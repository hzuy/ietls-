/**
 * draftService.js
 * Manages in-progress exam drafts in localStorage.
 * Key format: ielts_draft_{userId}_{examId}_{skillType}
 *
 * `data` là payload tuỳ kỹ năng:
 *   reading / listening → { [questionId]: answer }
 *   writing             → { essays: { [taskId]: text }, submittedTaskIds: number[] }
 *   speaking            → { transcripts: { [partId]: text }, submittedPartIds: number[] }
 */

const PREFIX = 'ielts_draft'

// Draft quá 7 ngày coi như bị bỏ — không mời resume nữa, và bị dọn khỏi localStorage.
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

// True nếu draft đã quá hạn. savedAt không parse được (NaN) → KHÔNG coi là hết hạn
// (an toàn: giữ nguyên hành vi cũ thay vì xoá nhầm).
function isExpired(draft) {
  const t = Date.parse(draft?.savedAt)
  if (Number.isNaN(t)) return false
  return Date.now() - t > DRAFT_TTL_MS
}

/**
 * Build a unique draft key.
 * @param {string|number} userId
 * @param {string|number} examId  — the DB exam id (e.g. reading exam id)
 * @param {string} skillType      — 'reading' | 'listening' | 'writing' | 'speaking'
 */
function draftKey(userId, examId, skillType) {
  return `${PREFIX}_${userId}_${examId}_${skillType}`
}

/**
 * Có phải "rỗng thực sự" không — không chứa nội dung gì đáng lưu.
 * Đệ quy để xử lý được cả map phẳng (reading/listening) lẫn shape lồng
 * (writing: { essays, submittedTaskIds } / speaking: { transcripts, submittedPartIds }).
 */
export function isDataEmpty(data) {
  if (data == null) return true
  if (typeof data === 'string') return data.trim() === ''
  if (Array.isArray(data)) return data.every(isDataEmpty)
  if (typeof data === 'object') {
    const values = Object.values(data)
    return values.length === 0 || values.every(isDataEmpty)
  }
  return false // number / boolean → coi là có nội dung
}

/**
 * Save a draft.
 * @param {{ userId, examId, skillType, data, timeRemaining, examTitle, totalQuestions, highlights }} payload
 * `highlights` (Reading) — optional list of text-highlight ranges the thí sinh đã tô,
 * đồng bộ cùng answers/timeRemaining ở mỗi lần autosave. Field độc lập với `data` nên
 * không ảnh hưởng isDataEmpty() / các skill khác không gửi field này.
 */
export function saveDraft({ userId, examId, skillType, data, timeRemaining, examTitle, totalQuestions, highlights }) {
  if (!userId || !examId || !skillType) return
  const key = draftKey(userId, examId, skillType)
  const payload = {
    userId,
    examId,
    skillType,
    data: data || {},
    timeRemaining: timeRemaining ?? null,
    savedAt: new Date().toISOString(),
    examTitle: examTitle ?? null,
    totalQuestions: totalQuestions ?? null,
    highlights: highlights ?? [],
  }
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {
    console.warn('[draftService] Failed to save draft:', e)
  }
}

/**
 * Get the most recent in-progress draft for a user.
 * @param {string|number} userId
 * @returns {object|null}
 */
export function getLatestDraft(userId) {
  if (!userId) return null
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(`${PREFIX}_${userId}_`))
    let best = null
    for (const k of keys) {
      const item = localStorage.getItem(k)
      if (!item) continue
      try {
        const d = JSON.parse(item)
        if (d && !isExpired(d) && !isDataEmpty(d.data)) {
          if (!best || Date.parse(d.savedAt) > Date.parse(best.savedAt)) {
            best = d
          }
        }
      } catch {
        // ignore parse error
      }
    }
    return best
  } catch {
    return null
  }
}

/**
 * Load a draft.
 * @returns {object|null}
 */
export function loadDraft(userId, examId, skillType) {
  if (!userId || !examId || !skillType) return null
  try {
    const raw = localStorage.getItem(draftKey(userId, examId, skillType))
    const draft = raw ? JSON.parse(raw) : null
    // Lớp 1 (bỏ qua): draft quá hạn → coi như không tồn tại. checkDraft gọi
    // loadDraft nên tự kế thừa (badge biến mất, resume không nạp). Không xoá ở đây.
    if (draft && isExpired(draft)) return null
    // Backward-compat: drafts lưu trước khi đổi field `answers` → `data`
    if (draft && draft.data === undefined && draft.answers !== undefined) {
      draft.data = draft.answers
    }
    return draft
  } catch {
    return null
  }
}

/**
 * Delete a draft after submission.
 */
export function clearDraft(userId, examId, skillType) {
  if (!userId || !examId || !skillType) return
  try {
    localStorage.removeItem(draftKey(userId, examId, skillType))
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Lớp 2 (dọn nền): quét mọi key `ielts_draft_*` trong localStorage, xoá hẳn cái
 * quá hạn. An toàn vì lớp 1 (loadDraft/checkDraft) đã ngừng dùng chúng từ trước.
 * Gọi 1 lần lúc app mount. Mỗi key bọc try/catch riêng — 1 key hỏng không chặn phần còn lại.
 */
export function purgeExpiredDrafts() {
  let keys
  try {
    keys = Object.keys(localStorage).filter(k => k.startsWith(`${PREFIX}_`))
  } catch {
    return
  }
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      if (isExpired(JSON.parse(raw))) localStorage.removeItem(key)
    } catch {
      // key rác / JSON hỏng → bỏ qua, không xoá (giữ an toàn)
    }
  }
}

/**
 * Format một mốc thời gian lưu nháp thành "HH:mm" cho indicator ở header runner.
 * Nhận Date | ISO string | epoch ms. Trả '' nếu null/không hợp lệ.
 */
export function formatSavedAt(value) {
  if (value == null) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Check if a draft exists with real content. Returns { hasDraft, savedAt, timeRemaining }.
 */
export function checkDraft(userId, examId, skillType) {
  const draft = loadDraft(userId, examId, skillType)
  if (!draft || isDataEmpty(draft.data)) return { hasDraft: false }
  return {
    hasDraft: true,
    savedAt: draft.savedAt,
    timeRemaining: draft.timeRemaining,
  }
}
