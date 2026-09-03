import { useCallback, useEffect, useRef, useState } from 'react'

import {
  saveDraft,
  loadDraft,
  clearDraft as clearDraftEntry,
  isDataEmpty,
} from '../services/draftService'

const AUTOSAVE_INTERVAL_MS = 30_000

/**
 * usePracticeDraft — autosave + resume cho màn làm bài luyện tập lẻ
 * (`PracticeExamPage` → `ReadingPracticeExam` / `ListeningPracticeExam`).
 *
 * Vì sao TÁCH RIÊNG khỏi ReadingExam/ListeningExam runner (không copy-paste):
 *
 *  1. BẪY KEY-COLLISION. Practice dùng bảng `PracticeExam` có PK riêng, TRÙNG dải
 *     số với bảng `Exam` của 4 skill chính (đã xác nhận bằng data thật: `id = 19`
 *     tồn tại ở CẢ hai bảng, cùng `skill = listening`). Key draft là
 *     `ielts_draft_{userId}_{examId}_{skillType}` → nếu Practice lưu dưới
 *     `skillType = 'listening'` sẽ ĐÈ draft của bài thi Listening chính id 19.
 *     → Caller PHẢI truyền `skillType` là `'practice-reading'` / `'practice-listening'`.
 *     Hook KHÔNG tự ghép prefix — namespace là trách nhiệm của caller.
 *
 *  2. KHÔNG có entry point `?resume=true`. FullTestDetail cấp `?resume=true` cho 4
 *     skill chính; Practice không có. Resume ở đây do start-screen tự quyết:
 *     `checkDraftOnMount()` lúc mount → nếu có draft, hiện nút "Tiếp tục".
 *
 * `draftService.js` được tái dùng NGUYÊN TRẠNG (TTL 7 ngày, shim field `answers`
 * cũ, `isDataEmpty` đệ quy) — hook này không sửa gì ở đó.
 *
 * Pattern autosave giống 4 skill chính: MỘT interval sống suốt phiên 'exam', deps
 * ổn định, đọc state mới nhất qua ref → tránh bug "interval teardown mỗi giây vì
 * timeLeft/answers nằm trong deps" (đã sửa + có regression guard trong
 * `examAutosave.test.jsx`).
 *
 * @param {object} p
 * @param {string|number} p.examId    `PracticeExam.id`.
 * @param {string} p.skillType        `'practice-reading'` | `'practice-listening'`.
 * @param {object} p.answers          State đáp án hiện tại (map phẳng { [qKey]: value }).
 * @param {number} p.timeLeft         Giây còn lại — lưu kèm để resume khôi phục đồng hồ.
 * @param {string|number|null} p.userId  Người dùng đăng nhập; falsy → hook bất hoạt.
 * @param {boolean} p.enabled         `true` khi đang ở `phase === 'exam'` → bật interval 30s.
 *
 * @returns {{
 *   checkDraftOnMount: () => { hasDraft: boolean, savedAt: string|null, timeRemaining: number|null, data: object|null },
 *   persistDraftNow: () => void,
 *   clearDraft: () => void,
 *   markSaved: (answers: object, savedAt?: string|number|Date|null) => void,
 *   lastSavedAt: Date | null,
 *   hasUnsavedChanges: boolean,
 * }}
 *   checkDraftOnMount — gọi 1 lần lúc mount (khi đã có userId). Trả cả `data` để
 *     start-screen prefill khi người dùng bấm "Tiếp tục".
 *   persistDraftNow — ghi draft NGAY (dùng cho interval + `onBeforeExit` của useExitGuard).
 *     Có guard P3-2: đáp án rỗng KHÔNG đè một draft cũ còn nội dung.
 *   clearDraft — xoá draft (gọi SAU `exitGuard.disarm()` khi nộp bài thành công).
 *   markSaved — đánh dấu bộ đáp án vừa nạp là "đã lưu": đồng bộ snapshot (để guard
 *     không nổ nhầm ngay sau resume) + set `lastSavedAt` từ mốc lưu của draft.
 *   lastSavedAt — mốc lưu nháp gần nhất cho indicator header; `null` khi chưa lưu lần nào.
 *   hasUnsavedChanges — `answers` hiện tại khác bộ đã ghi vào draft gần nhất.
 */
export function usePracticeDraft({ examId, skillType, answers, timeLeft, userId, enabled }) {
  // Ref "giá trị mới nhất" — sync mỗi render (effect KHÔNG deps). Đọc trong
  // interval/callback để không phải đưa answers/timeLeft vào deps (đổi liên tục →
  // interval bị teardown + setup lại mỗi giây → không bao giờ đạt mốc 30s).
  const latestRef = useRef({ answers, timeLeft, userId })
  useEffect(() => {
    latestRef.current = { answers, timeLeft, userId }
  })

  // Snapshot JSON của đáp án đã ghi vào draft gần nhất. Dùng STATE (không ref) →
  // đổi kéo re-render → `hasUnsavedChanges` phản ánh đúng ngay lập tức.
  const [savedSnapshot, setSavedSnapshot] = useState('{}')
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const persistDraftNow = useCallback(() => {
    const { answers, timeLeft, userId } = latestRef.current
    if (!userId || !examId) return
    // P3-2: đáp án rỗng KHÔNG được đè một draft cũ còn nội dung (vd người dùng bấm
    // "Làm lại từ đầu" → answers = {} → thoát ngay trước lần autosave kế tiếp).
    if (isDataEmpty(answers)) {
      const existing = loadDraft(userId, examId, skillType)
      if (existing && !isDataEmpty(existing.data)) return
    }
    saveDraft({ userId, examId, skillType, data: answers, timeRemaining: timeLeft })
    setSavedSnapshot(JSON.stringify(answers))
    setLastSavedAt(new Date())
  }, [examId, skillType])

  // MỘT interval sống suốt phiên 'exam'. Deps chỉ [enabled, persistDraftNow];
  // persistDraftNow ổn định (deps [examId, skillType] — 2 giá trị bất biến trong
  // vòng đời component). → interval setup đúng 1 lần, fire mỗi 30s.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(persistDraftNow, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [enabled, persistDraftNow])

  const checkDraftOnMount = useCallback(() => {
    const { userId } = latestRef.current
    const draft = userId && examId ? loadDraft(userId, examId, skillType) : null
    if (!draft || isDataEmpty(draft.data)) {
      return { hasDraft: false, savedAt: null, timeRemaining: null, data: null }
    }
    return {
      hasDraft: true,
      savedAt: draft.savedAt ?? null,
      timeRemaining: draft.timeRemaining ?? null,
      data: draft.data,
    }
  }, [examId, skillType])

  const clearDraft = useCallback(() => {
    const { userId } = latestRef.current
    if (!userId || !examId) return
    clearDraftEntry(userId, examId, skillType)
    setSavedSnapshot('{}')
    setLastSavedAt(null)
  }, [examId, skillType])

  const markSaved = useCallback((nextAnswers, savedAt) => {
    setSavedSnapshot(JSON.stringify(nextAnswers ?? {}))
    if (savedAt != null) {
      const d = new Date(savedAt)
      if (!Number.isNaN(d.getTime())) setLastSavedAt(d)
    }
  }, [])

  const hasUnsavedChanges = JSON.stringify(answers ?? {}) !== savedSnapshot

  return {
    checkDraftOnMount,
    persistDraftNow,
    clearDraft,
    markSaved,
    lastSavedAt,
    hasUnsavedChanges,
  }
}
