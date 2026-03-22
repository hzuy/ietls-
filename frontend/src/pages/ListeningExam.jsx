import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../utils/axios'
import { getSectionSlots } from '../utils/questionCount'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'

const TOTAL_TIME = 40 * 60
const SERVER_BASE = 'http://localhost:3001'
const toImgSrc = (url) => (url || '').startsWith('/') ? `${SERVER_BASE}${url}` : (url || '')

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Group instruction banner ─────────────────────────────────────────────────
function InstructionBanner({ group }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
      <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-gray-700">{group.instruction}</p>}
    </div>
  )
}

// ── Parse note tokens into inline inputs ─────────────────────────────────────
function NoteTokenLine({ content, groupQuestions, answers, onAnswer, previewMode, showAnswers }) {
  const parts = content.split(/(\[Q:\d+\])/)
  return (
    <p className="text-sm leading-9 text-gray-700">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = groupQuestions.find(q => q.number === qNum)
          if (!q) return <span key={i} className="inline-block w-24 border-b-2 border-gray-400 mx-1" />
          const val = previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')
          const cls = previewMode && showAnswers
            ? 'inline-block w-28 border-b-2 border-green-500 outline-none px-1 text-sm bg-transparent text-center font-semibold text-green-700'
            : 'inline-block w-28 border-b-2 border-blue-400 focus:border-blue-600 outline-none px-1 text-sm bg-transparent text-center'
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{qNum}</span>
              <input
                type="text"
                value={val}
                readOnly={previewMode}
                onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
                className={cls}
                placeholder={previewMode ? '' : '...'}
              />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// ── Note Completion Group ─────────────────────────────────────────────────────
function NoteCompletionGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const hasSections = (group.noteSections || []).length > 0
  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {hasSections ? (
        (group.noteSections || []).map(ns => (
          <div key={ns.id} className="mb-4">
            {ns.title && (
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-1">{ns.title}</p>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-0.5">
              {(ns.lines || []).map(line => (
                line.lineType === 'heading'
                  ? <p key={line.id} className="font-bold text-gray-800 text-[0.95rem] pt-2 pb-0.5">{line.contentWithTokens}</p>
                  : <NoteTokenLine key={line.id} content={line.contentWithTokens}
                      groupQuestions={group.questions} answers={answers} onAnswer={onAnswer}
                      previewMode={previewMode} showAnswers={showAnswers} />
              ))}
            </div>
          </div>
        ))
      ) : (
        (group.questions || []).map(q => (
          <div key={q.id} id={`question-${q.number}`} className="mb-3 flex gap-2 items-center scroll-mt-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{q.number}</span>
            <span className="text-sm text-gray-700 flex-1">{q.questionText}</span>
            <input type="text"
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              readOnly={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              placeholder={previewMode ? '' : '...'}
              className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-blue-400 focus:border-blue-600'} outline-none px-2 py-0.5 text-sm w-36 bg-transparent`} />
          </div>
        ))
      )}
    </div>
  )
}

// ── MCQ Group (single or multi) ───────────────────────────────────────────────
function MCQGroup({ group, answers, onAnswer, isMulti, previewMode, showAnswers }) {
  const maxChoices = group.maxChoices || 2
  const questions = group.questions || []

  if (isMulti) {
    return (
      <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
        <InstructionBanner group={group} />
        {questions.map((q, qi) => {
          const qStart = group.qNumberStart + qi * maxChoices
          const qEnd = qStart + maxChoices - 1
          const opts = q.options ? JSON.parse(q.options) : []
          const combined = answers[q.id] || ''
          const selected = combined.split(',').filter(Boolean)
          const correctSelected = previewMode && showAnswers
            ? (q.correctAnswer || '').split(',').filter(Boolean)
            : selected
          const limitReached = selected.length >= maxChoices

          const handleChange = (opt) => {
            if (previewMode) return
            const checked = selected.includes(opt)
            const next = checked ? selected.filter(s => s !== opt) : [...selected, opt]
            onAnswer(q.id, next.join(','))
          }

          return (
            <div key={q.id} id={`question-${qStart}`} className="mb-4 scroll-mt-4">
              {q.questionText && (
                <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
                  <span className="font-bold text-gray-700 shrink-0">{qStart}–{qEnd}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.map(opt => {
                  const checked = previewMode && showAnswers ? correctSelected.includes(opt) : selected.includes(opt)
                  const disabled = previewMode || (!checked && limitReached)
                  return (
                    <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                      ${checked && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                        : checked ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                        : disabled ? 'border border-transparent text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-50 border border-transparent text-gray-700 cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} className="accent-blue-600"
                        onChange={() => handleChange(opt)} />
                      {opt}
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

  // Single MCQ — render each question separately
  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {questions.map(q => {
        const opts = q.options ? JSON.parse(q.options) : []
        const displayAnswer = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
        return (
          <div key={q.id} id={`question-${q.number}`} className="mb-5 scroll-mt-4">
            <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
              <span>{q.questionText}</span>
            </p>
            <div className="space-y-1 pl-8">
              {opts.map(opt => {
                const isSelected = displayAnswer === opt
                return (
                  <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                    ${isSelected && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                      : isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                      : previewMode ? 'border border-transparent text-gray-500 cursor-default'
                      : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
                    <input type="radio" name={`q${q.id}`} checked={isSelected}
                      disabled={previewMode}
                      onChange={previewMode ? undefined : () => onAnswer(q.id, opt)}
                      className="accent-blue-600" />
                    {opt}
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

// ── Map / Diagram Labelling Group ─────────────────────────────────────────────
function MapDiagramGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const letters = (group.matchingOptions || []).map(mo => mo.optionLetter)
  const questions = group.questions || []

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {group.imageUrl && (
        <div className="flex justify-center mb-5">
          <img src={toImgSrc(group.imageUrl)} alt="Map/Diagram"
            className="max-w-full rounded-xl border border-gray-200 shadow-sm"
            onError={e => { e.target.style.display = 'none' }} />
        </div>
      )}
      <MatchingTickGrid
        letters={letters}
        questions={questions}
        answers={answers}
        onAnswer={onAnswer}
        previewMode={previewMode}
        showAnswers={showAnswers}
        accentColor="blue"
      />
    </div>
  )
}

// ── Matching Group (dropdown list, non-map) ───────────────────────────────────
function MatchingGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const opts = (group.matchingOptions || []).map(mo => mo.optionLetter)
  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {(group.matchingOptions || []).length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          {(group.matchingOptions || []).map(mo => (
            <p key={mo.id} className="text-sm text-gray-700 py-0.5">
              <span className="font-bold text-[#1a56db] mr-2">{mo.optionLetter}.</span>{mo.optionText}
            </p>
          ))}
        </div>
      )}
      {(group.questions || []).map(q => (
        <div key={q.id} id={`question-${q.number}`} className="mb-4 scroll-mt-4">
          <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
            <span>{q.questionText}</span>
          </p>
          <div className="pl-8">
            <select
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              disabled={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              className={`border ${previewMode && showAnswers ? 'border-green-400 text-green-700 font-semibold' : 'border-gray-300'} rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white min-w-32`}>
              <option value="">— Chọn —</option>
              {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Short Answer Group ────────────────────────────────────────────────────────
function ShortAnswerGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {(group.questions || []).map(q => (
        <div key={q.id} id={`question-${q.number}`} className="mb-4 scroll-mt-4">
          <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
            <span>{q.questionText}</span>
          </p>
          <div className="pl-8">
            <input type="text"
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              readOnly={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              placeholder={previewMode ? '' : 'Nhập đáp án...'}
              className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-56 bg-transparent transition`} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
function GroupBlock({ group, answers, onAnswer, previewMode, showAnswers }) {
  if (group.type === 'note_completion') return <NoteCompletionGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'mcq')             return <MCQGroup group={group} answers={answers} onAnswer={onAnswer} isMulti={false} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'mcq_multi')       return <MCQGroup group={group} answers={answers} onAnswer={onAnswer} isMulti={true} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'map_diagram')     return <MapDiagramGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'matching')        return <MatchingGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'short_answer')    return <ShortAnswerGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'drag_word_bank')  return <div id={`question-${group.qNumberStart}`} className="scroll-mt-4"><DragWordBankGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} /></div>
  if (group.type === 'matching_drag')   return <div id={`question-${group.qNumberStart}`} className="scroll-mt-4"><MatchingDragGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} /></div>
  return null
}

// ── Legacy direct-question support ───────────────────────────────────────────
function QuestionBlock({ q, globalIdx, answers, onAnswer, previewMode, showAnswers }) {
  const opts = q.options ? JSON.parse(q.options) : []
  const selected = (answers[q.id] || '').split(',').filter(Boolean)
  return (
    <div id={`question-${q.number}`} className="mb-5 scroll-mt-4">
      <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0 mt-0.5">{globalIdx + 1}</span>
        <span>{q.questionText}</span>
      </p>
      {q.type === 'mcq' && (
        <div className="space-y-1 pl-8">
          {opts.map(opt => {
            const isSelected = previewMode && showAnswers ? q.correctAnswer === opt : answers[q.id] === opt
            return (
              <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${isSelected && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                  : isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                  : previewMode ? 'border border-transparent text-gray-500 cursor-default'
                  : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
                <input type="radio" name={`q${q.id}`} checked={isSelected}
                  disabled={previewMode}
                  onChange={previewMode ? undefined : () => onAnswer(q.id, opt)}
                  className="accent-blue-600" />
                {opt}
              </label>
            )
          })}
        </div>
      )}
      {q.type === 'mcq_multi' && (
        <div className="space-y-1 pl-8">
          {opts.map(opt => {
            const correctAnswers = previewMode && showAnswers ? (q.correctAnswer || '').split(',').filter(Boolean) : []
            const checked = previewMode && showAnswers ? correctAnswers.includes(opt) : selected.includes(opt)
            return (
              <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${checked && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                  : checked ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                  : previewMode ? 'border border-transparent text-gray-500 cursor-default'
                  : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
                <input type="checkbox" checked={checked} disabled={previewMode} className="accent-blue-600"
                  onChange={previewMode ? undefined : () => {
                    const next = checked ? selected.filter(s => s !== opt) : [...selected, opt].sort()
                    onAnswer(q.id, next.join(','))
                  }} />
                {opt}
              </label>
            )
          })}
        </div>
      )}
      {['fill_blank', 'short_answer'].includes(q.type) && (
        <div className="pl-8">
          <input type="text"
            value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
            readOnly={previewMode}
            onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
            placeholder={previewMode ? '' : 'Nhập đáp án...'}
            className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-56 bg-transparent transition`} />
        </div>
      )}
      {['matching', 'map_diagram'].includes(q.type) && (
        <div className="pl-8">
          {q.imageUrl && <img src={q.imageUrl} alt="map/diagram" className="w-full max-w-sm rounded-lg mb-2 border" />}
          {opts.length > 0 ? (
            <select
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              disabled={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              className={`border ${previewMode && showAnswers ? 'border-green-400 text-green-700 font-semibold' : 'border-gray-300'} rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white min-w-48`}>
              <option value="">— Chọn đáp án —</option>
              {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input type="text"
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              readOnly={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              placeholder={previewMode ? '' : 'Nhập đáp án...'}
              className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-56 bg-transparent transition`} />
          )}
        </div>
      )}
    </div>
  )
}

function groupByType(questions) {
  const groups = []
  let i = 0
  while (i < questions.length) {
    const type = questions[i].type
    const start = i
    while (i < questions.length && questions[i].type === type) i++
    groups.push({ type, qs: questions.slice(start, i), startOffset: start })
  }
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ListeningExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === 'true'

  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [phase, setPhase] = useState('start')
  const [showAnswers, setShowAnswers] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [showNavNumbers, setShowNavNumbers] = useState(true)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(0)
  const audioRef = useRef(null)
  const bottomBarRef = useRef(null)

  useEffect(() => {
    api.get(`/listening/exams/${id}`).then(r => setExam(r.data)).finally(() => setLoading(false))
  }, [id])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    if (phase !== 'exam' || result || previewMode) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result, previewMode])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [activeSection])

  useEffect(() => {
    if (!showConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showConfirm])

  useEffect(() => {
    if (!showExitConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowExitConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm])

  useEffect(() => {
    if (!showQuestionPanel) return
    const handler = (e) => { if (e.key === 'Escape') setShowQuestionPanel(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showQuestionPanel])

  useEffect(() => {
    if (result) {
      api.get(`/full-test/status?examId=${id}`)
        .then(r => { if (r.data.isComplete) setFullTestStatus(r.data) })
        .catch(() => {})
    }
  }, [result])

  useEffect(() => {
    if (!bottomBarRef.current) return
    const ro = new ResizeObserver(entries => {
      setBottomBarHeight(entries[0].contentRect.height)
    })
    ro.observe(bottomBarRef.current)
    return () => ro.disconnect()
  }, [])

  const onAnswer = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }))

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      const r = await api.post(`/listening/exams/${id}/submit`, { answers })
      setResult(r.data)
      setPhase('result')
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const jumpToQuestion = (slot) => {
    let sectionIdx = activeSection
    for (let i = 0; i < exam.listeningSections.length; i++) {
      const s = exam.listeningSections[i]
      const inSection = (s.questionGroups || []).some(g => slot.number >= g.qNumberStart && slot.number <= g.qNumberEnd)
        || (s.questions || []).some(q => q.number === slot.number)
      if (inSection) { sectionIdx = i; break }
    }
    const doScroll = () => {
      let el = document.getElementById(`question-${slot.number}`)
        || document.getElementById(`q-${slot.number}`)
      if (!el) {
        for (const group of (exam.listeningSections[sectionIdx].questionGroups || [])) {
          if (slot.number >= group.qNumberStart && slot.number <= group.qNumberEnd) {
            el = document.getElementById(`question-${group.qNumberStart}`)
            break
          }
        }
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (sectionIdx !== activeSection) {
      setActiveSection(sectionIdx)
      setTimeout(doScroll, 50)
    } else {
      doScroll()
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>

  const allQ = exam.listeningSections.flatMap(s => getSectionSlots(s))
  const answered = allQ.filter(s => s.qId && answers[s.qId]).length

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">🎧</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h1>
        <p className="text-gray-500 text-sm mb-1">{exam.listeningSections.length} Sections · {allQ.length} câu hỏi</p>
        <p className="text-gray-500 text-sm mb-8">Thời gian: <span className="font-semibold text-[#1a56db]">40 phút</span></p>
        <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-8 space-y-1">
          <p>• Nghe audio rồi trả lời câu hỏi bên dưới</p>
          <p>• Có thể tua lại audio trong phần làm bài</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="w-full bg-[#1a56db] hover:bg-[#1d4ed8] text-white py-3 rounded-xl font-bold transition">
          Bắt đầu làm bài
        </button>
        <button onClick={() => navigate('/listening')} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition">← Quay lại</button>
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────
  if (phase === 'result' && result) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] text-white px-6 py-4">
        <h1 className="font-bold text-lg">Kết quả Listening</h1>
        <p className="text-blue-200 text-sm">{exam.title}</p>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-6xl font-bold text-[#1a56db] mb-2">{result.score}</div>
          <div className="text-gray-500">Band Score IELTS</div>
          <div className="text-gray-600 mt-2">Đúng {result.correct}/{result.total} câu</div>
          <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="bg-[#1a56db] h-3 rounded-full" style={{ width: `${(result.correct / result.total) * 100}%` }} />
          </div>
        </div>
        <div className="space-y-3">
          {result.result.map((r, i) => (
            <div key={r.questionId} className={`bg-white rounded-xl p-4 border-l-4 ${r.isCorrect ? 'border-green-400' : 'border-red-400'}`}>
              <p className="text-sm font-medium text-gray-700 mb-1">Câu {i + 1}: {r.questionText}</p>
              <p className={`text-sm ${r.isCorrect ? 'text-green-600' : 'text-red-500'}`}>Bạn trả lời: {r.userAnswer || '(bỏ trống)'}</p>
              {!r.isCorrect && <p className="text-sm text-green-600">Đáp án: {r.correctAnswer}</p>}
            </div>
          ))}
        </div>
        {fullTestStatus?.isComplete && (
          <button
            onClick={() => navigate(`/full-test/result?seriesId=${fullTestStatus.seriesId}&bookNumber=${fullTestStatus.bookNumber}&testNumber=${fullTestStatus.testNumber}`)}
            className="w-full py-3 rounded-xl font-bold text-white transition mb-3"
            style={{ backgroundColor: '#059669' }}
          >
            Xem kết quả Full Test →
          </button>
        )}
        <button onClick={() => navigate('/listening')} className="w-full bg-[#1a56db] text-white py-3 rounded-xl font-bold hover:bg-[#1d4ed8] transition">
          Làm đề khác
        </button>
      </div>
    </div>
  )

  // ── Exam ──────────────────────────────────────────────────────
  const section = exam.listeningSections[activeSection]
  let startIdx = 0
  for (let i = 0; i < activeSection; i++) startIdx += getSectionSlots(exam.listeningSections[i]).length

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => previewMode ? navigate('/admin') : setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base shrink-0 transition">✕</button>
          <span className="text-sm font-semibold truncate">{exam.title}</span>
          {previewMode && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold shrink-0">Chế độ Preview</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {previewMode ? (
            <button
              onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition ${showAnswers ? 'bg-green-500 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'}`}
            >
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          ) : (
            <>
              <span className="text-blue-200 text-xs">{answered}/{allQ.length} câu</span>
              <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 300 ? 'bg-red-500' : timeLeft < 600 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
                {fmt(timeLeft)}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Audio player */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Section {section.number} — {section.context}</p>
          {section.audioUrl ? (
            <audio ref={audioRef} controls className="w-full h-10" src={toImgSrc(section.audioUrl)} />
          ) : (
            <div className="bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-400 text-center">Chưa có file audio cho section này</div>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {/* Questions */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wider mb-5">
              Section {section.number}
              {section.context && <span className="font-normal text-gray-400 ml-1">— {section.context}</span>}
            </p>

            {/* Legacy: direct questions (groupId = null) */}
            {(section.questions || []).length > 0 && groupByType(section.questions).map((group, gi) => (
              <div key={gi} className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
                  <p className="font-bold text-gray-800">Questions {startIdx + group.startOffset + 1}–{startIdx + group.startOffset + group.qs.length}</p>
                </div>
                {group.qs.map((q, qi) => (
                  <QuestionBlock key={q.id} q={q} globalIdx={startIdx + group.startOffset + qi}
                    answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
                ))}
              </div>
            ))}

            {/* New: group-based questions */}
            {(section.questionGroups || []).map(group => (
              <GroupBlock key={group.id} group={group} answers={answers} onAnswer={onAnswer}
                previewMode={previewMode} showAnswers={showAnswers} />
            ))}

            {getSectionSlots(section).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8 italic">Section này chưa có câu hỏi.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigator bar — 2 rows */}
      {!previewMode && (
        <div ref={bottomBarRef} className="bg-white border-t border-gray-200 shrink-0">
          {/* Row 1: question numbers for active section only (collapsible) */}
          {showNavNumbers && (
            <div className="px-4 pt-2 pb-1.5 border-b border-gray-100 flex justify-center">
              <div className="flex flex-wrap gap-0.5 justify-center">
                {getSectionSlots(section).map(slot => (
                  <button
                    key={slot.number}
                    onClick={() => jumpToQuestion(slot)}
                    className={`w-6 h-6 rounded text-[11px] font-bold transition
                      ${slot.qId && answers[slot.qId]
                        ? 'bg-[#1a56db] border border-[#1a56db] text-white'
                        : 'bg-white border border-[#e2e8f0] text-[#1e293b]'}`}
                  >
                    {slot.number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: controls */}
          <div className="px-4 py-2 flex items-center gap-3">
            {/* Left: icons + current section info */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Grid icon — opens question panel */}
              <button
                title="Bảng câu hỏi"
                onClick={() => setShowQuestionPanel(v => !v)}
                className={`w-7 h-7 flex items-center justify-center rounded border transition ${showQuestionPanel ? 'border-[#1a56db] text-[#1a56db]' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                  <rect x="0" y="0" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="4.75" y="0" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="9.5" y="0" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="0" y="4.75" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="4.75" y="4.75" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="9.5" y="4.75" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="0" y="9.5" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="4.75" y="9.5" width="3.5" height="3.5" rx="0.5"/>
                  <rect x="9.5" y="9.5" width="3.5" height="3.5" rx="0.5"/>
                </svg>
              </button>
              {/* Collapse/expand icon */}
              <button
                title={showNavNumbers ? 'Thu gọn' : 'Mở rộng'}
                onClick={() => setShowNavNumbers(v => !v)}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  {showNavNumbers
                    ? <path d="M2 9l4.5-4.5L11 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    : <path d="M2 4l4.5 4.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  }
                </svg>
              </button>
              <div className="w-px h-4 bg-gray-200 mx-0.5" />
              <span className="text-xs font-bold text-gray-800">Section {section.number}</span>
              <span className="text-[11px] text-gray-500">
                Đã làm {getSectionSlots(section).filter(s => s.qId && answers[s.qId]).length}/{getSectionSlots(section).length}
              </span>
            </div>

            {/* Middle: section summary */}
            <div className="flex-1 flex items-center justify-center gap-3 text-[11px] font-medium">
              {exam.listeningSections.map((s, si) => {
                const slots = getSectionSlots(s)
                const sAns = slots.filter(sl => sl.qId && answers[sl.qId]).length
                const isActive = activeSection === si
                return (
                  <Fragment key={si}>
                    {si > 0 && <span className="text-gray-300 select-none">——</span>}
                    <button
                      onClick={() => setActiveSection(si)}
                      className={`transition whitespace-nowrap ${isActive ? 'text-[#1a56db] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Section {s.number}{' '}
                      <span className={isActive ? 'text-[#1a56db]' : 'text-gray-400'}>{sAns}/{slots.length}</span>
                    </button>
                  </Fragment>
                )
              })}
            </div>

            {/* Right: prev/next arrows + submit */}
            <div className="flex items-center gap-1.5 shrink-0">
              {activeSection > 0 && (() => {
                const slots = getSectionSlots(exam.listeningSections[activeSection - 1])
                const range = `${slots[0]?.number}–${slots[slots.length - 1]?.number}`
                return (
                  <button
                    onClick={() => setActiveSection(activeSection - 1)}
                    className="text-[11px] text-gray-600 hover:text-[#1a56db] font-semibold px-2 py-1.5 rounded border border-gray-200 hover:border-[#1a56db] transition"
                  >
                    ← {range}
                  </button>
                )
              })()}
              {activeSection < exam.listeningSections.length - 1 && (() => {
                const slots = getSectionSlots(exam.listeningSections[activeSection + 1])
                const range = `${slots[0]?.number}–${slots[slots.length - 1]?.number}`
                return (
                  <button
                    onClick={() => setActiveSection(activeSection + 1)}
                    className="text-[11px] text-gray-600 hover:text-[#1a56db] font-semibold px-2 py-1.5 rounded border border-gray-200 hover:border-[#1a56db] transition"
                  >
                    {range} →
                  </button>
                )
              })()}
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition ml-1"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question panel popup */}
      {showQuestionPanel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowQuestionPanel(false)} />
          <div
            className="fixed left-4 z-40 bg-white rounded-lg shadow-lg border border-gray-200 w-72 max-h-80 overflow-y-auto"
            style={{ bottom: bottomBarHeight + 8 }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm">Bảng câu hỏi</h3>
              <button
                onClick={() => setShowQuestionPanel(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-bold transition"
              >✕</button>
            </div>
            <div className="px-4 py-3 space-y-4">
              {exam.listeningSections.map((s, si) => {
                const slots = [...getSectionSlots(s)].sort((a, b) => a.number - b.number)
                const isActive = activeSection === si
                return (
                  <div key={si}>
                    <p className={`text-xs font-bold mb-2 ${isActive ? 'text-[#1a56db]' : 'text-gray-500'}`}>
                      Section {s.number}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map(slot => (
                        <button
                          key={slot.number}
                          onClick={() => { jumpToQuestion(slot); setShowQuestionPanel(false) }}
                          className={`w-8 h-8 rounded text-xs font-bold transition
                            ${slot.qId && answers[slot.qId]
                              ? 'bg-[#1a56db] border border-[#1a56db] text-white'
                              : isActive
                                ? 'bg-[#f1f5f9] border border-[#cbd5e1] text-[#475569]'
                                : 'bg-white border border-[#e2e8f0] text-[#1e293b]'}`}
                        >
                          {slot.number}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

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
              <button onClick={() => navigate('/listening')} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">
                Thoát
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm submit modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2">Nộp bài?</h2>
            <p className="text-gray-600 text-sm mb-2">Bạn có chắc muốn nộp bài không?</p>
            <p className="text-sm font-semibold text-gray-700 mb-6">
              Đã làm: <span className="text-[#1a56db]">{answered}/{allQ.length}</span> câu
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Tiếp tục làm
              </button>
              <button
                onClick={() => { setShowConfirm(false); doSubmit() }}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition disabled:opacity-50"
              >
                {submitting ? 'Đang chấm...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
