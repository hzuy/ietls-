import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../utils/axios'

const TOTAL_TIME = 60 * 60
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
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'auto' }}
    >
      <button
        onClick={onClose}
        style={{ position: 'fixed', top: 16, right: 20, zIndex: 10000, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: 36, height: 36, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
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
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState('start')
  const [activeTask, setActiveTask] = useState(0)
  const [essays, setEssays] = useState({}) // { taskId: text }
  const [results, setResults] = useState({}) // { taskId: result }
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [lightbox, setLightbox] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)

  useEffect(() => {
    api.get(`/writing/exams/${id}`).then(r => setExam(r.data)).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!exam) return
    const allTasksDone = exam.writingTasks.every(t => results[t.id])
    if (allTasksDone && exam.writingTasks.length > 0) {
      api.get(`/full-test/status?examId=${id}`)
        .then(r => { if (r.data.isComplete) setFullTestStatus(r.data) })
        .catch(() => {})
    }
  }, [results, exam])

  useEffect(() => {
    if (phase !== 'exam') return
    if (timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft])

  useEffect(() => {
    if (!showExitConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowExitConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm])

  const setEssay = (taskId, text) => setEssays(e => ({ ...e, [taskId]: text }))

  const submitTask = async (task) => {
    const essay = essays[task.id] || ''
    if (wc(essay) < 50) { alert('Bài viết cần ít nhất 50 từ!'); return }
    setSubmitting(true)
    try {
      const r = await api.post(`/writing/exams/${id}/submit`, { taskId: task.id, essay })
      setResults(prev => ({ ...prev, [task.id]: r.data }))
    } catch (e) {
      alert('Lỗi chấm bài, thử lại nhé!')
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>

  const allDone = exam.writingTasks.every(t => results[t.id])

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">✍️</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h1>
        <p className="text-gray-500 text-sm mb-1">{exam.writingTasks.length} Tasks</p>
        <p className="text-gray-500 text-sm mb-8">Thời gian: <span className="font-semibold text-[#1a56db]">60 phút</span></p>
        <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-8 space-y-1">
          <p>• Task 1: mô tả biểu đồ/bản đồ — tối thiểu 150 từ (~20 phút)</p>
          <p>• Task 2: viết luận — tối thiểu 250 từ (~40 phút)</p>
          <p>• AI chấm điểm theo 4 tiêu chí IELTS</p>
        </div>
        <button onClick={() => setPhase('exam')} className="w-full bg-[#1a56db] hover:bg-[#1d4ed8] text-white py-3 rounded-xl font-bold transition">
          Bắt đầu làm bài
        </button>
        <button onClick={() => navigate('/writing')} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition">← Quay lại</button>
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────
  if (allDone) {
    const taskScores = exam.writingTasks.map(t => results[t.id]?.overall).filter(s => s != null)
    const avg = taskScores.length > 0 ? taskScores.reduce((a, b) => a + b, 0) / taskScores.length : 0
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#1e3a5f] text-white px-6 py-4">
          <h1 className="font-bold text-lg">Kết quả Writing — AI chấm bài</h1>
          <p className="text-blue-200 text-sm">{exam.title}</p>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {/* Overall band */}
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center border border-blue-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Overall Band Score</p>
            <div className="text-7xl font-extrabold text-[#1a56db] mb-2">{overallBand}</div>
            <p className="text-sm text-gray-500">
              {exam.writingTasks.map(t => `Task ${t.number}: ${results[t.id]?.overall}`).join(' · ')}
            </p>
          </div>

          {/* Per-task results */}
          {exam.writingTasks.map(task => {
            const r = results[task.id]
            if (!r) return null
            return (
              <div key={task.id}>
                <h2 className="font-bold text-gray-700 mb-4">Task {task.number}</h2>
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
                  <div className="text-5xl font-bold text-[#1a56db] mb-1">{r.overall}</div>
                  <div className="text-gray-400 text-sm">Band Score</div>
                  <div className="text-gray-500 text-xs mt-1">{r.wordCount} từ</div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
                    <div key={key} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-[#1a56db] mb-0.5">{r.criteria[key]?.score}</div>
                      <div className="text-xs font-semibold text-gray-600 mb-2">{label}</div>
                      <p className="text-xs text-gray-500 leading-relaxed">{r.criteria[key]?.comment}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
                  <p className="text-xs font-bold text-[#1a56db] uppercase mb-2">Điểm mạnh</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.strengths}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-2">Gợi ý cải thiện</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.improvements}</p>
                </div>
              </div>
            )
          })}
          {fullTestStatus?.isComplete && (
            <button
              onClick={() => navigate(`/full-test/result?seriesId=${fullTestStatus.seriesId}&bookNumber=${fullTestStatus.bookNumber}&testNumber=${fullTestStatus.testNumber}`)}
              className="w-full py-3 rounded-xl font-bold text-white transition mb-3"
              style={{ backgroundColor: '#059669' }}
            >
              Xem kết quả Full Test →
            </button>
          )}
          <button onClick={() => navigate('/writing')} className="w-full bg-[#1a56db] text-white py-3 rounded-xl font-bold hover:bg-[#1d4ed8] transition">
            Làm đề khác
          </button>
        </div>
      </div>
    )
  }

  // ── Exam ──────────────────────────────────────────────────────
  const task = exam.writingTasks[activeTask]
  const taskEssay = essays[task.id] || ''
  const words = wc(taskEssay)
  const minWords = task.minWords || (task.number === 1 ? 150 : 250)
  const taskDone = !!results[task.id]

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 300 ? 'bg-red-500' : timeLeft < 600 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Task tabs */}
      <div className="bg-[#2d5282] flex shrink-0">
        {exam.writingTasks.map((t, i) => (
          <button key={t.id} onClick={() => setActiveTask(i)}
            className={`px-5 py-2 text-sm font-medium transition border-b-2 ${activeTask === i ? 'border-white text-white bg-white/10' : 'border-transparent text-blue-200 hover:text-white'}`}>
            Task {t.number}
            {results[t.id] && <span className="ml-2 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">Đã nộp</span>}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task prompt */}
        <div className="w-2/5 overflow-y-auto bg-white p-6 border-r border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">{task.number}</div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Task {task.number}</span>
          </div>
          {task.imageUrl && (
            <div
              onClick={() => setLightbox(toImgSrc(task.imageUrl))}
              style={{ position: 'relative', cursor: 'pointer', display: 'inline-block', width: '100%' }}
              className="group mb-4"
            >
              <img src={toImgSrc(task.imageUrl)} alt="Task visual" className="w-full rounded-xl border border-gray-200" />
              <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: 6, padding: '3px 7px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: 0, transition: 'opacity 0.15s' }} className="group-hover:opacity-100">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Phóng to
              </div>
            </div>
          )}
          {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
          <p className="text-gray-700 text-sm leading-7">{task.prompt}</p>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Tối thiểu <span className="font-bold">{minWords} từ</span></p>
            {task.number === 1 && <p className="text-xs text-gray-400 mt-1">Khuyến nghị: 20 phút</p>}
            {task.number === 2 && <p className="text-xs text-gray-400 mt-1">Khuyến nghị: 40 phút</p>}
          </div>
        </div>

        {/* Right: Essay area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-5">
          {taskDone ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-gray-700 mb-1">Task {task.number} đã được nộp!</p>
              <p className="text-gray-500 text-sm mb-6">Kết quả sẽ hiển thị sau khi hoàn thành tất cả tasks.</p>
              {exam.writingTasks.length > 1 && activeTask < exam.writingTasks.length - 1 && !results[exam.writingTasks[activeTask + 1]?.id] && (
                <button onClick={() => setActiveTask(activeTask + 1)} className="bg-[#1a56db] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#1d4ed8] transition text-sm">
                  Làm Task {task.number + 1} →
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Bài viết Task {task.number}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${words >= minWords ? 'bg-blue-100 text-[#1a56db]' : words > 0 ? 'bg-blue-100 text-[#1a56db]' : 'bg-gray-100 text-gray-400'}`}>
                    {words}/{minWords} từ
                  </span>
                </div>
                <textarea
                  className="flex-1 p-4 text-gray-700 text-sm leading-7 resize-none focus:outline-none"
                  placeholder={`Bắt đầu viết Task ${task.number} tại đây...`}
                  value={taskEssay}
                  onChange={e => setEssay(task.id, e.target.value)}
                />
              </div>
              <button
                onClick={() => submitTask(task)}
                disabled={submitting || words < 50}
                className="mt-3 bg-[#1a56db] hover:bg-[#1d4ed8] text-white py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-40">
                {submitting ? '🤖 AI đang chấm bài... (10–15 giây)' : `Nộp Task ${task.number} để AI chấm`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Exit confirm modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExitConfirm(false)}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Thoát bài làm?</h2>
            <p className="text-gray-600 text-sm mb-6">Tiến trình bài làm sẽ không được lưu nếu bạn thoát lúc này.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-[#1a56db] hover:bg-[#1d4ed8] text-white text-sm font-bold transition">
                Tiếp tục làm
              </button>
              <button onClick={() => navigate('/writing')} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">
                Thoát
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
