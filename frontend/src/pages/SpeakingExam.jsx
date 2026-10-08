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




function getScoreColorClass(scoreStr, isSolid = false) {
  const score = parseFloat(scoreStr);
  if (isNaN(score)) return isSolid ? 'bg-zinc-200 text-zinc-700' : 'bg-zinc-50 text-zinc-800 border-zinc-200';
  if (score >= 8.0) return isSolid ? 'bg-purple-400 text-purple-950' : 'bg-purple-50 text-purple-800 border-purple-200';
  if (score >= 7.0) return isSolid ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (score >= 5.5) return isSolid ? 'bg-amber-400 text-amber-950' : 'bg-amber-50 text-amber-800 border-amber-200';
  return isSolid ? 'bg-zinc-300 text-zinc-800' : 'bg-zinc-50 text-zinc-800 border-zinc-300';
}

function roundIeltsScore(score) {
  const num = parseFloat(score);
  if (isNaN(num)) return score;
  const whole = Math.floor(num);
  const fraction = num - whole;
  if (fraction >= 0.75) return (whole + 1).toFixed(1);
  if (fraction >= 0.25) return (whole + 0.5).toFixed(1);
  return whole.toFixed(1);
}

function CustomAudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDurationHacked, setIsDurationHacked] = useState(false)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
       audioRef.current.pause()
       setIsPlaying(false)
    } else {
      if (audioRef.current.duration === Infinity && !isDurationHacked) {
        audioRef.current.currentTime = 1e101;
        setTimeout(() => {
           audioRef.current.currentTime = 0;
           setIsDurationHacked(true);
           audioRef.current.play();
           setIsPlaying(true)
        }, 200);
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    const time = audioRef.current.currentTime
    const dur = audioRef.current.duration
    setCurrentTime(time)
    if (dur && dur !== Infinity && !isNaN(dur)) {
      setDuration(dur)
      setProgress((time / dur) * 100)
    }
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (dur && dur !== Infinity && !isNaN(dur)) {
      setDuration(dur);
    }
  }

  const handleEnded = () => {
     setIsPlaying(false)
     setProgress(100)
  }

  const formatTime = (time) => {
    if (isNaN(time) || !isFinite(time)) return '0:00'
    const m = Math.floor(time / 60)
    const s = Math.floor(time % 60)
    return m + ":" + s.toString().padStart(2, '0')
  }

  const handleSeek = (e) => {
    if (!audioRef.current) return
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percent = Math.max(0, Math.min(1, x / bounds.width))
    const dur = duration || audioRef.current.duration || 0;
    const newTime = percent * dur
    if (!isNaN(newTime) && isFinite(newTime)) {
       audioRef.current.currentTime = newTime
       setCurrentTime(newTime)
    }
    if (dur) setProgress(percent * 100)
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <audio ref={audioRef} src={src} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onLoadedMetadata={handleLoadedMetadata} />
      <button onClick={togglePlay} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border-2 border-teal-400 text-teal-500 bg-white shadow-sm hover:bg-teal-50 transition-colors">
        {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
      </button>
      <div className="flex-1 h-2 bg-teal-100 rounded-full cursor-pointer relative" onClick={handleSeek}>
        <div className="absolute left-0 top-0 bottom-0 bg-teal-400 rounded-full transition-all duration-100" style={{ width: progress + '%' }} />
        <div className="absolute w-3 h-3 bg-white border-2 border-teal-400 rounded-full top-1/2 -translate-y-1/2 -ml-1.5 transition-all duration-100" style={{ left: progress + '%' }} />
      </div>
      <div className="text-xs font-mono text-zinc-500 font-medium whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
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

  // Auto-advance to first unfinished part on load
  useEffect(() => {
    if (exam?.speakingParts && Object.keys(results || {}).length > 0) {
      const firstUnfinished = exam.speakingParts.findIndex(p => !(p.id in results))
      if (firstUnfinished !== -1 && activePart === 0) {
        setActivePart(firstUnfinished)
      }
    }
  }, [exam, results, activePart])
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
  const [showQuestion, setShowQuestion] = useState(false)
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
    if (partNum === 1) return 40
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
      startRecording(p.id, p.questions[activeQuestionIndex]?.id)
    }
  }, [exam, activePart, activeQuestionIndex, startRecording])

  const isRecordingRef = useRef(false)
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    if (transcribeError) {
      showToast(transcribeError, 'error')
    }
  }, [transcribeError, showToast])

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
      stopRecording()
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
      setTurnState('completed')
      stopRecording()
    }
  }, [exam, activePart, activeQuestionIndex, stopRecording, playTTS, onAiAudioEnded])

  const skipPrep = useCallback(() => {
    setTurnState('user_speaking')
    const p = exam?.speakingParts?.[activePart]
    if (p) {
      startRecording(p.id, p.questions[0]?.id)
    }
  }, [exam, activePart, startRecording])

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
        if (data && data.speakingParts) {
          data.speakingParts = data.speakingParts.map(p => ({
            ...p,
            questions: (p.questions || []).filter(q => !q.questionText?.startsWith('##TOPIC##:'))
          }))
        }
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
              if (entry.transcript) {
                try {
                  restoredTranscripts[entry.partId] = JSON.parse(entry.transcript);
                } catch(e) {
                  restoredTranscripts[entry.partId] = entry.transcript;
                }
              }
            } else if (entry.status === 'failed') {
              restoredErrors[entry.partId] = { error: entry.error, answerId: entry.answerId }
              if (entry.transcript) {
                try {
                  restoredTranscripts[entry.partId] = JSON.parse(entry.transcript);
                } catch(e) {
                  restoredTranscripts[entry.partId] = entry.transcript;
                }
              }
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
          { setActivePart(currentIndex + 1); setTurnState('idle'); setActiveQuestionIndex(0); }
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
    setTranscripts(prev => {
      const next = { ...prev }
      delete next[part.id]
      return next
    })
    clearPartError(part.id)
    setConfirmResubmitId(null)
  }, [clearPartError])

  const redoPart = useCallback((part) => {
    setTranscripts(prev => {
      const next = { ...prev }
      delete next[part.id]
      return next
    })
    setTurnState('idle')
    setActiveQuestionIndex(0)
  }, [])

    const submitPart = useCallback(async (part) => {
    if (isRecording) stopRecording()
    if (isTranscribing) {
      showToast('Hệ thống đang xử lý giọng nói, vui lòng chờ trong giây lát...', 'info');
      return;
    }
    const transcriptArray = transcripts[part.id] || [];
    const transcript = Array.isArray(transcriptArray) ? JSON.stringify(transcriptArray) : transcriptArray;
    const wCount = Array.isArray(transcriptArray) ? transcriptArray.reduce((acc, curr) => acc + (curr.text || '').split(/\s+/).filter(Boolean).length, 0) : transcript.trim().split(/\s+/).filter(Boolean).length;
    if (wCount < 10) {
      showToast(`Câu trả lời quá ngắn (${wCount} từ), hãy nói thêm!`, 'error');
      return;
    }
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
          { setActivePart(currentIndex + 1); setTurnState('idle'); setActiveQuestionIndex(0); }
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
                const partTitle = part.topic || part.cueCard || `Speaking Part ${part.number}`

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

                    {/* Transcript block */}
                    <div className="flex flex-col gap-4 mb-4">
                      {(() => {
                        let ansArray = transcripts[part.id];
                        if (typeof ansArray === 'string') {
                          try { ansArray = JSON.parse(ansArray); } catch(e) {}
                        }
                        if (Array.isArray(ansArray)) {
                          const maxAnswers = part.questions && part.questions.length > 0 ? part.questions.length : 1;
                          return ansArray.slice(0, maxAnswers).map((ans, idx) => {
                            const q = part.questions ? part.questions[idx] : null;
                            const partScore = r.score ? roundIeltsScore(r.score) : roundIeltsScore((parseFloat(fluencyScore) + parseFloat(vocabScore) + parseFloat(grammarScore) + parseFloat(pronScore)) / 4);
                            
                            let questionTitle = q?.questionText || 'Câu hỏi';
                            if (part.number === 2 && !q?.questionText) {
                                questionTitle = 'Phần trả lời Cue Card';
                            }

                            return (
                                <div key={idx} className="mb-8">
                                  {/* Title */}
                                  <h4 className="text-[15px] font-medium text-zinc-600 mb-3 flex items-start gap-2">
                                    <span className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-zinc-400 text-zinc-500 text-[11px] font-bold shrink-0 mt-0.5">?</span>
                                    TEST PART {part.number}: {questionTitle}
                                  </h4>

                                  <div className="bg-[#E9EDFF] rounded-2xl p-5 md:p-6 shadow-sm border border-indigo-100/50">
                                    <div className="flex flex-col md:flex-row md:items-start gap-4 mb-4">
                                      <div className="flex-1 mt-1">
                                        <CustomAudioPlayer src={ans.audioUrl?.startsWith('/') ? `${BACKEND_URL}${ans.audioUrl}` : ans.audioUrl} />
                                      </div>
                                      <div className="flex items-start gap-4">
                                        <div className={"w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shadow-md border-2 border-white/50 shrink-0 " + getScoreColorClass(partScore, true)}>
                                          {partScore === 'NaN' ? '–' : partScore}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-[15px] leading-relaxed text-zinc-700 font-medium mb-5 bg-white/40 p-4 rounded-xl border border-white/50">
                                      <HighlightedTranscript text={ans.text} />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={"px-3 py-1 rounded-full text-[11px] font-bold shadow-sm " + getScoreColorClass(fluencyScore, true)}>Trôi chảy: {fluencyScore}</span>
                                      <span className={"px-3 py-1 rounded-full text-[11px] font-bold shadow-sm " + getScoreColorClass(vocabScore, true)}>Từ vựng: {vocabScore}</span>
                                      <span className={"px-3 py-1 rounded-full text-[11px] font-bold shadow-sm " + getScoreColorClass(grammarScore, true)}>Ngữ pháp: {grammarScore}</span>
                                      <span className={"px-3 py-1 rounded-full text-[11px] font-bold shadow-sm " + getScoreColorClass(pronScore, true)}>Phát âm: {pronScore}</span>
                                    </div>
                                  </div>
                                </div>
                            )
                          })
                        }
                        return (
                          <div className="bg-zinc-50/70 rounded-xl border border-zinc-200/70 p-3.5">
                            <div className="flex items-center justify-between mb-1.5 text-xs text-zinc-500 font-medium">
                              <span>Transcript bài nói của bạn:</span>
                              <span className="text-[11px] font-mono text-zinc-400">
                                {typeof transcripts[part.id] === 'string' && transcripts[part.id]?.trim() ? `${transcripts[part.id].trim().split(/\s+/).length} từ` : '0 từ'}
                              </span>
                            </div>
                            <HighlightedTranscript text={typeof transcripts[part.id] === 'string' ? transcripts[part.id] : ''} />
                          </div>
                        )
                      })()}
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
  const partTranscripts = transcripts[part.id] || [];
  const wordCount = Array.isArray(partTranscripts)
    ? partTranscripts.reduce((acc, curr) => acc + (curr.text || '').split(/\s+/).filter(Boolean).length, 0)
    : partTranscripts.trim().split(/\s+/).filter(Boolean).length;
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
      {part.number === 2 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-50 overflow-hidden relative">
          {(() => {
            const cueText = part.cueCard ? (part.cueCard.indexOf('\n===\n') !== -1 ? part.cueCard.slice(part.cueCard.indexOf('\n===\n') + 5) : part.cueCard) : ''
            const lines = cueText.split('\n').filter(l => l.trim())
            const title = lines.length > 0 ? lines[0] : ''
            const rest = lines.slice(1).join('\n')
            
            return (
              <div className="flex flex-col w-full max-w-5xl z-10 px-4 h-full py-4">
                <div className="flex justify-between items-center mb-8 shrink-0">
                  <div className="w-40 flex justify-start">
                    {turnState !== 'idle' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-indigo-500 text-indigo-600 font-bold text-sm bg-indigo-50/50">
                        <History className="w-4 h-4" />
                        {turnState === 'user_preparing' ? formatTime(prepSecondsLeft) : formatTime(Math.max(0, getSpeakSecondsLimit(part.number) - recordingSeconds))}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-widest text-zinc-900">Part {part.number}</h2>
                  <div className="w-40 text-right">
                    {(turnState === 'idle' || turnState === 'user_preparing') && (
                      <button onClick={handleBack} className="px-5 py-2 rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-colors bg-white">
                        Thoát
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 mb-8 min-h-[300px] flex-1">
                  {/* Left: Cue Card */}
                  <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm text-left overflow-y-auto">
                    {title && <h3 className="text-pink-600 font-bold text-lg mb-4">{title}</h3>}
                    <div className="text-zinc-700 whitespace-pre-wrap leading-relaxed text-base">
                      {rest}
                    </div>
                  </div>
                  
                  {/* Right: Notes */}
                  <div className="flex-1">
                    <textarea 
                      className="w-full h-full bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-zinc-700 transition-all placeholder:text-zinc-400 text-base"
                      placeholder="Ghi chú ở đây..."
                    ></textarea>
                  </div>
                </div>

                <div className="flex justify-between items-center px-4 pt-6 border-t border-zinc-200 shrink-0 h-16">
                  <div className="flex items-center min-w-[200px]">
                    {turnState === 'idle' && <p className="text-zinc-500 font-medium text-sm">Sẵn sàng để bắt đầu...</p>}
                    {turnState === 'ai_speaking' && <p className="text-indigo-500 font-medium text-sm animate-pulse">Giám khảo đang đọc hướng dẫn...</p>}
                    {turnState === 'user_preparing' && <p className="text-indigo-500 font-medium text-sm">Đang có một phút để ghi chú...</p>}
                    {turnState === 'user_speaking' && <p className="text-red-500 font-medium text-sm animate-pulse">Đang thu âm câu trả lời...</p>}
                    {turnState === 'completed' && <p className="text-emerald-600 font-medium text-sm">Đã hoàn thành Part 2!</p>}
                  </div>
                  
                  <div className="flex flex-1 items-center justify-center">
                    {turnState === 'ai_speaking' && (
                      <div className="flex items-center gap-1.5 h-6">
                        {[1,2,3].map(n => <span key={n} className="w-1.5 bg-indigo-500 animate-pulse rounded-full h-full" style={{animationDelay: `${n*100}ms`}}/>)}
                      </div>
                    )}
                    {turnState === 'user_preparing' && <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>}
                    {turnState === 'user_speaking' && (
                      <div className="flex items-end gap-1.5 h-6 justify-center w-32">
                        {audioLevels.slice(0, 10).map((level, i) => (
                          <div
                            key={i}
                            className="w-1.5 rounded-full bg-red-500 transition-all duration-75"
                            style={{ height: `${Math.max(4, Math.round(level * 24))}px` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="min-w-[200px] text-right">
                    {turnState === 'idle' && (
                      <button onClick={startInterview} disabled={partDone || gradingPart === part.id} className="px-6 py-2.5 rounded-full font-bold text-sm border-2 border-indigo-500 text-white bg-indigo-500 hover:bg-indigo-600 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                        {(partDone || gradingPart === part.id) ? 'Đã hoàn thành' : 'Bắt đầu Part 2'}
                      </button>
                    )}
                    {turnState === 'ai_speaking' && (
                       <button disabled className="px-6 py-2.5 rounded-full font-bold text-sm border-2 border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed">
                         Đang nghe...
                       </button>
                    )}
                    {turnState === 'user_preparing' && (
                      <button onClick={skipPrep} className="px-6 py-2.5 rounded-full font-bold text-sm border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer bg-white">
                        Đã chuẩn bị xong
                      </button>
                    )}
                    {turnState === 'user_speaking' && (
                      <button onClick={handleNextQuestion} className="px-6 py-2.5 rounded-full font-bold text-sm border-2 border-red-500 text-red-600 hover:bg-red-50 transition-all cursor-pointer bg-white inline-flex items-center gap-2">
                        <Square className="w-4 h-4" /> Nộp Part 2
                      </button>
                    )}
                    {turnState === 'completed' && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => redoPart(part)} disabled={submitting} className="px-6 py-2.5 rounded-full font-bold text-sm border-2 border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 transition-all cursor-pointer inline-flex items-center gap-2">
                          Làm lại
                        </button>
                        <button onClick={() => submitPart(part)} disabled={submitting} className="px-6 py-2.5 rounded-full font-bold text-sm border-2 border-red-500 text-white bg-red-500 hover:bg-red-600 transition-all cursor-pointer inline-flex items-center gap-2">
                          {submitting ? 'Đang nộp...' : 'Nộp Part 2'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white overflow-hidden relative">
           <div className="flex justify-between items-center w-full max-w-5xl absolute top-6 px-4 z-20">
              <div className="w-32"></div>
              <h2 className="text-xl font-black uppercase tracking-widest text-zinc-900">Part {part.number}</h2>
              <div className="w-32 text-right">
                <button onClick={handleBack} className="px-4 py-2 rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 bg-white cursor-pointer">Thoát</button>
              </div>
           </div>

           {/* Center content */}
           <div className="flex flex-col items-center justify-center flex-1 w-full max-w-3xl pb-24">
              <p className="text-sm text-zinc-500 italic mb-12">
                *Trả lời câu hỏi, sau đó nhấn Ghi nhận câu trả lời để sang câu tiếp theo.
              </p>

              {turnState === 'idle' && (
                 <button onClick={startInterview} disabled={partDone || gradingPart === part.id} className="px-8 py-3 rounded-full font-bold text-base bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                   {(partDone || gradingPart === part.id) ? 'Đã hoàn thành' : `Bắt đầu Part ${part.number}`}
                 </button>
              )}

              {turnState === 'ai_speaking' && (
                 <div className="flex flex-col items-center gap-12 w-full">
                    <h3 className="text-2xl font-bold text-[#c026d3] flex items-center justify-center gap-4 text-center leading-relaxed max-w-4xl px-8">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full border-[2.5px] border-[#c026d3] text-[#c026d3] shrink-0 font-bold bg-white text-sm">?</span>
                      <span className="max-w-2xl">{part.questions[activeQuestionIndex]?.questionText}</span>
                    </h3>
                    <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-50 text-blue-500 animate-pulse shadow-inner border border-blue-100">
                       <Volume2 className="w-8 h-8" />
                    </div>
                 </div>
              )}

              {turnState === 'user_speaking' && (
                 <div className="flex flex-col items-center gap-8 w-full">
                    {showQuestion && (
                      <h3 className="text-2xl font-bold text-[#c026d3] flex items-center justify-center gap-4 text-center leading-relaxed max-w-4xl px-8 mb-2">
                        <span className="w-8 h-8 flex items-center justify-center rounded-full border-[2.5px] border-[#c026d3] text-[#c026d3] shrink-0 font-bold bg-white text-sm">?</span>
                        <span className="max-w-2xl">{part.questions[activeQuestionIndex]?.questionText}</span>
                      </h3>
                    )}
                    <button onClick={() => setShowQuestion(!showQuestion)} className="px-5 py-2 rounded-full bg-zinc-50 text-zinc-500 font-medium text-sm hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200">
                      {showQuestion ? 'Ẩn câu hỏi' : 'Hiện câu hỏi'}
                    </button>
                 </div>
              )}

              {turnState === 'completed' && (
                 <div className="flex flex-col items-center justify-center gap-6 w-full">
                    <p className="text-sm font-medium text-zinc-500 text-center max-w-sm leading-relaxed">Bạn đã trả lời xong tất cả câu hỏi. Hãy ấn nút <strong className="text-zinc-700 font-bold">Nộp Part {part.number}</strong> bên dưới để hệ thống chấm điểm nhé!</p>
                    <div className="flex items-center gap-4">
                      <button onClick={() => redoPart(part)} disabled={submitting} className="px-6 py-3 rounded-full font-bold text-sm bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition-colors cursor-pointer flex items-center gap-2">
                        Làm lại
                      </button>
                      <button onClick={() => submitPart(part)} disabled={submitting} className="px-8 py-3 rounded-full font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg cursor-pointer flex items-center gap-2">
                        {submitting ? 'Đang nộp...' : `Nộp Part ${part.number}`}
                      </button>
                    </div>
                 </div>
              )}
           </div>

           {/* Bottom bar for user_speaking */}
           {turnState === 'user_speaking' && (
              <div className="w-full absolute bottom-0 left-0 h-24 border-t border-zinc-100 bg-white px-8 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-30">
                 <div className="flex items-center gap-3 w-40">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-cyan-500 font-bold text-sm">Đang ghi âm...</span>
                 </div>
                 
                 <div className="flex items-center gap-8 flex-1 justify-center">
                    <div className="flex items-end gap-1.5 h-10 w-24 justify-center">
                       {audioLevels.slice(0, 7).map((l, i) => <div key={i} className="w-2 bg-cyan-400 rounded-full transition-all" style={{height: `${Math.max(6, l*40)}px`}}/>)}
                    </div>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm relative bg-white">
                       <svg className="absolute inset-0 w-full h-full -rotate-90 z-0" viewBox="0 0 100 100">
                         
                         <circle cx="50" cy="50" r="48" fill="none" stroke="#4f46e5" strokeWidth="4" strokeDasharray="301.59" strokeDashoffset={`${301.59 * (1 - (recordingSeconds / getSpeakSecondsLimit(part.number)))}`} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
                       </svg>
                       <span className="text-xs font-bold text-indigo-900 tabular-nums z-10">{formatTime(recordingSeconds)}</span>
                    </div>
                 </div>
                 
                 <div className="w-60 text-right">
                   <button onClick={handleNextQuestion} className="px-8 py-3.5 rounded-full font-bold text-sm bg-indigo-700 text-white hover:bg-indigo-800 transition-colors shadow-lg cursor-pointer active:scale-95 whitespace-nowrap">
                      Ghi nhận câu trả lời
                   </button>
                 </div>
              </div>
           )}
        </div>
      )}

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
