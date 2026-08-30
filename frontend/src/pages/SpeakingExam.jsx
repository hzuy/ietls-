import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getSpeakingExam, submitSpeakingExam, getSpeakingStatus, getFullTestStatus } from '../services/examService'
import { useSpeechRecording } from '../hooks/useSpeechRecording'
import { Mic, ArrowLeft, X, Square, Play, Pause } from 'lucide-react'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'

const CRITERIA_LABELS = {
  fluency: 'Fluency',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
}

function renderFeedbackList(text, bulletColorClass = 'text-sky-600') {
  if (!text) return null
  const items = text.split(/\r?\n|•|-|\*/).map(s => s.trim()).filter(Boolean)
  if (items.length <= 1) {
    return <p className="text-slate-600 text-sm leading-relaxed m-0 font-medium">{text}</p>
  }
  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2.5 text-slate-600 text-sm leading-relaxed font-medium">
          <span className={`font-bold select-none ${bulletColorClass}`} style={{ marginTop: '2px' }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function SpeakingExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === 'true'

  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState('start')
  const [activePart, setActivePart] = useState(0)
  const [transcripts, setTranscripts] = useState({}) // { partId: text }
  const [results, setResults] = useState({})         // { partId: result }
  const [submitting, setSubmitting] = useState(false)
  const [gradingPart, setGradingPart] = useState(null)
  const [gradingError, setGradingError] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const pollTimerRef = useRef(null)

  // Guard thoát: chưa có draftService/autosave ở batch này → điều kiện tạm là
  // "có part đã ghi/nói ra transcript nhưng chưa nộp".
  const speakingParts = exam?.speakingParts || []
  const hasUnsubmittedWork = speakingParts.some(p => (transcripts[p.id] || '').trim() && !results[p.id])
  const allSubmitted = speakingParts.length > 0 && speakingParts.every(p => results[p.id])
  const exitGuard = useExitGuard(phase === 'exam' && !previewMode && hasUnsubmittedWork)

  useEffect(() => {
    if (allSubmitted) exitGuard.disarm()
  }, [allSubmitted, exitGuard.disarm])

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // ── Centralized Speech Recording Hook ──────────────────────────────────────
  const {
    isRecording,
    isTranscribing,
    useFallback,
    interimText,
    transcribeError,
    audioLevels,
    recordingSeconds,
    recordingAudioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    forceCleanupAll
  } = useSpeechRecording(transcripts, setTranscripts)

  // ── Audio playback state for "nghe lại" feature ──────────────────────────
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = useRef(null)

  // Format mm:ss from seconds
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleTogglePlayback = useCallback(() => {
    if (!audioRef.current) return
    if (isPlayingAudio) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }, [isPlayingAudio])

  // ── Load exam ────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = 'Bài thi Speaking | IELTS Pro'
    getSpeakingExam(id)
      .then(data => setExam(data))
      .catch(() => navigate('/full-test', { replace: true }))
      .finally(() => setLoading(false))
  }, [id, navigate])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam, phase])

  useEffect(() => {
    if (!showExitConfirm && !exitGuard.prompt) return
    const handler = (e) => {
      if (e.key === 'Escape') { setShowExitConfirm(false); exitGuard.stay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm, exitGuard.prompt, exitGuard.stay])

  useEffect(() => {
    if (!exam) return
    const allPartsDone = exam.speakingParts.every(p => results[p.id])
    if (allPartsDone && exam.speakingParts.length > 0) {
      getFullTestStatus(id)
        .then(data => { if (data.isComplete) setFullTestStatus(data) })
        .catch(() => {})
    }
  }, [results, exam, id])

  // ── Stop recording + full cleanup when switching parts ───────────────────────
  useEffect(() => {
    forceCleanupAll()
  }, [activePart, forceCleanupAll])

  const handleBack = useCallback(() => {
    if (exam?.seriesId) {
      navigate(`/full-test/${exam.seriesId}?book=${exam.bookNumber}`)
    } else {
      navigate('/speaking')
    }
  }, [exam, navigate])

  const pollStatus = useCallback(async (answerId, part, pollCount = 0) => {
    if (pollCount >= 30) {
      setGradingError({ partId: part.id, error: 'Hết thời gian chờ nhận xét (90 giây). Vui lòng thử lại.' })
      setSubmitting(false)
      setGradingPart(null)
      return
    }

    try {
      const res = await getSpeakingStatus(answerId)
      if (res.status === 'graded') {
        setResults(prev => ({ ...prev, [part.id]: res }))
        setGradingPart(null)
        setGradingError(null)
        setSubmitting(false)

        // Auto-advance to next part
        const currentIndex = exam.speakingParts.findIndex(p => p.id === part.id)
        if (currentIndex < exam.speakingParts.length - 1) {
          setActivePart(currentIndex + 1)
        }
      } else if (res.status === 'failed') {
        setGradingError({ partId: part.id, error: res.error || 'Lỗi nhận xét AI' })
        setSubmitting(false)
        setGradingPart(null)
      } else {
        // Pending or grading
        pollTimerRef.current = setTimeout(() => pollStatus(answerId, part, pollCount + 1), 3000)
      }
    } catch (err) {
      setGradingError({ partId: part.id, error: err.response?.data?.message || 'Lỗi kiểm tra kết quả nhận xét' })
      setSubmitting(false)
      setGradingPart(null)
    }
  }, [exam])

  const submitPart = useCallback(async (part) => {
    const transcript = transcripts[part.id] || ''
    if (transcript.trim().split(/\s+/).filter(Boolean).length < 10) {
      alert('Câu trả lời quá ngắn, hãy nói thêm!')
      return
    }
    if (isRecording) stopRecording()
    if (isTranscribing) return // Don't submit while Whisper is processing
    setSubmitting(true)
    setGradingError(null)
    setGradingPart(part.id)
    try {
      const r = await submitSpeakingExam(id, part.id, transcript)
      if (r.answerId && r.status === 'pending') {
        pollStatus(r.answerId, part)
      } else {
        setResults(prev => ({ ...prev, [part.id]: r }))
        setSubmitting(false)
        setGradingPart(null)
        const currentIndex = exam.speakingParts.findIndex(p => p.id === part.id)
        if (currentIndex < exam.speakingParts.length - 1) {
          setActivePart(currentIndex + 1)
        }
      }
    } catch (e) {
      setGradingError({ partId: part.id, error: e.response?.data?.message || 'Lỗi nộp bài, thử lại nhé!' })
      setSubmitting(false)
      setGradingPart(null)
    }
  }, [transcripts, isRecording, isTranscribing, id, exam, stopRecording, pollStatus])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
      Đang tải đề...
    </div>
  )
  if (!exam) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Không tìm thấy đề thi.</div>

  const allDone = exam.speakingParts.every(p => results[p.id])

  // ── Start ─────────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-10 max-w-md w-full text-center flex flex-col items-center transition-all duration-300">
        <div className="w-16 h-16 bg-slate-100 border border-slate-200/80 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mic className="w-8 h-8 text-slate-600 stroke-[1.75]" />
        </div>
        <h1 className="text-slate-900 text-xl font-bold mb-2 tracking-tight">{exam.title}</h1>
        <p className="text-slate-600 text-sm mb-1">{exam.speakingParts.length} Parts</p>
        <p className="text-slate-600 text-sm mb-6">Thời gian: <span className="font-bold text-sky-600">~15 phút</span></p>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-left text-sm text-slate-600 mb-8 flex flex-col gap-2.5 leading-relaxed w-full">
          <p className="m-0">• Part 1: câu hỏi quen thuộc (~4 phút)</p>
          <p className="m-0">• Part 2: thuyết trình 2 phút (~4 phút)</p>
          <p className="m-0">• Part 3: thảo luận chuyên sâu (~5 phút)</p>
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

  // ── Result ────────────────────────────────────────────────────────────────
  if (allDone) {
    const partScores = exam.speakingParts.map(p => results[p.id]?.overall || 0)
    const avg = partScores.reduce((a, b) => a + b, 0) / partScores.length
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2

    return (
      <div className="min-h-screen bg-slate-50 text-slate-600 font-sans">
        {/* Header */}
        <div className="bg-[#0B2345] border-b border-slate-800 px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-white text-xl font-bold tracking-tight m-0">Kết quả Speaking — AI chấm bài</h1>
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
                Trung bình 3 parts · {partScores.map((s, i) => `Part ${i + 1}: ${s}`).join(' · ')}
              </p>
            </div>

            {/* Per-part results */}
            {exam.speakingParts.map(part => {
              const r = results[part.id]
              if (!r) return null
              return (
                <div key={part.id} className="flex flex-col gap-6">
                  <h2 className="text-slate-900 text-xl font-bold tracking-tight m-0 border-b border-slate-200 pb-2">
                    Part {part.number}
                  </h2>

                  {/* Part score overview */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center transition-all duration-300">
                    <div className="text-5xl font-extrabold font-mono tracking-tight mb-1" style={{ color: '#0B2345' }}>
                      {r.overall}
                    </div>
                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Band Score</div>
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

                  {/* User transcript */}
                  <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 transition-all duration-300">
                    <p className="text-slate-600 text-sm font-bold mb-2">Bài nói của bạn</p>
                    <p className="text-slate-700 text-sm leading-relaxed m-0 font-medium italic">"{transcripts[part.id]}"</p>
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
                onClick={() => navigate('/speaking')}
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

  // ── Exam ──────────────────────────────────────────────────────────────────
  const part = exam.speakingParts[activePart]
  const partTranscript = transcripts[part.id] || ''
  const wordCount = partTranscript.trim().split(/\s+/).filter(Boolean).length
  const partDone = !!results[part.id]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="bg-[#0B2345] border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            aria-label="Đóng bài thi"
            onClick={() => previewMode ? navigate('/admin') : setShowExitConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border-none text-white font-bold text-sm cursor-pointer flex-shrink-0 transition-colors"
          >✕</button>
          <span className="font-sans text-sm font-semibold text-white overflow-hidden text-overflow-ellipsis white-space-nowrap">{exam.title}</span>
          {previewMode && (
            <span className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">Chế độ Preview</span>
          )}
        </div>
        {!previewMode && (
          <div className="text-slate-400 text-xs font-semibold">
            {exam.speakingParts.filter(p => results[p.id]).length}/{exam.speakingParts.length} parts hoàn thành
          </div>
        )}
      </header>

      {/* Part tabs */}
      <div className="bg-[#1e293b] flex flex-shrink-0 border-b border-slate-800">
        {exam.speakingParts.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActivePart(i)}
            className={`px-5 py-3 text-sm font-medium border-none cursor-pointer border-b-2 transition-all duration-300 flex items-center gap-2 ${activePart === i ? 'border-sky-500 bg-white/5 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Part {p.number}
            {results[p.id] && (
              <span className="text-[10px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-bold">Đã nộp</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: questions */}
        <div className="w-2/5 overflow-y-auto bg-white border-r border-slate-200 flex flex-col">
          {/* Part banner */}
          <div className="bg-[#0B2345] px-5 py-3 text-xs font-bold text-white uppercase tracking-wider">
            {part.number === 1 && 'Part 1 — Introduction & Interview'}
            {part.number === 2 && 'Part 2 — Individual Long Turn'}
            {part.number === 3 && 'Part 3 — Two-way Discussion'}
          </div>

          {/* Part 1 content */}
          {part.number === 1 && (
            <div className="p-6 bg-slate-50/50 flex-1 flex flex-col gap-5">
              {part.cueCard && (
                <p className="text-slate-500 text-sm leading-relaxed m-0 font-medium italic border-l-2 border-sky-500 pl-3.5">{part.cueCard}</p>
              )}
              <div className="flex flex-col gap-4">
                {part.questions.map((q, i) => (
                  <div key={q.id} className="flex gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-sky-50 border border-sky-100 text-sky-600 font-bold text-xs flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="text-slate-800 text-sm leading-relaxed m-0 font-medium">{q.questionText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part 2 content */}
          {part.number === 2 && (() => {
            const sep = part.cueCard ? part.cueCard.indexOf('\n===\n') : -1
            const instructions = sep !== -1 ? part.cueCard.slice(0, sep) : ''
            const cueCardText = part.cueCard ? (sep !== -1 ? part.cueCard.slice(sep + 5) : part.cueCard) : ''
            return (
              <div className="p-6 bg-slate-50/50 flex-1 flex flex-col gap-5">
                {instructions && (
                  <p className="text-slate-500 text-sm leading-relaxed m-0 font-medium italic">{instructions}</p>
                )}
                {cueCardText && (
                  <div className="bg-white border-l-4 border-sky-500 rounded-r-2xl border-y border-r border-slate-200 p-5 shadow-sm">
                    <p className="text-sky-600 text-xs font-bold uppercase tracking-wider mb-2">Cue Card</p>
                    <p className="text-slate-800 text-sm leading-relaxed font-semibold m-0 whitespace-pre-wrap">{cueCardText}</p>
                    <p className="text-sky-500 text-xs mt-4 font-medium italic m-0">Chuẩn bị 1 phút · Nói 1–2 phút</p>
                  </div>
                )}
                {part.questions.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Follow-up Questions</p>
                    <div className="flex flex-col gap-2.5">
                      {part.questions.map(q => (
                        <div key={q.id} className="flex gap-2.5 items-start bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-sm">
                          <span className="text-sky-400 font-bold mt-0.5">•</span>
                          <span className="text-slate-600 leading-relaxed font-medium">{q.questionText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Part 3 content */}
          {part.number === 3 && (() => {
            // Every ##TOPIC## marker (bare "##TOPIC##:" included) starts a new topic
            // group; questions before the first marker fall into a leading group.
            const groups = []
            let currentTopic = null
            for (const q of part.questions) {
              if (q.questionText.startsWith('##TOPIC##:')) {
                currentTopic = { label: q.questionText.slice('##TOPIC##:'.length), questions: [] }
                groups.push(currentTopic)
              } else {
                if (!currentTopic) { currentTopic = { label: '', questions: [] }; groups.push(currentTopic) }
                currentTopic.questions.push(q)
              }
            }
            return (
              <div className="p-6 bg-slate-50/50 flex-1 flex flex-col gap-5">
                {part.cueCard && (
                  <p className="text-slate-500 text-sm leading-relaxed m-0 font-medium italic border-l-2 border-sky-500 pl-3.5">{part.cueCard}</p>
                )}
                <div className="flex flex-col gap-5">
                  {groups.map((group, gi) => (
                    <div key={gi} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                      {(group.label || groups.length > 1) && (
                        <p className="text-sky-600 text-xs font-bold uppercase tracking-wider pb-2 border-b border-slate-100 m-0">{group.label || `Chủ đề ${gi + 1}`}</p>
                      )}
                      <div className="flex flex-col gap-3">
                        {group.questions.map((q, qi) => (
                          <div key={q.id} className="flex gap-3 text-sm">
                            <span className="w-5 h-5 flex-shrink-0 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center mt-0.5">{qi + 1}</span>
                            <span className="text-slate-700 leading-relaxed font-medium">{q.questionText}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Right: recording */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 p-6">
          {previewMode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="text-4xl mb-4">👁</div>
              <p className="text-slate-800 text-base font-bold mb-2">Chế độ Preview</p>
              <p className="text-slate-500 text-sm leading-relaxed m-0">Phần ghi âm và chấm điểm không hiển thị trong preview.<br />Nội dung đề thi hiển thị bên trái.</p>
            </div>
          ) : partDone ? (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-sm">
              <div className="text-4xl mb-4">✅</div>
              <p className="font-bold text-slate-800 text-lg mb-1">Đã nộp Part {part.number}!</p>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">Kết quả từ AI sẽ hiển thị sau khi hoàn thành tất cả các Part.</p>
              {activePart < exam.speakingParts.length - 1 ? (
                <button
                  onClick={() => setActivePart(activePart + 1)}
                  className="btn-primary px-8 py-2.5 rounded-xl font-bold text-sm"
                >
                  Tiếp tục Part {exam.speakingParts[activePart + 1].number} →
                </button>
              ) : (
                <p className="text-sky-600 font-semibold text-sm m-0">Đang tổng hợp kết quả...</p>
              )}
            </div>
          ) : gradingPart === part.id ? (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-sm">
              <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-bold text-slate-800 text-lg mb-1">AI đang nhận xét Part {part.number}...</p>
              <p className="text-slate-500 text-sm leading-relaxed">Hệ thống đang phân tích câu trả lời của bạn. Vui lòng chờ trong giây lát.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3.5 min-h-0">
              {gradingError && gradingError.partId === part.id && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
                  <span>❌ Nhận xét không thành công: {gradingError.error}</span>
                  <button
                    onClick={() => submitPart(part)}
                    className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    🔄 Thử chấm điểm lại
                  </button>
                </div>
              )}
              {/* Recording area */}
              {isRecording ? (
                /* ── 1. Compact horizontal bar while recording ─────────────── */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 transition-all duration-300">
                  {/* Left: Recording indicator */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-slate-800 text-sm font-bold whitespace-nowrap">Đang ghi âm...</span>
                  </div>

                  {/* Middle: Compact waveform + Timer */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-end gap-1 h-5 justify-center" style={{ width: '40px' }}>
                      {audioLevels.map((level, i) => (
                        <div
                          key={i}
                          className="w-1.5 rounded-full bg-sky-500 transition-all duration-75"
                          style={{
                            height: `${Math.max(4, Math.round(level * 18))}px`,
                            minHeight: '4px',
                            maxHeight: '18px',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-slate-600 text-xs font-mono font-bold select-none">
                      {formatTime(recordingSeconds)}
                    </span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={cancelRecording}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold bg-white hover:bg-slate-50 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Huỷ
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      style={{ background: 'linear-gradient(135deg, #0B2345 0%, #1e4080 100%)' }}
                    >
                      <Square className="w-3.5 h-3.5" fill="currentColor" />
                      Dừng và gửi
                    </button>
                  </div>
                </div>
              ) : isTranscribing ? (
                /* ── 2. Loading state while Whisper processes audio ────────── */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-semibold">Đang nhận dạng giọng nói...</span>
                </div>
              ) : (
                /* ── 3. Idle state (Before recording OR after transcript received) ── */
                <div className="flex-1 flex flex-col gap-3.5 min-h-0">
                  {/* Mic action panel — fixed height, does not grow */}
                  <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center gap-3">
                    <button
                      onClick={() => startRecording(part.id)}
                      className="w-14 h-14 rounded-full border-none flex items-center justify-center shadow-md transition-all duration-300 bg-sky-500 text-white cursor-pointer hover:bg-sky-600 active:scale-95"
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                    <p className="text-slate-500 text-sm font-semibold m-0 text-center">
                      {partTranscript ? 'Đã ghi xong. Bấm để ghi âm lại' : 'Bấm để bắt đầu nói'}
                    </p>
                    {transcribeError && (
                      <p className="text-xs text-amber-600 font-medium m-0 text-center">⚠️ {transcribeError}</p>
                    )}
                  </div>

                  {/* Chat bubble transcript — grows to fill remaining space, scrolls if long */}
                  {partTranscript && (
                    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm overflow-hidden">
                      {/* Header bar: Play button + Title (Left) and Word count (Right) */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Audio playback button */}
                          {recordingAudioUrl && (
                            <button
                              onClick={handleTogglePlayback}
                              className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-600 active:scale-95 text-white flex items-center justify-center flex-shrink-0 transition cursor-pointer border-none shadow-sm"
                              title={isPlayingAudio ? 'Tạm dừng' : 'Nghe lại đoạn ghi âm'}
                            >
                              {isPlayingAudio
                                ? <Pause className="w-3.5 h-3.5" fill="currentColor" />
                                : <Play className="w-3.5 h-3.5" fill="currentColor" style={{ marginLeft: 2 }} />}
                            </button>
                          )}

                          {/* Hidden HTML audio element */}
                          {recordingAudioUrl && (
                            <audio
                              ref={audioRef}
                              src={recordingAudioUrl}
                              onPlay={() => setIsPlayingAudio(true)}
                              onPause={() => setIsPlayingAudio(false)}
                              onEnded={() => setIsPlayingAudio(false)}
                            />
                          )}

                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Bản ghi giọng nói
                          </span>
                        </div>

                        <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 ${wordCount > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
                          {wordCount} từ
                        </span>
                      </div>

                      {/* Main content area: Standalone transcript text, full width, no background tint */}
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <p className="text-slate-800 text-sm leading-relaxed font-medium m-0 italic">
                          "{partTranscript}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit button — pinned at bottom, does not grow */}
                  <button
                    onClick={() => submitPart(part)}
                    disabled={submitting || wordCount < 10 || isTranscribing}
                    className="flex-shrink-0 btn-primary py-3 rounded-xl font-bold text-sm w-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? '🤖 Đang chấm điểm...' : `Nộp Part ${part.number}`}
                  </button>
                </div>
              )}
            </div>
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
