import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BACKEND_URL } from '../utils/media'

import { getSpeakingExam, submitSpeakingExam, getSpeakingStatus, getFullTestStatus, getSpeakingMyResults, retrySpeakingGrading } from '../services/examService'
import { saveDraft, loadDraft, clearDraft, isDataEmpty, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBrowserHistoryGuard } from '../hooks/useBrowserHistoryGuard'
import { useSpeechRecording } from '../hooks/useSpeechRecording'
import { Mic, X, Square, Play, Pause, AlertCircle, RotateCcw, Sparkles, Eye, Volume2, History, CheckCircle2 } from 'lucide-react'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import { renderFeedbackList } from '../utils/feedbackList'
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
  const viewResultMode = searchParams.get('viewResult') === 'true'
  const { user } = useAuth()
  const { showToast } = useToast()

  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('exam')
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
  const [hasPastResults, setHasPastResults] = useState(false)
  const [confirmResubmitId, setConfirmResubmitId] = useState(null) // partId đang chờ xác nhận "Nộp lại"
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [playingPartId, setPlayingPartId] = useState(null)
  const pollTimerRef = useRef(null)

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [turnState, setTurnState] = useState('idle') // 'idle' | 'ai_speaking' | 'user_preparing' | 'user_speaking'
  const [playingAudioId, setPlayingAudioId] = useState(null)
  const ttsAudioRef = useRef(null)
  const playTTS = useCallback((url, id, onEnded = null) => {
    if (!url) {
      if (onEnded) onEnded()
      return
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
    }
    const resolvedUrl = url.startsWith('/') ? `${BACKEND_URL}${url}` : url
    const audio = new Audio(resolvedUrl)
    ttsAudioRef.current = audio
    setPlayingAudioId(id)
    audio.play().catch(e => {
      console.error('Audio play error:', e)
      setPlayingAudioId(null)
      if (onEnded) onEnded()
    })
    audio.onended = () => {
      setPlayingAudioId(null)
      if (onEnded) onEnded()
    }
  }, [])

  // Cleanup TTS on unmount or part change
  useEffect(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      setPlayingAudioId(null)
    }
    setActiveQuestionIndex(0)
    setTurnState('idle')
  }, [activePart])

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

  const exitPath = exam?.seriesId ? `/full-test/${exam.seriesId}?book=${exam.bookNumber}` : '/speaking-samples'
  const { showModal: showExitModal, stay: stayInExam, leave: leaveExam } = useBrowserHistoryGuard(phase === 'exam' && !previewMode && !allSubmitted, persistDraftNow, exitPath)

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
    forceCleanupAll,
    pauseRecording,
    resumeRecording
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

  // ── State Machine Logic ──────────────────────────────────────────────────
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(PART2_PREP_SECONDS)
  
  const getSpeakSecondsLimit = useCallback((partNum) => {
    if (partNum === 1) return 30
    if (partNum === 2) return 120
    if (partNum === 3) return 45
    return 60
  }, [])

  const onAiAudioEnded = useCallback(() => {
    const p = exam?.speakingParts?.[activePart]
    if (!p) return
    if (p.number === 2 && activeQuestionIndex === 0) { // Prep time after intro
      setTurnState('user_preparing')
      setPrepSecondsLeft(PART2_PREP_SECONDS)
    } else {
      setTurnState('user_speaking')
      if (!isRecordingRef.current) { // We can't access isRecording reliably in useCallback if it's stale, but startRecording handles it
        startRecording(p.id)
      } else {
        resumeRecording()
      }
    }
  }, [exam, activePart, activeQuestionIndex, startRecording, resumeRecording])

  const isRecordingRef = useRef(false)
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  const startInterview = useCallback(() => {
    const p = exam?.speakingParts?.[activePart]
    if (!p) return
    setTurnState('ai_speaking')
    setActiveQuestionIndex(0)

    if (p.number === 2) {
      if (p.introAudioUrl) {
        playTTS(p.introAudioUrl, `intro-${p.id}`, onAiAudioEnded)
      } else {
        onAiAudioEnded()
      }
    } else {
      const currentQ = p.questions[0]
      if (currentQ?.audioUrl) {
        playTTS(currentQ.audioUrl, `q-${currentQ.id}`, onAiAudioEnded)
      } else {
        onAiAudioEnded()
      }
    }
  }, [exam, activePart, playTTS, onAiAudioEnded])

  const handleNextQuestion = useCallback(() => {
    const p = exam?.speakingParts?.[activePart]
    if (!p) return
    if (activeQuestionIndex < p.questions.length - 1) {
      pauseRecording()
      const nextIndex = activeQuestionIndex + 1
      setActiveQuestionIndex(nextIndex)
      setTurnState('ai_speaking')
      const nextQ = p.questions[nextIndex]
      if (nextQ?.audioUrl) {
        playTTS(nextQ.audioUrl, `q-${nextQ.id}`, onAiAudioEnded)
      } else {
        onAiAudioEnded()
      }
    } else {
      setTurnState('idle')
      stopRecording()
    }
  }, [exam, activePart, activeQuestionIndex, pauseRecording, stopRecording, playTTS, onAiAudioEnded])

  const skipPrep = useCallback(() => {
    setTurnState('user_speaking')
    const p = exam?.speakingParts?.[activePart]
    if (p) {
      if (!isRecordingRef.current) {
        startRecording(p.id)
      } else {
        resumeRecording()
      }
    }
  }, [exam, activePart, startRecording, resumeRecording])

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
        
        // ── Resume draft cục bộ (logic cũ, dùng functional update để không
        //    clobber phần state mà nhánh khôi phục vừa set) ─────────────────
        let draftTranscripts = null
        let draftIds = []
        let activeDraft = false
        if (user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'speaking')
          // Cho phép tự động load draft kể cả không có ?resume=true
          if (draft?.data && !isDataEmpty(draft.data)) {
            draftTranscripts = draft.data.transcripts || {}
            draftIds = Array.isArray(draft.data.submittedPartIds) ? draft.data.submittedPartIds : []
            activeDraft = true
            setTranscripts(prev => ({ ...prev, ...draftTranscripts }))
            setSubmittedPartIds(prev => Array.from(new Set([...prev, ...draftIds])))
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
        }

        // ── Khôi phục kết quả đã chấm (status 'graded') ─────────────────────
        // NẾU có draft đang dang dở (hoặc vừa bấm Làm lại), CHỈ khôi phục
        // kết quả của những part thuộc attempt hiện tại (nằm trong draft).
        const restoredResults = {}
        const restoredTranscripts = {}
        const restoredIds = []
        const restoredErrors = {}
        if (Array.isArray(myResults)) {
          if (myResults.length > 0) setHasPastResults(true)
          for (const entry of myResults) {
            if (!entry || entry.partId == null) continue
            // Lọc bớt result cũ nếu không phải ở chế độ xem lại (viewResultMode)
            if (!viewResultMode && (!activeDraft || !draftIds.includes(entry.partId))) continue;

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

        setPhase('exam')
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
  // chấm, part đã nộp) — chỉ đẩy một chiều.
  useEffect(() => {
    if (!exam) return
    const p = exam.speakingParts[activePart]
    if (!p) return
    const done = !!results[p.id] || submittedPartIds.includes(p.id)
    if (done || gradingPart === p.id || isRecording || isTranscribing || turnState === 'user_preparing' || turnState === 'ai_speaking' || turnState === 'user_speaking') setMobileView('recording')
  }, [exam, activePart, results, submittedPartIds, gradingPart, isRecording, isTranscribing, turnState])

  // Đếm ngược user_preparing (60s)
  useEffect(() => {
    if (turnState !== 'user_preparing') return
    let n = PART2_PREP_SECONDS
    setPrepSecondsLeft(n)
    const iv = setInterval(() => {
      n -= 1
      setPrepSecondsLeft(n)
      if (n <= 0) {
        clearInterval(iv)
        skipPrep()
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [turnState, skipPrep])

  // Tự động dừng ghi âm/chuyển câu khi hết thời gian quy định
  useEffect(() => {
    if (turnState !== 'user_speaking') return
    const p = exam?.speakingParts?.[activePart]
    if (!p) return
    const limit = getSpeakSecondsLimit(p.number)
    if (recordingSeconds >= limit) {
      handleNextQuestion()
    }
  }, [turnState, recordingSeconds, activePart, exam, handleNextQuestion, getSpeakSecondsLimit])

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

                {/* Cột 3: Nút hành động */}
                <div className="flex flex-col gap-2.5 justify-center w-full max-w-[220px] mx-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (user) {
                        clearDraft(user.id || user._id, id, 'speaking')
                        saveDraft({
                          userId: user.id || user._id,
                          examId: id,
                          skillType: 'speaking',
                          data: { transcripts: {}, submittedPartIds: [], isRetake: true },
                          timeRemaining: null
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
              <span className="text-[11px] text-zinc-400 whitespace-nowrap hidden sm:inline">
                ✓ Đã lưu {formatSavedAt(lastSavedAt)}
              </span>
            )}
            <span className="text-xs text-zinc-500 font-mono tabular-nums">
              {exam.speakingParts.filter(p => isPartDone(p.id)).length}/{exam.speakingParts.length} parts
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
      {turnState !== 'idle' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white overflow-hidden relative">
          {/* Mock Interview Component */}
          {turnState === 'ai_speaking' && (
            <div className="flex flex-col items-center justify-center w-full max-w-2xl text-center z-10">
              <div className="w-40 h-40 rounded-full bg-zinc-900 shadow-[0_0_50px_rgba(24,24,27,0.3)] flex items-center justify-center relative mb-12">
                 <div className="absolute inset-0 rounded-full border-4 border-zinc-900 animate-ping opacity-20"></div>
                 <div className="flex items-center gap-1.5 h-8">
                   {[1,2,3,4,5].map(n => <span key={n} className="w-1.5 bg-white animate-pulse rounded-full h-full" style={{animationDelay: `${n*100}ms`}}/>)}
                 </div>
              </div>
              <p className="text-zinc-500 font-semibold animate-pulse mb-6 text-sm uppercase tracking-widest">Giám khảo đang hỏi</p>
              <p className="text-2xl text-zinc-900 font-medium leading-relaxed">
                {part.number === 2 && activeQuestionIndex === 0 && part.introAudioUrl ? "Giám khảo đang hướng dẫn đề..." : part.questions[activeQuestionIndex]?.questionText}
              </p>
            </div>
          )}
          {turnState === 'user_preparing' && (
            <div className="flex flex-col items-center justify-center w-full max-w-2xl text-center z-10">
              <p className="text-zinc-500 font-bold uppercase tracking-wider mb-6 text-sm">Thời gian chuẩn bị</p>
              <div className="text-7xl font-mono font-black text-zinc-900 mb-10 tracking-tighter" style={{ color: 'var(--ink)' }}>
                {formatTime(prepSecondsLeft)}
              </div>
              <div className="bg-zinc-50 border-2 border-zinc-900 rounded-3xl p-8 w-full shadow-sm mb-10 text-left">
                 <p className="text-sm font-bold uppercase text-zinc-400 mb-4 tracking-wider">Cue Card</p>
                 <p className="text-zinc-900 font-medium whitespace-pre-wrap leading-relaxed text-lg">{part.cueCard ? (part.cueCard.indexOf('\n===\n') !== -1 ? part.cueCard.slice(part.cueCard.indexOf('\n===\n') + 5) : part.cueCard) : ''}</p>
              </div>
              <button onClick={skipPrep} className="btn-primary h-14 px-10 rounded-full font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer">
                Bắt đầu nói
              </button>
            </div>
          )}
          {turnState === 'user_speaking' && (
            <div className="flex flex-col items-center justify-center w-full max-w-2xl text-center z-10">
              <p className="text-zinc-500 font-bold uppercase tracking-wider mb-6 text-sm">Thời gian trả lời</p>
              <div className={`text-7xl font-mono font-black mb-10 tracking-tighter ${getSpeakSecondsLimit(part.number) - recordingSeconds <= 15 ? 'text-red-500 animate-pulse' : 'text-zinc-900'}`}>
                {formatTime(Math.max(0, getSpeakSecondsLimit(part.number) - recordingSeconds))}
              </div>
              <div className="flex items-end gap-2 h-20 justify-center mb-10" style={{ width: '160px' }}>
                {audioLevels.map((level, i) => (
                  <div
                    key={i}
                    className="w-5 rounded-full bg-red-500 transition-all duration-75"
                    style={{ height: `${Math.max(12, Math.round(level * 70))}px` }}
                  />
                ))}
              </div>
              <p className="mb-12 text-xl text-zinc-700 font-medium leading-relaxed">
                {part.questions[activeQuestionIndex]?.questionText}
              </p>
              <button onClick={handleNextQuestion} className="h-14 px-10 bg-zinc-900 hover:bg-black text-white font-bold rounded-full transition-all shadow-xl hover:scale-105 active:scale-95 text-lg flex items-center gap-3 cursor-pointer">
                {activeQuestionIndex < part.questions.length - 1 ? 'Chuyển câu tiếp theo' : 'Kết thúc phần thi'}
                <Square className="w-5 h-5 fill-current" />
              </button>
            </div>
          )}
        </div>
      ) : (
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
                  <div key={q.id} className="flex gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative overflow-hidden">
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-zinc-800 text-sm leading-relaxed m-0 font-medium transition-all">
                        {q.questionText}
                      </p>
                    </div>
                    {q.audioUrl && (
                      <button 
                        onClick={() => playingAudioId === `q-${q.id}` ? (ttsAudioRef.current?.pause(), setPlayingAudioId(null)) : playTTS(q.audioUrl, `q-${q.id}`)}
                        className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10 ${playingAudioId === `q-${q.id}` ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                      >
                        {playingAudioId === `q-${q.id}` ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                      </button>
                    )}
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
                  <div className={`relative overflow-hidden bg-white border-l-4 border-zinc-900 rounded-r-2xl border-y border-r border-zinc-200 p-5 shadow-xs transition-all duration-500 ${playingAudioId === `intro-${part.id}` ? 'blur-sm select-none opacity-40' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-zinc-900 text-xs font-bold uppercase tracking-wider">Cue Card</p>
                      {part.introAudioUrl && (
                        <button 
                          onClick={() => playingAudioId === `intro-${part.id}` ? (ttsAudioRef.current?.pause(), setPlayingAudioId(null)) : playTTS(part.introAudioUrl, `intro-${part.id}`)}
                          className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10 ${playingAudioId === `intro-${part.id}` ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                        >
                          {playingAudioId === `intro-${part.id}` ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                        </button>
                      )}
                    </div>
                    <p className="text-zinc-800 text-sm leading-relaxed font-semibold m-0 whitespace-pre-wrap">{cueCardText}</p>
                    <p className="text-zinc-500 text-xs mt-4 font-medium italic m-0">Chuẩn bị 1 phút · Nói 1–2 phút</p>
                    {playingAudioId === `intro-${part.id}` && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="flex items-center gap-1.5 h-8">
                           {[1,2,3,4,5].map(n => <span key={n} className="w-1.5 bg-zinc-900 animate-pulse rounded-full h-full" style={{animationDelay: `${n*100}ms`}}/>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {part.questions.length > 0 && (
                  <div className="flex flex-col gap-2.5 mt-2">
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Follow-up Questions</p>
                    <div className="flex flex-col gap-2.5">
                      {part.questions.map(q => (
                        <div key={q.id} className="flex gap-2.5 items-start bg-white p-3 rounded-xl border border-zinc-200 shadow-xs text-sm relative overflow-hidden">
                          <span className="text-zinc-400 font-bold mt-0.5 flex-shrink-0">•</span>
                          <div className="flex-1">
                            <span className="text-zinc-600 leading-relaxed font-medium transition-all">{q.questionText}</span>
                          </div>
                          {q.audioUrl && (
                            <button 
                              onClick={() => playingAudioId === `q-${q.id}` ? (ttsAudioRef.current?.pause(), setPlayingAudioId(null)) : playTTS(q.audioUrl, `q-${q.id}`)}
                              className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10 ${playingAudioId === `q-${q.id}` ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                            >
                              {playingAudioId === `q-${q.id}` ? <Square className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
                            </button>
                          )}
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
                  <div className={`relative overflow-hidden transition-all duration-500 ${playingAudioId === `intro-${part.id}` ? 'blur-sm select-none opacity-40' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-zinc-500 text-sm leading-relaxed m-0 font-medium italic border-l-2 border-zinc-900 pl-3.5 relative z-10">{part.cueCard}</p>
                      {part.introAudioUrl && (
                        <button 
                          onClick={() => playingAudioId === `intro-${part.id}` ? (ttsAudioRef.current?.pause(), setPlayingAudioId(null)) : playTTS(part.introAudioUrl, `intro-${part.id}`)}
                          className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10 ${playingAudioId === `intro-${part.id}` ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                        >
                          {playingAudioId === `intro-${part.id}` ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                        </button>
                      )}
                    </div>
                    {playingAudioId === `intro-${part.id}` && (
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="flex items-center gap-1.5 h-6">
                           {[1,2,3,4,5].map(n => <span key={n} className="w-1.5 bg-zinc-900 animate-pulse rounded-full h-full" style={{animationDelay: `${n*100}ms`}}/>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-5">
                  {groups.map((group, gi) => (
                    <div key={gi} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs flex flex-col gap-3">
                      {(group.label || groups.length > 1) && (
                        <p className="text-zinc-900 text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-100 m-0">{group.label || `Chủ đề ${gi + 1}`}</p>
                      )}
                      <div className="flex flex-col gap-3">
                        {group.questions.map((q, qi) => (
                          <div key={q.id} className="flex gap-3 text-sm relative overflow-hidden">
                            <span className="w-5 h-5 flex-shrink-0 rounded-full bg-zinc-100 text-zinc-600 font-bold text-xs flex items-center justify-center mt-0.5">{qi + 1}</span>
                            <div className="flex-1">
                              <span className="text-zinc-700 leading-relaxed font-medium transition-all">{q.questionText}</span>
                            </div>
                            {q.audioUrl && (
                              <button 
                                onClick={() => playingAudioId === `q-${q.id}` ? (ttsAudioRef.current?.pause(), setPlayingAudioId(null)) : playTTS(q.audioUrl, `q-${q.id}`)}
                                className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer z-10 ${playingAudioId === `q-${q.id}` ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                              >
                                {playingAudioId === `q-${q.id}` ? <Square className="w-2 h-2" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
                              </button>
                            )}
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
          ) : (
            <div className="flex-1 flex flex-col gap-3.5 min-h-0">
              {(partDone || gradingPart === part.id) && (
                <div className={`mb-1 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shrink-0 ${partDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                  {partDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Part {part.number} đã được nộp!
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
                      AI đang nhận xét Part {part.number}...
                    </>
                  )}
                </div>
              )}
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
              ) : (
                /* ── 3. Idle state (Before recording OR after transcript received) ── */
                <div className="flex-1 flex flex-col gap-3.5 min-h-0">
                  {/* Mic action panel — fixed height, does not grow */}
                  <div className="flex-shrink-0 bg-white rounded-2xl border border-zinc-200 shadow-xs p-5 flex flex-col items-center gap-3">
                    <button
                      onClick={startInterview}
                      disabled={partDone || gradingPart === part.id}
                      className={`w-14 h-14 rounded-full border-none flex items-center justify-center shadow-md transition-all duration-300 ${partDone || gradingPart === part.id ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 text-white cursor-pointer hover:bg-black active:scale-95'}`}
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                    <p className="text-zinc-600 text-sm font-semibold m-0 text-center">
                      {(partDone || gradingPart === part.id) ? 'Bài thi đã hoàn thành' : partTranscript ? 'Đã ghi xong. Bấm để phỏng vấn lại' : 'Bấm để bắt đầu phỏng vấn'}
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Bottom Bar */}
      <div className="h-14 px-4 sm:px-6 bg-white border-t border-zinc-200 flex items-center justify-between gap-3 sm:gap-4 shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0 overflow-x-auto [scrollbar-width:none]">
          {exam.speakingParts.map((p, i) => {
            const done = isPartDone(p.id)
            const active = activePart === i
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePart(i)}
                aria-label={`Part ${p.number}${done ? ' — đã nộp' : ''}`}
                className={`exam-bar-btn shrink-0 whitespace-nowrap h-9 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-all cursor-pointer ${
                  done
                    ? 'bg-zinc-900 text-white border border-zinc-900'
                    : 'border border-zinc-300 text-zinc-700 bg-white hover:border-zinc-400'
                } ${active ? 'ring-2 ring-zinc-900/20 font-semibold' : ''}`}
              >
                <span className="sm:hidden" aria-hidden="true">P{p.number}</span>
                <span className="hidden sm:inline" aria-hidden="true">Part {p.number}</span>
                {done && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
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
            className="exam-bar-btn whitespace-nowrap bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium h-9 px-5 rounded-full shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 leading-none"
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

    {/* Exit confirmation modal — Back nút trình duyệt hoặc nút Header */}
    <ExitConfirmModal open={showExitModal} onStay={stayInExam} onLeave={() => leaveExam(exitPath)} />

    {/* Loading overlay khi nộp bài */}
    {(submitting && exam.speakingParts.filter(p => !isPartDone(p.id)).length <= 1) && (
      <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-700">Đang chấm điểm và tổng hợp kết quả...</p>
      </div>
    )}
    </>
  )
}
