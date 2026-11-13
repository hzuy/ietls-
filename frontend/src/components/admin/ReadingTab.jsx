import { buildExamPayload, hydrateExamForm } from '../../utils/examAuthoring'
import { needsParagraphLetters, paragraphLettersAlert, syncParagraphGroups } from '../../utils/readingParagraphs'
import QuestionTypePicker from './QuestionTypePicker'
import ReadingPassagePreview from '../practice/ReadingPassagePreview'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { queryClient } from '../../lib/queryClient'
import api from '../../utils/axios'
import { showAlert } from '../../utils/alertUtils'
import { validateExamReading, formatValidationAlert } from '../../utils/questionValidation'
import { notifyTrashChanged } from '../../services/adminService'
import {
  READING_GROUP_TYPES,
  emptyReadingForm, emptyReadingGroupOf,
  recalcAllGroupNumbers,
  inputCls, labelCls, btnSecondary,
  useExamSeriesList, useSeriesBooks,
} from './adminConstants'
import InlinePreviewPanel from '../common/InlinePreviewPanel'
import Select from './Select'
import ExamList from './ExamList'
import AdminGroupPreview from '../practice/AdminGroupPreview'
import ReadingGroupEditor from './editors/ReadingGroupEditor'
import { Eye, ChevronDown, Volume2, History, BookOpen, Loader2 } from 'lucide-react'
import ExplanationConflictModal from './ExplanationConflictModal'
import OverwriteProtectedConfirmModal from './OverwriteProtectedConfirmModal'
import UnsavedChangesAIModal from './UnsavedChangesAIModal'
import ExamExplanationOverviewBadge from './ExamExplanationOverviewBadge'
import {
  mergeExamExplanations,
  normalizeFormForDirtyCheck,
  isExamFormDirty,
  calculateExamExplanationStats,
  isExplanationUnsupportedGroup,
  executeTimedAIGenerationLoop,
} from '../../utils/examExplanationUtils'
import { useExplanationGenerationLock } from '../../hooks/useExplanationGenerationLock'
import { useAIExitGuard } from '../../hooks/useAIExitGuard'
import AIGenerationStickyProgress from './AIGenerationStickyProgress'
import AIGenerationExitConfirmModal from './AIGenerationExitConfirmModal'
import AIGenerationResumeBanner from './AIGenerationResumeBanner'
import ExplanationRunPanel from './ExplanationRunPanel'
import { useToast } from '../../context/ToastContext'
import {
  createRunReport,
  createBlockedReport,
  addRunOutcome,
  finishRunReport,
  loadRunReport,
  saveRunReport,
  clearRunReport,
  makeRunReportKey,
  getRunReportCounts,
} from '../../utils/explanationRunReport'
import { DraftBanner } from './contentPageUI'
import {
  smartMergeDraft,
  analyzeDraftDifferences,
  extractExplanationsMap,
  isExplanationEqual,
} from '../../utils/draftMergeUtils'

// ─── TAB: READING ─────────────────────────────────────────────────────────────

function ReadingFormPreview({ form, showAnswers }) {
  const [activePassage, setActivePassage] = useState(0)
  const [leftPct, setLeftPct] = useState(50)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const passage = form.passages[activePassage]
  const sortedGroups = passage
    ? [...(passage.questionGroups || [])].sort((a, b) => a.qNumberStart - b.qNumberStart)
    : []

  const onDividerPointerDown = useCallback((e) => {
    e.preventDefault()
    const container = containerRef.current
    const divider = e.currentTarget
    if (!container) return

    // Capture the pointer on the divider itself so move/up events keep
    // firing even when the cursor is released outside the browser window.
    try { divider.setPointerCapture(e.pointerId) } catch { /* unsupported */ }
    setDragging(true)

    const onPointerMove = (ev) => {
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(75, Math.max(25, pct)))
    }
    const stop = () => {
      setDragging(false)
      try { divider.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      divider.removeEventListener('pointermove', onPointerMove)
      divider.removeEventListener('pointerup', stop)
      divider.removeEventListener('pointercancel', stop)
      window.removeEventListener('mouseleave', stop)
    }
    divider.addEventListener('pointermove', onPointerMove)
    divider.addEventListener('pointerup', stop)
    divider.addEventListener('pointercancel', stop)
    // Fallback: end the drag if the mouse leaves the window entirely.
    window.addEventListener('mouseleave', stop)
  }, [])

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {form.passages.length > 1 && (
        <div className="flex gap-2 mb-3 shrink-0">
          {form.passages.map((p, pi) => (
            <button
              key={pi}
              type="button"
              onClick={() => setActivePassage(pi)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                activePassage === pi
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              Passage {p.number}
            </button>
          ))}
        </div>
      )}
      {passage && (
        <div
          ref={containerRef}
          className="flex flex-1 border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs"
          style={{ userSelect: dragging ? 'none' : 'auto' }}
        >
          {/* Left: Passage text */}
          <div className="overflow-y-auto bg-white px-8 py-6" style={{ width: `${leftPct}%`, flexShrink: 0 }}>
            <ReadingPassagePreview {...passage} />
          </div>

          {/* Divider */}
          <div
            onPointerDown={onDividerPointerDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, touchAction: 'none', background: dragging ? '#18181b' : '#e4e4e7', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#a1a1aa' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e4e4e7' }}
          />

          {/* Right: Questions */}
          <div className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-6">
            {sortedGroups.length > 0 ? (
              <div className="space-y-4">
                {sortedGroups.map((group, gi) => (
                  <AdminGroupPreview skill="reading" practice={false} key={gi} group={group} showAnswers={showAnswers} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic text-center mt-10">Chưa có câu hỏi cho passage này</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SpeakingFormPreview({ form }) {
  const [activePart, setActivePart] = useState(1)
  const [activeQIdx, setActiveQIdx] = useState(0)

  const handlePartChange = (p) => {
    setActivePart(p)
    setActiveQIdx(0)
  }

  const p1Questions = (form.part1?.questions || []).filter(q => typeof q === 'string' && q.trim())
  const p3Questions = (form.part3?.questions || []).filter(q => typeof q === 'string' && q.trim()).length > 0
    ? (form.part3?.questions || []).filter(q => typeof q === 'string' && q.trim())
    : (form.part3?.topics || []).flatMap(t => t.questions || []).filter(q => typeof q === 'string' && q.trim())

  const PART_META = {
    1: { title: 'Part 1 — Introduction & Interview', questions: p1Questions, description: form.part1?.description },
    2: { title: 'Part 2 — Individual Long Turn' },
    3: { title: 'Part 3 — Two-way Discussion', questions: p3Questions, description: form.part3?.description },
  }

  const currentQuestions = PART_META[activePart]?.questions || []
  const safeQIdx = Math.min(activeQIdx, Math.max(0, currentQuestions.length - 1))
  const activeQuestionText = currentQuestions[safeQIdx] || ''

  return (
    <div className="space-y-4 overflow-y-auto flex-1 p-1">
      {/* Part tabs */}
      <div className="flex gap-2">
        {[1, 2, 3].map(p => (
          <button
            key={p}
            type="button"
            onClick={() => handlePartChange(p)}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer border ${
              activePart === p
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            Part {p}
          </button>
        ))}
      </div>

      {/* Main card simulating SpeakingExam UI */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs">
        {activePart === 2 ? (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500 text-indigo-600 font-bold text-xs bg-indigo-50/50">
                  <History className="w-3.5 h-3.5" /> 01:00 Chuẩn bị
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-300 text-zinc-600 font-bold text-xs bg-zinc-50">
                  02:00 Nói
                </span>
              </div>
              <p className="text-xs text-zinc-500 italic">
                *Bạn có 1 phút để chuẩn bị và ghi chú cho chủ đề, sau đó có 2 phút để nói.
              </p>
            </div>

            {form.part2?.instructions && (
              <p className="text-xs text-zinc-600 italic bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                {form.part2.instructions}
              </p>
            )}

            {/* Split Cue Card & Notes */}
            <div className="flex flex-col md:flex-row gap-4 min-h-[260px]">
              {/* Left: Cue Card */}
              <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs text-left">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-zinc-100">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Cue Card</span>
                  <span className="text-[11px] font-medium text-zinc-400">Đề bài</span>
                </div>
                {form.part2?.cueCard ? (
                  <div className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {form.part2.cueCard}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 italic">Chưa có nội dung Cue Card</p>
                )}
              </div>

              {/* Right: Candidate Notes */}
              <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-zinc-100">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Ghi chú của thí sinh</span>
                  <span className="text-[11px] font-medium text-zinc-400">Nháp</span>
                </div>
                <div className="flex-1 rounded-xl bg-zinc-50/70 border border-dashed border-zinc-200 p-4 text-xs text-zinc-400 italic flex items-center justify-center text-center">
                  Ghi chú ở đây... (Khu vực thí sinh nháp ý tưởng trong thời gian chuẩn bị 1 phút)
                </div>
              </div>
            </div>

            {/* Bottom Bar Part 2 */}
            <div className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 flex items-center justify-between shadow-2xs mt-2">
              <p className="text-xs sm:text-sm text-indigo-600 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                Đang có 1 phút để ghi chú...
              </p>
              <button
                type="button"
                disabled
                className="px-6 py-2 rounded-full font-bold text-xs sm:text-sm border-2 border-indigo-500 text-indigo-600 bg-white opacity-90 cursor-default"
              >
                Đã chuẩn bị xong
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top subtitle */}
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-zinc-900 mb-1">
                {PART_META[activePart].title}
              </h2>
              <p className="text-xs text-zinc-500 italic">
                *Trả lời câu hỏi, sau đó nhấn Ghi nhận câu trả lời để sang câu tiếp theo.
              </p>
              {PART_META[activePart].description && (
                <p className="text-xs text-zinc-600 italic bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 max-w-xl mx-auto mt-2.5">
                  {PART_META[activePart].description}
                </p>
              )}
            </div>

            {/* Question selector tabs */}
            {currentQuestions.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {currentQuestions.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveQIdx(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
                      safeQIdx === idx
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    Câu {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Hero active question box (SpeakingExam signature styling) */}
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-50/50 rounded-2xl border border-zinc-200 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
                {currentQuestions.length > 0 ? `Câu hỏi ${safeQIdx + 1} / ${currentQuestions.length}` : 'Chưa có câu hỏi'}
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[#c026d3] flex items-center justify-center gap-3 text-center leading-relaxed max-w-3xl px-4 mb-4">
                <span className="w-8 h-8 flex items-center justify-center rounded-full border-[2.5px] border-[#c026d3] text-[#c026d3] shrink-0 font-bold bg-white text-sm">?</span>
                <span>{activeQuestionText || 'Chưa nhập nội dung câu hỏi cho phần này'}</span>
              </h3>
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-50 text-blue-500 shadow-inner border border-blue-100">
                <Volume2 className="w-6 h-6" />
              </div>
            </div>


            {/* Bottom Bar: Voice recording mockup */}
            <div className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="text-cyan-600 font-bold text-xs sm:text-sm">Đang ghi âm (Mô phỏng)...</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-end gap-1.5 h-8 w-24 justify-center">
                  {[10, 18, 28, 20, 14, 26, 16].map((h, i) => (
                    <div key={i} className="w-1.5 bg-cyan-400 rounded-full" style={{ height: `${h}px` }} />
                  ))}
                </div>
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-2xs relative bg-white border-2 border-indigo-500">
                  <span className="text-xs font-bold text-indigo-900 font-mono">00:00</span>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm bg-indigo-700 text-white opacity-90 cursor-default"
              >
                Ghi nhận câu trả lời
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// ─── TAB: READING ─────────────────────────────────────────────────────────────

const DRAFT_PREFIX = 'draft_reading_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function ReadingTab({ exams, onRefresh, examSeries = [], paginationData, fetchExams, loading, loadError }) {
  const [form, setForm] = useState(emptyReadingForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const saveInFlightRef = useRef(false)
  const loadSequenceRef = useRef(0)
  const latestFormRef = useRef(form)
  useEffect(() => { latestFormRef.current = form }, [form])
  const [openPassage, setOpenPassage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [addingGroupPassage, setAddingGroupPassage] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const { showToast } = useToast()
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiConflicts, setAiConflicts] = useState([])
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [overwriteModalOpen, setOverwriteModalOpen] = useState(false)
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)
  const [protectedStats, setProtectedStats] = useState({ reviewedCount: 0, editedCount: 0 })
  const formRef = useRef(null)
  const previewRef = useRef(null)
  const pristineFormSigRef = useRef('')

  const examStats = useMemo(() => calculateExamExplanationStats(form), [form])

  const countProtectedQuestions = () => {
    let reviewedCount = 0
    let editedCount = 0
    for (const p of (form.passages || [])) {
      for (const g of (p.questionGroups || [])) {
        for (const q of (g.questions || [])) {
          if (q.explanation?.status === 'teacher_reviewed') reviewedCount++
          if (q.explanation?.status === 'teacher_edited') editedCount++
        }
      }
    }
    return { reviewedCount, editedCount }
  }

  const [generatingGroupId, setGeneratingGroupId] = useState(null)
  const [aiProgress, setAiProgress] = useState(null)
  const [isCancellingAI, setIsCancellingAI] = useState(false)
  const isCancellingAIRef = useRef(false)
  const abortControllerRef = useRef(null)
  const pendingAIFnRef = useRef(null)
  const pristineExplanationsRef = useRef({})

  // ─── Run report (UI-only, session scoped) ───────────────────────────────────
  // Không ghi DB. Báo cáo giữ được khi F5 trong cùng phiên và tự mất sau 24h.
  const runReportKey = useMemo(
    () => (editingId ? makeRunReportKey('reading', editingId) : null),
    [editingId]
  )
  const [runReport, setRunReport] = useState(null)
  const [runStatusByNumber, setRunStatusByNumber] = useState({})
  const runPanelRef = useRef(null)

  useEffect(() => {
    if (!runReportKey) {
      setRunReport(null)
      setRunStatusByNumber({})
      return
    }
    setRunReport(loadRunReport(runReportKey))
    setRunStatusByNumber({})
  }, [runReportKey])

  const persistRunReport = useCallback((next) => {
    setRunReport(next)
    if (runReportKey) saveRunReport(runReportKey, next)
  }, [runReportKey])

  const markRunStatus = useCallback((numbers, status) => {
    if (!Array.isArray(numbers) || numbers.length === 0) return
    setRunStatusByNumber(prev => {
      const next = { ...prev }
      for (const raw of numbers) {
        const num = Number(raw)
        if (!Number.isInteger(num) || num <= 0) continue
        next[num] = status
      }
      return next
    })
  }, [])

  // Bắt đầu một lần chạy mới: bỏ mọi trạng thái còn sót của lần trước để chip
  // không hiển thị lỗi cũ cho những câu không nằm trong lần chạy này.
  const beginRunStatus = useCallback((numbers, status = 'queued') => {
    const next = {}
    for (const raw of numbers || []) {
      const num = Number(raw)
      if (Number.isInteger(num) && num > 0) next[num] = status
    }
    setRunStatusByNumber(next)
  }, [])

  const clearPendingRunStatus = useCallback(() => {
    setRunStatusByNumber(prev => {
      const next = {}
      for (const [key, value] of Object.entries(prev)) {
        if (value !== 'queued' && value !== 'generating') next[key] = value
      }
      return next
    })
  }, [])

  // Trạng thái cuối của một nhóm: lỗi > cần kiểm tra > xong. Khi huỷ, các câu
  // chưa kịp sinh được trả về "không có trạng thái" thay vì báo xong sai.
  const finalizeRunStatus = useCallback((numbers, loopResult, { cancelled = false } = {}) => {
    const nums = (Array.isArray(numbers) ? numbers : []).map(Number).filter(n => Number.isInteger(n) && n > 0)
    if (nums.length === 0) return
    const errorNums = new Set((loopResult?.errors || []).map(e => Number(e?.number)).filter(Boolean))
    const retryNums = new Set((loopResult?.needsRetryQuestions || [])
      .map(item => Number(typeof item === 'object' ? item?.number : item))
      .filter(Boolean))
    const hasUnnumberedError = (loopResult?.errors || []).some(e => !Number(e?.number))

    setRunStatusByNumber(prev => {
      const next = { ...prev }
      for (const num of nums) {
        if (retryNums.has(num)) { next[num] = 'retry'; continue }
        if (errorNums.has(num)) { next[num] = 'error'; continue }
        if (hasUnnumberedError && !cancelled) {
          // Lỗi không gắn với câu cụ thể (409/timeout cả nhóm): giữ nguyên các
          // câu đã sinh xong, đánh dấu lỗi cho phần chưa xong.
          if (next[num] !== 'done') next[num] = 'error'
          continue
        }
        if (cancelled) {
          if (next[num] === 'generating' || next[num] === 'queued') delete next[num]
          continue
        }
        next[num] = 'done'
      }
      return next
    })
  }, [])

  const applyChunkStatus = useCallback((sentNumbers, data) => {
    const sent = (Array.isArray(sentNumbers) ? sentNumbers : []).map(Number).filter(Boolean)
    const errors = (data?.errors || []).map(item => Number(item?.number)).filter(Boolean)
    const retries = (data?.needsRetryQuestions || [])
      .map(item => Number(typeof item === 'object' ? item?.number : item))
      .filter(Boolean)
    const remaining = Array.isArray(data?.remainingQuestionNumbers)
      ? data.remainingQuestionNumbers.map(Number).filter(Boolean)
      : null

    setRunStatusByNumber(prev => {
      const next = { ...prev }
      for (const num of sent) {
        if (next[num] === 'error' || next[num] === 'retry') continue
        next[num] = 'done'
      }
      for (const num of errors) next[num] = 'error'
      for (const num of retries) next[num] = 'retry'
      for (const num of remaining || []) {
        if (!next[num] || next[num] === 'done') next[num] = 'queued'
      }
      return next
    })
  }, [])

  const focusExplanationGroup = useCallback((groupId) => {
    if (groupId == null) return
    const target = document.querySelector(`[data-explanation-group-id="${groupId}"]`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('ring-2', 'ring-amber-300')
    setTimeout(() => target.classList.remove('ring-2', 'ring-amber-300'), 1600)
  }, [])

  const generatingQuestionNumbers = useMemo(() => {
    const set = new Set()
    for (const [num, status] of Object.entries(runStatusByNumber)) {
      if (status === 'generating') set.add(Number(num))
    }
    return set
  }, [runStatusByNumber])

  const runErrorMessageByNumber = useMemo(() => {
    const map = {}
    for (const row of runReport?.rows || []) {
      if (row.number != null) map[row.number] = row.message
    }
    return map
  }, [runReport])

  const runCounts = useMemo(() => getRunReportCounts(runReport), [runReport])

  // Báo cáo "thành công trọn vẹn" không cần chiếm chỗ trên trang; chỉ hiện khi
  // có lỗi, có câu cần kiểm tra, đang chạy, bị huỷ hoặc bị gián đoạn.
  const runReportForPanel = useMemo(() => {
    if (!runReport) return null
    if (runReport.status === 'done' && (runReport.needsRetry || []).length === 0) return null
    return runReport
  }, [runReport])

  const groupNumbersOf = useCallback((group) => {
    if (!group) return []
    if (Array.isArray(group.questions) && group.questions.length > 0) {
      return group.questions.map(q => Number(q?.number)).filter(Boolean)
    }
    const start = Number(group.qNumberStart)
    const end = Number(group.qNumberEnd)
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return []
    const list = []
    for (let num = start; num <= end; num++) list.push(num)
    return list
  }, [])

  // Concurrency lock, multi-tab sync, grace window & exit confirmation hook
  const expLock = useExplanationGenerationLock({
    examId: editingId,
    type: 'exam',
    skill: 'reading',
    enabled: !!editingId,
    onResumeGenerate: (unprocessedNums) => {
      handleGenerateSequentialAll({ questionNumbers: unprocessedNums })
    },
  })

  // Chặn rời trang (sidebar/tab/link) khi AI đang chạy: mở modal xác nhận thay
  // vì âm thầm unmount để request tiếp tục ghi dữ liệu ngầm.
  useAIExitGuard({
    active: expLock.isGenerating,
    onBlocked: expLock.openExitConfirm,
  })

  // Compare explanations with DB snapshot to detect unsaved changes
  const unsavedQuestionNumbers = useMemo(() => {
    if (!editingId || !pristineExplanationsRef.current) return new Set()
    const set = new Set()
    const currentExps = extractExplanationsMap(form)
    for (const [k, exp] of Object.entries(currentExps)) {
      const qNum = Number(k)
      if (!qNum) continue
      const pristineExp = pristineExplanationsRef.current[qNum]
      if (!isExplanationEqual(exp, pristineExp)) {
        set.add(qNum)
      }
    }
    return set
  }, [form, editingId])

  // Analyze differences between draft in localStorage and active DB form
  const draftDiffInfo = useMemo(() => {
    if (!draftBanner?.data) return null
    return analyzeDraftDifferences({
      draftData: draftBanner.data,
      currentDbForm: form,
      draftSavedAt: draftBanner.savedAt ?? null,
    })
  }, [draftBanner, form])

  const handleRestoreDraft = (resolutionChoice = null) => {
    if (!draftBanner?.data) return
    // Không có lựa chọn rõ ràng -> dùng khuyến nghị dựa trên mốc thời gian
    // (nháp lưu sau lần cập nhật cuối của DB thì ưu tiên bản nháp).
    const effectiveChoice = resolutionChoice
      || draftDiffInfo?.recommendedChoice
      || 'keep_db'
    const merged = smartMergeDraft({
      draftData: draftBanner.data,
      currentDbForm: form,
      resolutionChoice: effectiveChoice,
      draftSavedAt: draftBanner.savedAt ?? null,
    })
    setForm(merged)
    setDraftBanner(null)
    showToast(
      effectiveChoice === 'keep_draft'
        ? 'Đã khôi phục bản nháp gồm các giải thích đã sửa'
        : 'Đã khôi phục bản nháp'
    )
  }

  const handleCancelAI = () => {
    isCancellingAIRef.current = true
    setIsCancellingAI(true)
    expLock.setIsCancelling(true)
    abortControllerRef.current?.abort()
  }

  const countGroupProtected = (g) => {
    let reviewedCount = 0
    let editedCount = 0
    for (const q of (g.questions || [])) {
      if (q.explanation?.status === 'teacher_reviewed') reviewedCount++
      if (q.explanation?.status === 'teacher_edited') editedCount++
    }
    return { reviewedCount, editedCount }
  }

  const proceedWithAIGeneration = () => {
    const stats = countProtectedQuestions()
    if (stats.reviewedCount + stats.editedCount > 0) {
      setProtectedStats(stats)
      setOverwriteModalOpen(true)
    } else {
      handleGenerateSequentialAll({ overwriteProtected: false })
    }
  }

  const proceedWithGroupAIGeneration = (group) => {
    const stats = countGroupProtected(group)
    if (stats.reviewedCount + stats.editedCount > 0) {
      setProtectedStats(stats)
      setOverwriteModalOpen(true)
    } else {
      handleGenerateGroupAI(group, { overwriteProtected: false })
    }
  }

  const handleStartGenerateAI = () => {
    if (!editingId || generatingAI) return
    const val = validateExamReading(form)
    if (!val.isValid) {
      const msg = formatValidationAlert('Không thể tạo giải thích bằng AI', val.errors)
      persistRunReport(createBlockedReport({
        examId: editingId,
        skill: 'reading',
        message: `Có ${val.errors.length} lỗi cần sửa trước khi sinh giải thích.`,
        details: String(msg).split('\n').filter(Boolean),
      }))
      showToast(`Chưa thể sinh AI: có ${val.errors.length} lỗi cần sửa. Xem chi tiết trong báo cáo.`, 'error')
      return
    }
    pendingAIFnRef.current = (opts) => handleGenerateSequentialAll(opts)
    if (isExamFormDirty(form, pristineFormSigRef.current)) {
      setUnsavedModalOpen(true)
      return
    }
    proceedWithAIGeneration()
  }

  const handleRetryFailedAI = (numbers) => {
    if (!editingId || expLock.isLockedGenerate) return
    pendingAIFnRef.current = (opts = {}) => handleGenerateSequentialAll({
      ...opts, questionNumbers: numbers, overwriteProtected: false,
    })
    if (isExamFormDirty(form, pristineFormSigRef.current)) {
      setUnsavedModalOpen(true)
      return
    }
    pendingAIFnRef.current()
  }

  const handleStartGenerateGroupAI = (group) => {
    if (!editingId || generatingAI) return
    if (!group || !group.id) {
      showToast('Vui lòng lưu đề thi trước khi sinh AI cho nhóm câu hỏi mới tạo.', 'info')
      return
    }
    pendingAIFnRef.current = (opts) => handleGenerateGroupAI(group, opts)
    if (isExamFormDirty(form, pristineFormSigRef.current)) {
      setUnsavedModalOpen(true)
      return
    }
    proceedWithGroupAIGeneration(group)
  }

  const handleGenerateGroupAI = async (group, { resolveChoices = {}, overwriteProtected = false, questionNumbers = null } = {}) => {
    if (!editingId) return
    group = latestFormRef.current.passages.flatMap(p => p.questionGroups || []).find(g => (group?.id != null && g.id === group.id) || (group?._id != null && g._id === group._id)) || group

    const isRetryScope = Array.isArray(questionNumbers) && questionNumbers.length > 0
    const targetNumbers = isRetryScope
      ? questionNumbers.map(Number).filter(n => Number.isInteger(n) && n > 0)
      : groupNumbersOf(group)

    setGeneratingAI(true)
    setIsCancellingAI(false)
    isCancellingAIRef.current = false
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setGeneratingGroupId(group.id)
    setAiProgress({ current: 0, total: targetNumbers.length, groupLabel: `nhóm câu ${group.qNumberStart}–${group.qNumberEnd}` })

    const totalTarget = targetNumbers.length
    expLock.startLocalGeneration({
      abortController,
      total: totalTarget,
      current: 0,
    })

    // Báo cáo mới cho lần chạy này (ghi đè báo cáo cũ của cùng đề).
    const report = createRunReport({
      examId: editingId,
      skill: 'reading',
      scope: isRetryScope ? 'retry' : 'group',
      totalGroups: 1,
      totalQuestions: totalTarget,
    })
    persistRunReport(report)
    beginRunStatus(targetNumbers, 'generating')

    let loopResult = null
    let caughtError = null

    try {
      loopResult = await executeTimedAIGenerationLoop({
        fetchChunk: (payload, opts) => {
          expLock.notifyChunkStart({
            current: aiProgress?.current || 0,
            total: totalTarget,
          })
          return api.post(`/admin/exams/${editingId}/groups/${group.id}/generate-explanations`, payload, opts)
        },
        basePayload: { force: true, overwriteProtected, resolveChoices },
        signal: abortController.signal,
        initialQuestionNumbers: isRetryScope ? targetNumbers : null,
        onProgress: ({ current, total, data }) => {
          const countText = total > 0 ? ` (${current}/${total} câu)` : ''
          const p = {
            current,
            total,
            groupLabel: `nhóm câu ${group.qNumberStart}–${group.qNumberEnd}${countText}`,
          }
          setAiProgress(p)
          expLock.updateLocalProgress(p)
          if (data) applyChunkStatus(targetNumbers, data)
        },
        onChunkSuccess: async () => {
          expLock.notifyChunkEnd({
            current: aiProgress?.current || 0,
            total: totalTarget,
          })
          try {
            const fresh = await api.get(`/admin/exams/${editingId}`)
            if (fresh?.data) {
              setForm(prev => mergeExamExplanations(prev, fresh.data, resolveChoices))
              pristineExplanationsRef.current = extractExplanationsMap(fresh.data)
            }
          } catch (syncErr) {
            console.error('Lỗi đồng bộ lời giải mới vào form:', syncErr)
          }
        },
      })

      finalizeRunStatus(targetNumbers, loopResult, { cancelled: Boolean(loopResult.cancelled) })
      const nextReport = addRunOutcome(report, { group, loopResult, sentNumbers: targetNumbers })
      persistRunReport(finishRunReport(nextReport, { cancelled: Boolean(loopResult.cancelled) }))

      if (loopResult.cancelled) {
        showToast('Đã dừng tác vụ sinh AI. Các câu đã xong đã được lưu lại.', 'info')
      } else if (loopResult.hasConflicts) {
        setAiConflicts(loopResult.conflicts || [])
        setConflictModalOpen(true)
      } else if (loopResult.errors?.length || loopResult.needsRetryQuestions?.length) {
        showToast('Một số câu chưa sinh được. Xem báo cáo để biết lý do và thử lại các câu lỗi.', 'error')
      } else {
        showToast(`Đã tạo giải thích cho nhóm câu ${group.qNumberStart}–${group.qNumberEnd}!`)
        setConflictModalOpen(false)
      }
    } catch (err) {
      caughtError = err
      if (abortController.signal.aborted || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        finalizeRunStatus(targetNumbers, null, { cancelled: true })
        persistRunReport(finishRunReport(report, { cancelled: true }))
        showToast('Đã dừng tác vụ sinh AI. Các câu đã xong đã được lưu lại.', 'info')
      } else {
        finalizeRunStatus(targetNumbers, { errors: [err] })
        const nextReport = addRunOutcome(report, {
          group,
          loopResult: { errors: [err], totalGenerated: 0 },
          sentNumbers: targetNumbers,
        })
        persistRunReport(finishRunReport(nextReport))
        showToast('Không thể tạo giải thích cho nhóm này. Xem báo cáo để biết lý do.', 'error')
      }
    } finally {
      setGeneratingAI(false)
      setIsCancellingAI(false)
      setGeneratingGroupId(null)
      setAiProgress(null)
      clearPendingRunStatus()
      abortControllerRef.current = null
      const wasCancelled = Boolean(loopResult?.cancelled) || abortController.signal.aborted
      const hadErrors = Boolean(loopResult?.errors?.length) || Boolean(caughtError)
      expLock.endLocalGeneration({ completed: !wasCancelled && !hadErrors, cancelled: wasCancelled })
      if (!wasCancelled) onRefresh()
    }
  }

  const handleGenerateSequentialAll = async ({ resolveChoices = {}, overwriteProtected = false, questionNumbers = null } = {}) => {
    if (!editingId) return
    const val = validateExamReading(form)
    if (!val.isValid) {
      const msg = formatValidationAlert('Không thể tạo giải thích bằng AI', val.errors)
      persistRunReport(createBlockedReport({
        examId: editingId,
        skill: 'reading',
        message: `Có ${val.errors.length} lỗi cần sửa trước khi sinh giải thích.`,
        details: String(msg).split('\n').filter(Boolean),
      }))
      showToast(`Chưa thể sinh AI: có ${val.errors.length} lỗi cần sửa. Xem chi tiết trong báo cáo.`, 'error')
      return
    }

    const isRetryScope = Array.isArray(questionNumbers) && questionNumbers.length > 0
    const requestedNumbers = isRetryScope
      ? questionNumbers.map(Number).filter(n => Number.isInteger(n) && n > 0)
      : null
    const requestedSet = requestedNumbers ? new Set(requestedNumbers) : null

    let allGroups = (latestFormRef.current.passages || []).flatMap(p => p.questionGroups || [])
      .filter(g => !isExplanationUnsupportedGroup(g) && (g.questions?.length > 0 || (g.qNumberEnd >= g.qNumberStart)))

    if (requestedSet) {
      allGroups = allGroups.filter(g => groupNumbersOf(g).some(n => requestedSet.has(n)))
    }

    if (allGroups.length === 0) {
      persistRunReport(createBlockedReport({
        examId: editingId,
        skill: 'reading',
        message: 'Không có nhóm câu hỏi nào hỗ trợ tạo giải thích AI trong đề này.',
        details: ['Hãy kiểm tra lại loại câu hỏi của đề trước khi sinh giải thích.'],
      }))
      showToast('Không có nhóm câu hỏi nào hỗ trợ sinh giải thích AI. Xem chi tiết trong báo cáo.', 'info')
      return
    }

    // Với phạm vi "thử lại câu lỗi", chỉ gửi đúng các câu được yêu cầu.
    const numbersForGroup = (group) => {
      const nums = groupNumbersOf(group)
      if (!requestedSet) return nums
      return nums.filter(n => requestedSet.has(n))
    }

    const plannedNumbers = allGroups.flatMap(numbersForGroup)
    const totalQuestions = plannedNumbers.length

    setGeneratingAI(true)
    setIsCancellingAI(false)
    isCancellingAIRef.current = false
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setAiProgress({ current: 0, total: allGroups.length, groupLabel: '' })

    expLock.startLocalGeneration({
      abortController,
      total: totalQuestions,
      current: 0,
    })

    const report = createRunReport({
      examId: editingId,
      skill: 'reading',
      scope: isRetryScope ? 'retry' : 'all',
      totalGroups: allGroups.length,
      totalQuestions,
    })
    persistRunReport(report)
    beginRunStatus(plannedNumbers, 'queued')

    let totalGenerated = 0
    const accumulatedConflicts = []
    let latestReport = report
    let failedGroupCount = 0
    let stoppedByBusy = false

    for (let i = 0; i < allGroups.length; i++) {
      if (isCancellingAIRef.current || abortController.signal.aborted) break
      const group = allGroups[i]
      const groupNums = numbersForGroup(group)
      setGeneratingGroupId(group.id)
      markRunStatus(groupNums, 'generating')
      const groupLabel = `nhóm ${i + 1}/${allGroups.length} (Câu ${group.qNumberStart}–${group.qNumberEnd})`
      setAiProgress({ current: i + 1, total: allGroups.length, groupLabel })

      let loopResult = null

      try {
        loopResult = await executeTimedAIGenerationLoop({
          fetchChunk: (payload, opts) => {
            expLock.notifyChunkStart({
              current: totalGenerated,
              total: totalQuestions,
            })
            return api.post(
              `/admin/exams/${editingId}/groups/${group.id}/generate-explanations`,
              payload,
              opts
            )
          },
          basePayload: { force: true, overwriteProtected, resolveChoices },
          signal: abortController.signal,
          initialQuestionNumbers: requestedSet ? groupNums : null,
          onProgress: ({ current, total, data }) => {
            const subCountText = total > 0 ? ` [${current}/${total} câu]` : ''
            const p = {
              current: i + 1,
              total: allGroups.length,
              groupLabel: `nhóm ${i + 1}/${allGroups.length} (Câu ${group.qNumberStart}–${group.qNumberEnd})${subCountText}`,
            }
            setAiProgress(p)
            expLock.updateLocalProgress({
              current: totalGenerated + current,
              total: totalQuestions,
              label: `${totalGenerated + current}/${totalQuestions} câu`,
            })
            if (data) applyChunkStatus(groupNums, data)
          },
          onChunkSuccess: async () => {
            expLock.notifyChunkEnd({
              current: totalGenerated,
              total: totalQuestions,
            })
            try {
              const fresh = await api.get(`/admin/exams/${editingId}`)
              if (fresh?.data) {
                setForm(prev => mergeExamExplanations(prev, fresh.data, resolveChoices))
                pristineExplanationsRef.current = extractExplanationsMap(fresh.data)
              }
            } catch (syncErr) {
              console.error('Lỗi đồng bộ nhóm vào form:', syncErr)
            }
          },
        })

        totalGenerated += loopResult.totalGenerated || 0
        if (loopResult.hasConflicts && loopResult.conflicts?.length) {
          accumulatedConflicts.push(...loopResult.conflicts)
        }

        finalizeRunStatus(groupNums, loopResult, { cancelled: Boolean(loopResult.cancelled) })
        latestReport = addRunOutcome(latestReport, { group, loopResult, sentNumbers: groupNums })
        persistRunReport(latestReport)

        if (loopResult.cancelled) break
        if (loopResult.errors?.length) {
          failedGroupCount++
          // 409: dừng cả lượt, không đánh dấu các nhóm còn lại là "xong".
          if (loopResult.errors.some(e => e?.status === 409)) {
            stoppedByBusy = true
            break
          }
        }
      } catch (err) {
        if (abortController.signal.aborted || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') break
        failedGroupCount++
        finalizeRunStatus(groupNums, { errors: [err] })
        latestReport = addRunOutcome(latestReport, {
          group,
          loopResult: { errors: [err], totalGenerated: 0 },
          sentNumbers: groupNums,
        })
        persistRunReport(latestReport)
        if (err.response?.status === 409) {
          stoppedByBusy = true
          break
        }
      }

      if (isCancellingAIRef.current) break
    }

    const wasAborted = isCancellingAIRef.current || abortController.signal.aborted
    setGeneratingAI(false)
    setIsCancellingAI(false)
    setGeneratingGroupId(null)
    setAiProgress(null)
    clearPendingRunStatus()
    abortControllerRef.current = null
    expLock.endLocalGeneration({ completed: !wasAborted && failedGroupCount === 0, cancelled: Boolean(wasAborted) })

    const finishedReport = finishRunReport(latestReport, { cancelled: wasAborted })
    persistRunReport(finishedReport)

    try {
      const fresh = await api.get(`/admin/exams/${editingId}`)
      if (fresh?.data) {
        setForm(prev => mergeExamExplanations(prev, fresh.data, resolveChoices))
        pristineExplanationsRef.current = extractExplanationsMap(fresh.data)
      }
    } catch { /* Fresh data is best-effort; retain the current form on refresh failure. */ }

    onRefresh()

    const counts = getRunReportCounts(finishedReport)
    if (wasAborted) {
      showToast('Đã dừng tác vụ sinh AI. Các câu đã xong đã được lưu lại.', 'info')
    } else if (stoppedByBusy) {
      showToast('Tiến trình AI khác đang chạy cho đề này. Xem báo cáo để biết phần đã xong.', 'warning')
    } else if (counts.errors > 0 || counts.needsRetry > 0) {
      showToast(
        `Đã sinh ${counts.generated}/${totalQuestions} câu. Còn ${counts.errors} lỗi và ${counts.needsRetry} câu cần kiểm tra — xem báo cáo để thử lại.`,
        'error'
      )
    } else {
      showToast(`Đã tạo giải thích thành công cho toàn bộ ${allGroups.length} nhóm (${totalGenerated} câu)!`)
    }

    if (accumulatedConflicts.length > 0) {
      setAiConflicts(accumulatedConflicts)
      setConflictModalOpen(true)
    }
  }

  // Scroll the preview panel into view once it has rendered (not when hidden).
  useEffect(() => {
    if (showPreview) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showPreview])

  // On mount: purge stale draft_reading_* keys (older than 7 days) so
  // abandoned drafts don't accumulate in localStorage forever.
  useEffect(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith(DRAFT_PREFIX)) continue
        try {
          const parsed = JSON.parse(localStorage.getItem(k))
          const savedAt = parsed && parsed._savedAt
          // Drop drafts we can date to older than the max age. Drafts with no
          // timestamp (created before this field existed) are left alone —
          // they pick one up on the next autosave.
          if (savedAt && Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
            localStorage.removeItem(k)
          }
        } catch { localStorage.removeItem(k) }
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  useEffect(() => {
    const key = `draft_reading_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const { _savedAt, ...data } = JSON.parse(saved)
        setDraftBanner({ key, data, savedAt: _savedAt })
      }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    // Chỉ autosave khi form đã thực sự thay đổi so với mốc sạch (dữ liệu DB lúc mở
    // đề/sau khi lưu). Không có mốc này thì vừa mở đề để sửa là autosave ghi ngay
    // một bản nháp GIỐNG Y dữ liệu DB ("nháp ma") và spam toast "Đã lưu bản nháp".
    if (!isExamFormDirty(form, pristineFormSigRef.current || normalizeFormForDirtyCheck(emptyReadingForm()))) return
    const key = `draft_reading_${editingId || 'new'}`
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...form, _savedAt: Date.now() }))
      } catch {
        showAlert('Không lưu được nháp (bộ nhớ đầy)')
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    if (saveInFlightRef.current) return
    const sequence = ++loadSequenceRef.current

    setLoadingEdit(true)
    try {
      const res = await api.get(`/admin/exams/${id}`)
      if (sequence !== loadSequenceRef.current) return
      const exam = res.data
      const loadedWithNumbers = hydrateExamForm(exam, 'reading')
      loadedWithNumbers.passages = recalcAllGroupNumbers(loadedWithNumbers.passages)
      setForm(loadedWithNumbers)
      pristineFormSigRef.current = normalizeFormForDirtyCheck(loadedWithNumbers)
      pristineExplanationsRef.current = extractExplanationsMap(loadedWithNumbers)
      setEditingId(id)
      setOpenPassage(0)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      if (sequence !== loadSequenceRef.current) return
      const msg = 'Lỗi tải đề để sửa. Vui lòng thử lại.'

      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    finally { if (sequence === loadSequenceRef.current) setLoadingEdit(false) }
  }

  const cancelEdit = () => {
    if (saveInFlightRef.current) return
    loadSequenceRef.current += 1
    setLoadingEdit(false)
    expLock.handleSafeActionOrExit(() => {

      if (editingId) localStorage.removeItem(`draft_reading_${editingId}`)
      pristineFormSigRef.current = ''
      pristineExplanationsRef.current = {}
      setEditingId(null)
      setForm(emptyReadingForm())
      setOpenPassage(0)
      setEditHighlight(false)
      setDraftBanner(null)
    })
  }

  const updatePassage = (pi, field, val) => {
    const p = [...form.passages]
    p[pi] = { ...p[pi], [field]: val }
    if (field === 'body' || field === 'letteredParagraphs') p[pi].questionGroups = syncParagraphGroups(p[pi].questionGroups, p[pi].body, p[pi].letteredParagraphs)
    setForm({ ...form, passages: p })
  }

  const addGroup = (pi, type) => {
    if (needsParagraphLetters(type) && !form.passages[pi].letteredParagraphs) {
      showAlert(paragraphLettersAlert)
      return
    }
    const p = [...form.passages]
    const newGroup = emptyReadingGroupOf(type, 1) // start placeholder; recalc fixes it
    p[pi] = { ...p[pi], questionGroups: syncParagraphGroups([...p[pi].questionGroups, newGroup], p[pi].body, p[pi].letteredParagraphs) }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
    setAddingGroupPassage(null)
  }

  const updateGroup = (pi, gi, newGroup) => {
    const p = [...form.passages]
    const groups = [...p[pi].questionGroups]
    groups[gi] = newGroup
    p[pi] = { ...p[pi], questionGroups: groups }
    // Normalize token order as well as question counts after every edit.
    const recalced = recalcAllGroupNumbers(p)
    setForm({ ...form, passages: recalced })
  }

  const removeGroup = (pi, gi) => {
    const p = [...form.passages]
    p[pi] = { ...p[pi], questionGroups: p[pi].questionGroups.filter((_, i) => i !== gi) }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
  }

  const moveGroup = (pi, gi, dir) => {
    const p = [...form.passages]
    const groups = [...p[pi].questionGroups]
    const ni = gi + dir
    if (ni < 0 || ni >= groups.length) return
    ;[groups[gi], groups[ni]] = [groups[ni], groups[gi]]
    p[pi] = { ...p[pi], questionGroups: groups }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
  }

  const saveCurrentExam = async () => {
    if (saveInFlightRef.current || loadingEdit || generatingAI || expLock.isLockedOperation) return false


    // Client-side guardrails before hitting the API
    const val = validateExamReading(form)
    if (!val.isValid) {
      const msg = 'Không thể lưu đề:\n• ' + val.errors.join('\n• ')

      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return false
    }

    const totalQ = form.passages.reduce(
      (a, p) => a + (p.questionGroups || []).reduce((b, g) => b + (g.qNumberEnd - g.qNumberStart + 1), 0), 0
    )
    if (totalQ !== 40 && !window.confirm(`Tổng số câu hiện tại là ${totalQ}, không phải 40. Vẫn lưu?`)) return false

    saveInFlightRef.current = true
    setSubmitting(true)
    try {
      const payload = buildExamPayload(form, 'reading')
      if (editingId) {
        const saved = await api.put(`/admin/exams/${editingId}`, payload)
        const canonical = hydrateExamForm(saved.data, 'reading', form)
        latestFormRef.current = canonical
        setForm(canonical)
        localStorage.removeItem(`draft_reading_${editingId}`)
        showToast('Cập nhật đề thành công!')
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        pristineFormSigRef.current = normalizeFormForDirtyCheck(canonical)
        pristineExplanationsRef.current = extractExplanationsMap(canonical)
        Promise.resolve().then(() => onRefresh?.()).catch(() => {})
        return true
      } else {
        await api.post('/admin/exams/reading', payload)
        localStorage.removeItem('draft_reading_new')
        showToast('Tạo đề thành công!')
        setForm(emptyReadingForm())
        setOpenPassage(0)
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        pristineFormSigRef.current = ''
        pristineExplanationsRef.current = {}
        Promise.resolve().then(() => onRefresh?.()).catch(() => {})
        return true
      }
    } catch (err) {
      const data = err.response?.data
      const errMsg = data?.blockedQuestions?.length
        ? `${data.message}\n${data.blockedQuestions.map(b => `Passage ${b.passageNumber} - Câu ${b.questionNumber}`).join('\n')}`
        : (data?.message || err.message || 'Lỗi lưu đề Reading')

      showAlert(errMsg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return false
    } finally {
      saveInFlightRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await saveCurrentExam()
  }

  const handleDelete = async (id) => {
    // Xác nhận đã do modal của ExamList đảm nhiệm trước khi gọi onDelete
    try {
      await api.delete(`/admin/exams/${id}`)
      notifyTrashChanged()
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
      onRefresh()
    } catch { showToast('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
      {loadingEdit && (
        <div className="absolute inset-0 z-20 rounded-2xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <span className="text-sm font-semibold text-zinc-500">Đang tải đề để sửa…</span>
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} aria-busy={loadingEdit}
        className={`bg-white rounded-2xl p-6 border shadow-xs transition-all duration-500 ${loadingEdit ? 'opacity-60 pointer-events-none select-none' : ''} ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-zinc-200'}`}>
        <fieldset disabled={submitting || loadingEdit} className="min-w-0 border-0 p-0 m-0">
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">
          {editingId ? (form.title ? `Sửa đề Reading: ${form.title}` : 'Sửa đề Reading') : 'Tạo đề Reading mới'}
        </h3>

        <AIGenerationResumeBanner
          banner={expLock.resumeBanner}
          disabled={expLock.isLockedOperation}
        />

        <DraftBanner
          draft={draftBanner}
          diffInfo={draftDiffInfo}
          onRestore={() => handleRestoreDraft()}
          onRestoreKeepDraft={() => handleRestoreDraft('keep_draft')}
          onDismiss={() => {
            if (draftBanner?.key) localStorage.removeItem(draftBanner.key)
            setDraftBanner(null)
          }}
        />

        {editingId && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-4 flex flex-nowrap items-center justify-between gap-3">
            <div className="flex flex-nowrap items-center gap-3 min-w-0">
              <span
                className="min-w-0 truncate text-sm font-semibold text-zinc-800"
                title={form.title ? `Đang sửa đề: ${form.title}` : `Đang sửa đề ${editingId}`}
              >
                {form.title ? `Đang sửa đề: ${form.title}` : `Đang sửa đề ${editingId}`}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <ExamExplanationOverviewBadge
                  stats={examStats}
                  runErrorCount={runCounts.errors}
                  runAttentionCount={runCounts.needsRetry}
                  onOpenRunPanel={() => runPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {generatingAI ? (
                <span
                  className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium ${
                    isCancellingAI
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-zinc-100 border-zinc-300 text-zinc-800'
                  }`}
                  title={isCancellingAI ? 'Đang hoàn tất nhóm hiện tại rồi dừng' : `Đang xử lý ${aiProgress?.groupLabel || '...'}`}
                  aria-live="polite"
                >
                  <Loader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ${isCancellingAI ? 'text-amber-700' : 'text-zinc-700'}`} />
                  <span>{isCancellingAI ? 'Đang dừng…' : 'Đang sinh AI…'}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleStartGenerateAI}
                  disabled={generatingAI || expLock.isLockedGenerate}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={expLock.isLockedGenerate ? (expLock.lockTooltip ? `${expLock.lockTooltip} (tuần tự theo nhóm)` : 'Đang sinh giải thích AI, vui lòng chờ (tuần tự theo nhóm)') : 'AI giải thích 4 bước cho bài đọc (tuần tự theo nhóm)'}
                >
                  <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
                  <span>AI giải thích</span>
                </button>
              )}
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition shadow-2xs">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} disabled={generatingAI} className={btnSecondary + ' text-xs disabled:opacity-50 disabled:cursor-not-allowed'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div ref={runPanelRef}>
          <ExplanationRunPanel
            report={expLock.isGenerating ? null : runReportForPanel}
            onRetryFailed={expLock.isLockedGenerate ? undefined : handleRetryFailedAI}
            onOpenGroup={focusExplanationGroup}
            onDismiss={() => {
              clearRunReport(runReportKey)
              persistRunReport(null)
              setRunStatusByNumber({})
            }}
            className="mb-4"
          />
        </div>

        <AIGenerationStickyProgress
          isGenerating={expLock.isGenerating}
          isCancelling={expLock.isCancelling}
          progress={expLock.localProgress}
          runErrorCount={runCounts.errors}
          runAttentionCount={runCounts.needsRetry}
          onCancel={handleCancelAI}
        />

        <div className="mb-3">
          <label className={labelCls}>Tên đề</label>
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Reading"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>

        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-5">
          <p className="text-xs font-bold text-zinc-800 mb-2">Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <Select
                ariaLabel="Bộ đề"
                value={form.seriesId}
                onChange={v => setForm({ ...form, seriesId: v, bookNumber: '' })}
                options={[
                  { value: '', label: '-- Không gắn --' },
                  ...liveExamSeries.map(s => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <Select
                ariaLabel="Cuốn số"
                value={form.bookNumber}
                onChange={v => setForm({ ...form, bookNumber: v })}
                disabled={!form.seriesId}
                options={[
                  { value: '', label: '-- Chọn cuốn --' },
                  ...seriesBooks.map(b => ({ value: String(b.bookNumber), label: String(b.bookNumber) })),
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <Select
                ariaLabel="Test số"
                value={form.testNumber}
                onChange={v => setForm({ ...form, testNumber: v })}
                disabled={!form.bookNumber}
                options={[
                  { value: '', label: '-- Chọn test --' },
                  ...[1, 2, 3, 4].map(n => ({ value: String(n), label: `Test ${n}` })),
                ]}
              />
            </div>
          </div>
        </div>

        {/* Passages accordion — always 3 */}
        <div className="space-y-3 mb-5">
          {form.passages.map((passage, pi) => {
            const totalQs = passage.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)
            const pStats = calculateExamExplanationStats(passage)
            return (
              <div key={pi} className="border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setOpenPassage(openPassage === pi ? -1 : pi)}
                  aria-expanded={openPassage === pi}
                  aria-controls={`passage-panel-${pi}`}
                  className="w-full flex items-center justify-between px-5 py-3 bg-zinc-50 hover:bg-zinc-100/80 transition-colors"
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-sm text-zinc-800">Passage {passage.number}</span>
                    <span className="text-xs text-zinc-500 mt-0.5">{passage.title || '(chưa đặt tiêu đề)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 font-medium">{passage.questionGroups.length} nhóm · {totalQs} câu</span>
                    <ExamExplanationOverviewBadge stats={pStats} compact={true} />
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${openPassage === pi ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {openPassage === pi && (
                  <div id={`passage-panel-${pi}`} role="region" aria-label={`Đoạn văn ${pi + 1}`} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Tiêu đề chính</label>
                        <input className={inputCls} placeholder="VD: The Evolution of AI"
                          value={passage.title} onChange={e => updatePassage(pi, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Tiêu đề phụ (tùy chọn)</label>
                        <input className={inputCls} placeholder="VD: A study on machine cognition"
                          value={passage.subtitle} onChange={e => updatePassage(pi, 'subtitle', e.target.value)} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={passage.letteredParagraphs}
                          onChange={e => updatePassage(pi, 'letteredParagraphs', e.target.checked)}
                          className="accent-zinc-900" />
                        <span className="text-xs text-zinc-600 font-medium">Đoạn văn có ký hiệu chữ cái (A, B, C...) — dùng cho Matching Information và Matching Headings</span>
                      </label>
                    </div>

                    <div>
                      <label className={labelCls}>Nội dung bài đọc</label>
                      <textarea className={`${inputCls} resize-none`} rows={10}
                        placeholder="Dán toàn bộ nội dung bài đọc vào đây. Dùng dòng trống để phân cách đoạn văn..."
                        value={passage.body} onChange={e => updatePassage(pi, 'body', e.target.value)} />
                    </div>

                    {/* Question Groups */}
                    <div>
                      <label className={labelCls}>Nhóm câu hỏi ({passage.questionGroups.length})</label>
                      <div className="space-y-3 mb-3">
                        {passage.questionGroups.map((group, gi) => (
                          <ReadingGroupEditor
                            key={group._id || gi}
                            group={group}
                            examId={editingId}
                            passage={passage.body}
                            letteredParagraphs={Boolean(passage.letteredParagraphs)}
                            onChange={newGroup => updateGroup(pi, gi, newGroup)}
                            onRemove={() => removeGroup(pi, gi)}
                            onMoveUp={() => moveGroup(pi, gi, -1)}
                            onMoveDown={() => moveGroup(pi, gi, 1)}
                            isFirst={gi === 0}
                            isLast={gi === passage.questionGroups.length - 1}
                            onGenerateGroupAI={editingId ? () => handleStartGenerateGroupAI(group) : null}
                            isAIBusy={expLock.isLockedOperation}
                            generatingGroupId={generatingGroupId}
                            generatingQuestionNumbers={generatingQuestionNumbers}
                            runStatusByNumber={runStatusByNumber}
                            runErrorMessageByNumber={runErrorMessageByNumber}
                            unsavedQuestionNumbers={unsavedQuestionNumbers}
                          />
                        ))}
                      </div>

                      {addingGroupPassage === pi ? (
                        <QuestionTypePicker types={READING_GROUP_TYPES} onSelect={type => addGroup(pi, type)} onCancel={() => setAddingGroupPassage(null)} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingGroupPassage(pi)}
                          disabled={expLock.isLockedOperation}
                          title={expLock.lockTooltip}
                          className="w-full border-2 border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 rounded-lg py-2 px-3 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
                          + Thêm nhóm câu hỏi
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="submit"
          disabled={submitting || loadingEdit || expLock.isLockedOperation}
          title={expLock.lockTooltip}
          className="w-full h-10 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Reading' : 'Tạo đề Reading'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full h-10 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
            showPreview
              ? 'border-zinc-400 bg-zinc-100 text-zinc-900'
              : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{showPreview ? 'Đóng preview' : 'Preview nội dung đề'}</span>
        </button>
        </fieldset>
      </form>
      </div>

      {showPreview && (
        <div ref={previewRef} style={{ scrollMarginTop: 16 }}>
          <InlinePreviewPanel
            title={form.title || 'Reading'}
            showAnswers={showAnswers}
            setShowAnswers={setShowAnswers}
            onClose={() => setShowPreview(false)}
          >
            <ReadingFormPreview form={form} showAnswers={showAnswers} />
          </InlinePreviewPanel>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Danh sách đề Reading</h3>
        <ExamList exams={exams} skill="reading" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} paginationData={paginationData} fetchExams={fetchExams} loading={loading} error={loadError} />
      </div>

      <UnsavedChangesAIModal
        isOpen={unsavedModalOpen}
        onClose={() => { setUnsavedModalOpen(false); pendingAIFnRef.current = null }}
        isSaving={submitting}
        onSaveAndGenerate={async () => {
          const ok = await saveCurrentExam()
          if (ok) {
            setUnsavedModalOpen(false)
            if (pendingAIFnRef.current) {
              pendingAIFnRef.current()
            } else {
              proceedWithAIGeneration()
            }
          }
        }}
        onContinueWithoutSaving={() => {
          setUnsavedModalOpen(false)
          if (pendingAIFnRef.current) {
            pendingAIFnRef.current()
          } else {
            proceedWithAIGeneration()
          }
        }}
      />

      <ExplanationConflictModal
        isOpen={conflictModalOpen}
        onClose={() => { setConflictModalOpen(false); pendingAIFnRef.current = null }}
        conflicts={aiConflicts}
        onConfirmResolve={(choices) => {
          if (pendingAIFnRef.current) {
            pendingAIFnRef.current({ resolveChoices: choices, overwriteProtected: false })
          } else {
            handleGenerateSequentialAll({ resolveChoices: choices, overwriteProtected: false })
          }
        }}
        isSubmitting={generatingAI}
      />

      <OverwriteProtectedConfirmModal
        isOpen={overwriteModalOpen}
        onClose={() => { setOverwriteModalOpen(false); pendingAIFnRef.current = null }}
        reviewedCount={protectedStats.reviewedCount}
        editedCount={protectedStats.editedCount}
        isSubmitting={generatingAI}
        onConfirm={({ overwriteProtected }) => {
          setOverwriteModalOpen(false)
          if (pendingAIFnRef.current) {
            pendingAIFnRef.current({ overwriteProtected })
          } else {
            handleGenerateSequentialAll({ overwriteProtected })
          }
        }}
      />

      <AIGenerationExitConfirmModal
        isOpen={expLock.exitConfirmOpen}
        onClose={expLock.closeExitConfirm}
        onConfirmExit={expLock.confirmExit}
        currentCount={expLock.localProgress?.current || 0}
        totalCount={expLock.localProgress?.total || 0}
        isCancelling={expLock.isCancelling}
      />
    </div>
  )
}

export { SpeakingFormPreview }
export default ReadingTab
