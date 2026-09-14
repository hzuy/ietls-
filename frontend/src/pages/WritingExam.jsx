import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getWritingExam, submitWritingExam, getWritingStatus, getFullTestStatus, getWritingMyResults, retryWritingGrading } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, isDataEmpty, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBrowserHistoryGuard } from '../hooks/useBrowserHistoryGuard'
import { PenTool, ArrowLeft, Clock, Sparkles, CheckCircle2, RotateCcw, AlertCircle, ChevronRight, X, BarChart2 } from 'lucide-react'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import { renderFeedbackList } from '../utils/feedbackList'
import { isTaskComplete, countUnsubmitted } from '../utils/writingTasks'
import { toImgSrc } from '../utils/media'
import { askAITutor } from '../components/common/AIChatbotDrawer'
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
  const { user } = useAuth()
  const { showToast } = useToast()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('start')
  const [activeTask, setActiveTask] = useState(0)
  const [essays, setEssays] = useState({}) // { taskId: text }
  const [results, setResults] = useState({}) // { taskId: result }
  const [submittedTaskIds, setSubmittedTaskIds] = useState([]) // task đã nộp (kể cả phiên trước)
  const [submitting, setSubmitting] = useState(false)
  const [gradingTask, setGradingTask] = useState(null)
  const [gradingErrors, setGradingErrors] = useState({})
  const [retryingTask, setRetryingTask] = useState(null)
  const [confirmResubmitId, setConfirmResubmitId] = useState(null) // taskId đang chờ xác nhận "Nộp lại"
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WRITING_TIME)
  const [totalMinutes, setTotalMinutes] = useState(DEFAULT_WRITING_TIME / 60) // hiển thị ở start-screen
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

  // Chặn nút Back (<) của trình duyệt khi đang làm bài
  const { showModal: showExitModal, stay: stayInExam, leave: leaveExam } = useBrowserHistoryGuard(phase === 'exam' && !allSubmitted, persistDraftNow)

  // Khi đã nộp hết cả 2 task (hoặc bài chỉ có 1 task và đã nộp) → clear draft
  useEffect(() => {
    if (!allSubmitted) return
    if (user) clearDraft(user.id || user._id, id, 'writing')
  }, [allSubmitted, user, id])

  // ── Autosave draft ─────────────────────────────────────────────────────────
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

  const loadExam = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.writing_time)
        if (!isNaN(mins) && mins > 0) { setTimeLeft(mins * 60); setTotalMinutes(mins) }
      })
      .catch(() => {})
    Promise.all([
      getWritingExam(id),
      getWritingMyResults(id).catch(() => []),
    ])
      .then(([data, myResults]) => {
        setExam(data)

        const restoredResults = {}
        const restoredIds = []
        const restoredErrors = {}
        if (Array.isArray(myResults)) {
          for (const entry of myResults) {
            if (!entry || entry.taskId == null) continue
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

        let draftEssays = null
        let draftIds = []
        if (resumeMode && user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'writing')
          if (draft?.data && !isDataEmpty(draft.data)) {
            draftEssays = draft.data.essays || {}
            draftIds = Array.isArray(draft.data.submittedTaskIds) ? draft.data.submittedTaskIds : []
            setEssays(draftEssays)
            setSubmittedTaskIds(prev => Array.from(new Set([...prev, ...draftIds])))
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
          setPhase('exam')
        }
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
      setSubmitting(false)
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
        setSubmitting(false)
      } else if (res.status === 'failed') {
        setGradingErrors(prev => ({ ...prev, [task.id]: { error: res.error || 'Lỗi chấm bài AI', answerId: res.answerId ?? answerId } }))
        setSubmitting(false)
        setGradingTask(null)
        setRetryingTask(null)
      } else {
        // Still pending or grading
        pollTimerRef.current = setTimeout(() => pollStatus(answerId, task, pollCount + 1), 3000)
      }
    } catch (err) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: err.response?.data?.message || 'Lỗi kiểm tra kết quả chấm', answerId } }))
      setSubmitting(false)
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
      if (r.answerId && r.status === 'pending') {
        pollStatus(r.answerId, task)
      } else {
        setResults(prev => ({ ...prev, [task.id]: r }))
        setSubmitting(false)
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
      pollStatus(r.answerId, task)
    } catch (e) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: e.response?.data?.message || 'Lỗi chấm lại, thử lại nhé!', answerId: entry.answerId } }))
      setSubmitting(false)
      setGradingTask(null)
      setRetryingTask(null)
    }
  }

  // "Nộp lại" (Task 3) — cho task ĐÃ chấm xong viết lại từ đầu. Chỉ xoá state cục
  // bộ (results/submittedTaskIds/gradingErrors); bản ghi WritingAnswer cũ trong DB
  // giữ nguyên — /submit luôn tạo bản ghi MỚI, my-results tự ưu tiên bản mới nhất.
  const handleResubmit = (task) => {
    setResults(prev => {
      if (!(task.id in prev)) return prev
      const next = { ...prev }
      delete next[task.id]
      return next
    })
    setSubmittedTaskIds(ids => ids.filter(tid => tid !== task.id))
    clearTaskError(task.id)
    setConfirmResubmitId(null)
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

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-zinc-50/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 max-w-md w-full text-center flex flex-col items-center transition-all duration-300">
        <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <PenTool className="w-8 h-8 text-zinc-700 stroke-[1.75]" />
        </div>
        <h1 className="text-zinc-900 text-xl font-bold mb-2 tracking-tight">{exam.title}</h1>
        <p className="text-zinc-600 text-sm mb-1">{exam.writingTasks.length} Tasks</p>
        <p className="text-zinc-600 text-sm mb-6">Thời gian: <span className="font-bold text-zinc-900">{totalMinutes} phút</span></p>

        <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-5 text-left text-sm text-zinc-600 mb-8 flex flex-col gap-2.5 leading-relaxed w-full">
          <p className="m-0">• Task 1: mô tả biểu đồ/bản đồ — tối thiểu 150 từ (~20 phút)</p>
          <p className="m-0">• Task 2: viết luận — tối thiểu 250 từ (~40 phút)</p>
          <p className="m-0">• AI chấm điểm theo 4 tiêu chí IELTS</p>
          <p className="m-0">• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        
        <button
          onClick={() => setPhase('exam')}
          className="btn-primary w-full text-sm font-bold transition-all duration-300"
          style={{ width: '100%', padding: '12px 0', borderRadius: '9999px', marginBottom: 8 }}
        >
          Bắt đầu làm bài
        </button>
        <button
          onClick={handleBack}
          className="w-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200 ease-in-out font-medium text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ width: '100%', padding: '12px 0', borderRadius: '9999px' }}
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" /> Quay lại
        </button>
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────
  if (allDone) {
    const taskScores = exam.writingTasks.map(t => results[t.id]?.overall).filter(s => s != null)
    const avg = taskScores.length > 0 ? taskScores.reduce((a, b) => a + b, 0) / taskScores.length : 0
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2
    return (
      <div className="min-h-screen bg-zinc-50/50 text-zinc-600 font-sans">
        {/* Header */}
        <div className="bg-[var(--ink)] border-b border-zinc-800 px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-white text-xl font-bold tracking-tight m-0">Kết quả Writing — AI chấm bài</h1>
            <p className="text-zinc-400 text-xs mt-1 m-0 font-medium">{exam.title}</p>
          </div>
        </div>

        {/* Content */}
        <div className="app-container section-py">
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            {/* ── Bento Score Hero Card ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Bento Col 1: Overall Band & Score (lg:col-span-4) */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  Overall Band Score
                </span>
                <div className="w-24 h-24 rounded-full border-4 border-zinc-900 flex items-center justify-center mb-3">
                  <span className="text-4xl font-extrabold font-mono tabular-nums text-zinc-900">
                    {overallBand}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã hoàn thành {exam.writingTasks.length} Tasks
                </div>
              </div>

              {/* Bento Col 2: Breakdown per Task (lg:col-span-5) */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                      Điểm từng Task
                    </span>
                    <span className="text-xs font-semibold text-zinc-500">
                      Writing Academic
                    </span>
                  </div>
                  <div className="space-y-3">
                    {exam.writingTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-zinc-100 font-semibold text-zinc-700 flex items-center justify-center text-[11px]">
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
                <div className="pt-3 mt-3 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between">
                  <span>Tiêu chuẩn chấm:</span>
                  <span className="font-medium text-zinc-700">TR · CC · LR · GRA</span>
                </div>
              </div>

              {/* Bento Col 3: Quick Actions (lg:col-span-3) */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => askAITutor(`Tôi vừa hoàn thành bài thi Writing "${exam.title}" với điểm Overall Band ${overallBand} (${exam.writingTasks.map(t => `Task ${t.number}: Band ${results[t.id]?.overall}`).join(', ')}). Nhờ AI phân tích các tiêu chí cần ưu tiên nâng điểm và gợi ý bài tập luyện tập cụ thể giúp tôi.`)}
                  className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Hỏi AI Tutor phân tích
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/progress')}
                  className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium border border-zinc-200 hover:bg-zinc-100 text-zinc-900 transition-colors flex items-center justify-center gap-2 cursor-pointer bg-white shadow-xs"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
                  Xem bảng phân tích
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/writing')}
                  className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  Về danh sách đề
                </button>
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

                            <div className="text-zinc-600 text-xs leading-relaxed font-medium mb-4 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                              {comment || 'Chưa có nhận xét chi tiết.'}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => askAITutor(`Tôi đang cần nâng band tiêu chí "${label}" trong IELTS Writing Task ${task.number} (hiện tại: Band ${score ?? '–'}). Nhận xét của giám khảo: "${comment}". Bạn hãy phân tích chi tiết điểm yếu, gợi ý cấu trúc câu và từ vựng band 7.5+ để cải thiện tiêu chí này giúp tôi.`)}
                            className="w-full h-9 px-4 rounded-full text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-auto"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Hỏi AI cách nâng band tiêu chí này
                          </button>
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
          ) : taskDone ? (
            <div className="flex-1 bg-white rounded-2xl border border-zinc-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 text-emerald-600">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="font-bold text-zinc-900 text-lg mb-1">Task {task.number} đã được nộp!</p>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">Kết quả chi tiết từ AI sẽ hiển thị sau khi hoàn thành tất cả các tasks của bài thi viết.</p>
              {exam.writingTasks.length > 1 && activeTask < exam.writingTasks.length - 1 && !isTaskDone(exam.writingTasks[activeTask + 1]?.id) && (
                <button onClick={() => setActiveTask(activeTask + 1)} className="btn-primary h-9 px-4 rounded-full text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center justify-center">
                  Làm Task {task.number + 1} →
                </button>
              )}
              {/* Task 3: "Nộp lại" — hành động phụ, xác nhận 2 bước, không xoá bản ghi cũ */}
              <div className="mt-5 pt-5 border-t border-zinc-100 w-full">
                {confirmResubmitId === task.id ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-zinc-500 text-xs leading-relaxed m-0">Nộp lại sẽ ghi đè kết quả hiển thị bằng bài viết mới — bài cũ vẫn được lưu lại.</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleResubmit(task)} className="h-9 px-4 rounded-full text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none">
                        Xác nhận nộp lại
                      </button>
                      <button onClick={() => setConfirmResubmitId(null)} className="h-9 px-4 rounded-full text-sm font-medium bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none">
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmResubmitId(task.id)}
                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-900 underline decoration-dotted transition-colors cursor-pointer bg-transparent border-none"
                  >
                    Nộp lại Task {task.number}
                  </button>
                )}
              </div>
            </div>
          ) : gradingTask === task.id ? (
            <div className="flex-1 bg-white rounded-2xl border border-zinc-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-bold text-zinc-900 text-lg mb-1 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-zinc-700 animate-pulse" />
                AI đang chấm bài Task {task.number}...
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed">Hệ thống đang xử lý bài viết của bạn. Vui lòng chờ trong giây lát.</p>
            </div>
          ) : (
            <>
              {taskGradingError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    Nộp bài không thành công: {taskGradingError.error}
                  </span>
                  <button
                    onClick={() => submitTask(task)}
                    className="ml-3 h-8 px-3.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử nộp lại
                  </button>
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
                  className="flex-1 p-8 text-zinc-800 text-sm leading-relaxed resize-none focus:outline-none bg-white font-normal"
                  placeholder={`Bắt đầu viết Task ${task.number} tại đây...`}
                  value={taskEssay}
                  onChange={e => setEssay(task.id, e.target.value)}
                />
              </div>
              <button
                onClick={() => submitTask(task)}
                disabled={submitting || words < 50}
                className="mt-4 btn-primary h-9 px-5 rounded-full font-medium text-xs sm:text-sm w-full transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer leading-none">
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Đang chấm điểm...
                  </>
                ) : (
                  `Nộp Task ${task.number} để AI chấm`
                )}
              </button>
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
                className={`h-9 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-all cursor-pointer ${
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
            className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium h-9 px-5 rounded-full shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 leading-none"
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

      {/* Exit confirmation modal — Back nút trình duyệt */}
      <ExitConfirmModal open={showExitModal} onStay={stayInExam} onLeave={leaveExam} />
    </div>
  )
}
