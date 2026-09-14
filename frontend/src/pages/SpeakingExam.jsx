import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getSpeakingExam, submitSpeakingExam, getSpeakingStatus, getFullTestStatus, getSpeakingMyResults, retrySpeakingGrading } from '../services/examService'
import { saveDraft, loadDraft, clearDraft, isDataEmpty, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBrowserHistoryGuard } from '../hooks/useBrowserHistoryGuard'
import { useSpeechRecording } from '../hooks/useSpeechRecording'
import { Mic, ArrowLeft, X, Square, Play, Pause, AlertCircle, RotateCcw, Sparkles, Eye, Volume2 } from 'lucide-react'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import { renderFeedbackList } from '../utils/feedbackList'
import { askAITutor } from '../components/common/AIChatbotDrawer'
import ExitConfirmModal from '../components/common/ExitConfirmModal'

const CRITERIA_LABELS = {
  fluency: 'Fluency',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
}

// Part 2 chuẩn IELTS: 1 phút chuẩn bị + tối đa 2 phút nói.
const PART2_PREP_SECONDS = 60
const PART2_SPEAK_SECONDS = 120

function HighlightedTranscript({ text }) {
  if (!text) return <p className="text-zinc-400 italic text-sm m-0">Chưa có bản ghi âm bài nói.</p>
  const tokens = text.split(/(\s+)/)
  const fillerRegex = /^(uh|um|ah|er|eh|mm|hmm|like)$/i

  return (
    <p className="text-zinc-800 text-sm leading-relaxed m-0 font-normal">
      {tokens.map((token, idx) => {
        const clean = token.replace(/[.,!?;:"]/g, '').toLowerCase()
        if (fillerRegex.test(clean)) {
          return (
            <span key={idx} className="bg-zinc-100 text-zinc-500 px-1 py-0.5 rounded text-xs mx-0.5 inline-block font-mono" title="Từ đệm / ngập ngừng">
              {token}
            </span>
          )
        }
        return <span key={idx}>{token}</span>
      })}
    </p>
  )
}

export default function SpeakingExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === 'true'
  const resumeMode = searchParams.get('resume') === 'true'
  const { user } = useAuth()
  const { showToast } = useToast()

  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('start')
  const [activePart, setActivePart] = useState(0)
  const [transcripts, setTranscripts] = useState({}) // { partId: text }
  const [results, setResults] = useState({})         // { partId: result }
  const [submittedPartIds, setSubmittedPartIds] = useState([]) // part đã nộp (kể cả phiên trước)
  const [submitting, setSubmitting] = useState(false)
  const [gradingPart, setGradingPart] = useState(null)
  // Map theo partId — { [partId]: { error, answerId } }. Khác biệt object đơn cũ:
  // hỗ trợ NHIỀU part lỗi cùng lúc (vd. cả 3 part cùng lỗi model Groq).
  const [gradingErrors, setGradingErrors] = useState({})
  const [retryingPart, setRetryingPart] = useState(null)
  const [confirmResubmitId, setConfirmResubmitId] = useState(null) // partId đang chờ xác nhận "Nộp lại"
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [playingPartId, setPlayingPartId] = useState(null)
  const pollTimerRef = useRef(null)

  // ── Layout mobile ──────────────────────────────────────────────────────────
  // isMobile: cùng pattern resize listener + breakpoint 768 với ReadingExam.
  // mobileView: CHỈ dùng cho toggle 2 panel trên mobile. Tách biệt HOÀN TOÀN khỏi
  // activePart — chuyển view KHÔNG nằm trong deps của useEffect(forceCleanupAll,
  // [activePart]), nên xem lại câu hỏi giữa lúc ghi âm không làm dừng/mất bản ghi.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('questions') // 'questions' | 'recording'
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const speakingParts = exam?.speakingParts || []
  const allSubmitted = speakingParts.length > 0 && speakingParts.every(p => results[p.id])
  const isPartDone = (pid) => !!results[pid] || submittedPartIds.includes(pid)

  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // ── Autosave draft ─────────────────────────────────────────────────────────
  // MỘT interval sống suốt phiên (deps [phase, previewMode, id]). KHÔNG đưa
  // transcripts/submittedPartIds/user vào deps — đổi liên tục khi ghi âm → interval
  // bị reset, không bao giờ fire. Đọc state mới nhất qua ref. persistDraftNow() còn
  // được useExitGuard gọi ngay tại mọi điểm thoát bài (onBeforeExit).
  const autosaveRef = useRef(null)
  useEffect(() => {
    autosaveRef.current = {
      transcripts, submittedPartIds,
      userId: user ? (user.id || user._id) : null,
    }
  })
  const persistDraftNow = useCallback(() => {
    const { transcripts, submittedPartIds, userId } = autosaveRef.current
    if (!userId || !id) return
    const data = { transcripts, submittedPartIds }
    // P3-2: đừng để data rỗng ghi đè một draft cũ không rỗng
    if (isDataEmpty(data)) {
      const existing = loadDraft(userId, id, 'speaking')
      if (existing && !isDataEmpty(existing.data)) return
    }
    saveDraft({ userId, examId: id, skillType: 'speaking', data, timeRemaining: null })
    setLastSavedAt(new Date())
  }, [id])
  useEffect(() => {
    if (phase !== 'exam' || previewMode) return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, previewMode, id, persistDraftNow])

  // Cảnh báo trình duyệt (beforeunload) khi thí sinh đóng tab/F5 trong lúc làm bài
  useEffect(() => {
    if (phase !== 'exam' || previewMode || allSubmitted) return
    const handleBeforeUnload = (e) => {
      persistDraftNow()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase, previewMode, allSubmitted, persistDraftNow])

  // Chặn nút Back (<) của trình duyệt khi đang làm bài
  const { showModal: showExitModal, stay: stayInExam, leave: leaveExam } = useBrowserHistoryGuard(phase === 'exam' && !previewMode && !allSubmitted, persistDraftNow)

  // Nộp + chấm xong hết → xoá draft
  useEffect(() => {
    if (!allSubmitted) return
    if (user && id) clearDraft(user.id || user._id, id, 'speaking')
  }, [allSubmitted, user, id])

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

  // ── Timer riêng cho Part 2 ─────────────────────────────────────────────────
  // Chạy ĐỘC LẬP với mobileView (toggle Câu hỏi/Ghi âm): các effect dưới KHÔNG có
  // mobileView trong deps → đổi view không dừng/reset đồng hồ prep hay đếm ngược nói.
  const [prepActive, setPrepActive] = useState(false)
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(PART2_PREP_SECONDS)
  const part2PrepDoneRef = useRef(false) // đã qua/skip prep → không hiện lại card khi re-record
  const skipPrep = () => { part2PrepDoneRef.current = true; setPrepActive(false) }

  const handleTogglePlayback = useCallback(() => {
    if (!audioRef.current) return
    if (isPlayingAudio) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }, [isPlayingAudio])

  const loadExam = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getSpeakingExam(id),
      // Tầng 4: khôi phục kết quả đã chấm từ server — độc lập với resume draft,
      // gọi vô điều kiện. Lỗi ở đây KHÔNG được làm hỏng việc load đề.
      getSpeakingMyResults(id).catch(() => []),
    ])
      .then(([data, myResults]) => {
        setExam(data)

        // ── Khôi phục kết quả đã chấm (status 'graded') ─────────────────────
        // Set `results` + `submittedPartIds` cho part có trong response, và
        // `transcripts` (để ô "Bài nói của bạn" hiển thị lại đúng).
        // Part với bản ghi mới nhất 'failed' (vd. lỗi model Groq) KHÔNG được coi
        // là "đã nộp" — nạp vào `gradingErrors` để hiện banner lỗi + nút thử lại,
        // thay vì im lặng treo ở "Đang tổng hợp kết quả" như trước.
        const restoredResults = {}
        const restoredTranscripts = {}
        const restoredIds = []
        const restoredErrors = {}
        if (Array.isArray(myResults)) {
          for (const entry of myResults) {
            if (!entry || entry.partId == null) continue
            if (entry.status === 'graded') {
              restoredResults[entry.partId] = entry
              restoredIds.push(entry.partId)
              if (entry.transcript) restoredTranscripts[entry.partId] = entry.transcript
            } else if (entry.status === 'failed') {
              restoredErrors[entry.partId] = { error: entry.error, answerId: entry.answerId }
              if (entry.transcript) restoredTranscripts[entry.partId] = entry.transcript
            }
          }
        }
        if (restoredIds.length > 0) {
          // `...prev` sau cùng: nếu polling phiên này vừa set kết quả mới hơn thì giữ nguyên
          setResults(prev => ({ ...restoredResults, ...prev }))
          setSubmittedPartIds(prev => Array.from(new Set([...prev, ...restoredIds])))
        }
        if (Object.keys(restoredTranscripts).length > 0) {
          setTranscripts(prev => ({ ...restoredTranscripts, ...prev }))
        }
        if (Object.keys(restoredErrors).length > 0) {
          setGradingErrors(prev => ({ ...restoredErrors, ...prev }))
        }

        // ── Resume draft cục bộ (logic cũ, dùng functional update để không
        //    clobber phần state mà nhánh khôi phục vừa set) ─────────────────
        let draftTranscripts = null
        let draftIds = []
        if (resumeMode && user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'speaking')
          if (draft?.data && !isDataEmpty(draft.data)) {
            draftTranscripts = draft.data.transcripts || {}
            draftIds = Array.isArray(draft.data.submittedPartIds) ? draft.data.submittedPartIds : []
            setTranscripts(prev => ({ ...prev, ...draftTranscripts }))
            setSubmittedPartIds(prev => Array.from(new Set([...prev, ...draftIds])))
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
    document.title = 'Bài thi Speaking | IELTS Pro'
    loadExam()
  }, [loadExam])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam, phase])


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

  // ── Đồng bộ mobileView (chỉ ảnh hưởng layout mobile) ────────────────────────
  // Đổi part → về 'questions' (đọc câu hỏi trước). KHÔNG bao giờ tự ép ngược về
  // 'questions' ngoài lúc đổi part — user tự toggle. `mobileView` KHÔNG có ở đây
  // lẫn ở effect forceCleanupAll → toggle view không đụng phiên ghi âm.
  useEffect(() => { setMobileView('questions') }, [activePart])
  // Ép sang 'recording' khi panel phải có hoạt động cần thấy (đang ghi/nhận dạng/
  // chấm, part đã nộp, hoặc đang ở prep Part 2) — chỉ đẩy một chiều.
  useEffect(() => {
    if (!exam) return
    const p = exam.speakingParts[activePart]
    if (!p) return
    const done = !!results[p.id] || submittedPartIds.includes(p.id)
    if (done || gradingPart === p.id || isRecording || isTranscribing || prepActive) setMobileView('recording')
  }, [exam, activePart, results, submittedPartIds, gradingPart, isRecording, isTranscribing, prepActive])

  // ── Part 2: mở card "Chuẩn bị" khi vào Part 2 lần đầu (chưa nộp, chưa qua prep).
  // Rời Part 2 hoặc part đã nộp → tắt. part2PrepDoneRef chặn hiện lại khi re-record.
  useEffect(() => {
    const p = exam?.speakingParts?.[activePart]
    const done = p ? (!!results[p.id] || submittedPartIds.includes(p.id)) : false
    const eligible = !previewMode && p?.number === 2 && !part2PrepDoneRef.current && !done
    setPrepActive(eligible)
    if (eligible) setPrepSecondsLeft(PART2_PREP_SECONDS)
  }, [activePart, exam, previewMode, results, submittedPartIds])

  // Đếm ngược prep 60s — tick + kết thúc đều trong callback interval (bất đồng bộ).
  useEffect(() => {
    if (!prepActive) return
    let n = PART2_PREP_SECONDS
    const iv = setInterval(() => {
      n -= 1
      setPrepSecondsLeft(n)
      if (n <= 0) { clearInterval(iv); part2PrepDoneRef.current = true; setPrepActive(false) }
    }, 1000)
    return () => clearInterval(iv)
  }, [prepActive])

  // Đang ghi Part 2 và chạm 120s → tự dừng (bản ghi giữ nguyên, nộp như thường).
  // Dựa trên recordingSeconds đếm-lên sẵn có của hook, không tạo interval mới.
  useEffect(() => {
    if (!isRecording) return
    const p = exam?.speakingParts?.[activePart]
    if (p?.number !== 2) return
    if (recordingSeconds >= PART2_SPEAK_SECONDS) stopRecording()
  }, [isRecording, recordingSeconds, activePart, exam, stopRecording])

  const handleBack = useCallback(() => {
    if (exam?.seriesId) {
      navigate(`/full-test/${exam.seriesId}?book=${exam.bookNumber}`)
    } else {
      navigate('/speaking')
    }
  }, [exam, navigate])

  const clearPartError = useCallback((partId) => setGradingErrors(prev => {
    if (!(partId in prev)) return prev
    const next = { ...prev }
    delete next[partId]
    return next
  }), [])

  const pollStatus = useCallback(async (answerId, part, pollCount = 0) => {
    if (pollCount >= 30) {
      setGradingErrors(prev => ({ ...prev, [part.id]: { error: 'Hết thời gian chờ nhận xét (90 giây). Vui lòng thử lại.', answerId } }))
      setSubmitting(false)
      setGradingPart(null)
      setRetryingPart(null)
      return
    }

    try {
      const res = await getSpeakingStatus(answerId)
      if (res.status === 'graded') {
        setResults(prev => ({ ...prev, [part.id]: res }))
        setGradingPart(null)
        setRetryingPart(null)
        clearPartError(part.id)
        setSubmitting(false)

        // Auto-advance to next part
        const currentIndex = exam.speakingParts.findIndex(p => p.id === part.id)
        if (currentIndex < exam.speakingParts.length - 1) {
          setActivePart(currentIndex + 1)
        }
      } else if (res.status === 'failed') {
        setGradingErrors(prev => ({ ...prev, [part.id]: { error: res.error || 'Lỗi nhận xét AI', answerId: res.answerId ?? answerId } }))
        setSubmitting(false)
        setGradingPart(null)
        setRetryingPart(null)
      } else {
        // Pending or grading
        pollTimerRef.current = setTimeout(() => pollStatus(answerId, part, pollCount + 1), 3000)
      }
    } catch (err) {
      setGradingErrors(prev => ({ ...prev, [part.id]: { error: err.response?.data?.message || 'Lỗi kiểm tra kết quả nhận xét', answerId } }))
      setSubmitting(false)
      setGradingPart(null)
      setRetryingPart(null)
    }
  }, [exam, clearPartError])

  // Chấm lại bài ĐÃ nộp (status='failed') từ transcript đã lưu — không cần ghi âm
  // lại. Khác handleResubmit (Task 3): dùng khi lỗi hạ tầng AI, không phải muốn
  // nói lại nội dung.
  const retryPart = useCallback(async (part) => {
    const entry = gradingErrors[part.id]
    if (!entry?.answerId || retryingPart) return
    setRetryingPart(part.id)
    setSubmitting(true)
    clearPartError(part.id)
    setGradingPart(part.id)
    try {
      const r = await retrySpeakingGrading(entry.answerId)
      pollStatus(r.answerId, part)
    } catch (e) {
      setGradingErrors(prev => ({ ...prev, [part.id]: { error: e.response?.data?.message || 'Lỗi chấm lại, thử lại nhé!', answerId: entry.answerId } }))
      setSubmitting(false)
      setGradingPart(null)
      setRetryingPart(null)
    }
  }, [gradingErrors, retryingPart, clearPartError, pollStatus])

  // "Nộp lại" (Task 3) — cho part ĐÃ chấm xong nói lại từ đầu. Chỉ xoá state cục
  // bộ (results/submittedPartIds/gradingErrors); bản ghi SpeakingAnswer cũ trong
  // DB giữ nguyên — /submit luôn tạo bản ghi MỚI, my-results tự ưu tiên bản mới nhất.
  const handleResubmit = useCallback((part) => {
    setResults(prev => {
      if (!(part.id in prev)) return prev
      const next = { ...prev }
      delete next[part.id]
      return next
    })
    setSubmittedPartIds(ids => ids.filter(pid => pid !== part.id))
    clearPartError(part.id)
    setConfirmResubmitId(null)
  }, [clearPartError])

  const submitPart = useCallback(async (part) => {
    const transcript = transcripts[part.id] || ''
    if (transcript.trim().split(/\s+/).filter(Boolean).length < 10) {
      showToast('Câu trả lời quá ngắn, hãy nói thêm!', 'error')
      return
    }
    if (isRecording) stopRecording()
    if (isTranscribing) return // Don't submit while Whisper is processing
    setSubmitting(true)
    clearPartError(part.id)
    setGradingPart(part.id)
    try {
      const r = await submitSpeakingExam(id, part.id, transcript)
      setSubmittedPartIds(ids => ids.includes(part.id) ? ids : [...ids, part.id])
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
      setGradingErrors(prev => ({ ...prev, [part.id]: { error: e.response?.data?.message || 'Lỗi nộp bài, thử lại nhé!' } }))
      setSubmitting(false)
      setGradingPart(null)
    }
  }, [transcripts, isRecording, isTranscribing, id, exam, stopRecording, pollStatus, clearPartError])

  if (loading) return <SkeletonExamPage variant="speaking" />
  if (error || !exam) {
    return (
      <ExamErrorState
        title="Không thể tải đề thi Speaking"
        message={error || 'Không tìm thấy đề thi hoặc đề thi đã bị gỡ bỏ.'}
        onRetry={loadExam}
        onBack={handleBack}
        backLabel="Quay lại danh sách"
      />
    )
  }

  const allDone = exam.speakingParts.every(p => results[p.id])

  // ── Start ─────────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-zinc-50/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-10 max-w-md w-full text-center flex flex-col items-center transition-all duration-300">
        <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mic className="w-8 h-8 text-zinc-600 stroke-[1.75]" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">{exam.title}</h1>
        <p className="text-zinc-500 text-sm mb-1">{exam.speakingParts.length} Parts</p>
        <p className="text-zinc-500 text-sm mb-6">Thời gian: <span className="font-bold text-zinc-900">~15 phút</span></p>

        <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-5 text-left text-sm text-zinc-600 mb-8 flex flex-col gap-2.5 leading-relaxed w-full">
          <p className="m-0">• Part 1: câu hỏi quen thuộc (~4 phút)</p>
          <p className="m-0">• Part 2: thuyết trình 2 phút (~4 phút)</p>
          <p className="m-0">• Part 3: thảo luận chuyên sâu (~5 phút)</p>
          <p className="m-0">• AI chấm điểm theo 4 tiêu chí IELTS</p>
        </div>

        <button
          onClick={() => setPhase('exam')}
          className="btn-primary w-full text-sm font-medium transition shadow-xs"
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

  // ── Result ────────────────────────────────────────────────────────────────
  if (allDone) {
    const partScores = exam.speakingParts.map(p => results[p.id]?.overall || 0)
    const avg = partScores.reduce((a, b) => a + b, 0) / partScores.length
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2

    return (
      <div className="min-h-screen bg-zinc-50/50 text-zinc-600 font-sans">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3 flex items-center">
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center' }}>
            <p className="font-bold text-sm text-zinc-900 m-0">
              Kết quả Speaking — AI chấm bài
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
                      IELTS Speaking Interview
                    </p>
                    <p className="text-xs text-zinc-500 m-0 mt-0.5">
                      Hoàn thành: {exam.speakingParts.length} Parts
                    </p>
                  </div>
                </div>

                {/* Cột 2: Điểm từng Part */}
                <div className="flex flex-col justify-center items-center md:items-start border-t md:border-t-0 md:border-x border-zinc-100 px-6 py-2 gap-2">
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Điểm từng Part
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      FC · PR · LR · GRA
                    </span>
                  </div>
                  <div className="w-full space-y-1.5">
                    {exam.speakingParts.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs w-full">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-100 font-semibold text-zinc-700 flex items-center justify-center text-[10px]">
                            P{p.number}
                          </span>
                          <span className="font-semibold text-zinc-800">Part {p.number}</span>
                        </div>
                        <span className="font-mono font-extrabold text-sm text-zinc-900">
                          Band {results[p.id]?.overall ?? '–'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cột 3: Đúng 2 nút hành động cốt lõi */}
                <div className="flex flex-col gap-2.5 justify-center w-full max-w-[220px] mx-auto">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Làm lại bài thi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => askAITutor(`Tôi vừa hoàn thành bài thi Speaking "${exam.title}" với điểm Overall Band ${overallBand} (${partScores.map((s, i) => `Part ${i + 1}: Band ${s}`).join(', ')}). Nhờ AI phân tích các tiêu chí cần ưu tiên nâng điểm và gợi ý phương pháp luyện phát âm/phản xạ giúp tôi.`)}
                    className="h-9 px-5 rounded-full border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer bg-white"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Hỏi AI phân tích bài làm</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Per-part results: Luyện Nói card format */}
            <div className="flex flex-col gap-4">
              {exam.speakingParts.map(part => {
                const r = results[part.id]
                if (!r) return null
                const partTitle = part.topic || part.cueCard || (part.questions?.map(q => q.questionText.replace(/^##TOPIC##:/, '')).filter(Boolean).slice(0, 2).join(' · ')) || `Speaking Part ${part.number}`

                const fluencyScore = r.criteria?.fluency?.score ?? '–'
                const vocabScore = r.criteria?.vocabulary?.score ?? '–'
                const grammarScore = r.criteria?.grammar?.score ?? '–'
                const pronScore = r.criteria?.pronunciation?.score ?? '–'

                return (
                  <div key={part.id} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-4 shadow-xs">
                    {/* Header Part Card */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                          TEST PART {part.number}: {partTitle}
                        </span>
                        <h3 className="text-base font-bold text-zinc-900 m-0">
                          Đánh giá chi tiết Part {part.number}
                        </h3>
                      </div>
                      <div className="bg-amber-100 text-amber-800 font-bold rounded-full w-12 h-12 flex items-center justify-center font-mono text-base shrink-0 shadow-2xs border border-amber-200/60" title={`Overall Part ${part.number}: Band ${r.overall}`}>
                        {r.overall}
                      </div>
                    </div>

                    {/* Audio Player Bar */}
                    <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200/80 rounded-xl px-3.5 py-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setPlayingPartId(prev => prev === part.id ? null : part.id)}
                        className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 transition cursor-pointer shrink-0"
                        title={playingPartId === part.id ? "Tạm dừng" : "Nghe lại bài nói"}
                      >
                        {playingPartId === part.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                      <div className="flex items-center gap-1 flex-1 h-6">
                        {[35, 60, 45, 80, 65, 90, 40, 70, 85, 50, 75, 95, 60, 40, 80, 55, 70, 90, 65, 45, 85, 60, 75, 40, 55, 30].map((h, i) => (
                          <span
                            key={i}
                            className={`w-1 rounded-full transition-all duration-300 ${
                              playingPartId === part.id ? 'bg-zinc-800 animate-pulse' : 'bg-zinc-300'
                            }`}
                            style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] font-mono font-medium text-zinc-500 shrink-0 flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-zinc-400" />
                        <span>Audio Recording</span>
                      </div>
                    </div>

                    {/* Transcript with highlights */}
                    <div className="bg-zinc-50/70 rounded-xl border border-zinc-200/70 p-3.5 mb-3.5">
                      <div className="flex items-center justify-between mb-1.5 text-xs text-zinc-500 font-medium">
                        <span>Transcript bài nói của bạn:</span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {transcripts[part.id]?.trim() ? `${transcripts[part.id].trim().split(/\s+/).length} từ` : '0 từ'}
                        </span>
                      </div>
                      <HighlightedTranscript text={transcripts[part.id]} />
                    </div>

                    {/* 4 Criteria Badges Row (Pill badges) */}
                    <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-zinc-100">
                      <span className="rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1.5">
                        Trôi chảy: <strong className="font-mono">{fluencyScore}</strong>
                      </span>
                      <span className="rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1.5">
                        Từ vựng: <strong className="font-mono">{vocabScore}</strong>
                      </span>
                      <span className="rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1.5">
                        Ngữ pháp: <strong className="font-mono">{grammarScore}</strong>
                      </span>
                      <span className="rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1.5">
                        Phát âm: <strong className="font-mono">{pronScore}</strong>
                      </span>
                    </div>

                    {/* Feedback notes / Strengths & Improvements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
                      {r.strengths && (
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                          <span className="text-emerald-800 font-bold block mb-1">Điểm mạnh (Strengths)</span>
                          {renderFeedbackList(r.strengths, 'text-emerald-600')}
                        </div>
                      )}
                      {r.improvements && (
                        <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3">
                          <span className="text-orange-800 font-bold block mb-1">Cần cải thiện (Improvements)</span>
                          {renderFeedbackList(r.improvements, 'text-orange-600')}
                        </div>
                      )}
                    </div>

                    {/* AI tutor action button */}
                    <button
                      type="button"
                      onClick={() => askAITutor(`Tôi vừa hoàn thành IELTS Speaking Part ${part.number} (${partTitle}) với kết quả Band ${r.overall} (Trôi chảy: ${fluencyScore}, Từ vựng: ${vocabScore}, Ngữ pháp: ${grammarScore}, Phát âm: ${pronScore}). Bài nói của tôi: "${transcripts[part.id]}". Hãy phân tích lỗi ngữ pháp/phát âm cụ thể và gợi ý cách diễn đạt band 7.5+ giúp tôi.`)}
                      className="h-8 px-4 rounded-full text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Hỏi AI Tutor câu này
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-2">
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
                onClick={() => navigate('/speaking')} 
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

  // ── Exam ──────────────────────────────────────────────────────────────────
  const part = exam.speakingParts[activePart]
  const partTranscript = transcripts[part.id] || ''
  const wordCount = partTranscript.trim().split(/\s+/).filter(Boolean).length
  const partDone = isPartDone(part.id)
  const partGradingError = gradingErrors[part.id] || null

  return (
    <>
    <div className="h-dvh flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Header */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
            {exam.title}
          </span>
          {previewMode && (
            <span className="text-[11px] bg-zinc-100 text-zinc-800 border border-zinc-200 px-2.5 py-0.5 rounded-full font-medium shrink-0">
              Chế độ Preview
            </span>
          )}
        </div>
        {!previewMode && (
          <div className="flex items-center gap-3 shrink-0">
            {lastSavedAt && (
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                ✓ Đã lưu {formatSavedAt(lastSavedAt)}
              </span>
            )}
            <span className="text-xs text-zinc-500 font-mono tabular-nums">
              {exam.speakingParts.filter(p => isPartDone(p.id)).length}/{exam.speakingParts.length} parts hoàn thành
            </span>
          </div>
        )}
      </header>

      {/* Mobile view toggle — chỉ render trên mobile; state riêng, không đụng activePart */}
      {isMobile && (
        <div className="flex flex-shrink-0 border-b border-zinc-200 bg-white">
          <button
            onClick={() => setMobileView('questions')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'questions' ? 'border-zinc-900 text-zinc-900 bg-zinc-100' : 'border-transparent text-zinc-500'}`}
          >
            Câu hỏi
          </button>
          <button
            onClick={() => setMobileView('recording')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'recording' ? 'border-zinc-900 text-zinc-900 bg-zinc-100' : 'border-transparent text-zinc-500'}`}
          >
            Ghi âm{wordCount > 0 ? ` · ${wordCount} từ` : ''}
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: questions */}
        <div className={`overflow-y-auto bg-white border-r border-zinc-200 flex flex-col ${isMobile ? (mobileView === 'questions' ? 'w-full' : 'hidden') : 'w-2/5'}`}>
          {/* Part banner */}
          <div className="bg-[var(--ink)] px-5 py-3 text-xs font-bold text-white uppercase tracking-wider">
            {part.number === 1 && 'Part 1 — Introduction & Interview'}
            {part.number === 2 && 'Part 2 — Individual Long Turn'}
            {part.number === 3 && 'Part 3 — Two-way Discussion'}
          </div>

          {/* Part 1 content */}
          {part.number === 1 && (
            <div className="p-6 bg-zinc-50/50 flex-1 flex flex-col gap-5">
              {part.cueCard && (
                <p className="text-zinc-500 text-sm leading-relaxed m-0 font-medium italic border-l-2 border-zinc-900 pl-3.5">{part.cueCard}</p>
              )}
              <div className="flex flex-col gap-4">
                {part.questions.map((q, i) => (
                  <div key={q.id} className="flex gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="text-zinc-800 text-sm leading-relaxed m-0 font-medium">{q.questionText}</p>
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
              <div className="p-6 bg-zinc-50/50 flex-1 flex flex-col gap-5">
                {instructions && (
                  <p className="text-zinc-500 text-sm leading-relaxed m-0 font-medium italic">{instructions}</p>
                )}
                {cueCardText && (
                  <div className="bg-white border-l-4 border-zinc-900 rounded-r-2xl border-y border-r border-zinc-200 p-5 shadow-xs">
                    <p className="text-zinc-900 text-xs font-bold uppercase tracking-wider mb-2">Cue Card</p>
                    <p className="text-zinc-800 text-sm leading-relaxed font-semibold m-0 whitespace-pre-wrap">{cueCardText}</p>
                    <p className="text-zinc-500 text-xs mt-4 font-medium italic m-0">Chuẩn bị 1 phút · Nói 1–2 phút</p>
                  </div>
                )}
                {part.questions.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Follow-up Questions</p>
                    <div className="flex flex-col gap-2.5">
                      {part.questions.map(q => (
                        <div key={q.id} className="flex gap-2.5 items-start bg-white p-3 rounded-xl border border-zinc-200 shadow-xs text-sm">
                          <span className="text-zinc-400 font-bold mt-0.5">•</span>
                          <span className="text-zinc-600 leading-relaxed font-medium">{q.questionText}</span>
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
              <div className="p-6 bg-zinc-50/50 flex-1 flex flex-col gap-5">
                {part.cueCard && (
                  <p className="text-zinc-500 text-sm leading-relaxed m-0 font-medium italic border-l-2 border-zinc-900 pl-3.5">{part.cueCard}</p>
                )}
                <div className="flex flex-col gap-5">
                  {groups.map((group, gi) => (
                    <div key={gi} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs flex flex-col gap-3">
                      {(group.label || groups.length > 1) && (
                        <p className="text-zinc-900 text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-100 m-0">{group.label || `Chủ đề ${gi + 1}`}</p>
                      )}
                      <div className="flex flex-col gap-3">
                        {group.questions.map((q, qi) => (
                          <div key={q.id} className="flex gap-3 text-sm">
                            <span className="w-5 h-5 flex-shrink-0 rounded-full bg-zinc-100 text-zinc-600 font-bold text-xs flex items-center justify-center mt-0.5">{qi + 1}</span>
                            <span className="text-zinc-700 leading-relaxed font-medium">{q.questionText}</span>
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
        <div className={`flex-1 flex flex-col overflow-hidden bg-zinc-50/50 p-6 ${isMobile && mobileView !== 'recording' ? 'hidden' : ''}`}>
          {previewMode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4 text-zinc-600">
                <Eye className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="text-zinc-900 text-base font-bold mb-2">Chế độ Preview</p>
              <p className="text-zinc-500 text-sm leading-relaxed m-0">Phần ghi âm và chấm điểm không hiển thị trong preview.<br />Nội dung đề thi hiển thị bên trái.</p>
            </div>
          ) : partGradingError?.answerId && !results[part.id] ? (
            // Đã nộp NHƯNG bản chấm mới nhất bị lỗi (vd. model AI đổi/timeout) — vẫn còn
            // transcript đã lưu, cho chấm lại tại chỗ thay vì treo mãi ở "Đang tổng hợp".
            <div className="flex-1 bg-white rounded-2xl border border-red-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="font-bold text-zinc-900 text-lg mb-1">Nhận xét Part {part.number} không thành công</p>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">{partGradingError.error}</p>
              <button
                onClick={() => retryPart(part)}
                disabled={retryingPart === part.id}
                className="btn-primary h-9 px-4 rounded-full text-xs sm:text-sm font-medium shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {retryingPart === part.id ? (
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
          ) : partDone ? (
            <div className="flex-1 bg-white rounded-2xl border border-zinc-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 text-emerald-600">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="font-bold text-zinc-900 text-lg mb-1">Đã nộp Part {part.number}!</p>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">Kết quả từ AI sẽ hiển thị sau khi hoàn thành tất cả các Part.</p>
              {activePart < exam.speakingParts.length - 1 ? (
                <button
                  onClick={() => setActivePart(activePart + 1)}
                  className="btn-primary h-9 px-4 rounded-full text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center justify-center"
                >
                  Tiếp tục Part {exam.speakingParts[activePart + 1].number} →
                </button>
              ) : (
                <p className="text-zinc-700 font-semibold text-sm m-0">Đang tổng hợp kết quả...</p>
              )}
              {/* Task 3: "Nộp lại" — hành động phụ, xác nhận 2 bước, không xoá bản ghi cũ */}
              <div className="mt-5 pt-5 border-t border-zinc-100 w-full">
                {confirmResubmitId === part.id ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-zinc-500 text-xs leading-relaxed m-0">Nộp lại sẽ ghi đè kết quả hiển thị bằng bài nói mới — bài cũ vẫn được lưu lại.</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleResubmit(part)} className="h-9 px-4 rounded-full text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none">
                        Xác nhận nộp lại
                      </button>
                      <button onClick={() => setConfirmResubmitId(null)} className="h-9 px-4 rounded-full text-sm font-medium bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none">
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmResubmitId(part.id)}
                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-900 underline decoration-dotted transition-colors cursor-pointer bg-transparent border-none"
                  >
                    Nộp lại Part {part.number}
                  </button>
                )}
              </div>
            </div>
          ) : gradingPart === part.id ? (
            <div className="flex-1 bg-white rounded-2xl border border-zinc-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-bold text-zinc-900 text-lg mb-1">AI đang nhận xét Part {part.number}...</p>
              <p className="text-zinc-500 text-sm leading-relaxed">Hệ thống đang phân tích câu trả lời của bạn. Vui lòng chờ trong giây lát.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3.5 min-h-0">
              {partGradingError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    Nộp bài không thành công: {partGradingError.error}
                  </span>
                  <button
                    onClick={() => submitPart(part)}
                    className="ml-3 h-8 px-3.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử nộp lại
                  </button>
                </div>
              )}
              {/* Recording area */}
              {isRecording ? (
                /* ── 1. Compact horizontal bar while recording ─────────────── */
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs px-5 py-4 flex flex-wrap items-center justify-between gap-3 transition-all duration-300">
                  {/* Left: Recording indicator */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-zinc-900 text-sm font-bold whitespace-nowrap">Đang ghi âm...</span>
                  </div>

                  {/* Middle: Compact waveform + Timer */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-full">
                    <div className="flex items-end gap-1 h-5 justify-center" style={{ width: '40px' }}>
                      {audioLevels.map((level, i) => (
                        <div
                          key={i}
                          className="w-1.5 rounded-full bg-zinc-800 transition-all duration-75"
                          style={{
                            height: `${Math.max(4, Math.round(level * 18))}px`,
                            minHeight: '4px',
                            maxHeight: '18px',
                          }}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-mono font-bold select-none ${part.number === 2 && (PART2_SPEAK_SECONDS - recordingSeconds) <= 20 ? 'text-red-600' : 'text-zinc-600'}`}>
                      {part.number === 2
                        ? formatTime(Math.max(0, PART2_SPEAK_SECONDS - recordingSeconds))
                        : formatTime(recordingSeconds)}
                    </span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={cancelRecording}
                      className="flex items-center gap-1 h-8 px-3.5 py-1 rounded-full border border-zinc-300 text-zinc-600 text-xs font-medium bg-white hover:bg-zinc-50 transition-colors cursor-pointer shadow-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                      Huỷ
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 h-8 px-3.5 py-1 rounded-full text-white text-xs font-medium bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
                    >
                      <Square className="w-3.5 h-3.5" fill="currentColor" />
                      Dừng và gửi
                    </button>
                  </div>
                </div>
              ) : isTranscribing ? (
                /* ── 2. Loading state while Whisper processes audio ────────── */
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-zinc-700 text-sm font-semibold">Đang nhận dạng giọng nói...</span>
                </div>
              ) : prepActive ? (
                /* ── 2b. Part 2 — card "Chuẩn bị" 60s (đếm ngược, có nút skip) ── */
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-8 flex flex-col items-center text-center gap-3">
                  <p className="text-zinc-900 text-xs font-bold uppercase tracking-wider m-0">Thời gian chuẩn bị</p>
                  <div className="text-5xl font-mono font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
                    {formatTime(prepSecondsLeft)}
                  </div>
                  <p className="text-zinc-500 text-sm leading-relaxed m-0 max-w-xs">
                    Bạn có 1 phút để chuẩn bị. Ghi lại ý chính rồi bắt đầu nói (tối đa 2 phút).
                  </p>
                  <button
                    onClick={skipPrep}
                    className="btn-primary mt-2 h-9 px-4 rounded-full font-medium text-xs sm:text-sm shadow-xs transition-colors cursor-pointer flex items-center justify-center"
                  >
                    Bắt đầu ngay
                  </button>
                </div>
              ) : (
                /* ── 3. Idle state (Before recording OR after transcript received) ── */
                <div className="flex-1 flex flex-col gap-3.5 min-h-0">
                  {/* Mic action panel — fixed height, does not grow */}
                  <div className="flex-shrink-0 bg-white rounded-2xl border border-zinc-200 shadow-xs p-5 flex flex-col items-center gap-3">
                    <button
                      onClick={() => startRecording(part.id)}
                      className="w-14 h-14 rounded-full border-none flex items-center justify-center shadow-md transition-all duration-300 bg-zinc-900 text-white cursor-pointer hover:bg-black active:scale-95"
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                    <p className="text-zinc-600 text-sm font-semibold m-0 text-center">
                      {partTranscript ? 'Đã ghi xong. Bấm để ghi âm lại' : 'Bấm để bắt đầu nói'}
                    </p>
                    {transcribeError && (
                      <p className="text-xs text-amber-600 font-medium m-0 text-center flex items-center justify-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {transcribeError}
                      </p>
                    )}
                  </div>

                  {/* Chat bubble transcript — grows to fill remaining space, scrolls if long */}
                  {partTranscript && (
                    <div className="flex-1 min-h-0 bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs overflow-hidden">
                      {/* Header bar: Play button + Title (Left) and Word count (Right) */}
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 flex-shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Audio playback button */}
                          {recordingAudioUrl && (
                            <button
                              onClick={handleTogglePlayback}
                              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-black active:scale-95 text-white flex items-center justify-center flex-shrink-0 transition cursor-pointer border-none shadow-xs"
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

                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            Bản ghi giọng nói
                          </span>
                        </div>

                        <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 ${wordCount > 0 ? 'bg-zinc-100 text-zinc-800 border border-zinc-200' : 'bg-zinc-100 text-zinc-500'}`}>
                          {wordCount} từ
                        </span>
                      </div>

                      {/* Main content area: Standalone transcript text, full width, no background tint */}
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <p className="text-zinc-900 text-sm leading-relaxed font-normal m-0 italic">
                          "{partTranscript}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit button — pinned at bottom, does not grow */}
                  <button
                    onClick={() => submitPart(part)}
                    disabled={submitting || wordCount < 10 || isTranscribing}
                    className="flex-shrink-0 btn-primary h-9 px-5 rounded-full font-medium text-sm w-full transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        Đang chấm điểm...
                      </>
                    ) : (
                      `Nộp Part ${part.number}`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-14 px-6 bg-white border-t border-zinc-200 flex items-center justify-between gap-4 shrink-0 z-20">
        {/* Left/Middle: Part palette */}
        <div className="flex items-center gap-2">
          {exam.speakingParts.map((p, i) => {
            const done = isPartDone(p.id)
            const active = activePart === i
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePart(i)}
                className={`h-9 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-all cursor-pointer ${
                  done
                    ? 'bg-zinc-900 text-white border border-zinc-900'
                    : 'border border-zinc-300 text-zinc-700 bg-white hover:border-zinc-400'
                } ${active ? 'ring-2 ring-zinc-900/20 font-semibold' : ''}`}
              >
                <span>Part {p.number}</span>
                {done && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            )
          })}
        </div>

        {/* Right: Submit button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => submitPart(part)}
            disabled={submitting || wordCount < 10 || isTranscribing || partDone}
            className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium h-9 px-5 rounded-full shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 leading-none"
          >
            {submitting ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Đang chấm điểm...
              </>
            ) : partDone ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã nộp Part {part.number}
              </>
            ) : (
              `Nộp Part ${part.number}`
            )}
          </button>
        </div>
      </div>

    </div>

    {/* Exit confirmation modal — Back nút trình duyệt */}
    <ExitConfirmModal open={showExitModal} onStay={stayInExam} onLeave={leaveExam} />

    {/* Loading overlay khi nộp bài */}
    {submitting && (
      <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-700">Đang chấm điểm và tổng hợp kết quả...</p>
      </div>
    )}
    </>
  )
}
