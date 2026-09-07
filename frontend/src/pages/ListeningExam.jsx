import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getListeningExam, getListeningExamWithAnswers, submitListeningExam, getFullTestStatus } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Headphones, ArrowLeft, X, Clock, LayoutGrid, ChevronUp, ChevronDown } from 'lucide-react'
import { getSectionSlots } from '../utils/questionCount'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import PassagePills from '../components/PassagePills'
import QuestionNavButton from '../components/common/QuestionNavButton'
import QuestionPanelPopover from '../components/common/QuestionPanelPopover'
import TableCompletionRender from '../components/TableCompletionRender'
import NoteCompletionGroup from '../components/exam/listening/NoteCompletionGroup'
import MCQGroup from '../components/exam/listening/MCQGroup'
import MapDiagramGroup from '../components/exam/listening/MapDiagramGroup'
import { GroupBlock, QuestionBlock, groupByType } from '../components/exam/listening/OtherGroups'
import { fmt } from '../utils/practiceUtils'
import { toImgSrc } from '../utils/practiceConfig'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'


const DEFAULT_LISTENING_TIME = 40 * 60
// ─────────────────────────────────────────────────────────────────────────────

export default function ListeningExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === 'true'
  const resumeMode = searchParams.get('resume') === 'true'
  const viewResultMode = searchParams.get('viewResult') === 'true'
  const { user } = useAuth()
  const { showToast } = useToast()

  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_LISTENING_TIME)
  const [phase, setPhase] = useState('start')
  const [showAnswers, setShowAnswers] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [showNavNumbers, setShowNavNumbers] = useState(true)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(0)
  const audioRef = useRef(null)
  const bottomBarRef = useRef(null)
  const savedDraftRef = useRef('{}')  // JSON của answers đã ghi vào draft gần nhất
  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header

  // ── Autosave draft ─────────────────────────────────────────────────────────
  // MỘT interval sống suốt phiên (deps [phase, previewMode, id]). KHÔNG đưa
  // answers/timeLeft/user vào deps — đổi liên tục → interval bị reset, không bao
  // giờ fire. Đọc state mới nhất qua ref (sync mỗi render). persistDraftNow() còn
  // được useExitGuard gọi ngay tại mọi điểm thoát bài (onBeforeExit).
  const autosaveRef = useRef(null)
  useEffect(() => {
    autosaveRef.current = {
      answers, timeLeft,
      userId: user ? (user.id || user._id) : null,
    }
  })
  const persistDraftNow = useCallback(() => {
    const { answers, timeLeft, userId } = autosaveRef.current
    if (!userId || !id) return
    // P3-2: đừng để answers rỗng ghi đè một draft cũ không rỗng
    // (vd reload KHÔNG kèm ?resume=true → vào 'exam' với answers = {})
    if (Object.keys(answers).length === 0) {
      const existing = loadDraft(userId, id, 'listening')
      if (existing?.data && Object.keys(existing.data).length > 0) return
    }
    saveDraft({ userId, examId: id, skillType: 'listening', data: answers, timeRemaining: timeLeft })
    savedDraftRef.current = JSON.stringify(answers)
    setLastSavedAt(new Date())
  }, [id])
  useEffect(() => {
    if (phase !== 'exam' || previewMode) return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, previewMode, id, persistDraftNow])

  // Cảnh báo khi thoát bằng Back/Forward/refresh nếu có đáp án chưa ghi vào draft
  const hasUnsavedAnswers = JSON.stringify(answers) !== savedDraftRef.current
  const exitGuard = useExitGuard(phase === 'exam' && !previewMode && hasUnsavedAnswers, persistDraftNow)

  const loadExam = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.listening_time)
        if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60)
      })
      .catch(() => {})
    const fetchExam = previewMode ? getListeningExamWithAnswers : getListeningExam
    fetchExam(id)
      .then(data => {
        setExam(data)
        if (resumeMode && user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'listening')
          if (draft?.data && Object.keys(draft.data).length > 0) {
            setAnswers(draft.data)
            savedDraftRef.current = JSON.stringify(draft.data)
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
          setPhase('exam')
        }
        if (viewResultMode) setPhase('viewResult')
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Không tìm thấy đề thi hoặc kết nối bị gián đoạn.')
      })
      .finally(() => setLoading(false))
  }, [id, previewMode, resumeMode, user, viewResultMode])

  useEffect(() => {
    document.title = 'Bài thi Listening | IELTS Pro'
    loadExam()
  }, [loadExam])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    if (phase !== 'exam' || result || previewMode) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result, previewMode])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [activeSection])

  useEffect(() => {
    if (!showConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showConfirm])

  useEffect(() => {
    if (!showExitConfirm && !exitGuard.prompt) return
    const handler = (e) => {
      if (e.key === 'Escape') { setShowExitConfirm(false); exitGuard.stay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm, exitGuard.prompt, exitGuard.stay])

  useEffect(() => {
    if (!showQuestionPanel) return
    const handler = (e) => { if (e.key === 'Escape') setShowQuestionPanel(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showQuestionPanel])

  useEffect(() => {
    if (phase === 'result' && result) {
      getFullTestStatus(id)
        .then(data => { if (data.isComplete) setFullTestStatus(data) })
        .catch(() => {})
    }
  }, [phase, result])

  const handleBack = () => {
    if (exam?.seriesId) {
      navigate(`/full-test/${exam.seriesId}?book=${exam.bookNumber}`)
    } else {
      navigate('/practice/listening')
    }
  }

  useEffect(() => {
    if (!bottomBarRef.current) return
    const ro = new ResizeObserver(entries => {
      setBottomBarHeight(entries[0].contentRect.height)
    })
    ro.observe(bottomBarRef.current)
    return () => ro.disconnect()
  }, [])

  const onAnswer = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }))

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await submitListeningExam(id, answers)
      // disarm() gọi persistDraftNow (onBeforeExit) → clearDraft PHẢI chạy SAU nó
      await exitGuard.disarm()
      if (user) clearDraft(user.id || user._id, id, 'listening')
      navigate(`/listening/${id}/result`, { replace: true })
    } catch (e) {
      showToast(e?.response?.data?.message || e?.message || 'Lỗi nộp bài thi. Vui lòng thử lại.', 'error')
    } finally { setSubmitting(false) }
  }

  const jumpToQuestion = (slot) => {
    let sectionIdx = activeSection
    for (let i = 0; i < exam.listeningSections.length; i++) {
      const s = exam.listeningSections[i]
      const inSection = (s.questionGroups || []).some(g => slot.number >= g.qNumberStart && slot.number <= g.qNumberEnd)
        || (s.questions || []).some(q => q.number === slot.number)
      if (inSection) { sectionIdx = i; break }
    }
    const doScroll = () => {
      let el = document.getElementById(`question-${slot.number}`)
        || document.getElementById(`q-${slot.number}`)
      if (!el) {
        for (const group of (exam.listeningSections[sectionIdx].questionGroups || [])) {
          if (slot.number >= group.qNumberStart && slot.number <= group.qNumberEnd) {
            el = document.getElementById(`question-${group.qNumberStart}`)
            break
          }
        }
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (sectionIdx !== activeSection) {
      setActiveSection(sectionIdx)
      setTimeout(doScroll, 50)
    } else {
      doScroll()
    }
  }

  if (loading) return <SkeletonExamPage />
  if (error || !exam) {
    return (
      <ExamErrorState
        title="Không thể tải đề thi Listening"
        message={error || 'Không tìm thấy đề thi hoặc đề thi đã bị gỡ bỏ.'}
        onRetry={loadExam}
        onBack={handleBack}
        backLabel="Quay lại danh sách"
      />
    )
  }

  const allQ = exam.listeningSections.flatMap(s => getSectionSlots(s))
  const answered = allQ.filter(s => s.qId && answers[s.qId]).length

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center" style={{ background: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', padding: 40, maxWidth: 448, width: '100%', textAlign: 'center', border: '1px solid var(--border)' }}>
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-5">
          <Headphones className="w-8 h-8 text-zinc-600 stroke-[1.75]" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">{exam.title}</h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 4 }}>{exam.listeningSections.length} Sections · <span style={{ fontFamily: 'var(--font-mono)' }}>{allQ.length}</span> câu hỏi</p>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 32 }}>Thời gian: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--skill-l-color)' }}>40 phút</span></p>
        <div style={{ background: 'var(--skill-l-bg)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'left', fontSize: 'var(--fs-sm)', color: 'var(--ink-soft)', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Nghe audio rồi trả lời câu hỏi bên dưới</p>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Có thể tua lại audio trong phần làm bài</p>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: 'var(--fs-base)', marginBottom: 8 }}>
          Bắt đầu làm bài
        </button>
        <button
          onClick={handleBack}
          className="w-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200 ease-in-out font-medium text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ width: '100%', padding: '12px 0', borderRadius: '12px' }}
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" /> Quay lại
        </button>
      </div>
    </div>
  )

  // ── Exam ──────────────────────────────────────────────────────

  const section = exam.listeningSections[activeSection]
  let startIdx = 0
  for (let i = 0; i < activeSection; i++) startIdx += getSectionSlots(exam.listeningSections[i]).length

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-raised)' }}>
      {/* Header */}
      <header className="h-14 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Đóng bài thi"
            onClick={() => previewMode ? navigate('/admin') : setShowExitConfirm(true)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium transition cursor-pointer shrink-0"
            title="Thoát bài thi"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thoát</span>
          </button>
          <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {exam.title}
          </span>
          {previewMode && (
            <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md font-medium shrink-0">
              Chế độ Preview
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {previewMode ? (
            <button
              type="button"
              onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                showAnswers
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          ) : (
            <>
              {lastSavedAt && (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  ✓ Đã lưu {formatSavedAt(lastSavedAt)}
                </span>
              )}
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                {answered}/{allQ.length} câu
              </span>
              <div
                className={`tabular-nums text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  timeLeft < 300
                    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60'
                    : timeLeft < 600
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
                    : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {fmt(timeLeft)}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Sticky Audio Player Bar — Pinned right below top bar */}
      <div className="shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-2.5 shadow-xs z-20">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shrink-0">
              Section {section.number}
            </span>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
              {section.context || 'Listening Section'}
            </span>
          </div>
          <div className="w-full sm:w-auto flex-1 max-w-xl flex items-center justify-end">
            {section.audioUrl ? (
              <audio ref={audioRef} controls className="w-full h-9 rounded-lg" src={toImgSrc(section.audioUrl)} />
            ) : (
              <div className="w-full py-1.5 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-400 text-center">Chưa có file audio cho section này</div>
            )}
          </div>
        </div>
      </div>

      {/* Body: Scrollable Question Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {/* Questions */}
          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-xs">
            <p className="text-xs font-bold text-[var(--primary-hover)] uppercase tracking-wider mb-5">
              Section {section.number}
              {section.context && <span className="font-normal text-zinc-400 ml-1">— {section.context}</span>}
            </p>

            {/* Legacy: direct questions (groupId = null) */}
            {(section.questions || []).length > 0 && groupByType(section.questions).map((group, gi) => (
              <div key={gi} className="mb-6">
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4 text-sm">
                  <p className="font-semibold text-zinc-900 text-sm">Questions {startIdx + group.startOffset + 1}–{startIdx + group.startOffset + group.qs.length}</p>
                </div>
                {group.qs.map((q, qi) => (
                  <QuestionBlock key={q.id} q={q} globalIdx={startIdx + group.startOffset + qi}
                    answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
                ))}
              </div>
            ))}

            {/* New: group-based questions */}
            {(section.questionGroups || []).map(group => (
              <GroupBlock key={group.id} group={group} answers={answers} onAnswer={onAnswer}
                previewMode={previewMode} showAnswers={showAnswers} />
            ))}

            {getSectionSlots(section).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8 italic">Section này chưa có câu hỏi.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigator bar — 2 rows */}
      {!previewMode && (
        <div ref={bottomBarRef} className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* Row 1: question numbers for active section only (collapsible) */}
          {showNavNumbers && (
            <div className="px-6 py-4 border-b border-gray-100 flex justify-center bg-white">
              <div className="flex flex-wrap gap-3 justify-center max-w-5xl">
                {getSectionSlots(section).map(slot => (
                  <QuestionNavButton
                    key={slot.number}
                    number={slot.number}
                    status={slot.qId && answers[slot.qId] ? 'answered' : 'unanswered'}
                    onClick={() => jumpToQuestion(slot)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 2: controls */}
          <div className="px-6 h-14 flex items-center justify-between gap-6">
            {/* Left: icons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                title="Bảng câu hỏi"
                aria-label="Bảng câu hỏi"
                onClick={() => setShowQuestionPanel(v => !v)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  showQuestionPanel
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs'
                    : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                title={showNavNumbers ? 'Thu gọn' : 'Mở rộng'}
                aria-label={showNavNumbers ? 'Thu gọn' : 'Mở rộng'}
                onClick={() => setShowNavNumbers(v => !v)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 transition-all cursor-pointer"
              >
                {showNavNumbers ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Middle: Section Pills */}
            <PassagePills
              items={exam.listeningSections.map(s => {
                const slots = getSectionSlots(s)
                return {
                  label: `Section ${s.number}`,
                  answered: slots.filter(sl => sl.qId && answers[sl.qId]).length,
                  total: slots.length,
                }
              })}
              activeIndex={activeSection}
              onChange={setActiveSection}
            />

            {/* Right: submit */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question panel popup (shared component) */}
      {showQuestionPanel && (
        <QuestionPanelPopover
          bottomOffset={bottomBarHeight + 8}
          activeIndex={activeSection}
          onClose={() => setShowQuestionPanel(false)}
          onJump={jumpToQuestion}
          groups={exam.listeningSections.map(s => ({
            label: `Section ${s.number}`,
            items: [...getSectionSlots(s)]
              .sort((a, b) => a.number - b.number)
              .map(slot => ({ number: slot.number, answered: !!(slot.qId && answers[slot.qId]), ref: slot })),
          }))}
        />
      )}

      {/* Exit confirm modal — dùng chung cho nút ✕ và guard Back/Forward */}
      <ConfirmExitModal
        isOpen={showExitConfirm || exitGuard.prompt}
        onClose={() => { setShowExitConfirm(false); exitGuard.stay() }}
        onConfirm={async () => {
          setShowExitConfirm(false)
          if (exitGuard.prompt) { exitGuard.leave() }
          else { await exitGuard.disarm(); handleBack() }
        }}
      />

      {/* Confirm submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="p-6 shadow-xl max-w-sm w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">Nộp bài?</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Đã làm: <span className="font-mono text-zinc-900 dark:text-zinc-100">{answered}/{allQ.length}</span> câu
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 px-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl font-medium text-xs transition cursor-pointer"
              >
                Tiếp tục làm
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); doSubmit() }}
                disabled={submitting}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-xs transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Đang chấm...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
