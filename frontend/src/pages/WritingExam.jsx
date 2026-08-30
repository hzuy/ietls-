import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getWritingExam, submitWritingExam, getWritingStatus, getFullTestStatus, getWritingMyResults } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, isDataEmpty } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { PenTool, ArrowLeft } from 'lucide-react'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'
import { renderFeedbackList } from '../utils/feedbackList'

const DEFAULT_WRITING_TIME = 60 * 60
const SERVER_BASE = 'http://localhost:3001'
const toImgSrc = (url) => (url || '').startsWith('/') ? `${SERVER_BASE}${url}` : (url || '')

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
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState('start')
  const [activeTask, setActiveTask] = useState(0)
  const [essays, setEssays] = useState({}) // { taskId: text }
  const [results, setResults] = useState({}) // { taskId: result }
  const [submittedTaskIds, setSubmittedTaskIds] = useState([]) // task đã nộp (kể cả phiên trước)
  const [submitting, setSubmitting] = useState(false)
  const [gradingTask, setGradingTask] = useState(null)
  const [gradingError, setGradingError] = useState(null)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WRITING_TIME)
  const [lightbox, setLightbox] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const pollTimerRef = useRef(null)

  // ── Layout mobile ──────────────────────────────────────────────────────────
  // isMobile: cùng pattern resize listener + breakpoint 768 với ReadingExam.
  // mobileView: CHỈ dùng cho toggle 2 panel trên mobile. Tách biệt HOÀN TOÀN khỏi
  // activeTask và mọi effect/state khác — chuyển view không đụng gì tới bài làm.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('prompt') // 'prompt' | 'writing'
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const writingTasks = exam?.writingTasks || []
  const allSubmitted = writingTasks.length > 0 && writingTasks.every(t => results[t.id])
  const isTaskDone = (tid) => !!results[tid] || submittedTaskIds.includes(tid)

  // Snapshot của draft đã lưu gần nhất — để so cho điều kiện enabled của useExitGuard.
  const [savedDraftJSON, setSavedDraftJSON] = useState('{"essays":{},"submittedTaskIds":[]}')

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // ── Autosave draft ─────────────────────────────────────────────────────────
  // MỘT interval sống suốt phiên (deps [phase, id]). KHÔNG đưa essays/submittedTaskIds/
  // timeLeft/user vào deps — đổi liên tục → interval bị reset, không bao giờ fire.
  // Đọc state mới nhất qua ref. persistDraftNow() còn được useExitGuard gọi ngay
  // tại mọi điểm thoát bài (onBeforeExit).
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
    setSavedDraftJSON(JSON.stringify(data))
  }, [id])
  useEffect(() => {
    if (phase !== 'exam') return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, id, persistDraftNow])

  // Guard thoát: bật khi data hiện tại lệch với draft đã lưu.
  const hasUnsavedWork = JSON.stringify({ essays, submittedTaskIds }) !== savedDraftJSON
  const exitGuard = useExitGuard(phase === 'exam' && hasUnsavedWork, persistDraftNow)

  // Nộp + chấm xong hết → gỡ sentinel + xoá draft
  useEffect(() => {
    if (!allSubmitted) return
    exitGuard.disarm()
    if (user && id) clearDraft(user.id || user._id, id, 'writing')
  }, [allSubmitted, exitGuard.disarm, user, id])

  useEffect(() => {
    document.title = 'Bài thi Writing | IELTS Pro'
    // Fetch writing_time setting from admin settings, fallback to 60 min
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.writing_time)
        if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60)
      })
      .catch(() => {})
    Promise.all([
      getWritingExam(id),
      // Tầng 4: khôi phục kết quả đã chấm từ server — độc lập với resume draft,
      // gọi vô điều kiện. Lỗi ở đây KHÔNG được làm hỏng việc load đề.
      getWritingMyResults(id).catch(() => []),
    ])
      .then(([data, myResults]) => {
        setExam(data)

        // ── Khôi phục kết quả đã chấm (status 'graded') ─────────────────────
        // Chỉ set `results` + `submittedTaskIds` cho task có trong response;
        // KHÔNG đụng `essays` → task chưa nộp vẫn gõ tiếp bình thường.
        const restoredResults = {}
        const restoredIds = []
        if (Array.isArray(myResults)) {
          for (const entry of myResults) {
            if (entry && entry.taskId != null && entry.status === 'graded') {
              restoredResults[entry.taskId] = entry
              restoredIds.push(entry.taskId)
            }
          }
        }
        if (restoredIds.length > 0) {
          // `...prev` sau cùng: nếu polling phiên này vừa set kết quả mới hơn thì giữ nguyên
          setResults(prev => ({ ...restoredResults, ...prev }))
          setSubmittedTaskIds(prev => Array.from(new Set([...prev, ...restoredIds])))
        }

        // ── Resume draft cục bộ (logic cũ, dùng functional update để không
        //    clobber phần submittedTaskIds mà nhánh khôi phục vừa set) ───────
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
          }
          setPhase('exam')
        }

        // Đồng bộ snapshot "đã lưu": khôi phục từ server KHÔNG được tự kích hoạt
        // exit-guard (kết quả graded đã nằm trên server, không có gì để mất).
        // Thứ tự [restoredIds, draftIds] khớp đúng thứ tự 2 functional update ở
        // trên (nhánh khôi phục chạy trước) để JSON.stringify so bằng hasUnsavedWork.
        setSavedDraftJSON(JSON.stringify({
          essays: draftEssays || {},
          submittedTaskIds: Array.from(new Set([...restoredIds, ...draftIds])),
        }))
      })
      .catch(() => navigate('/full-test', { replace: true }))
      .finally(() => setLoading(false))
  }, [id])

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

  useEffect(() => {
    if (!showExitConfirm && !exitGuard.prompt) return
    const handler = (e) => {
      if (e.key === 'Escape') { setShowExitConfirm(false); exitGuard.stay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm, exitGuard.prompt, exitGuard.stay])

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

  const pollStatus = async (answerId, task, pollCount = 0) => {
    if (pollCount >= 30) {
      setGradingError({ taskId: task.id, error: 'Hết thời gian chờ chấm bài (90 giây). Vui lòng thử lại.' })
      setSubmitting(false)
      setGradingTask(null)
      return
    }

    try {
      const res = await getWritingStatus(answerId)
      if (res.status === 'graded') {
        setResults(prev => ({ ...prev, [task.id]: res }))
        setGradingTask(null)
        setGradingError(null)
        setSubmitting(false)
      } else if (res.status === 'failed') {
        setGradingError({ taskId: task.id, error: res.error || 'Lỗi chấm bài AI' })
        setSubmitting(false)
        setGradingTask(null)
      } else {
        // Still pending or grading
        pollTimerRef.current = setTimeout(() => pollStatus(answerId, task, pollCount + 1), 3000)
      }
    } catch (err) {
      setGradingError({ taskId: task.id, error: err.response?.data?.message || 'Lỗi kiểm tra kết quả chấm' })
      setSubmitting(false)
      setGradingTask(null)
    }
  }

  const submitTask = async (task) => {
    const essay = essays[task.id] || ''
    if (wc(essay) < 50) { alert('Bài viết cần ít nhất 50 từ!'); return }
    setSubmitting(true)
    setGradingError(null)
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
      setGradingError({ taskId: task.id, error: e.response?.data?.message || 'Lỗi nộp bài, thử lại nhé!' })
      setSubmitting(false)
      setGradingTask(null)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>
  if (!exam) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Không tìm thấy đề thi.</div>

  const allDone = exam.writingTasks.every(t => results[t.id])

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-10 max-w-md w-full text-center flex flex-col items-center transition-all duration-300">
        <div className="w-16 h-16 bg-slate-100 border border-slate-200/80 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <PenTool className="w-8 h-8 text-slate-600 stroke-[1.75]" />
        </div>
        <h1 className="text-slate-900 text-xl font-bold mb-2 tracking-tight">{exam.title}</h1>
        <p className="text-slate-600 text-sm mb-1">{exam.writingTasks.length} Tasks</p>
        <p className="text-slate-600 text-sm mb-6">Thời gian: <span className="font-bold text-purple-600">60 phút</span></p>
        
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-left text-sm text-slate-600 mb-8 flex flex-col gap-2.5 leading-relaxed w-full">
          <p className="m-0">• Task 1: mô tả biểu đồ/bản đồ — tối thiểu 150 từ (~20 phút)</p>
          <p className="m-0">• Task 2: viết luận — tối thiểu 250 từ (~40 phút)</p>
          <p className="m-0">• AI chấm điểm theo 4 tiêu chí IELTS</p>
        </div>
        
        <button
          onClick={() => setPhase('exam')}
          className="btn-primary w-full text-sm font-bold transition-all duration-300"
          style={{ width: '100%', padding: '12px 0', borderRadius: '12px', marginBottom: 8 }}
        >
          Bắt đầu làm bài
        </button>
        <button
          onClick={handleBack}
          className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 ease-in-out font-medium text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ width: '100%', padding: '12px 0', borderRadius: '12px' }}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" /> Quay lại
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
      <div className="min-h-screen bg-slate-50 text-slate-600 font-sans">
        {/* Header */}
        <div className="bg-[#0B2345] border-b border-slate-800 px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-white text-xl font-bold tracking-tight m-0">Kết quả Writing — AI chấm bài</h1>
            <p className="text-slate-400 text-xs mt-1 m-0 font-medium">{exam.title}</p>
          </div>
        </div>

        {/* Content */}
        <div className="app-container section-py">
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            {/* Overall band score card */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 text-center transition-all duration-300">
              <p className="text-slate-400 text-xs font-bold tracking-wider uppercase mb-1">Overall Band Score</p>
              <div className="text-7xl font-extrabold font-mono tracking-tight my-4" style={{ color: '#0B2345' }}>
                {overallBand}
              </div>
              <p className="text-slate-500 text-sm font-medium">
                {exam.writingTasks.map(t => `Task ${t.number}: ${results[t.id]?.overall}`).join(' · ')}
              </p>
            </div>

            {/* Per-task results */}
            {exam.writingTasks.map(task => {
              const r = results[task.id]
              if (!r) return null
              return (
                <div key={task.id} className="flex flex-col gap-6">
                  <h2 className="text-slate-900 text-xl font-bold tracking-tight m-0 border-b border-slate-200 pb-2">
                    Task {task.number}
                  </h2>
                  
                  {/* Task score overview */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center transition-all duration-300">
                    <div className="text-5xl font-extrabold font-mono tracking-tight mb-1" style={{ color: '#0B2345' }}>
                      {r.overall}
                    </div>
                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Band Score</div>
                    <div className="text-slate-500 text-xs font-mono">{r.wordCount} từ</div>
                  </div>

                  {/* 4 Criteria Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
                      <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col transition-all duration-300">
                        <div className="text-3xl font-extrabold font-mono mb-2" style={{ color: '#0B2345' }}>
                          {r.criteria[key]?.score}
                        </div>
                        <div className="text-slate-900 text-sm font-bold mb-2">{label}</div>
                        <p className="text-slate-600 text-xs leading-relaxed m-0 font-medium">{r.criteria[key]?.comment}</p>
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all duration-300">
                    <p className="text-slate-900 text-sm font-bold mb-3">Điểm mạnh (Strengths)</p>
                    {renderFeedbackList(r.strengths, 'text-emerald-500')}
                  </div>

                  {/* Improvements */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all duration-300">
                    <p className="text-slate-900 text-sm font-bold mb-3">Điểm cần cải thiện & Gợi ý (Improvements)</p>
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
                  className="btn-primary w-full py-3.5 text-sm font-bold rounded-xl transition-all duration-300"
                >
                  Xem kết quả Full Test →
                </button>
              )}
              <button 
                onClick={() => navigate('/writing')} 
                className="w-full py-3.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all duration-300 cursor-pointer text-center"
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

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="bg-[#0B2345] border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button aria-label="Đóng bài thi" onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border-none text-white font-bold text-sm cursor-pointer flex-shrink-0 transition-colors">✕</button>
          <span className="font-sans text-sm font-semibold text-white overflow-hidden text-overflow-ellipsis white-space-nowrap">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`font-mono font-bold text-sm px-3.5 py-1.5 rounded-lg text-white ${timeLeft < 300 ? 'bg-blue-500' : timeLeft < 600 ? 'bg-amber-600' : 'bg-white/15'}`}>
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Task tabs */}
      <div className="bg-[#1e293b] flex flex-shrink-0 border-b border-slate-800">
        {exam.writingTasks.map((t, i) => (
          <button key={t.id} onClick={() => setActiveTask(i)}
            className={`px-5 py-3 text-sm font-medium border-none cursor-pointer border-b-2 transition-all duration-300 flex items-center gap-2 ${activeTask === i ? 'border-purple-500 bg-white/5 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            Task {t.number}
            {isTaskDone(t.id) && <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">Đã nộp</span>}
          </button>
        ))}
      </div>

      {/* Mobile view toggle — chỉ render trên mobile; state riêng, không đụng activeTask */}
      {isMobile && (
        <div className="flex flex-shrink-0 border-b border-slate-200 bg-white">
          <button
            onClick={() => setMobileView('prompt')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'prompt' ? 'border-purple-500 text-purple-700 bg-purple-50/60' : 'border-transparent text-slate-500'}`}
          >
            Đề bài
          </button>
          <button
            onClick={() => setMobileView('writing')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'writing' ? 'border-purple-500 text-purple-700 bg-purple-50/60' : 'border-transparent text-slate-500'}`}
          >
            Bài viết · {words} từ
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task prompt */}
        <div className={`overflow-y-auto bg-white p-6 border-r border-slate-200 flex flex-col gap-5 ${isMobile ? (mobileView === 'prompt' ? 'w-full' : 'hidden') : 'w-2/5'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-100 text-purple-600 font-bold text-sm flex items-center justify-center">{task.number}</div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Task {task.number}</span>
          </div>
          {task.imageUrl && (
            <div
              onClick={() => setLightbox(toImgSrc(task.imageUrl))}
              className="relative cursor-pointer inline-block w-full group border border-slate-200 rounded-2xl overflow-hidden"
            >
              <img src={toImgSrc(task.imageUrl)} alt={`Hình ảnh minh họa Task ${task.number}`} className="w-full" />
              <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Phóng to
              </div>
            </div>
          )}
          {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
          <p className="text-slate-700 text-sm leading-relaxed m-0 font-medium whitespace-pre-line">{task.prompt}</p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Tối thiểu <span className="font-bold text-slate-600">{minWords} từ</span></span>
            <span>Khuyến nghị: {task.number === 1 ? '20 phút' : '40 phút'}</span>
          </div>
        </div>

        {/* Right: Essay area */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-slate-50 p-8 ${isMobile && mobileView !== 'writing' ? 'hidden' : ''}`}>
          {taskDone ? (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-sm">
              <div className="text-4xl mb-4">✅</div>
              <p className="font-bold text-slate-800 text-lg mb-1">Task {task.number} đã được nộp!</p>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">Kết quả chi tiết từ AI sẽ hiển thị sau khi hoàn thành tất cả các tasks của bài thi viết.</p>
              {exam.writingTasks.length > 1 && activeTask < exam.writingTasks.length - 1 && !isTaskDone(exam.writingTasks[activeTask + 1]?.id) && (
                <button onClick={() => setActiveTask(activeTask + 1)} className="btn-primary px-6 py-2.5 rounded-xl font-bold transition text-sm">
                  Làm Task {task.number + 1} →
                </button>
              )}
            </div>
          ) : gradingTask === task.id ? (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-sm">
              <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-bold text-slate-800 text-lg mb-1">🤖 AI đang chấm bài Task {task.number}...</p>
              <p className="text-slate-500 text-sm leading-relaxed">Hệ thống đang xử lý bài viết của bạn. Vui lòng chờ trong giây lát.</p>
            </div>
          ) : (
            <>
              {gradingError && gradingError.taskId === task.id && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
                  <span>❌ Chấm bài không thành công: {gradingError.error}</span>
                  <button
                    onClick={() => submitTask(task)}
                    className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    🔄 Thử chấm điểm lại
                  </button>
                </div>
              )}
              <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Bài viết Task {task.number}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${words >= minWords ? 'bg-purple-100 text-purple-700' : words > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    {words}/{minWords} từ
                  </span>
                </div>
                <textarea
                  className="flex-1 p-8 text-slate-800 text-base leading-relaxed resize-none focus:outline-none bg-white font-medium"
                  placeholder={`Bắt đầu viết Task ${task.number} tại đây...`}
                  value={taskEssay}
                  onChange={e => setEssay(task.id, e.target.value)}
                />
              </div>
              <button
                onClick={() => submitTask(task)}
                disabled={submitting || words < 50}
                className="mt-4 btn-primary py-3 rounded-xl font-bold text-sm w-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? '🤖 Đang chấm điểm...' : `Nộp Task ${task.number} để AI chấm`}
              </button>
            </>
          )}
        </div>
      </div>

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
    </div>
  )
}
