import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getPractice } from '../services/practiceService'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import TableCompletionRender from '../components/TableCompletionRender'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
const resolveUrl = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

// Normalize practice group data: add optionLetter/optionText aliases (practice saves as letter/text)
// and ensure q.id exists (practice JSON questions don't have DB ids — use q.number as fallback)
function normalizeGroup(g) {
  return {
    ...g,
    matchingOptions: (g.matchingOptions || []).map(mo => ({
      ...mo,
      optionLetter: mo.optionLetter ?? mo.letter ?? '',
      optionText: mo.optionText ?? mo.text ?? '',
    })),
    questions: (g.questions || []).map(q => ({
      ...q,
      id: q.id ?? q.number,
    })),
  }
}

const PRACTICE_TIME = 20 * 60

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ─── Reading Practice group block (full rendering for all question types) ──────
function ReadingPracticeGroupBlock({ group, answers, onAnswer }) {
  const from = group.qNumberStart
  const to = group.qNumberEnd

  // Note completion: inline fill blanks
  if (group.type === 'note_completion') {
    const questionMap = {}
    ;(group.questions || []).forEach(q => { questionMap[q.number] = q })
    const parseContent = (content) => {
      const parts = (content || '').split(/(\[Q:\d+\])/)
      return parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = questionMap[qNum]
          const val = q ? (answers[q.id] || '') : ''
          return (
            <span key={i} className="inline-flex items-center mx-1">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1 rounded mr-0.5">{qNum}</span>
              <input type="text" value={val}
                onChange={e => q && onAnswer(q.id, e.target.value)}
                placeholder="..."
                className="border-b-2 border-[#e2e8f0] focus:border-[#3b82f6] outline-none px-1 py-0.5 text-sm w-24 bg-white transition text-center" />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })
    }
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
        </div>
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          {(group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3 last:mb-0">
              {ns.title && <div className="font-bold text-gray-700 mb-1.5 border-b border-gray-200 pb-1">{ns.title}</div>}
              <ul className="space-y-2">
                {(ns.lines || []).map((line, li) => (
                  line.lineType === 'heading'
                    ? <li key={li} className="list-none font-bold text-[#1e293b] text-[0.95rem] pt-1 pb-0.5">{line.contentWithTokens || line.content || ''}</li>
                    : <li key={li} className="flex items-start gap-1.5 text-gray-700 leading-relaxed">
                        <span className="text-gray-400 mt-1 shrink-0">•</span>
                        <span>{parseContent(line.contentWithTokens || line.content || '')}</span>
                      </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Table completion
  if (group.type === 'table_completion') {
    return <TableCompletionRender group={group} answers={answers} onAnswer={onAnswer} />
  }

  // Matching Information (tick-grid)
  if (group.type === 'matching_information') {
    const letters = (group.matchingOptions || []).map(mo => mo.optionLetter).filter(Boolean)
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-600 text-xs mb-1">{group.instruction}</p>}
          <p className="text-gray-500 text-xs italic">You may use any letter more than once.</p>
        </div>
        <MatchingTickGrid letters={letters} questions={group.questions || []} answers={answers} onAnswer={onAnswer} />
      </div>
    )
  }

  // Summary + Word Bank (drag-drop)
  if (group.type === 'drag_word_bank') {
    return (
      <div id={`q-${from}`} className="scroll-mt-4">
        <DragWordBankGroup group={group} answers={answers} onAnswer={onAnswer} />
      </div>
    )
  }

  // Matching drag-drop
  if (group.type === 'matching_drag') {
    return (
      <div id={`q-${from}`} className="scroll-mt-4">
        <MatchingDragGroup group={group} answers={answers} onAnswer={onAnswer} />
      </div>
    )
  }

  // Diagram Label Completion
  if (group.type === 'diagram_label') {
    return <DiagramLabelGroup group={group} answers={answers} onAnswer={onAnswer} />
  }

  // Matching Headings
  if (group.type === 'matching_headings') {
    return <MatchingHeadingsGroup group={group} answers={answers} onAnswer={onAnswer} />
  }

  // MCQ Multi
  if (group.type === 'mcq_multi') {
    const maxChoices = group.maxChoices || 2
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-700 text-xs">{group.instruction}</p>}
        </div>
        {(group.questions || []).map((q, qi) => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          const combined = answers[q.id] || ''
          const selected = combined.split(',').filter(Boolean)
          const limitReached = selected.length >= maxChoices
          return (
            <div key={q.id} className="mb-4">
              {q.questionText && (
                <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
                  <span className="font-bold text-gray-700 shrink-0">{from + qi * maxChoices}–{from + qi * maxChoices + maxChoices - 1}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const checked = selected.includes(opt)
                  const disabled = !checked && limitReached
                  return (
                    <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                      ${checked ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                      : disabled ? 'border border-transparent text-gray-300 cursor-not-allowed'
                      : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} className="accent-blue-600"
                        onChange={() => {
                          const next = checked ? selected.filter(s => s !== opt) : [...selected, opt]
                          onAnswer(q.id, next.join(','))
                        }} />
                      {String.fromCharCode(65 + oi)}. {opt}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // MCQ single
  if (group.type === 'mcq') {
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-700 text-xs">{group.instruction}</p>}
        </div>
        {(group.questions || []).map(q => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          return (
            <div key={q.id} id={`q-${q.number}`} className="mb-5 scroll-mt-4">
              <p className="text-sm text-gray-800 mb-2 flex gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
                <span>{q.questionText}</span>
              </p>
              <div className="space-y-1.5 pl-8">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const isSelected = answers[q.id] === opt
                  return (
                    <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition cursor-pointer
                      ${isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700' : 'hover:bg-gray-50 border border-transparent'}`}>
                      <input type="radio" name={`q${q.id}`} checked={isSelected} onChange={() => onAnswer(q.id, opt)} className="accent-blue-600 shrink-0" />
                      <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // True/False/NG and Yes/No/NG
  if (group.type === 'true_false_ng' || group.type === 'yes_no_ng') {
    const tfOpts = group.type === 'true_false_ng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
        </div>
        {(group.questions || []).map(q => (
          <div key={q.id} id={`q-${q.number}`} className="mb-6 scroll-mt-4">
            <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
              <span>{q.questionText}</span>
            </p>
            <div className="flex gap-2 pl-8 flex-wrap">
              {tfOpts.map(opt => (
                <button key={opt} onClick={() => onAnswer(q.id, opt)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition
                    ${answers[q.id] === opt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default: text input
  return (
    <div id={`q-${from}`} className="mb-6 scroll-mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
        {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
      </div>
      {(group.questions || []).map(q => (
        <div key={q.id} id={`q-${q.number}`} className="mb-6 scroll-mt-4">
          <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
            <span>{q.questionText}</span>
          </p>
          <div className="pl-8">
            <input type="text" value={answers[q.id] || ''} onChange={e => onAnswer(q.id, e.target.value)}
              placeholder="Nhập đáp án..."
              className="border-b-2 border-gray-300 focus:border-blue-500 outline-none px-2 py-1 text-sm w-64 bg-transparent transition" />
          </div>
        </div>
      ))}
    </div>
  )
}

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

  const groups = exam.questions?.groups || []
  const navItems = groups.flatMap(g => {
    const items = []
    for (let n = g.qNumberStart; n <= g.qNumberEnd; n++) {
      const qId = (g.questions || []).find(q => q.number === n)?.id ?? null
      items.push({ number: n, qId })
    }
    return items
  })
  const totalSlots = navItems.length
  const answered = navItems.filter(item => item.qId && answers[item.qId]).length

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
    if (!showExitConfirm) return
    const h = (e) => { if (e.key === 'Escape') setShowExitConfirm(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [showExitConfirm])

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

  const doSubmit = () => {
    let correct = 0
    const detail = []
    groups.forEach(g => {
      g.questions.forEach(q => {
        const userAns = (answers[q.id] || '').trim().toLowerCase()
        const correctAns = (q.correctAnswer || '').trim().toLowerCase()
        const isCorrect = userAns === correctAns
        if (isCorrect) correct++
        detail.push({ qId: q.id, number: q.number, questionText: q.questionText, userAnswer: answers[q.id] || '', correctAnswer: q.correctAnswer, isCorrect })
      })
    })
    setResult({ correct, total: totalSlots, detail })
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">📖</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h1>
        <p className="text-gray-500 text-sm mb-1">1 Passage · {totalSlots} câu hỏi</p>
        <p className="text-gray-500 text-sm mb-8">Thời gian: <span className="font-semibold text-blue-600">20 phút</span></p>
        <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-8 space-y-1">
          <p>• Đọc passage bên trái, trả lời câu hỏi bên phải</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition">
          Bắt đầu làm bài
        </button>
        <button onClick={onBack} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition">← Quay lại</button>
      </div>
    </div>
  )

  // ── Result screen ───────────────────────────────────────────────────────────
  if (phase === 'result' && result) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] text-white px-6 py-4">
        <h1 className="font-bold text-lg">Kết quả Reading Practice</h1>
        <p className="text-blue-200 text-sm">{exam.title}</p>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-5xl font-bold text-blue-600 mb-2">{result.correct}/{result.total}</div>
          <div className="text-gray-500 mb-3">câu đúng ({result.total > 0 ? Math.round(result.correct / result.total * 100) : 0}%)</div>
          <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${result.total > 0 ? (result.correct / result.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="space-y-3">
          {result.detail.map(r => (
            <div key={r.qId} className={`bg-white rounded-xl p-4 border-l-4 ${r.isCorrect ? 'border-green-400' : 'border-red-400'}`}>
              <p className="text-sm font-medium text-gray-700 mb-1">Câu {r.number}{r.questionText ? ': ' + r.questionText : ''}</p>
              <p className={`text-sm ${r.isCorrect ? 'text-green-600' : 'text-red-500'}`}>Bạn trả lời: {r.userAnswer || '(bỏ trống)'}</p>
              {!r.isCorrect && <p className="text-sm text-green-600">Đáp án: {r.correctAnswer}</p>}
            </div>
          ))}
        </div>
        <button onClick={onBack} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
          ← Quay lại
        </button>
      </div>
    </div>
  )

  // ── Exam screen ─────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-blue-200 text-xs">{answered}/{totalSlots} câu</span>
          <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 300 ? 'bg-red-500' : timeLeft < 600 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
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
          style={{ backgroundColor: isDragging ? '#93c5fd' : undefined }}
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
        <div className="overflow-y-auto bg-gray-50 px-6 py-5 max-md:w-full"
          style={{ width: isMobile ? '100%' : `${100 - splitRatio}%` }}>
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
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center border
                  ${qId && answers[qId]
                    ? 'bg-[#002D5B] border-[#002D5B] text-white shadow-sm'
                    : 'bg-white border-gray-300 text-[#002D5B] hover:border-[#0066FF] hover:text-[#0066FF]'}`}>
                {number}
              </button>
            ))}
          </div>
          <button onClick={() => setShowConfirm(true)}
            className="bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition shrink-0">
            Nộp bài
          </button>
        </div>
      </div>

      {/* Exit confirm */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExitConfirm(false)}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Thoát bài làm?</h2>
            <p className="text-gray-600 text-sm mb-6">Tiến trình bài làm sẽ không được lưu nếu bạn thoát lúc này.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-[#1a56db] hover:bg-[#1d4ed8] text-white text-sm font-bold transition">Tiếp tục làm</button>
              <button onClick={onBack} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">Thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Nộp bài?</h2>
            <p className="text-gray-600 text-sm mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold text-gray-700 mb-6">Đã làm: <span className="text-[#1a56db]">{answered}/{totalSlots}</span> câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition">Tiếp tục làm</button>
              <button onClick={() => { setShowConfirm(false); doSubmit() }} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">Nộp bài</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Listening Practice ───────────────────────────────────────────────────────
const LISTENING_FILL_TYPES = ['note_completion', 'table_completion']
const LISTENING_TIME = 10 * 60

function buildListeningTokenMap(group) {
  const map = {}
  let idx = 0
  ;(group.noteSections || []).forEach(ns => {
    ;(ns.lines || []).forEach(line => {
      const content = line.content || ''
      const tokens = [...content.matchAll(/\[Q:(\d+)\]/g)]
      tokens.forEach(m => {
        const num = parseInt(m[1])
        if (!(num in map)) { map[num] = group.qNumberStart + idx; idx++ }
      })
    })
  })
  return map
}

function ListeningTokenLine({ content, answers, onAnswer, group, tokenNumMap, isDragWordBank }) {
  const parts = (content || '').split(/(\[Q:\d+\])/)
  return (
    <span className="text-sm leading-9 text-gray-800">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const displayNum = tokenNumMap[qNum] ?? qNum
          const val = answers[qNum] || ''
          if (isDragWordBank) {
            return (
              <span key={i} className="inline-flex items-center gap-1 mx-1">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{displayNum}</span>
                <select value={val} onChange={e => onAnswer(qNum, e.target.value)}
                  className="border-b-2 border-blue-400 bg-transparent outline-none text-sm px-1 text-blue-700 max-w-36">
                  <option value="">—</option>
                  {(group.matchingOptions || []).map((mo, mi) => (
                    <option key={mi} value={mo.letter}>{mo.letter}. {mo.text}</option>
                  ))}
                </select>
              </span>
            )
          }
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{displayNum}</span>
              <input type="text" value={val} onChange={e => onAnswer(qNum, e.target.value)}
                className="border-b-2 border-blue-400 outline-none px-1 text-sm w-24 bg-transparent transition" />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function ListeningPracticeGroupBlock({ group, answers, onAnswer }) {
  const tokenNumMap = ['note_completion', 'table_completion', 'drag_word_bank'].includes(group.type)
    ? buildListeningTokenMap(group) : {}
  const opts = group.matchingOptions || []

  return (
    <div id={`q-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
        <p className="font-bold text-gray-800 mb-0.5">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
      </div>

      {/* note_completion */}
      {group.type === 'note_completion' && (group.noteSections || []).map((ns, nsi) => (
        <div key={nsi} className="mb-4">
          {ns.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{ns.title}</p>}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
            {(ns.lines || []).map((line, li) => (
              line.lineType === 'heading'
                ? <p key={li} className="font-bold text-gray-800 pt-1">{line.content}</p>
                : <p key={li}><ListeningTokenLine content={line.content} answers={answers} onAnswer={onAnswer} group={group} tokenNumMap={tokenNumMap} isDragWordBank={false} /></p>
            ))}
          </div>
        </div>
      ))}

      {/* table_completion */}
      {group.type === 'table_completion' && (() => {
        const section = (group.noteSections || [])[0]
        if (!section) return null
        const tLines = section.lines || []
        const headerLine = tLines.find(l => l.lineType === 'heading')
        const dataLines = tLines.filter(l => l.lineType !== 'heading')
        const headers = headerLine ? (headerLine.content || '').split('|') : []
        return (
          <div>
            {section.title && <p className="text-xs font-bold text-gray-500 uppercase mb-2">{section.title}</p>}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-sm">
                {headers.length > 0 && headers.some(h => h.trim()) && (
                  <thead><tr className="bg-gray-100">
                    {headers.map((h, i) => <th key={i} className="text-left px-3 py-2 text-xs font-bold text-gray-700 border-b border-r last:border-r-0 border-gray-200">{h}</th>)}
                  </tr></thead>
                )}
                <tbody>
                  {dataLines.map((dl, ri) => {
                    const cells = (dl.content || '').split('|')
                    return (
                      <tr key={ri} className={ri % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                        {cells.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2.5 border-b border-r last:border-r-0 border-gray-200">
                            <ListeningTokenLine content={cell} answers={answers} onAnswer={onAnswer} group={group} tokenNumMap={tokenNumMap} isDragWordBank={false} />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* mcq */}
      {group.type === 'mcq' && (group.questions || []).map(q => (
        <div key={q.number} id={`q-${q.number}`} className="mb-5 scroll-mt-4">
          <p className="text-sm text-gray-800 mb-2 flex gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
            <span>{q.questionText}</span>
          </p>
          <div className="space-y-1.5 pl-8">
            {(Array.isArray(q.options) ? q.options : []).filter(o => o && o.trim()).map((opt, oi) => {
              const isSelected = answers[q.number] === opt
              return (
                <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition cursor-pointer
                  ${isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <input type="radio" name={`q${q.number}`} checked={isSelected} onChange={() => onAnswer(q.number, opt)} className="accent-blue-600 shrink-0" />
                  <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}

      {/* mcq_multi */}
      {group.type === 'mcq_multi' && (group.questions || []).map(q => {
        const maxChoices = group.maxChoices || 2
        const selected = (answers[q.number] || '').split(',').filter(Boolean)
        const toggleOpt = (opt) => {
          const next = selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt]
          onAnswer(q.number, next.join(','))
        }
        return (
          <div key={q.number} id={`q-${q.number}`} className="mb-5 scroll-mt-4">
            <p className="text-sm text-gray-800 mb-2 flex gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
              <span>{q.questionText}</span>
            </p>
            <p className="text-xs text-gray-400 pl-8 mb-2">Chọn {maxChoices} đáp án</p>
            <div className="space-y-1.5 pl-8">
              {(Array.isArray(q.options) ? q.options : []).filter(o => o && o.trim()).map((opt, oi) => {
                const isSelected = selected.includes(opt)
                return (
                  <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition cursor-pointer
                    ${isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOpt(opt)} className="accent-blue-600 shrink-0" />
                    <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* matching */}
      {group.type === 'matching' && (
        <div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opts.map((mo, mi) => (
              <span key={mi} className="text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="font-bold text-blue-700">{mo.letter}.</span> {mo.text}
              </span>
            ))}
          </div>
          {(group.questions || []).map(q => (
            <div key={q.number} id={`q-${q.number}`} className="flex items-center gap-3 mb-3 scroll-mt-4">
              <span className="text-xs font-bold text-gray-500 w-7 shrink-0">{q.number}.</span>
              <span className="flex-1 text-sm text-gray-700">{q.questionText}</span>
              <select value={answers[q.number] || ''} onChange={e => onAnswer(q.number, e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white min-w-32">
                <option value="">— Chọn —</option>
                {opts.map(mo => <option key={mo.letter} value={mo.letter}>{mo.letter}. {mo.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* map_diagram */}
      {group.type === 'map_diagram' && (
        <div>
          {group.imageUrl && (
            <img src={group.imageUrl.startsWith('/') ? `${BACKEND_URL}${group.imageUrl}` : group.imageUrl}
              alt="diagram" className="w-full max-w-sm rounded-xl border mb-4 object-contain bg-gray-50" />
          )}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opts.map((mo, mi) => (
              <span key={mi} className="text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="font-bold text-blue-700">{mo.letter}.</span> {mo.text}
              </span>
            ))}
          </div>
          {(group.questions || []).map(q => (
            <div key={q.number} id={`q-${q.number}`} className="flex items-center gap-3 mb-3 scroll-mt-4">
              <span className="text-xs font-bold text-gray-500 w-7 shrink-0">{q.number}.</span>
              <span className="flex-1 text-sm text-gray-700">{q.questionText}</span>
              <select value={answers[q.number] || ''} onChange={e => onAnswer(q.number, e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white min-w-32">
                <option value="">— Chọn —</option>
                {opts.map(mo => <option key={mo.letter} value={mo.letter}>{mo.letter}. {mo.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* drag_word_bank */}
      {group.type === 'drag_word_bank' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="w-full text-xs font-bold text-gray-500 uppercase mb-1">Word Bank</p>
            {opts.map((mo, mi) => (
              <span key={mi} className="text-xs px-3 py-1.5 bg-white border border-blue-200 rounded-lg font-medium text-gray-700">
                <span className="text-blue-600 font-bold">{mo.letter}.</span> {mo.text}
              </span>
            ))}
          </div>
          {(group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3">
              {ns.title && <p className="text-xs font-bold text-gray-500 uppercase mb-2">{ns.title}</p>}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
                {(ns.lines || []).map((line, li) => (
                  <p key={li}><ListeningTokenLine content={line.content} answers={answers} onAnswer={onAnswer} group={group} tokenNumMap={tokenNumMap} isDragWordBank={true} /></p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* matching_drag */}
      {group.type === 'matching_drag' && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
            {(group.questions || []).map(q => (
              <div key={q.number} id={`q-${q.number}`} className="bg-white rounded-xl border border-gray-200 p-3 scroll-mt-4">
                <p className="text-sm text-gray-800 mb-2 flex gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
                  <span>{q.questionText}</span>
                </p>
                <select value={answers[q.number] || ''} onChange={e => onAnswer(q.number, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="">— Chọn đáp án —</option>
                  {opts.map(mo => <option key={mo.letter} value={mo.letter}>{mo.letter}. {mo.text}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="w-44 shrink-0">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Options</p>
            <div className="space-y-1.5">
              {opts.map((mo, oi) => (
                <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs">
                  <span className="font-bold text-blue-600 shrink-0">{mo.letter}</span>
                  <span className="text-gray-700">{mo.text}</span>
                </div>
              ))}
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
    if (!showExitConfirm) return
    const h = (e) => { if (e.key === 'Escape') setShowExitConfirm(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [showExitConfirm])

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

  const doSubmit = () => {
    let correct = 0
    const detail = []
    groups.forEach(g => {
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
        if (isCorrect) correct++
        detail.push({ number: q.number, questionText: q.questionText || '', userAnswer: answers[q.number] || '', correctAnswer: q.correctAnswer, isCorrect })
      })
    })
    setResult({ correct, total: totalSlots, detail })
    setPhase('result')
  }

  // Start screen
  if (phase === 'start') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">🎧</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h1>
        <p className="text-gray-500 text-sm mb-1">{totalSlots} câu hỏi</p>
        <p className="text-gray-500 text-sm mb-8">Thời gian: <span className="font-semibold text-green-600">10 phút</span></p>
        <div className="bg-green-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-8 space-y-1">
          <p>• Nghe audio và trả lời các câu hỏi</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition">
          Bắt đầu làm bài
        </button>
        <button onClick={onBack} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition">← Quay lại</button>
      </div>
    </div>
  )

  // Result screen
  if (phase === 'result' && result) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] text-white px-6 py-4">
        <h1 className="font-bold text-lg">Kết quả Listening Practice</h1>
        <p className="text-blue-200 text-sm">{exam.title}</p>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-5xl font-bold text-green-600 mb-2">{result.correct}/{result.total}</div>
          <div className="text-gray-500 mb-3">câu đúng ({result.total > 0 ? Math.round(result.correct / result.total * 100) : 0}%)</div>
          <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${result.total > 0 ? (result.correct / result.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="space-y-3">
          {result.detail.map(r => (
            <div key={r.number} className={`bg-white rounded-xl p-4 border-l-4 ${r.isCorrect ? 'border-green-400' : 'border-red-400'}`}>
              <p className="text-sm font-medium text-gray-700 mb-1">Câu {r.number}{r.questionText ? ': ' + r.questionText : ''}</p>
              <p className={`text-sm ${r.isCorrect ? 'text-green-600' : 'text-red-500'}`}>Bạn trả lời: {r.userAnswer || '(bỏ trống)'}</p>
              {!r.isCorrect && <p className="text-sm text-green-600">Đáp án: {r.correctAnswer}</p>}
            </div>
          ))}
        </div>
        <button onClick={onBack} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition">
          ← Quay lại
        </button>
      </div>
    </div>
  )

  // Exam screen
  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-blue-200 text-xs">{answered}/{totalSlots} câu</span>
          <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 120 ? 'bg-red-500' : timeLeft < 300 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
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
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5">
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
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center border
                  ${answers[number]
                    ? 'bg-[#002D5B] border-[#002D5B] text-white shadow-sm'
                    : 'bg-white border-gray-300 text-[#002D5B] hover:border-[#0066FF] hover:text-[#0066FF]'}`}>
                {number}
              </button>
            ))}
          </div>
          <button onClick={() => setShowConfirm(true)}
            className="bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition shrink-0">
            Nộp bài
          </button>
        </div>
      </div>

      {/* Exit confirm */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExitConfirm(false)}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Thoát bài làm?</h2>
            <p className="text-gray-600 text-sm mb-6">Tiến trình bài làm sẽ không được lưu nếu bạn thoát.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-[#1a56db] hover:bg-[#1d4ed8] text-white text-sm font-bold transition">Tiếp tục làm</button>
              <button onClick={onBack} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">Thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Nộp bài?</h2>
            <p className="text-gray-600 text-sm mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold text-gray-700 mb-6">Đã làm: <span className="text-[#1a56db]">{answered}/{totalSlots}</span> câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition">Tiếp tục làm</button>
              <button onClick={() => { setShowConfirm(false); doSubmit() }} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">Nộp bài</button>
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
      .catch(() => navigate(-1))
      .finally(() => setLoading(false))
  }, [id, skill])

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">Đang tải...</div>
    </div>
  )
  if (!exam) return null

  // Reading: full exam UI
  if (skill === 'reading') {
    return <ReadingPracticeExam exam={exam} onBack={() => navigate(-1)} />
  }

  // Listening: full exam UI
  return <ListeningPracticeExam exam={exam} onBack={() => navigate(-1)} />
}
