import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../utils/axios'

const CRITERIA_LABELS = {
  fluency: 'Fluency & Coherence',
  vocabulary: 'Lexical Resource',
  grammar: 'Grammatical Range & Accuracy',
  pronunciation: 'Pronunciation',
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
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    api.get(`/speaking/exams/${id}`).then(r => setExam(r.data)).finally(() => setLoading(false))
  }, [id])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    if (!showExitConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowExitConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm])

  useEffect(() => {
    if (!exam) return
    const allPartsDone = exam.speakingParts.every(p => results[p.id])
    if (allPartsDone && exam.speakingParts.length > 0) {
      api.get(`/full-test/status?examId=${id}`)
        .then(r => { if (r.data.isComplete) setFullTestStatus(r.data) })
        .catch(() => {})
    }
  }, [results, exam])

  // Stop recording when switching parts
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
      setInterimText('')
    }
  }, [activePart])

  const setTranscript = (partId, text) => setTranscripts(t => ({ ...t, [partId]: text }))

  const startRecording = (partId) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome!'); return }
    const r = new SR()
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    const existing = transcripts[partId] || ''
    let final = existing

    r.onresult = (e) => {
      let interim = ''
      let newFinal = existing
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) newFinal += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      final = newFinal
      setTranscripts(t => ({ ...t, [partId]: newFinal }))
      setInterimText(interim)
    }
    r.onerror = () => setIsRecording(false)
    r.onend = () => { setIsRecording(false); setInterimText(''); setTranscripts(t => ({ ...t, [partId]: final })) }
    recognitionRef.current = r
    r.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
    setInterimText('')
  }

  const submitPart = async (part) => {
    const transcript = transcripts[part.id] || ''
    if (transcript.trim().split(/\s+/).filter(Boolean).length < 10) {
      alert('Câu trả lời quá ngắn, hãy nói thêm!')
      return
    }
    if (isRecording) stopRecording()
    setSubmitting(true)
    try {
      const r = await api.post(`/speaking/exams/${id}/submit`, { partId: part.id, transcript })
      setResults(prev => ({ ...prev, [part.id]: r.data }))
      // Auto-advance to next part
      const currentIndex = exam.speakingParts.findIndex(p => p.id === part.id)
      if (currentIndex < exam.speakingParts.length - 1) {
        setActivePart(currentIndex + 1)
      }
    } catch (e) {
      alert('Lỗi nhận xét, thử lại nhé!')
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>

  const allDone = exam.speakingParts.every(p => results[p.id])

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">🎤</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h1>
        <p className="text-gray-500 text-sm mb-1">{exam.speakingParts.length} Parts</p>
        <p className="text-gray-500 text-sm mb-8">Thời gian: <span className="font-semibold text-[#1a56db]">~15 phút</span></p>
        <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-8 space-y-1">
          <p>• Part 1: câu hỏi quen thuộc (~4 phút)</p>
          <p>• Part 2: thuyết trình 2 phút (~4 phút)</p>
          <p>• Part 3: thảo luận chuyên sâu (~5 phút)</p>
          <p>• AI chấm điểm theo 4 tiêu chí IELTS</p>
          <p>• Dùng Chrome để ghi âm tốt nhất</p>
        </div>
        <button onClick={() => setPhase('exam')} className="w-full bg-[#1a56db] hover:bg-[#1d4ed8] text-white py-3 rounded-xl font-bold transition">
          Bắt đầu làm bài
        </button>
        <button onClick={() => navigate('/speaking')} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition">← Quay lại</button>
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────
  if (allDone) {
    const partScores = exam.speakingParts.map(p => results[p.id]?.overall || 0)
    const avg = partScores.reduce((a, b) => a + b, 0) / partScores.length
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] text-white px-6 py-4">
        <h1 className="font-bold text-lg">Kết quả Speaking — AI chấm bài</h1>
        <p className="text-blue-200 text-sm">{exam.title}</p>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* Overall band */}
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center border border-blue-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Overall Band Score</p>
          <div className="text-7xl font-extrabold text-[#1a56db] mb-2">{overallBand}</div>
          <p className="text-sm text-gray-500">Trung bình 3 parts · {partScores.map((s, i) => `Part ${i+1}: ${s}`).join(' · ')}</p>
        </div>
        {exam.speakingParts.map(part => {
          const r = results[part.id]
          if (!r) return null
          return (
            <div key={part.id}>
              <h2 className="font-bold text-gray-700 mb-4">Part {part.number}</h2>
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
                <div className="text-5xl font-bold text-[#1a56db] mb-1">{r.overall}</div>
                <div className="text-gray-400 text-sm">Band Score</div>
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
              <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
                <p className="text-xs font-bold text-blue-600 uppercase mb-2">Gợi ý cải thiện</p>
                <p className="text-sm text-gray-700 leading-relaxed">{r.improvements}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Bài nói của bạn</p>
                <p className="text-sm text-gray-600 italic leading-relaxed">"{transcripts[part.id]}"</p>
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
        <button onClick={() => navigate('/speaking')} className="w-full bg-[#1a56db] text-white py-3 rounded-xl font-bold hover:bg-[#1d4ed8] transition">
          Làm đề khác
        </button>
      </div>
    </div>
  )
  } // end allDone

  // ── Exam ──────────────────────────────────────────────────────
  const part = exam.speakingParts[activePart]
  const partTranscript = transcripts[part.id] || ''
  const wordCount = partTranscript.trim().split(/\s+/).filter(Boolean).length
  const partDone = !!results[part.id]

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => previewMode ? navigate('/admin') : setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
          {previewMode && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold shrink-0">Chế độ Preview</span>}
        </div>
        {!previewMode && (
          <div className="text-blue-200 text-xs">
            {exam.speakingParts.filter(p => results[p.id]).length}/{exam.speakingParts.length} parts hoàn thành
          </div>
        )}
      </header>

      {/* Part tabs */}
      <div className="bg-[#2d5282] flex shrink-0">
        {exam.speakingParts.map((p, i) => (
          <button key={p.id} onClick={() => setActivePart(i)}
            className={`px-5 py-2 text-sm font-medium transition border-b-2 ${activePart === i ? 'border-white text-white bg-white/10' : 'border-transparent text-blue-200 hover:text-white'}`}>
            Part {p.number}
            {results[p.id] && <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Đã nộp</span>}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: questions */}
        <div className="w-2/5 overflow-y-auto bg-white border-r border-gray-200">
          {/* Part banner */}
          <div className="bg-[#1e3a5f] text-white px-4 py-2.5 font-semibold text-sm">
            {part.number === 1 && 'Part 1 — Introduction & Interview'}
            {part.number === 2 && 'Part 2 — Individual Long Turn'}
            {part.number === 3 && 'Part 3 — Two-way Discussion'}
          </div>

          {/* Part 1 content */}
          {part.number === 1 && (
            <div className="p-5 bg-blue-50/40 min-h-full">
              {part.cueCard && (
                <p className="text-sm text-gray-600 italic mb-4 leading-relaxed border-l-2 border-blue-300 pl-3">{part.cueCard}</p>
              )}
              <div className="space-y-2">
                {part.questions.map((q, i) => (
                  <div key={q.id} className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="text-sm text-gray-700 leading-6">{q.questionText}</p>
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
              <div className="p-5 bg-blue-50/40 min-h-full">
                {instructions && (
                  <p className="text-sm text-gray-500 italic mb-4 leading-relaxed">{instructions}</p>
                )}
                {cueCardText && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 mb-4">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Cue Card</p>
                    <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap font-medium">{cueCardText}</p>
                    <p className="text-xs text-[#1a56db] mt-3 italic">Chuẩn bị 1 phút · Nói 1–2 phút</p>
                  </div>
                )}
                {part.questions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Follow-up Questions</p>
                    <div className="space-y-1">
                      {part.questions.map(q => (
                        <div key={q.id} className="flex gap-2 text-sm text-gray-600">
                          <span className="text-gray-300 mt-0.5">•</span>
                          <span className="leading-6">{q.questionText}</span>
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
            const groups = []
            let currentTopic = null
            for (const q of part.questions) {
              if (q.questionText.startsWith('##TOPIC##:')) {
                const label = q.questionText.replace('##TOPIC##:', '')
                currentTopic = { label, questions: [] }
                groups.push(currentTopic)
              } else {
                if (!currentTopic) { currentTopic = { label: '', questions: [] }; groups.push(currentTopic) }
                currentTopic.questions.push(q)
              }
            }
            return (
              <div className="p-5 bg-blue-50/40 min-h-full">
                {part.cueCard && (
                  <p className="text-sm text-gray-500 italic mb-4 leading-relaxed border-l-2 border-blue-300 pl-3">{part.cueCard}</p>
                )}
                <div className="space-y-4">
                  {groups.map((group, gi) => (
                    <div key={gi} className="bg-white rounded-xl border border-blue-100 p-3">
                      {group.label && (
                        <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-2.5 pb-1.5 border-b border-blue-100">{group.label}</p>
                      )}
                      <div className="space-y-1.5">
                        {group.questions.map((q, qi) => (
                          <div key={q.id} className="flex gap-2.5 text-sm text-gray-700">
                            <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center mt-0.5">{qi + 1}</span>
                            <span className="leading-6">{q.questionText}</span>
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
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-5">
          {previewMode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="text-5xl mb-4">👁</div>
              <p className="font-bold text-gray-600 text-base mb-2">Chế độ Preview</p>
              <p className="text-gray-400 text-sm">Phần ghi âm và chấm điểm không hiển thị trong preview.<br />Nội dung đề thi hiển thị bên trái.</p>
            </div>
          ) : partDone ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="text-5xl mb-4">✅</div>
              <p className="font-bold text-gray-700 text-lg mb-2">Đã nộp Part {part.number}!</p>
              <p className="text-gray-400 text-sm mb-8">Kết quả sẽ hiển thị sau khi bạn hoàn thành tất cả các part.</p>
              {activePart < exam.speakingParts.length - 1 ? (
                <button onClick={() => setActivePart(activePart + 1)} className="bg-[#1a56db] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#1d4ed8] transition">
                  Tiếp tục Part {exam.speakingParts[activePart + 1].number} →
                </button>
              ) : (
                <p className="text-[#1a56db] font-semibold text-sm">Đang tổng hợp kết quả...</p>
              )}
            </div>
          ) : (
            <>
              {/* Recording area */}
              <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center mb-4">
                <button
                  onClick={() => isRecording ? stopRecording() : startRecording(part.id)}
                  className={`w-20 h-20 rounded-full text-3xl font-bold transition-all shadow-lg mb-3 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white' : 'bg-[#1a56db] hover:bg-[#1d4ed8] text-white'}`}
                >
                  {isRecording ? '⏹' : '🎤'}
                </button>
                <p className="text-sm text-gray-500">
                  {isRecording ? '🔴 Đang ghi âm... Bấm để dừng' : partTranscript ? '✅ Đã ghi xong. Bấm để ghi lại' : 'Bấm để bắt đầu nói'}
                </p>
              </div>

              {/* Transcript */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Hệ thống nhận diện được</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${wordCount >= 30 ? 'bg-blue-100 text-[#1a56db]' : wordCount > 0 ? 'bg-blue-100 text-[#1a56db]' : 'bg-gray-100 text-gray-400'}`}>
                    {wordCount} từ
                  </span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  {(partTranscript || interimText) ? (
                    <p className="text-sm text-gray-700 leading-7 italic">
                      {partTranscript}
                      {interimText && <span className="text-gray-400">{interimText}</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Bắt đầu nói để xem bản ghi tại đây...</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => submitPart(part)}
                disabled={submitting || wordCount < 10}
                className="mt-3 bg-[#1a56db] hover:bg-[#1d4ed8] text-white py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-40"
              >
                {submitting ? '🤖 AI đang nhận xét... (10–15 giây)' : `Nộp Part ${part.number} để AI chấm`}
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
              <button onClick={() => navigate('/speaking')} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">
                Thoát
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
