import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import Navbar from '../components/Navbar'
import { getPractice } from '../services/practiceService'
import { BookOpen, Headphones, ArrowLeft } from 'lucide-react'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import TableCompletionRender from '../components/TableCompletionRender'
import SkillResult from '../components/SkillResult'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'

import { normalizeGroup, fmt, buildListeningTokenMap } from '../utils/practiceUtils'
import ReadingPracticeGroupBlock from '../components/practice/ReadingPracticeGroupBlock'
import ListeningPracticeGroupBlock from '../components/practice/ListeningPracticeGroupBlock'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
const resolveUrl = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const PRACTICE_TIME = 20 * 60
const LISTENING_TIME = 10 * 60
const LISTENING_FILL_TYPES = ['note_completion', 'table_completion', 'drag_word_bank', 'diagram_label']

// ─── Full ReadingExam-style UI for Reading Practice ───────────────────────────
function ReadingPracticeExam({ exam, onBack }) {
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('start')
  const [timeLeft, setTimeLeft] = useState(PRACTICE_TIME)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [result, setResult] = useState(null)
  const bodyRef = useRef(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('reading-split-ratio')
    const n = parseFloat(saved)
    return (!isNaN(n) && n >= 25 && n <= 75) ? n : 50
  })

  // Guard thoát: Practice không dùng draftService → điều kiện là "có bất kỳ answer nào"
  const exitGuard = useExitGuard(phase === 'exam' && Object.keys(answers).length > 0)

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
    await exitGuard.disarm()
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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center flex flex-col items-center" style={{ background: 'var(--color-surface)', borderRadius: '24px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', padding: 40 }}>
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mx-auto mb-5">
          <BookOpen className="w-8 h-8 text-slate-600 stroke-[1.75]" />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-heading)' }}>{exam.title}</h1>
        <p className="text-sm mb-1" style={{ color: 'var(--color-body)' }}>1 Passage · {totalSlots} câu hỏi</p>
        <p className="text-sm mb-8" style={{ color: 'var(--color-body)' }}>Thời gian: <span className="font-semibold" style={{ color: 'var(--skill-r-color)' }}>20 phút</span></p>
        <div className="rounded-xl p-4 text-left text-sm mb-8 space-y-1 w-full" style={{ background: 'var(--skill-r-bg)', border: '1px solid var(--skill-r-border)', color: 'var(--color-heading)' }}>
          <p>• Đọc passage bên trái, trả lời câu hỏi bên phải</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: 15, marginBottom: 8 }}>
          Bắt đầu làm bài
        </button>
        <button
          onClick={onBack}
          className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 ease-in-out font-medium text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ width: '100%', padding: '12px 0', borderRadius: '12px' }}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" /> Quay lại
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header className="text-white px-6 py-3 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--ink)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-blue-200 text-xs">{answered}/{totalSlots} câu</span>
          <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 300 ? 'bg-blue-500' : timeLeft < 600 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Body */}
      <div ref={bodyRef} className={`flex-1 flex flex-col md:flex-row overflow-hidden${isDragging ? ' select-none' : ''}`}>
        {/* Left: Passage */}
        <div className="overflow-y-auto bg-white px-8 py-6 border-b md:border-b-0 md:border-r border-gray-200"
          style={{ width: isMobile ? '100%' : `${splitRatio}%` }}>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1 leading-snug">{exam.title}</h2>
          <div className="w-16 h-0.5 bg-blue-500 mx-auto mb-6" />
          <div className="text-gray-800 text-[0.92rem] leading-8 font-serif">
            {(exam.passage || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean).map((para, i) => (
              <p key={i} className="mb-5 indent-6">{para.charAt(0).toUpperCase() + para.slice(1)}</p>
            ))}
          </div>
        </div>

        {/* Drag divider */}
        <div
          className="group relative flex-shrink-0 hidden md:flex flex-col items-center justify-center w-2 hover:w-3 transition-all duration-100 cursor-col-resize select-none"
          style={{ backgroundColor: isDragging ? 'var(--primary-light)' : undefined }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={`w-full h-full absolute inset-0 transition-colors ${isDragging ? 'bg-blue-300' : 'bg-gray-200 group-hover:bg-blue-200'}`} />
          <div className="relative z-10 flex flex-col gap-1 pointer-events-none">
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-500'}`} />
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-500'}`} />
          </div>
          <button onMouseDown={e => e.stopPropagation()} onClick={resetSplit} title="Reset 50/50"
            className="absolute top-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-300 rounded text-gray-500 hover:text-blue-600 hover:border-blue-400 text-[10px] px-1 py-0.5 shadow-sm leading-none">
            ⇔
          </button>
        </div>

        {/* Right: Questions */}
        <div className="overflow-y-auto px-6 py-5 max-md:w-full"
          style={{ width: isMobile ? '100%' : `${100 - splitRatio}%`, backgroundColor: 'var(--surface-raised)' }}>
          {groups.map((group, gi) => (
            <ReadingPracticeGroupBlock key={group.id || gi} group={normalizeGroup(group)} answers={answers} onAnswer={onAnswer} />
          ))}
        </div>
      </div>

      {/* Bottom navigator bar — single row */}
      <div className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="px-6 py-3 flex items-center gap-4">
          <span className="text-[13px] text-gray-400 shrink-0 min-w-[90px]">Đã làm {answered}/{totalSlots} câu</span>
          <div className="flex flex-wrap gap-2 flex-1 justify-center">
            {navItems.map(({ number, qId }) => (
              <button key={number} onClick={() => jumpToQuestion(number)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center border ${
                  qId && answers[qId]
                    ? 'bg-[#002D5B] border-[#002D5B] text-white shadow-sm'
                    : 'bg-white border-gray-300 text-[#002D5B] hover:border-[#0066FF] hover:text-[#0066FF]'
                }`}>
                {number}
              </button>
            ))}
          </div>
          <button onClick={() => setShowConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shrink-0">
            Nộp bài
          </button>
        </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-heading)' }}>Nộp bài?</h2>
            <p className="text-sm mb-2" style={{ color: 'var(--color-body)' }}>Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold mb-6" style={{ color: 'var(--color-heading)' }}>Đã làm: <span style={{ color: 'var(--color-primary)' }}>{answered}/{totalSlots}</span> câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl btn-secondary text-sm font-semibold transition">Tiếp tục làm</button>
              <button onClick={() => { setShowConfirm(false); doSubmit() }} className="flex-1 py-2.5 rounded-xl btn-danger text-sm font-bold transition">Nộp bài</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ListeningPracticeExam({ exam, onBack }) {
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('start')
  const [timeLeft, setTimeLeft] = useState(LISTENING_TIME)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [result, setResult] = useState(null)

  // Guard thoát: Practice không dùng draftService → điều kiện là "có bất kỳ answer nào"
  const exitGuard = useExitGuard(phase === 'exam' && Object.keys(answers).length > 0)

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
    await exitGuard.disarm()
    setResult(formattedData)
    setPhase('result')
  }

  // Start screen
  if (phase === 'start') return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="rounded-2xl shadow-lg p-10 max-w-md w-full text-center flex flex-col items-center" style={{ background: 'var(--color-surface)', borderRadius: '24px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', padding: 40 }}>
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mx-auto mb-5">
          <Headphones className="w-8 h-8 text-slate-600 stroke-[1.75]" />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-heading)' }}>{exam.title}</h1>
        <p className="text-sm mb-1" style={{ color: 'var(--color-body)' }}>{totalSlots} câu hỏi</p>
        <p className="text-sm mb-8" style={{ color: 'var(--color-body)' }}>Thời gian: <span className="font-semibold" style={{ color: 'var(--skill-l-color)' }}>10 phút</span></p>
        <div className="rounded-xl p-4 text-left text-sm mb-8 space-y-1 w-full" style={{ background: 'var(--skill-l-bg)', border: '1px solid var(--skill-l-border)', color: 'var(--color-heading)' }}>
          <p>• Nghe audio và trả lời các câu hỏi</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: 15, marginBottom: 8 }}>
          Bắt đầu làm bài
        </button>
        <button
          onClick={onBack}
          className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 ease-in-out font-medium text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ width: '100%', padding: '12px 0', borderRadius: '12px' }}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" /> Quay lại
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header className="text-white px-6 py-3 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--ink)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-blue-200 text-xs">{answered}/{totalSlots} câu</span>
          <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 120 ? 'bg-blue-500' : timeLeft < 300 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Sticky audio player */}
      {exam.audioUrl && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
          <audio controls src={resolveUrl(exam.audioUrl)} className="w-full h-10" />
        </div>
      )}

      {/* Scrollable questions */}
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ backgroundColor: 'var(--surface-raised)' }}>
        {exam.passage && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Context / Situation</p>
            <p className="text-sm text-gray-700 leading-7 whitespace-pre-wrap">{exam.passage}</p>
          </div>
        )}
        <div className="max-w-2xl mx-auto">
          {groups.map((g, gi) => (
            <ListeningPracticeGroupBlock key={g._id || g.id || gi} group={g} answers={answers} onAnswer={onAnswer} />
          ))}
        </div>
      </div>

      {/* Bottom navigator */}
      <div className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="px-6 py-3 flex items-center gap-4">
          <span className="text-[13px] text-gray-400 shrink-0 min-w-[90px]">Đã làm {answered}/{totalSlots} câu</span>
          <div className="flex flex-wrap gap-2 flex-1 justify-center">
            {navItems.map(({ number }) => (
              <button key={number} onClick={() => jumpToQuestion(number)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center border ${
                  answers[number]
                    ? 'bg-[#002D5B] border-[#002D5B] text-white shadow-sm'
                    : 'bg-white border-gray-300 text-[#002D5B] hover:border-[#0066FF] hover:text-[#0066FF]'
                }`}>
                {number}
              </button>
            ))}
          </div>
          <button onClick={() => setShowConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shrink-0">
            Nộp bài
          </button>
        </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-heading)' }}>Nộp bài?</h2>
            <p className="text-sm mb-2" style={{ color: 'var(--color-body)' }}>Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold mb-6" style={{ color: 'var(--color-heading)' }}>Đã làm: <span style={{ color: 'var(--color-primary)' }}>{answered}/{totalSlots}</span> câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl btn-secondary text-sm font-semibold transition">Tiếp tục làm</button>
              <button onClick={() => { setShowConfirm(false); doSubmit() }} className="flex-1 py-2.5 rounded-xl btn-danger text-sm font-bold transition">Nộp bài</button>
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}><Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">Đang tải...</div>
    </div>
  )
  if (!exam) return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}><Navbar />
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
