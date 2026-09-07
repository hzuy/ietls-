import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import Navbar from '../components/Navbar'
import { getPractice } from '../services/practiceService'
import { BookOpen, Headphones, ArrowLeft, X, Clock } from 'lucide-react'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import TableCompletionRender from '../components/TableCompletionRender'
import SkillResult from '../components/SkillResult'
import QuestionNavButton from '../components/common/QuestionNavButton'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'
import { usePracticeDraft } from '../hooks/usePracticeDraft'
import { formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'

import { normalizeGroup, fmt, buildListeningTokenMap } from '../utils/practiceUtils'
import ReadingPracticeGroupBlock from '../components/practice/ReadingPracticeGroupBlock'
import ListeningPracticeGroupBlock from '../components/practice/ListeningPracticeGroupBlock'
import { resolveImg } from '../utils/media'

const PRACTICE_TIME = 20 * 60
const LISTENING_TIME = 10 * 60
const LISTENING_FILL_TYPES = ['note_completion', 'table_completion', 'drag_word_bank', 'diagram_label']

// ─── Full ReadingExam-style UI for Reading Practice ───────────────────────────
function ReadingPracticeExam({ exam, onBack }) {
  const { user } = useAuth()
  const userId = user ? (user.id || user._id) : null
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('start')
  const [timeLeft, setTimeLeft] = useState(PRACTICE_TIME)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [result, setResult] = useState(null)
  const [draftMeta, setDraftMeta] = useState(null) // { hasDraft, savedAt, timeRemaining, data } — nạp 1 lần lúc mount
  const bodyRef = useRef(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('reading-split-ratio')
    const n = parseFloat(saved)
    return (!isNaN(n) && n >= 25 && n <= 75) ? n : 50
  })

  // Autosave 30s + resume — namespace 'practice-reading' để KHÔNG đè draft của bài
  // thi Reading chính có cùng examId (PracticeExam.id trùng dải số với Exam.id).
  const {
    checkDraftOnMount, persistDraftNow, clearDraft, markSaved,
    lastSavedAt, hasUnsavedChanges,
  } = usePracticeDraft({
    examId: exam.id,
    skillType: 'practice-reading',
    answers,
    timeLeft,
    userId,
    enabled: phase === 'exam',
  })

  // Mount: có draft chưa nộp thì cho start-screen biết để hiện nút "Tiếp tục".
  // KHÔNG tự prefill answers ở đây — người dùng chủ động chọn.
  useEffect(() => {
    if (!userId) return
    const d = checkDraftOnMount()
    if (d.hasDraft) setDraftMeta(d)
  }, [userId, checkDraftOnMount])

  // Guard thoát: chỉ cảnh báo khi có thay đổi CHƯA ghi vào draft (persistDraftNow
  // được gọi ngay tại mọi điểm thoát qua onBeforeExit → flush trước khi rời).
  const exitGuard = useExitGuard(phase === 'exam' && hasUnsavedChanges, persistDraftNow)

  const resumeDraft = () => {
    if (!draftMeta?.hasDraft) return
    setAnswers(draftMeta.data)
    setTimeLeft(Math.max(1, draftMeta.timeRemaining ?? PRACTICE_TIME))
    markSaved(draftMeta.data, draftMeta.savedAt) // snapshot khớp → guard không nổ nhầm
    setPhase('exam')
  }

  const startFresh = () => {
    // Bỏ qua nháp nhưng KHÔNG xoá — chỉ xoá draft khi thực sự nộp bài.
    setDraftMeta(null)
    setPhase('exam')
  }

  const groups = exam.questions?.groups || []
  const navItems = groups.flatMap(g => {
    const items = []
    for (let n = g.qNumberStart; n <= g.qNumberEnd; n++) {
      const q = (g.questions || []).find(q => q.number === n)
      const qKey = q ? (q.id ?? q.number) : null
      items.push({ number: n, qId: qKey })
    }
    return items
  })
  const totalSlots = navItems.length
  const answered = navItems.filter(item => item.qId != null && answers[item.qId]).length

  useEffect(() => {
    if (phase !== 'exam' || result) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result])

  useEffect(() => {
    if (!showConfirm) return
    const h = (e) => { if (e.key === 'Escape') setShowConfirm(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [showConfirm])

  useEffect(() => {
    if (!showExitConfirm && !exitGuard.prompt) return
    const h = (e) => {
      if (e.key === 'Escape') { setShowExitConfirm(false); exitGuard.stay() }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [showExitConfirm, exitGuard.prompt, exitGuard.stay])

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h)
  }, [])

  const handleDividerMouseDown = (e) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    const onMove = (ev) => {
      if (!isDraggingRef.current || !bodyRef.current) return
      const rect = bodyRef.current.getBoundingClientRect()
      setSplitRatio(Math.min(75, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const resetSplit = (e) => {
    e.stopPropagation()
    setSplitRatio(50)
    localStorage.removeItem('reading-split-ratio')
  }

  const onAnswer = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }))

  const doSubmit = async () => {
    let correct = 0
    let wrong = 0
    let missed = 0
    const questions = []
    const typeStats = {}
    
    const formatType = (type) => {
      if (!type) return 'Unknown'
      return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }

    groups.forEach(g => {
      const typeName = formatType(g.type)
      if (!typeStats[typeName]) {
        typeStats[typeName] = { name: typeName, total: 0, correct: 0, wrong: 0, missed: 0 }
      }
      
      g.questions.forEach(q => {
        const qKey = q.id ?? q.number
        const userAns = (answers[qKey] || '').trim().toLowerCase()
        const correctAns = (q.correctAnswer || '').trim().toLowerCase()
        const isCorrect = userAns === correctAns
        
        let status = 'missed'
        if ((answers[qKey] || '').trim()) {
          status = isCorrect ? 'correct' : 'wrong'
        }
        
        if (isCorrect) {
          correct++
          typeStats[typeName].correct++
        } else if ((answers[qKey] || '').trim()) {
          wrong++
          typeStats[typeName].wrong++
        } else {
          missed++
          typeStats[typeName].missed++
        }
        typeStats[typeName].total++
        
        questions.push({
          number: q.number,
          grouped: false,
          status,
          userAnswer: answers[qKey] || '',
          correctAnswer: q.correctAnswer
        })
      })
    })

    const formattedData = {
      title: exam.title,
      timeSpent: 0,
      bandScore: 0,
      questionTypes: Object.values(typeStats),
      sections: [
        {
          number: 1,
          from: 1,
          to: totalSlots,
          questions
        }
      ]
    }
    // Thứ tự BẮT BUỘC: disarm() (chạy persistDraftNow qua onBeforeExit) TRƯỚC,
    // clearDraft() SAU — nếu ngược lại, persist sẽ ghi draft sống lại cho bài đã nộp.
    await exitGuard.disarm()
    clearDraft()
    setResult(formattedData)
    setPhase('result')
  }

  const jumpToQuestion = (qNumber) => {
    let el = document.getElementById(`q-${qNumber}`)
    if (!el) {
      for (const g of groups) {
        if (qNumber >= g.qNumberStart && qNumber <= g.qNumberEnd) {
          el = document.getElementById(`q-${g.qNumberStart}`)
          break
        }
      }
    }
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Start screen ────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50/50">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-10 max-w-md w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-5">
          <BookOpen className="w-8 h-8 text-zinc-700 stroke-[1.75]" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">{exam.title}</h1>
        <p className="text-sm text-zinc-500 mb-1">1 Passage · {totalSlots} câu hỏi</p>
        <p className="text-sm text-zinc-500 mb-8">Thời gian: <span className="font-semibold text-zinc-900">20 phút</span></p>
        <div className="rounded-xl p-4 text-left text-sm mb-8 space-y-1 w-full bg-zinc-50 border border-zinc-200 text-zinc-700">
          <p>• Đọc passage bên trái, trả lời câu hỏi bên phải</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        {draftMeta?.hasDraft ? (
          <>
            <button onClick={resumeDraft} className="w-full py-3 rounded-xl font-medium text-sm bg-zinc-900 hover:bg-black text-white transition shadow-xs cursor-pointer mb-2">
              Tiếp tục{draftMeta.savedAt ? ` (đã lưu ${formatSavedAt(draftMeta.savedAt)})` : ''} →
            </button>
            <button onClick={startFresh} className="w-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition font-medium text-xs py-2 rounded-xl mb-1 cursor-pointer">
              Làm lại từ đầu
            </button>
          </>
        ) : (
          <button onClick={() => setPhase('exam')} className="w-full py-3 rounded-xl font-medium text-sm bg-zinc-900 hover:bg-black text-white transition shadow-xs cursor-pointer mb-2">
            Bắt đầu làm bài
          </button>
        )}
        <button
          onClick={onBack}
          className="w-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" /> Quay lại
        </button>
      </div>
    </div>
  )

  // ── Result screen ───────────────────────────────────────────────────────────
  if (phase === 'result' && result) return (
    <SkillResult
      skillType="reading"
      dataProp={result}
      isPractice={true}
      onClose={onBack}
    />
  )

  // ── Exam screen ─────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Header */}
      <header className="h-14 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Đóng bài thi"
            onClick={() => setShowExitConfirm(true)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium transition cursor-pointer shrink-0"
            title="Thoát bài thi"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thoát</span>
          </button>
          <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastSavedAt && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">✓ Đã lưu {formatSavedAt(lastSavedAt)}</span>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">{answered}/{totalSlots} câu</span>
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
        </div>
      </header>

      {/* Body */}
      <div ref={bodyRef} className={`flex-1 flex flex-col md:flex-row overflow-hidden${isDragging ? ' select-none' : ''}`}>
        {/* Left: Passage */}
        <div className="overflow-y-auto bg-white px-8 py-6 border-b md:border-b-0 md:border-r border-zinc-200"
          style={{ width: isMobile ? '100%' : `${splitRatio}%` }}>
          <h2 className="text-lg font-semibold text-zinc-900 text-center mb-1 leading-snug">{exam.title}</h2>
          <div className="w-16 h-0.5 bg-zinc-900 mx-auto mb-6" />
          <div className="text-zinc-800 text-sm leading-relaxed font-normal" style={{ fontFamily: 'var(--font-reading)' }}>
            {(exam.passage || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean).map((para, i) => (
              <p key={i} className="mb-5 indent-6">{para.charAt(0).toUpperCase() + para.slice(1)}</p>
            ))}
          </div>
        </div>

        {/* Drag divider */}
        <div
          className="group relative flex-shrink-0 hidden md:flex flex-col items-center justify-center w-2 hover:w-3 transition-all duration-100 cursor-col-resize select-none"
          style={{ backgroundColor: isDragging ? '#d4d4d8' : undefined }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={`w-full h-full absolute inset-0 transition-colors ${isDragging ? 'bg-zinc-400' : 'bg-zinc-200 group-hover:bg-zinc-300'}`} />
          <div className="relative z-10 flex flex-col gap-1 pointer-events-none">
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-zinc-900' : 'bg-zinc-400 group-hover:bg-zinc-600'}`} />
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-zinc-900' : 'bg-zinc-400 group-hover:bg-zinc-600'}`} />
          </div>
          <button onMouseDown={e => e.stopPropagation()} onClick={resetSplit} title="Reset 50/50"
            className="absolute top-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-zinc-300 rounded text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 text-[10px] px-1 py-0.5 shadow-xs leading-none">
            ⇔
          </button>
        </div>

        {/* Right: Questions */}
        <div className="overflow-y-auto px-6 py-5 max-md:w-full bg-zinc-50/50"
          style={{ width: isMobile ? '100%' : `${100 - splitRatio}%` }}>
          {groups.map((group, gi) => (
            <ReadingPracticeGroupBlock key={group.id || gi} group={normalizeGroup(group)} answers={answers} onAnswer={onAnswer} />
          ))}
        </div>
      </div>

      {/* Bottom navigator bar — single row */}
      <div className="h-14 px-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-4 shrink-0 z-20">
        <span className="text-xs text-zinc-500 shrink-0 min-w-[90px] font-mono tabular-nums">Đã làm {answered}/{totalSlots} câu</span>
        <div className="flex flex-wrap gap-2 flex-1 justify-center">
          {navItems.map(({ number, qId }) => (
            <QuestionNavButton
              key={number}
              number={number}
              status={qId && answers[qId] ? 'answered' : 'unanswered'}
              onClick={() => jumpToQuestion(number)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 px-4 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          Nộp bài
        </button>
      </div>

      {/* Exit confirm */}
      <ConfirmExitModal
        isOpen={showExitConfirm || exitGuard.prompt}
        onClose={() => { setShowExitConfirm(false); exitGuard.stay() }}
        onConfirm={async () => {
          setShowExitConfirm(false)
          if (exitGuard.prompt) { exitGuard.leave() }
          else { await exitGuard.disarm(); onBack() }
        }}
      />

      {/* Submit confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="p-6 shadow-xl max-w-sm w-full bg-white rounded-2xl border border-zinc-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Nộp bài?</h2>
            <p className="text-sm text-zinc-600 mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-medium text-zinc-900 mb-6">Đã làm: <span className="font-semibold text-zinc-900">{answered}/{totalSlots}</span> câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-100 rounded-lg font-medium text-sm transition cursor-pointer">Tiếp tục làm</button>
              <button onClick={() => { setShowConfirm(false); doSubmit() }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition shadow-xs cursor-pointer">Nộp bài</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ListeningPracticeExam({ exam, onBack }) {
  const { user } = useAuth()
  const userId = user ? (user.id || user._id) : null
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('start')
  const [timeLeft, setTimeLeft] = useState(LISTENING_TIME)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [result, setResult] = useState(null)
  const [draftMeta, setDraftMeta] = useState(null) // { hasDraft, savedAt, timeRemaining, data } — nạp 1 lần lúc mount

  // Autosave 30s + resume — namespace 'practice-listening' để KHÔNG đè draft của
  // bài thi Listening chính có cùng examId (PracticeExam.id trùng dải số với Exam.id;
  // đã xác nhận id=19 tồn tại ở cả hai bảng, cùng skill listening).
  const {
    checkDraftOnMount, persistDraftNow, clearDraft, markSaved,
    lastSavedAt, hasUnsavedChanges,
  } = usePracticeDraft({
    examId: exam.id,
    skillType: 'practice-listening',
    answers,
    timeLeft,
    userId,
    enabled: phase === 'exam',
  })

  // Mount: có draft chưa nộp thì cho start-screen biết để hiện nút "Tiếp tục".
  // KHÔNG tự prefill answers ở đây — người dùng chủ động chọn.
  useEffect(() => {
    if (!userId) return
    const d = checkDraftOnMount()
    if (d.hasDraft) setDraftMeta(d)
  }, [userId, checkDraftOnMount])

  // Guard thoát: chỉ cảnh báo khi có thay đổi CHƯA ghi vào draft (persistDraftNow
  // được gọi ngay tại mọi điểm thoát qua onBeforeExit → flush trước khi rời).
  const exitGuard = useExitGuard(phase === 'exam' && hasUnsavedChanges, persistDraftNow)

  const resumeDraft = () => {
    if (!draftMeta?.hasDraft) return
    setAnswers(draftMeta.data)
    setTimeLeft(Math.max(1, draftMeta.timeRemaining ?? LISTENING_TIME))
    markSaved(draftMeta.data, draftMeta.savedAt) // snapshot khớp → guard không nổ nhầm
    setPhase('exam')
  }

  const startFresh = () => {
    // Bỏ qua nháp nhưng KHÔNG xoá — chỉ xoá draft khi thực sự nộp bài.
    setDraftMeta(null)
    setPhase('exam')
  }

  const groups = exam.questions?.groups || []

  // Build navItems: one entry per question number
  const navItems = groups.flatMap(g => {
    const items = []
    for (let n = g.qNumberStart; n <= g.qNumberEnd; n++) items.push({ number: n })
    return items
  })
  const totalSlots = navItems.length
  const answered = navItems.filter(({ number }) => answers[number]).length

  useEffect(() => {
    if (phase !== 'exam' || result) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result])

  useEffect(() => {
    if (!showConfirm) return
    const h = (e) => { if (e.key === 'Escape') setShowConfirm(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [showConfirm])

  useEffect(() => {
    if (!showExitConfirm && !exitGuard.prompt) return
    const h = (e) => {
      if (e.key === 'Escape') { setShowExitConfirm(false); exitGuard.stay() }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [showExitConfirm, exitGuard.prompt, exitGuard.stay])

  const onAnswer = (qNum, val) => setAnswers(a => ({ ...a, [qNum]: val }))

  const jumpToQuestion = (n) => {
    let el = document.getElementById(`q-${n}`)
    if (!el) {
      for (const g of groups) {
        if (n >= g.qNumberStart && n <= g.qNumberEnd) {
          el = document.getElementById(`q-${g.qNumberStart}`)
          break
        }
      }
    }
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const doSubmit = async () => {
    let correct = 0
    let wrong = 0
    let missed = 0
    const questions = []
    const typeStats = {}
    
    const formatType = (type) => {
      if (!type) return 'Unknown'
      return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }

    groups.forEach(g => {
      const typeName = formatType(g.type)
      if (!typeStats[typeName]) {
        typeStats[typeName] = { name: typeName, total: 0, correct: 0, wrong: 0, missed: 0 }
      }
      
      ;(g.questions || []).forEach(q => {
        const userRaw = (answers[q.number] || '').trim()
        const correctRaw = (q.correctAnswer || '').trim()
        let isCorrect = false
        if (LISTENING_FILL_TYPES.includes(g.type)) {
          const alts = correctRaw.split('/').map(a => a.trim().toLowerCase()).filter(Boolean)
          isCorrect = alts.length > 0 && alts.includes(userRaw.toLowerCase())
        } else if (g.type === 'mcq_multi') {
          const userList = userRaw.split(',').map(s => s.trim()).filter(Boolean).sort()
          const correctList = correctRaw.split(',').map(s => s.trim()).filter(Boolean).sort()
          isCorrect = userList.join(',') === correctList.join(',')
        } else {
          isCorrect = userRaw.toLowerCase() === correctRaw.toLowerCase()
        }
        
        let status = 'missed'
        if (userRaw) {
          status = isCorrect ? 'correct' : 'wrong'
        }
        
        if (isCorrect) {
          correct++
          typeStats[typeName].correct++
        } else if (userRaw) {
          wrong++
          typeStats[typeName].wrong++
        } else {
          missed++
          typeStats[typeName].missed++
        }
        typeStats[typeName].total++
        
        questions.push({
          number: q.number,
          grouped: false,
          status,
          userAnswer: userRaw,
          correctAnswer: correctRaw
        })
      })
    })

    const formattedData = {
      title: exam.title,
      timeSpent: 0,
      bandScore: 0,
      questionTypes: Object.values(typeStats),
      sections: [
        {
          number: 1,
          from: 1,
          to: totalSlots,
          questions
        }
      ]
    }
    // Thứ tự BẮT BUỘC: disarm() (chạy persistDraftNow qua onBeforeExit) TRƯỚC,
    // clearDraft() SAU — nếu ngược lại, persist sẽ ghi draft sống lại cho bài đã nộp.
    await exitGuard.disarm()
    clearDraft()
    setResult(formattedData)
    setPhase('result')
  }

  // Start screen
  if (phase === 'start') return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50/50">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-10 max-w-md w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-5">
          <Headphones className="w-8 h-8 text-zinc-700 stroke-[1.75]" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">{exam.title}</h1>
        <p className="text-sm text-zinc-500 mb-1">{totalSlots} câu hỏi</p>
        <p className="text-sm text-zinc-500 mb-8">Thời gian: <span className="font-semibold text-zinc-900">10 phút</span></p>
        <div className="rounded-xl p-4 text-left text-sm mb-8 space-y-1 w-full bg-zinc-50 border border-zinc-200 text-zinc-700">
          <p>• Nghe audio và trả lời các câu hỏi</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        {draftMeta?.hasDraft ? (
          <>
            <button onClick={resumeDraft} className="w-full py-3 rounded-xl font-medium text-sm bg-zinc-900 hover:bg-black text-white transition shadow-xs cursor-pointer mb-2">
              Tiếp tục{draftMeta.savedAt ? ` (đã lưu ${formatSavedAt(draftMeta.savedAt)})` : ''} →
            </button>
            <button onClick={startFresh} className="w-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition font-medium text-xs py-2 rounded-xl mb-1 cursor-pointer">
              Làm lại từ đầu
            </button>
          </>
        ) : (
          <button onClick={() => setPhase('exam')} className="w-full py-3 rounded-xl font-medium text-sm bg-zinc-900 hover:bg-black text-white transition shadow-xs cursor-pointer mb-2">
            Bắt đầu làm bài
          </button>
        )}
        <button
          onClick={onBack}
          className="w-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" /> Quay lại
        </button>
      </div>
    </div>
  )

  // Result screen
  if (phase === 'result' && result) return (
    <SkillResult
      skillType="listening"
      dataProp={result}
      isPractice={true}
      onClose={onBack}
    />
  )

  // Exam screen
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Header */}
      <header className="h-14 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Đóng bài thi"
            onClick={() => setShowExitConfirm(true)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium transition cursor-pointer shrink-0"
            title="Thoát bài thi"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thoát</span>
          </button>
          <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastSavedAt && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">✓ Đã lưu {formatSavedAt(lastSavedAt)}</span>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">{answered}/{totalSlots} câu</span>
          <div
            className={`tabular-nums text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              timeLeft < 120
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60'
                : timeLeft < 300
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
                : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Sticky audio player */}
      {exam.audioUrl && (
        <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-3 shrink-0">
          <audio controls src={resolveImg(exam.audioUrl)} className="w-full h-10 accent-zinc-900" />
        </div>
      )}

      {/* Scrollable questions */}
      <div className="flex-1 overflow-y-auto px-6 py-5 bg-zinc-50/50">
        {exam.passage && (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5 mb-5 max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Context / Situation</p>
            <p className="text-sm text-zinc-800 leading-relaxed font-normal whitespace-pre-wrap">{exam.passage}</p>
          </div>
        )}
        <div className="max-w-2xl mx-auto">
          {groups.map((g, gi) => (
            <ListeningPracticeGroupBlock key={g._id || g.id || gi} group={g} answers={answers} onAnswer={onAnswer} />
          ))}
        </div>
      </div>

      {/* Bottom navigator */}
      <div className="h-14 px-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-4 shrink-0 z-20">
        <span className="text-xs text-zinc-500 shrink-0 min-w-[90px] font-mono tabular-nums">Đã làm {answered}/{totalSlots} câu</span>
        <div className="flex flex-wrap gap-2 flex-1 justify-center">
          {navItems.map(({ number }) => (
            <QuestionNavButton
              key={number}
              number={number}
              status={answers[number] ? 'answered' : 'unanswered'}
              onClick={() => jumpToQuestion(number)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 px-4 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          Nộp bài
        </button>
      </div>

      {/* Exit confirm */}
      <ConfirmExitModal
        isOpen={showExitConfirm || exitGuard.prompt}
        onClose={() => { setShowExitConfirm(false); exitGuard.stay() }}
        onConfirm={async () => {
          setShowExitConfirm(false)
          if (exitGuard.prompt) { exitGuard.leave() }
          else { await exitGuard.disarm(); onBack() }
        }}
      />

      {/* Submit confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="p-6 shadow-xl max-w-sm w-full bg-white rounded-2xl border border-zinc-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Nộp bài?</h2>
            <p className="text-sm text-zinc-600 mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-medium text-zinc-900 mb-6">Đã làm: <span className="font-semibold text-zinc-900">{answered}/{totalSlots}</span> câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-100 rounded-lg font-medium text-sm transition cursor-pointer">Tiếp tục làm</button>
              <button onClick={() => { setShowConfirm(false); doSubmit() }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition shadow-xs cursor-pointer">Nộp bài</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PracticeExamPage({ skill }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPractice(skill, id)
      .then(data => setExam(data))
      .catch(() => navigate(`/practice/${skill}`, { replace: true }))
      .finally(() => setLoading(false))
  }, [id, skill])

  if (loading) return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}><Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">Đang tải...</div>
    </div>
  )
  if (!exam) return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}><Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">Không tìm thấy bài luyện tập.</div>
    </div>
  )

  // Reading: full exam UI
  if (skill === 'reading') {
    return <ReadingPracticeExam exam={exam} onBack={() => navigate(`/practice/${skill}`)} />
  }

  // Listening: full exam UI
  return <ListeningPracticeExam exam={exam} onBack={() => navigate(`/practice/${skill}`)} />
}
