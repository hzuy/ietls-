import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { queryClient } from '../lib/queryClient'
import { getReadingExam, getReadingExamWithAnswers, submitReadingExam, getFullTestStatus } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBrowserHistoryGuard } from '../hooks/useBrowserHistoryGuard'
import { BookOpen, ArrowLeft, Type, Clock, LayoutGrid, ChevronUp, ChevronDown } from 'lucide-react'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import PassagePills from '../components/PassagePills'
import QuestionNavButton from '../components/common/QuestionNavButton'
import QuestionPanelPopover from '../components/common/QuestionPanelPopover'
import TableCompletionRender from '../components/TableCompletionRender'
import GroupBlock from '../components/exam/GroupBlock'
import TypeHeader from '../components/exam/TypeHeaders'
import QuestionBlock from '../components/exam/QuestionBlock'
import { groupByType } from '../components/exam/listening/OtherGroups'
import { fmt } from '../utils/practiceUtils'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import ExitConfirmModal from '../components/common/ExitConfirmModal'


const DEFAULT_READING_TIME = 60 * 60


export default function ReadingExam() {
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
  const [activePassage, setActivePassage] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_READING_TIME)
  const [phase, setPhase] = useState('start')
  const [showAnswers, setShowAnswers] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [showNavNumbers, setShowNavNumbers] = useState(true)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(52)
  const bottomBarRef = useRef(null)
  const rightPanelRef = useRef(null)
  const bodyRef = useRef(null)
  const isDraggingRef = useRef(false)
  const savedDraftRef = useRef('{}')  // JSON của answers đã ghi vào draft gần nhất
  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('reading-split-ratio')
    const n = parseFloat(saved)
    return (!isNaN(n) && n >= 25 && n <= 75) ? n : 50
  })
  const [isDragging, setIsDragging] = useState(false)
  const [fontSize, setFontSize] = useState('base')

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
      const existing = loadDraft(userId, id, 'reading')
      if (existing?.data && Object.keys(existing.data).length > 0) return
    }
    saveDraft({ userId, examId: id, skillType: 'reading', data: answers, timeRemaining: timeLeft })
    savedDraftRef.current = JSON.stringify(answers)
    setLastSavedAt(new Date())
  }, [id])
  useEffect(() => {
    if (phase !== 'exam' || previewMode) return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, previewMode, id, persistDraftNow])

  // Cảnh báo trình duyệt (beforeunload) khi thí sinh đóng tab/F5 trong lúc làm bài
  useEffect(() => {
    if (phase !== 'exam' || previewMode) return
    const handleBeforeUnload = (e) => {
      persistDraftNow()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase, previewMode, persistDraftNow])

  // Chặn nút Back (<) của trình duyệt khi đang làm bài
  const { showModal: showExitModal, stay: stayInExam, leave: leaveExam } = useBrowserHistoryGuard(phase === 'exam' && !previewMode, persistDraftNow)

  const loadExam = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.reading_time)
        if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60)
      })
      .catch(() => {})
    const fetchExam = previewMode ? getReadingExamWithAnswers : getReadingExam
    queryClient.fetchQuery({
      queryKey: ['exam', 'reading', id, { previewMode }],
      queryFn: () => fetchExam(id),
      staleTime: 1000 * 60 * 5,
    })
      .then(data => {
        setExam(data)
        // Resume draft if ?resume=true
        if (resumeMode && user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'reading')
          if (draft?.data && Object.keys(draft.data).length > 0) {
            setAnswers(draft.data)
            savedDraftRef.current = JSON.stringify(draft.data)
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
          setPhase('exam')
        }
        // Jump straight to result view if ?viewResult=true
        if (viewResultMode) {
          setPhase('viewResult')
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Không tìm thấy đề thi hoặc kết nối bị gián đoạn.')
      })
      .finally(() => setLoading(false))
  }, [id, previewMode, resumeMode, user, viewResultMode])

  useEffect(() => {
    document.title = 'Bài thi Reading | IELTS Pro'
    loadExam()
  }, [loadExam])

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
      navigate('/practice/reading')
    }
  }

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleDividerMouseDown = (e) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)

    const onMouseMove = (ev) => {
      if (!isDraggingRef.current || !bodyRef.current) return
      const rect = bodyRef.current.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(75, Math.max(25, ratio))
      setSplitRatio(clamped)
      localStorage.setItem('reading-split-ratio', clamped)
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const resetSplit = (e) => {
    e.stopPropagation()
    setSplitRatio(50)
    localStorage.removeItem('reading-split-ratio')
  }

  useEffect(() => {
    if (phase !== 'exam' || result || previewMode) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result, previewMode])

  useEffect(() => {
    if (!showConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showConfirm])

  useEffect(() => {
    if (!showQuestionPanel) return
    const handler = (e) => { if (e.key === 'Escape') setShowQuestionPanel(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showQuestionPanel])

  useEffect(() => {
    if (!bottomBarRef.current) return
    const obs = new ResizeObserver(() => setBottomBarHeight(bottomBarRef.current?.offsetHeight || 52))
    obs.observe(bottomBarRef.current)
    return () => obs.disconnect()
  }, [])

  const onAnswer = useCallback((qId, val) => setAnswers(a => ({ ...a, [qId]: val })), [])

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await submitReadingExam(id, answers)
      if (user) clearDraft(user.id || user._id, id, 'reading')
      navigate(`/reading/${id}/result`, { replace: true })
    } catch (e) {
      showToast(e?.response?.data?.message || e?.message || 'Lỗi nộp bài thi. Vui lòng thử lại.', 'error')
    } finally { setSubmitting(false) }
  }

  // Get all questions for a passage (from groups or direct)
  const getPassageQuestions = (passage) => {
    if (passage.questionGroups && passage.questionGroups.length > 0) {
      return passage.questionGroups.flatMap(g => g.questions || [])
    }
    return passage.questions || []
  }

  // Get total question slots for a passage (uses qNumberEnd - qNumberStart + 1 for groups)
  const getPassageTotalSlots = (passage) => {
    if (passage.questionGroups && passage.questionGroups.length > 0) {
      return passage.questionGroups.reduce((sum, g) => sum + (g.qNumberEnd - g.qNumberStart + 1), 0)
    }
    return (passage.questions || []).length
  }

  // Get navigator items: one entry per slot number (expands ranges for mcq_multi etc.)
  const getPassageNavItems = (passage) => {
    if (!passage.questionGroups || passage.questionGroups.length === 0) {
      return (passage.questions || []).map(q => ({ number: q.number, qId: q.id }))
    }
    return passage.questionGroups.flatMap(g => {
      const items = []
      for (let n = g.qNumberStart; n <= g.qNumberEnd; n++) {
        let qId = null
        if (g.type === 'mcq_multi') {
          const maxC = g.maxChoices || 2
          const qi = Math.floor((n - g.qNumberStart) / maxC)
          qId = g.questions?.[qi]?.id ?? null
        } else {
          qId = (g.questions || []).find(q => q.number === n)?.id ?? null
        }
        items.push({ number: n, qId })
      }
      return items
    })
  }

  const jumpToQuestion = useCallback((qNumber) => {
    if (!exam?.passages) return
    // Find which passage contains this question number
    let passageIdx = -1
    for (let i = 0; i < exam.passages.length; i++) {
      const pQs = getPassageQuestions(exam.passages[i])
      if (pQs.some(q => q.number === qNumber)) { passageIdx = i; break }
    }
    if (passageIdx === -1) return

    const doScroll = () => {
      let el = document.getElementById(`q-${qNumber}`)
      if (!el) {
        // Fallback for token-based groups: scroll to group start
        for (const group of (exam.passages[passageIdx].questionGroups || [])) {
          if (qNumber >= group.qNumberStart && qNumber <= group.qNumberEnd) {
            el = document.getElementById(`q-${group.qNumberStart}`)
            break
          }
        }
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (passageIdx !== activePassage) {
      setActivePassage(passageIdx)
      setTimeout(doScroll, 50)
    } else {
      doScroll()
    }
  }, [activePassage, exam])

  const totalSlots = useMemo(() => exam?.passages ? exam.passages.reduce((sum, p) => sum + getPassageTotalSlots(p), 0) : 0, [exam])
  const allNavItems = useMemo(() => exam?.passages ? exam.passages.flatMap(p => getPassageNavItems(p)) : [], [exam])
  const answered = useMemo(() => allNavItems.filter(item => item.qId && answers[item.qId]).length, [allNavItems, answers])

  const passage = exam?.passages?.[activePassage] || null
  const useGroups = Boolean(passage?.questionGroups && passage.questionGroups.length > 0)

  // Compute global question offset for this passage
  const passageOffsets = useMemo(() => {
    if (!exam?.passages) return []
    return exam.passages.reduce((acc, p, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + getPassageQuestions(exam.passages[i - 1]).length)
      return acc
    }, [])
  }, [exam?.passages])

  const passageStartIdx = passageOffsets[activePassage] || 0
  const passageQuestions = useMemo(() => passage ? getPassageQuestions(passage) : [], [passage])
  const currentPassageNavItems = useMemo(() => passage ? getPassageNavItems(passage) : [], [passage])
  const sortedQuestionGroups = useMemo(() => {
    if (!passage?.questionGroups) return []
    return [...passage.questionGroups].sort((a, b) => a.qNumberStart - b.qNumberStart)
  }, [passage?.questionGroups])
  const passagePillsItems = useMemo(() => {
    if (!exam?.passages) return []
    return exam.passages.map(p => {
      const navItems = getPassageNavItems(p)
      return {
        label: `Passage ${p.number}`,
        answered: navItems.filter(s => s.qId && answers[s.qId]).length,
        total: navItems.length,
      }
    })
  }, [exam?.passages, answers])

  if (loading) return <SkeletonExamPage />
  if (error || !exam) {
    return (
      <ExamErrorState
        title="Không thể tải đề thi Reading"
        message={error || 'Không tìm thấy đề thi hoặc đề thi đã bị gỡ bỏ.'}
        onRetry={loadExam}
        onBack={handleBack}
        backLabel="Quay lại danh sách"
      />
    )
  }

  // ── View Result mode: redirect to dedicated result route ──────
  // (handled by navigate in doSubmit; ?viewResult=true redirects here too)
  if (viewResultMode) {
    navigate(`/reading/${id}/result`, { replace: true })
    return null
  }

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center" style={{ background: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', padding: 40, maxWidth: 448, width: '100%', textAlign: 'center', border: '1px solid var(--border)' }}>
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-5">
          <BookOpen className="w-8 h-8 text-zinc-600 stroke-[1.75]" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">{exam.title}</h1>
        <p style={{ color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 4 }}>{exam.passages.length} Passages · <span className="font-mono">{totalSlots}</span> câu hỏi</p>
        <p style={{ color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 32 }}>Thời gian: <span className="font-mono font-bold" style={{ color: 'var(--skill-r-color)' }}>60 phút</span></p>
        <div style={{ background: 'var(--skill-r-bg)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'left', fontSize: 'var(--fs-sm)', color: 'var(--ink-soft)', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <p style={{ margin: 0 }}>• Đọc passage bên trái, trả lời câu hỏi bên phải</p>
          <p style={{ margin: 0 }}>• Có thể chuyển qua lại giữa các passage</p>
          <p style={{ margin: 0 }}>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: 'var(--fs-base)', marginBottom: 8, textAlign: 'center' }}>
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

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-raised)' }}>
      {/* Header */}
      <header className="h-14 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
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
                {answered}/{totalSlots} câu
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

      {/* Body */}
      <div ref={bodyRef} className={`flex-1 flex flex-col md:flex-row overflow-hidden${isDragging ? ' select-none' : ''}`}>
        {/* Left: Passage text */}
        <div
          className="overflow-y-auto bg-white px-8 py-6 border-b md:border-b-0 md:border-r border-zinc-200"
          style={{ width: isMobile ? '100%' : `${splitRatio}%` }}
        >
          {/* Passage Toolbar */}
          <div className="sticky -top-6 -mx-8 px-8 py-2.5 mb-5 bg-white/95 backdrop-blur-xs border-b border-zinc-100 flex items-center justify-between z-10">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Passage {activePassage + 1}</span>
            <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/80">
              <span className="text-[11px] font-medium text-zinc-400 px-1.5 flex items-center gap-1">
                <Type className="w-3.5 h-3.5" />
              </span>
              {[
                { label: 'A-', size: 'sm', desc: '14px' },
                { label: 'A',  size: 'base', desc: '16px' },
                { label: 'A+', size: 'lg', desc: '18px' },
              ].map(({ label, size, desc }) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setFontSize(size)}
                  title={`Cỡ chữ ${desc}`}
                  className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer border-none ${
                    fontSize === size
                      ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <h2 className="text-lg font-semibold text-zinc-900 text-center mb-1 leading-snug">{passage.title}</h2>
          {passage.subtitle && <p className="text-sm text-zinc-500 text-center mb-2 italic">{passage.subtitle}</p>}
          <div className="w-16 h-0.5 bg-zinc-900 mx-auto mb-6" />
          <div className={`text-zinc-800 font-normal ${fontSize === 'sm' ? 'text-sm leading-relaxed' : fontSize === 'lg' ? 'text-lg leading-loose' : 'text-base leading-relaxed'}`}>
            {passage.body
              ? passage.body
                  .split(/\n\s*\n|\n/)
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map((para, i) => {
                    if (passage.letteredParagraphs) {
                      const letter = String.fromCharCode(65 + i)
                      return (
                         <p key={i} className="mb-5">
                          <span className="font-bold text-zinc-900 mr-2">{letter}</span>
                          {para.charAt(0).toUpperCase() + para.slice(1)}
                        </p>
                      )
                    }
                    const capitalized = para.charAt(0).toUpperCase() + para.slice(1)
                    return <p key={i} className="mb-5 indent-6">{capitalized}</p>
                  })
              : null
            }
          </div>
        </div>

        {/* Drag divider */}
        <div
          className="group relative flex-shrink-0 hidden md:flex flex-col items-center justify-center w-2 hover:w-3 transition-all duration-100 cursor-col-resize select-none"
          style={{ backgroundColor: isDragging ? '#d4d4d8' : undefined }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={`w-full h-full absolute inset-0 transition-colors ${isDragging ? 'bg-zinc-400' : 'bg-zinc-200 group-hover:bg-zinc-300'}`} />
          {/* Handle dots */}
          <div className="relative z-10 flex flex-col gap-1 pointer-events-none">
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-zinc-900' : 'bg-zinc-400 group-hover:bg-zinc-600'}`} />
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-zinc-900' : 'bg-zinc-400 group-hover:bg-zinc-600'}`} />
          </div>
          {/* Reset button — appears on hover */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={resetSplit}
            title="Reset 50/50"
            className="absolute top-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-zinc-300 rounded text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 text-[10px] px-1 py-0.5 shadow-xs leading-none"
          >
            ⇔
          </button>
        </div>

        {/* Right: Questions */}
        <div
          ref={rightPanelRef}
          className="overflow-y-auto bg-gray-50 px-6 py-5 max-md:w-full"
          style={{ width: isMobile ? '100%' : `${100 - splitRatio}%` }}
        >
          {useGroups ? (
            // New group-based rendering
            (() => {
              let groupOffset = passageStartIdx
              return sortedQuestionGroups.map((group, gi) => {
                const el = (
                  <GroupBlock
                    key={group.id || gi}
                    group={group}
                    answers={answers}
                    onAnswer={onAnswer}
                    globalOffset={groupOffset}
                    previewMode={previewMode}
                    showAnswers={showAnswers}
                  />
                )
                groupOffset += (group.questions || []).length
                return el
              })
            })()
          ) : (
            // Backward compat: flat questions grouped by type
            groupByType(passageQuestions).map((group, gi) => {
              const from = passageStartIdx + group.startOffset + 1
              const to = from + group.qs.length - 1
              return (
                <div key={gi}>
                  <TypeHeader type={group.type} from={from} to={to} />
                  {group.qs.map((q, qi) => (
                    <QuestionBlock
                      key={q.id}
                      q={q}
                      globalIdx={passageStartIdx + group.startOffset + qi}
                      answers={answers}
                      onAnswer={onAnswer}
                    />
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom navigator bar — 2 rows */}
      {!previewMode && (
        <div ref={bottomBarRef} className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* Row 1: question numbers for active passage only (collapsible) */}
          {showNavNumbers && (
            <div className="px-6 py-4 border-b border-gray-100 flex justify-center bg-white">
              <div className="flex flex-wrap gap-3 justify-center max-w-5xl">
                {currentPassageNavItems.map(({ number, qId }) => (
                  <QuestionNavButton
                    key={number}
                    number={number}
                    status={qId && answers[qId] ? 'answered' : 'unanswered'}
                    onClick={() => jumpToQuestion(number)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 2: controls & Passage Pills */}
          <div className="px-6 h-14 flex items-center justify-between gap-6">
            {/* Left: icons + Grid toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                title="Bảng câu hỏi"
                aria-label="Bảng câu hỏi"
                onClick={() => setShowQuestionPanel(v => !v)}
                className={`w-9 h-9 flex items-center justify-center rounded-md border transition-all cursor-pointer ${
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
                className="w-9 h-9 flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 transition-all cursor-pointer"
              >
                {showNavNumbers ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Middle: Passage Pills */}
            <PassagePills
              items={passagePillsItems}
              activeIndex={activePassage}
              onChange={setActivePassage}
            />

            {/* Right: Submit Button */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium h-9 px-4 rounded-md shadow-xs transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center leading-none"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question panel — popup bottom-left above bottom bar (shared component) */}
      {showQuestionPanel && (
        <QuestionPanelPopover
          bottomOffset={bottomBarHeight + 8}
          activeIndex={activePassage}
          onClose={() => setShowQuestionPanel(false)}
          onJump={jumpToQuestion}
          groups={exam.passages.map(p => ({
            label: `Passage ${p.number}`,
            items: [...getPassageNavItems(p)]
              .sort((a, b) => a.number - b.number)
              .map(({ number, qId }) => ({ number, answered: !!(qId && answers[qId]), ref: number })),
          }))}
        />
      )}

      {/* Confirm submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="p-6 shadow-xl max-w-sm w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">Nộp bài?</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Đã làm: <span className="font-mono text-zinc-900 dark:text-zinc-100">{answered}/{totalSlots}</span> câu
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-9 px-4 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-800 text-xs sm:text-sm font-medium rounded-md shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none"
              >
                Tiếp tục làm
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); doSubmit() }}
                disabled={submitting}
                className="flex-1 h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center leading-none"
              >
                {submitting ? 'Đang chấm...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Exit confirmation modal — Back nút trình duyệt */}
      <ExitConfirmModal open={showExitModal} onStay={stayInExam} onLeave={leaveExam} />
    </div>
  )
}
