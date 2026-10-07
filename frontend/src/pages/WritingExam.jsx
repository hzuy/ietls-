import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getWritingExam, submitWritingExam, getWritingStatus, getFullTestStatus, getWritingMyResults, retryWritingGrading } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, isDataEmpty, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBrowserHistoryGuard } from '../hooks/useBrowserHistoryGuard'
import { Clock, Sparkles, CheckCircle2, RotateCcw, AlertCircle, ChevronRight, X, History } from 'lucide-react'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import { renderFeedbackList } from '../utils/feedbackList'
import { isTaskComplete, countUnsubmitted } from '../utils/writingTasks'
import { toImgSrc } from '../utils/media'
import ExitConfirmModal from '../components/common/ExitConfirmModal'

const DEFAULT_WRITING_TIME = 60 * 60

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function wc(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const CRITERIA_LABELS = {
  task_achievement: 'Task Achievement',
  coherence_cohesion: 'Coherence & Cohesion',
  lexical_resource: 'Lexical Resource',
  grammatical_range: 'Grammatical Range & Accuracy',
}

function ImageLightbox({ src, onClose }) {
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div
      onClick={onClose}
      className="p-3 sm:p-6"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}
    >
      <button
        onClick={onClose}
        className="bg-white/15 hover:bg-white/25 transition-colors"
        style={{ position: 'fixed', top: 16, right: 20, zIndex: 10000, border: 'none', color: 'white', borderRadius: '50%', width: 44, height: 44, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
      >✕</button>
      <img
        src={src}
        alt="Task visual fullsize"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain', cursor: 'default' }}
      />
    </div>
  )
}

export default function WritingExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resumeMode = searchParams.get('resume') === 'true'
  const viewResultMode = searchParams.get('viewResult') === 'true'
  const { user } = useAuth()
  const { showToast } = useToast()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('exam')
  const [activeTask, setActiveTask] = useState(0)
  const [essays, setEssays] = useState({}) // { taskId: text }
  const [results, setResults] = useState({}) // { taskId: result }
  const [submittedTaskIds, setSubmittedTaskIds] = useState([]) // task đã nộp (kể cả phiên trước)
  const [submitting, setSubmitting] = useState(false)
  const [gradingTask, setGradingTask] = useState(null)
  const [gradingErrors, setGradingErrors] = useState({})
  const [retryingTask, setRetryingTask] = useState(null)
  const [confirmResubmitId, setConfirmResubmitId] = useState(null) // taskId đang chờ xác nhận "Nộp lại"
  const [hasPastResults, setHasPastResults] = useState(false)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WRITING_TIME)
  const [lightbox, setLightbox] = useState(null)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const pollTimerRef = useRef(null)

  // ── Hết giờ → tự động nộp ──────────────────────────────────────────────────
  const [timeUp, setTimeUp] = useState(false)
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(5)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [autoSubmitError, setAutoSubmitError] = useState(false)
  const autoSubmitDoneRef = useRef(false)

  // ── Layout mobile ──────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('prompt') // 'prompt' | 'writing'
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const writingTasks = exam?.writingTasks || []
  const allSubmitted = writingTasks.length > 0 && writingTasks.every(t => results[t.id])
  const isTaskDone = (tid) => isTaskComplete(tid, results, submittedTaskIds)

  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // ── Autosave draft ─────────────────────────────────────────────────────────
  // Khai báo persistDraftNow TRƯỚC mọi chỗ dùng nó bên dưới (beforeunload effect,
  // useBrowserHistoryGuard) — const bị TDZ nếu tham chiếu trước khi khai báo.
  const autosaveRef = useRef(null)
  useEffect(() => {
    autosaveRef.current = {
      essays, submittedTaskIds, timeLeft,
      userId: user ? (user.id || user._id) : null,
    }
  })
  const persistDraftNow = useCallback(() => {
    const { essays, submittedTaskIds, timeLeft, userId } = autosaveRef.current
    if (!userId || !id) return
    const data = { essays, submittedTaskIds }
    // P3-2: đừng để data rỗng ghi đè một draft cũ không rỗng
    if (isDataEmpty(data)) {
      const existing = loadDraft(userId, id, 'writing')
      if (existing && !isDataEmpty(existing.data)) return
    }
    saveDraft({ userId, examId: id, skillType: 'writing', data, timeRemaining: timeLeft })
    setLastSavedAt(new Date())
  }, [id])
  useEffect(() => {
    if (phase !== 'exam') return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, id, persistDraftNow])

  // Cảnh báo trình duyệt (beforeunload) khi thí sinh đóng tab/F5 trong lúc làm bài
  useEffect(() => {
    if (phase !== 'exam' || allSubmitted) return
    const handleBeforeUnload = (e) => {
      persistDraftNow()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase, allSubmitted, persistDraftNow])

  const exitPath = exam?.seriesId ? `/full-test/${exam.seriesId}?book=${exam.bookNumber}` : '/writing-samples'
  const { showModal: showExitModal, stay: stayInExam, leave: leaveExam } = useBrowserHistoryGuard(phase === 'exam' && !allSubmitted, persistDraftNow, exitPath)

  // Khi đã nộp hết cả 2 task (hoặc bài chỉ có 1 task và đã nộp) → clear draft
  useEffect(() => {
    if (!allSubmitted) return
    if (user) clearDraft(user.id || user._id, id, 'writing')
  }, [allSubmitted, user, id])

  const loadExam = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.writing_time)
        if (!isNaN(mins) && mins > 0) { setTimeLeft(mins * 60) }
      })
      .catch(() => {})
    Promise.all([
      getWritingExam(id),
      getWritingMyResults(id).catch(() => []),
    ])
      .then(([data, myResults]) => {
        setExam(data)

        let draftEssays = null
        let draftIds = []
        let activeDraft = false
        if (user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'writing')
          // Cho phép resume tự động nếu có draft, kể cả không có ?resume=true
          if (draft?.data && !isDataEmpty(draft.data)) {
            draftEssays = draft.data.essays || {}
            draftIds = Array.isArray(draft.data.submittedTaskIds) ? draft.data.submittedTaskIds : []
            activeDraft = true
            setEssays(draftEssays)
            setSubmittedTaskIds(prev => Array.from(new Set([...prev, ...draftIds])))
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
        }

        const restoredResults = {}
        const restoredIds = []
        const restoredErrors = {}
        if (Array.isArray(myResults)) {
          if (myResults.length > 0) setHasPastResults(true)
          for (const entry of myResults) {
            if (!entry || entry.taskId == null) continue
            // NẾU KHÔNG ở chế độ xem lại (viewResultMode),
            // CHỈ khôi phục kết quả của những task nằm trong draft (thuộc attempt hiện tại đang làm dở).
            // Nếu không có draft, bỏ qua toàn bộ kết quả cũ.
            if (!viewResultMode && (!activeDraft || !draftIds.includes(entry.taskId))) continue;

            if (entry.status === 'graded') {
              restoredResults[entry.taskId] = entry
              restoredIds.push(entry.taskId)
            } else if (entry.status === 'failed') {
              restoredErrors[entry.taskId] = { error: entry.error, answerId: entry.answerId }
            }
          }
        }
        if (restoredIds.length > 0) {
          setResults(prev => ({ ...restoredResults, ...prev }))
          setSubmittedTaskIds(prev => Array.from(new Set([...prev, ...restoredIds])))
        }
        if (Object.keys(restoredErrors).length > 0) {
          setGradingErrors(prev => ({ ...restoredErrors, ...prev }))
        }
        
        setPhase('exam')
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Không tìm thấy đề thi hoặc kết nối bị gián đoạn.')
      })
      .finally(() => setLoading(false))
  }, [id, resumeMode, user])

  useEffect(() => {
    document.title = 'Bài thi Writing | IELTS Pro'
    loadExam()
  }, [loadExam])

  useEffect(() => {
    if (!exam) return
    const allTasksDone = exam.writingTasks.every(t => results[t.id])
    if (allTasksDone && exam.writingTasks.length > 0) {
      getFullTestStatus(id)
        .then(data => { if (data.isComplete) setFullTestStatus(data) })
        .catch(() => {})
    }
  }, [results, exam])

  const handleBack = () => {
    if (exam?.seriesId) {
      navigate(`/full-test/${exam.seriesId}?book=${exam.bookNumber}`)
    } else {
      navigate('/writing')
    }
  }

  useEffect(() => {
    if (phase !== 'exam') return
    if (timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft])

  // Đồng hồ chạm 0 giữa lúc thi → lưu bản nháp cuối + bật modal chặn (một lần).
  useEffect(() => {
    if (phase !== 'exam' || timeLeft > 0) return
    if (timeUp || autoSubmitting || allSubmitted || autoSubmitDoneRef.current) return
    persistDraftNow()
    setTimeUp(true)
  }, [phase, timeLeft, timeUp, autoSubmitting, allSubmitted, persistDraftNow])


  // Đồng bộ mobileView theo task đang xem: đổi task → về 'prompt' (đọc đề trước);
  // task đã nộp / đang chấm → ép 'writing' để thấy card trạng thái thay vì bị che.
  // Deps KHÔNG có `essays` → gõ bài không làm effect chạy lại → toggle tay giữ nguyên.
  useEffect(() => {
    if (!exam) return
    const t = exam.writingTasks[activeTask]
    if (!t) return
    const done = !!results[t.id] || submittedTaskIds.includes(t.id)
    setMobileView(done || gradingTask === t.id ? 'writing' : 'prompt')
  }, [exam, activeTask, results, submittedTaskIds, gradingTask])

  const setEssay = (taskId, text) => setEssays(e => ({ ...e, [taskId]: text }))

  const clearTaskError = (taskId) => setGradingErrors(prev => {
    if (!(taskId in prev)) return prev
    const next = { ...prev }
    delete next[taskId]
    return next
  })

  const pollStatus = async (answerId, task, pollCount = 0) => {
    if (pollCount >= 30) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: 'Hết thời gian chờ chấm bài (90 giây). Vui lòng thử lại.', answerId } }))
      setGradingTask(null)
      setRetryingTask(null)
      return
    }

    try {
      const res = await getWritingStatus(answerId)
      if (res.status === 'graded') {
        setResults(prev => ({ ...prev, [task.id]: res }))
        setGradingTask(null)
        setRetryingTask(null)
        clearTaskError(task.id)
      } else if (res.status === 'failed') {
        setGradingErrors(prev => ({ ...prev, [task.id]: { error: res.error || 'Lỗi chấm bài AI', answerId: res.answerId ?? answerId } }))
        setGradingTask(null)
        setRetryingTask(null)
      } else {
        // Still pending or grading
        pollTimerRef.current = setTimeout(() => pollStatus(answerId, task, pollCount + 1), 3000)
      }
    } catch (err) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: err.response?.data?.message || 'Lỗi kiểm tra kết quả chấm', answerId } }))
      setGradingTask(null)
      setRetryingTask(null)
    }
  }

  const submitTask = async (task) => {
    const essay = essays[task.id] || ''
    if (wc(essay) < 50) { showToast('Bài viết cần ít nhất 50 từ!', 'error'); return }
    setSubmitting(true)
    clearTaskError(task.id)
    setGradingTask(task.id)
    try {
      const r = await submitWritingExam(id, task.id, essay)
      setSubmittedTaskIds(ids => ids.includes(task.id) ? ids : [...ids, task.id])
      
      const currentIndex = exam.writingTasks.findIndex(t => t.id === task.id)
      if (currentIndex >= 0 && currentIndex < exam.writingTasks.length - 1) {
        setActiveTask(currentIndex + 1)
      }
      
      setSubmitting(false) // Release global submitting lock immediately

      if (r.answerId && r.status === 'pending') {
        pollStatus(r.answerId, task)
      } else {
        setResults(prev => ({ ...prev, [task.id]: r }))
        setGradingTask(null)
      }
    } catch (e) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: e.response?.data?.message || 'Lỗi nộp bài, thử lại nhé!' } }))
      setSubmitting(false)
      setGradingTask(null)
    }
  }

  // Chấm lại bài ĐÃ nộp (status='failed') từ essayText đã lưu — không cần viết lại.
  // Khác handleResubmit (Task 3): dùng khi lỗi hạ tầng AI, không phải muốn đổi nội dung.
  const retryTask = async (task) => {
    const entry = gradingErrors[task.id]
    if (!entry?.answerId || retryingTask) return
    setRetryingTask(task.id)
    setSubmitting(true)
    clearTaskError(task.id)
    setGradingTask(task.id)
    try {
      const r = await retryWritingGrading(entry.answerId)
      setSubmitting(false)
      pollStatus(r.answerId, task)
    } catch (e) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: e.response?.data?.message || 'Lỗi chấm lại, thử lại nhé!', answerId: entry.answerId } }))
      setSubmitting(false)
      setGradingTask(null)
      setRetryingTask(null)
    }
  }

  // ── Auto-submit khi hết giờ ────────────────────────────────────────────────
  // Nộp mọi task chưa hoàn thành với cờ autoSubmit (backend bỏ qua gate 50 từ;
  // bài rỗng/quá ngắn → band 0 trả về ngay, không qua Groq). Tái dùng pollStatus
  // cho task ≥ 50 từ. Task đã xong (isTaskDone) không bị đụng. Chạy đúng 1 lần.
  const runAutoSubmit = useCallback(async () => {
    if (autoSubmitDoneRef.current) return
    autoSubmitDoneRef.current = true
    setTimeUp(false)
    setAutoSubmitError(false)
    setAutoSubmitting(true)
    persistDraftNow()
    for (const t of (exam?.writingTasks || [])) {
      if (isTaskComplete(t.id, results, submittedTaskIds)) continue
      try {
        const r = await submitWritingExam(id, t.id, essays[t.id] || '', true)
        setSubmittedTaskIds(ids => ids.includes(t.id) ? ids : [...ids, t.id])
        if (r.answerId && r.status === 'pending') {
          pollStatus(r.answerId, t)
        } else {
          setResults(prev => ({ ...prev, [t.id]: r }))
        }
      } catch {
        autoSubmitDoneRef.current = false // cho phép bấm "Thử lại"
        setAutoSubmitError(true)
      }
    }
  }, [exam, results, submittedTaskIds, essays, id, persistDraftNow])

  // Đếm ngược 5s trong modal hết giờ → tự kích hoạt nộp nếu user không bấm.
  // Tick + gọi runAutoSubmit đều nằm trong callback của interval (bất đồng bộ) để
  // không setState đồng bộ trong effect. Countdown luôn bắt đầu từ 5.
  useEffect(() => {
    if (!timeUp) return
    let n = 5
    const iv = setInterval(() => {
      n -= 1
      setAutoSubmitCountdown(n)
      if (n <= 0) { clearInterval(iv); runAutoSubmit() }
    }, 1000)
    return () => clearInterval(iv)
  }, [timeUp, runAutoSubmit])

  if (loading) return <SkeletonExamPage />
  if (error || !exam) {
    return (
      <ExamErrorState
        title="Không thể tải đề thi Writing"
        message={error || 'Không tìm thấy đề thi hoặc đề thi đã bị gỡ bỏ.'}
        onRetry={loadExam}
        onBack={handleBack}
        backLabel="Quay lại danh sách"
      />
    )
  }

  const allDone = exam.writingTasks.every(t => results[t.id])


  // ── Result ────────────────────────────────────────────────────
  if (allDone) {
    const taskScores = exam.writingTasks.map(t => results[t.id]?.overall).filter(s => s != null)
    const avg = taskScores.length > 0 ? taskScores.reduce((a, b) => a + b, 0) / taskScores.length : 0
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2
    return (
      <div className="min-h-screen bg-zinc-50/50 text-zinc-600 font-sans">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3 flex items-center">
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center' }}>
            <p className="font-bold text-sm text-zinc-900 m-0">
              Kết quả Writing — AI chấm bài
            </p>
            <p className="text-xs text-zinc-500 m-0">
              {exam.title}
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Đóng"
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold cursor-pointer flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-16">
          <div className="flex flex-col gap-8">
            {/* ── Score Card Hero Section ── */}
            <div className="w-full max-w-4xl mx-auto bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Cột 1: Vòng tròn Band Score & thông tin tổng quan */}
                <div className="flex items-center justify-center gap-4">
                  <div className="w-20 h-20 rounded-full border-4 border-zinc-900 flex items-center justify-center shrink-0">
                    <span className="text-3xl font-extrabold font-mono tabular-nums text-zinc-900">
                      {overallBand}
                    </span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Overall Band Score
                    </span>
                    <p className="text-sm font-bold text-zinc-900 m-0">
                      IELTS Writing Academic
                    </p>
                    <p className="text-xs text-zinc-500 m-0 mt-0.5">
                      Hoàn thành: {exam.writingTasks.length} Tasks
                    </p>
                  </div>
                </div>

                {/* Cột 2: Điểm thành phần rút gọn (TR, CC, LR, GRA) */}
                <div className="flex flex-col justify-center items-center md:items-start border-t md:border-t-0 md:border-x border-zinc-100 px-6 py-2 gap-2">
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Điểm từng Task
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      TR · CC · LR · GRA
                    </span>
                  </div>
                  <div className="w-full space-y-1.5">
                    {exam.writingTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs w-full">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-100 font-semibold text-zinc-700 flex items-center justify-center text-[10px]">
                            T{t.number}
                          </span>
                          <span className="font-semibold text-zinc-800">Task {t.number}</span>
                          <span className="text-zinc-400 font-mono text-[11px]">({results[t.id]?.wordCount || 0} từ)</span>
                        </div>
                        <span className="font-mono font-extrabold text-sm text-zinc-900">
                          Band {results[t.id]?.overall ?? '–'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cột 3: Nút hành động */}
                <div className="flex flex-col gap-2.5 justify-center w-full max-w-[220px] mx-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (user) {
                        clearDraft(user.id || user._id, id, 'writing')
                        saveDraft({
                          userId: user.id || user._id,
                          examId: id,
                          skillType: 'writing',
                          data: { essays: {}, submittedTaskIds: [], isRetake: true },
                          timeRemaining: DEFAULT_WRITING_TIME
                        })
                      }
                      window.location.href = window.location.pathname
                    }}
                    className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Làm lại bài thi</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Per-task results */}
            {exam.writingTasks.map(task => {
              const r = results[task.id]
              if (!r) return null
              return (
                <div key={task.id} className="flex flex-col gap-6">
                  <h2 className="text-zinc-900 text-lg font-semibold tracking-tight m-0 border-b border-zinc-200 pb-2">
                    Task {task.number}
                  </h2>
                  
                  {/* Task score overview */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 text-center transition-all duration-300">
                    <div className="text-5xl font-extrabold font-mono tracking-tight mb-1" style={{ color: 'var(--ink)' }}>
                      {r.overall}
                    </div>
                    <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Band Score</div>
                    <div className="text-zinc-500 text-xs font-mono">{r.wordCount} từ</div>
                  </div>

                  {/* 4 Criteria Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(CRITERIA_LABELS).map(([key, label]) => {
                      const crit = r.criteria?.[key]
                      const score = crit?.score
                      const comment = crit?.comment || ''

                      return (
                        <div key={key} className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 flex flex-col justify-between transition-all duration-300 hover:border-zinc-300">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-zinc-900 text-sm font-bold tracking-tight">{label}</span>
                              <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-900 text-xs font-mono font-bold border border-zinc-200">
                                Band {score ?? '–'}
                              </span>
                            </div>

                            <div className="text-4xl font-black font-mono mb-3 tracking-tight text-zinc-900">
                              {score ?? '–'}
                            </div>

                            <div className="text-zinc-600 text-xs leading-relaxed font-medium mb-1 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                              {comment || 'Chưa có nhận xét chi tiết.'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Strengths */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 transition-all duration-300">
                    <p className="text-zinc-900 text-sm font-bold mb-3">Điểm mạnh (Strengths)</p>
                    {renderFeedbackList(r.strengths, 'text-emerald-500')}
                  </div>

                  {/* Improvements */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 transition-all duration-300">
                    <p className="text-zinc-900 text-sm font-bold mb-3">Điểm cần cải thiện & Gợi ý (Improvements)</p>
                    {renderFeedbackList(r.improvements, 'text-orange-500')}
                  </div>
                </div>
              )
            })}

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-4">
              {fullTestStatus?.isComplete && (
                <button
                  onClick={() => navigate(`/full-test/result?seriesId=${fullTestStatus.seriesId}&bookNumber=${fullTestStatus.bookNumber}&testNumber=${fullTestStatus.testNumber}`)}
                  className="btn-primary w-full h-9 px-5 text-xs sm:text-sm font-medium rounded-full shadow-xs transition-colors cursor-pointer flex items-center justify-center"
                >
                  Xem kết quả Full Test →
                </button>
              )}
              <button 
                type="button"
                onClick={() => navigate('/writing')} 
                className="w-full h-9 px-5 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 bg-white rounded-full text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center justify-center"
              >
                Làm đề khác
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Exam ──────────────────────────────────────────────────────
  const task = exam.writingTasks[activeTask]
  const taskEssay = essays[task.id] || ''
  const words = wc(taskEssay)
  const minWords = task.minWords || (task.number === 1 ? 150 : 250)
  const taskDone = isTaskDone(task.id)
  const taskGradingError = gradingErrors[task.id] || null

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Header */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
            {exam.title}
          </span>
          {hasPastResults && !viewResultMode && !allDone && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.set('viewResult', 'true')
                navigate(`?${params.toString()}`, { replace: true })
                window.location.reload()
              }}
              className="ml-2 h-7 px-3 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <History className="w-3 h-3" />
              Xem kết quả cũ
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastSavedAt && (
            <span className="text-[11px] text-zinc-400 whitespace-nowrap">
              ✓ Đã lưu {formatSavedAt(lastSavedAt)}
            </span>
          )}
          <div
            className={`tabular-nums text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              timeLeft < 300
                ? 'text-red-600 bg-red-50 border-red-200'
                : timeLeft < 600
                ? 'text-amber-600 bg-amber-50 border-amber-200'
                : 'text-zinc-700 bg-zinc-100 border-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Mobile view toggle — chỉ render trên mobile; state riêng, không đụng activeTask */}
      {isMobile && (
        <div className="flex flex-shrink-0 border-b border-zinc-200 bg-white">
          <button
            onClick={() => setMobileView('prompt')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'prompt' ? 'border-zinc-900 text-zinc-900 bg-zinc-100' : 'border-transparent text-zinc-500'}`}
          >
            Đề bài
          </button>
          <button
            onClick={() => setMobileView('writing')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'writing' ? 'border-zinc-900 text-zinc-900 bg-zinc-100' : 'border-transparent text-zinc-500'}`}
          >
            Bài viết · {words} từ
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task prompt */}
        <div className={`overflow-y-auto bg-white p-6 border-r border-zinc-200 flex flex-col gap-5 ${isMobile ? (mobileView === 'prompt' ? 'w-full' : 'hidden') : 'w-2/5'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-sm flex items-center justify-center">{task.number}</div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Task {task.number}</span>
          </div>
          {task.imageUrl && (
            <div
              onClick={() => setLightbox(toImgSrc(task.imageUrl))}
              className="relative cursor-pointer inline-block w-full group border border-zinc-200 rounded-2xl overflow-hidden"
            >
              <img src={toImgSrc(task.imageUrl)} alt={`Hình ảnh minh họa Task ${task.number}`} className="w-full" />
              <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Phóng to
              </div>
            </div>
          )}
          {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
          <p className="text-zinc-700 text-sm leading-relaxed m-0 font-medium whitespace-pre-line">{task.prompt}</p>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Tối thiểu <span className="font-bold text-zinc-600">{minWords} từ</span></span>
            <span>Khuyến nghị: {task.number === 1 ? '20 phút' : '40 phút'}</span>
          </div>
        </div>

        {/* Right: Essay area */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-zinc-50/50 p-8 ${isMobile && mobileView !== 'writing' ? 'hidden' : ''}`}>
          {taskGradingError?.answerId && !results[task.id] ? (
            // Đã nộp NHƯNG bản chấm mới nhất bị lỗi (vd. model AI đổi/timeout) — vẫn còn
            // essayText đã lưu, cho chấm lại tại chỗ thay vì hiện "đã nộp" giả hoặc treo mãi.
            <div className="flex-1 bg-white rounded-2xl border border-red-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="font-bold text-zinc-900 text-lg mb-1">Chấm bài Task {task.number} không thành công</p>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">{taskGradingError.error}</p>
              <button
                onClick={() => retryTask(task)}
                disabled={retryingTask === task.id}
                className="btn-primary h-9 px-4 rounded-full text-xs sm:text-sm font-medium shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {retryingTask === task.id ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Đang chấm lại...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Thử chấm điểm lại
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {taskGradingError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm shrink-0">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    Nộp bài không thành công: {taskGradingError.error}
                  </span>
                  <button
                    onClick={() => submitTask(task)}
                    className="exam-bar-btn ml-3 h-8 px-3.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử nộp lại
                  </button>
                </div>
              )}
              
              {/* Thông báo nhè nhẹ nếu đang chấm hoặc đã nộp ở góc trên của editor */}
              {(gradingTask === task.id || taskDone) && (
                <div className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shrink-0 ${taskDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                  {taskDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Task {task.number} đã được nộp! Kết quả chi tiết từ AI sẽ hiển thị sau khi hoàn thành tất cả các tasks.
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
                      AI đang chấm bài Task {task.number}... Vui lòng làm tiếp các task khác.
                    </>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden flex-1 flex flex-col">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Bài viết Task {task.number}</span>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${words >= minWords ? 'bg-zinc-900 text-white' : words > 0 ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-100 text-zinc-500'}`}>
                    {words}/{minWords} từ
                  </span>
                </div>
                <textarea
                  className={`flex-1 p-8 text-zinc-800 text-sm leading-relaxed resize-none focus:outline-none font-normal ${(taskDone || gradingTask === task.id) ? 'bg-zinc-50/80 cursor-not-allowed opacity-80' : 'bg-white'}`}
                  placeholder={`Bắt đầu viết Task ${task.number} tại đây...`}
                  value={taskEssay}
                  readOnly={taskDone || gradingTask === task.id}
                  onChange={e => setEssay(task.id, e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-14 px-6 bg-white border-t border-zinc-200 flex items-center justify-between gap-4 shrink-0 z-20">
        {/* Left/Middle: Task palette */}
        <div className="flex items-center gap-2">
          {exam.writingTasks.map((t, i) => {
            const done = isTaskDone(t.id)
            const active = activeTask === i
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTask(i)}
                className={`exam-bar-btn shrink-0 whitespace-nowrap h-9 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-all cursor-pointer ${
                  done
                    ? 'bg-zinc-900 text-white border border-zinc-900'
                    : 'border border-zinc-300 text-zinc-700 bg-white hover:border-zinc-400'
                } ${active ? 'ring-2 ring-zinc-900/20 font-semibold' : ''}`}
              >
                <span>Task {t.number}</span>
                {done && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            )
          })}
        </div>

        {/* Right: Submit button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => submitTask(task)}
            disabled={submitting || words < 50 || taskDone}
            className="exam-bar-btn whitespace-nowrap bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium h-9 px-5 rounded-full shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 leading-none"
          >
            {submitting ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Đang chấm điểm...
              </>
            ) : taskDone ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã nộp Task {task.number}
              </>
            ) : (
              `Nộp Task ${task.number}`
            )}
          </button>
        </div>
      </div>


      {/* Modal hết giờ — CHẶN, không đóng được bằng ESC / click nền */}
      {timeUp && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3 text-zinc-700">
              <Clock className="w-6 h-6 stroke-[2]" />
            </div>
            <h2 className="text-zinc-900 text-lg font-bold mb-2">Hết giờ làm bài</h2>
            <p className="text-zinc-600 text-sm leading-relaxed mb-6">
              Hệ thống sẽ nộp {countUnsubmitted(exam.writingTasks, results, submittedTaskIds)} task chưa hoàn thành của bạn.
            </p>
            <button
              onClick={() => runAutoSubmit()}
              className="w-full h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors cursor-pointer font-medium text-sm inline-flex items-center justify-center leading-none"
            >
              Nộp bài ngay
            </button>
            <p className="text-zinc-400 text-xs mt-3">Tự động nộp sau {autoSubmitCountdown}s</p>
          </div>
        </div>
      )}

      {/* Overlay đang nộp & chấm — đè lên nhánh exam cho tới khi allDone */}
      {autoSubmitting && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center flex flex-col items-center">
            {autoSubmitError ? (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 text-amber-600">
                  <AlertCircle className="w-6 h-6 stroke-[2]" />
                </div>
                <h2 className="text-zinc-900 text-lg font-bold mb-2">Nộp bài chưa hoàn tất</h2>
                <p className="text-zinc-600 text-sm leading-relaxed mb-6">Một số task chưa nộp được. Vui lòng thử lại.</p>
                <button
                  onClick={() => runAutoSubmit()}
                  className="w-full h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors cursor-pointer font-medium text-sm inline-flex items-center justify-center leading-none"
                >
                  Thử lại
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
                <h2 className="text-zinc-900 text-lg font-bold mb-2">Đang nộp &amp; chấm bài…</h2>
                <p className="text-zinc-600 text-sm leading-relaxed">Vui lòng chờ trong giây lát.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Exit confirmation modal — Back nút trình duyệt hoặc nút Header */}
      <ExitConfirmModal open={showExitModal} onStay={stayInExam} onLeave={() => leaveExam(exitPath)} />

      {/* Loading overlay khi nộp bài */}
      {(() => {
        const uncompletedCount = exam.writingTasks.filter(t => !isTaskComplete(t.id, results, submittedTaskIds)).length;
        const isSubmittingLastTask = submitting && uncompletedCount === 1;
        const isPollingFinalResults = uncompletedCount === 0 && !allDone;
        if (isSubmittingLastTask || isPollingFinalResults) {
          return (
            <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-3 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              <p className="text-sm font-medium text-zinc-700">Đang chấm điểm và tổng hợp kết quả...</p>
            </div>
          )
        }
        return null;
      })()}
    </div>
  )
}
