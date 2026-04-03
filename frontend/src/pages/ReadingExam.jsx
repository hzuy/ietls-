import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getReadingExam, submitReadingExam, getFullTestStatus } from '../services/examService'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import PassagePills from '../components/PassagePills'
import TableCompletionRender from '../components/TableCompletionRender'

const TOTAL_TIME = 60 * 60

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Group consecutive questions of the same type (backward compat for flat questions)
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

function TypeHeader({ type, from, to }) {
  const base = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm'
  const q = `Questions ${from}–${to}`
  const headers = {
    true_false_ng: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-2">{q}</p>
        <p className="text-gray-700 mb-2">Do the following statements agree with the information given in this passage?</p>
        <p className="text-gray-600 mb-1">In the boxes below, write</p>
        <div className="space-y-1 text-gray-700">
          <p><strong>TRUE</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement agrees with the information</p>
          <p><strong>FALSE</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement contradicts the information</p>
          <p><strong>NOT GIVEN</strong>&nbsp;&nbsp;if it is impossible to say what the writer thinks about this</p>
        </div>
      </div>
    ),
    yes_no_ng: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-2">{q}</p>
        <p className="text-gray-700 mb-2">Do the following statements agree with the claims of the writer in the passage?</p>
        <p className="text-gray-600 mb-1">In the boxes below, write</p>
        <div className="space-y-1 text-gray-700">
          <p><strong>YES</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement agrees with the claims of the writer</p>
          <p><strong>NO</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement contradicts the claims of the writer</p>
          <p><strong>NOT GIVEN</strong>&nbsp;&nbsp;if it is impossible to say what the writer thinks about this</p>
        </div>
      </div>
    ),
    mcq: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Choose the correct letter, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.</p>
      </div>
    ),
    mcq_multi: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>
      </div>
    ),
    fill_blank: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Complete the sentences below.</p>
        <p className="text-gray-600 mt-1">Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> from the passage for each answer.</p>
      </div>
    ),
    matching_headings: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">The passage has several paragraphs. Choose the correct heading for each paragraph from the list of headings below.</p>
        <p className="text-gray-600 mt-1">Write the correct number <strong>i–x</strong> in the boxes below.</p>
      </div>
    ),
    matching_features: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Match each statement with the correct person/place/feature <strong>A–F</strong> listed below.</p>
        <p className="text-gray-600 mt-1">You may use any letter more than once.</p>
      </div>
    ),
    matching_paragraph: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">The passage has several paragraphs. Which paragraph contains the following information?</p>
        <p className="text-gray-600 mt-1">Write the correct letter <strong>A–F</strong> in the boxes below.</p>
      </div>
    ),
    matching_endings: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Complete each sentence with the correct ending <strong>A–F</strong> from the box below.</p>
      </div>
    ),
    choose_title: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Choose the most suitable heading/title for this section from the list below.</p>
      </div>
    ),
    matching: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Match each statement with the correct information.</p>
        <p className="text-gray-600 mt-1">Write the correct letter in the boxes below.</p>
      </div>
    ),
    diagram_completion: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Label the diagram below.</p>
        <p className="text-gray-600 mt-1">Write <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p>
      </div>
    ),
  }
  return headers[type] || (
    <div className={base}>
      <p className="font-bold text-gray-800 mb-1">{q}</p>
    </div>
  )
}

const MATCHING_TYPES = ['matching','matching_headings','matching_features','matching_paragraph','matching_endings','choose_title','map_diagram']

function QuestionBlock({ q, globalIdx, answers, onAnswer, maxChoices = 2, previewMode, showAnswers }) {
  const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : []
  const selected = (answers[q.id] || '').split(',').filter(Boolean)

  return (
    <div id={`q-${q.number}`} className="mb-6 scroll-mt-4">
      <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
        <span>{q.questionText}</span>
      </p>

      {/* Single MCQ */}
      {q.type === 'mcq' && (
        <div className="space-y-1 pl-8">
          {opts.map(opt => {
            const displayAns = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
            const isSelected = displayAns === opt
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

      {/* Multi MCQ (checkboxes) */}
      {q.type === 'mcq_multi' && (
        <div className="space-y-1 pl-8">
          {opts.map(opt => {
            const correctList = previewMode && showAnswers ? (q.correctAnswer || '').split(',').filter(Boolean) : []
            const checked = previewMode && showAnswers ? correctList.includes(opt) : selected.includes(opt)
            const disabled = previewMode || (!checked && selected.length >= maxChoices)
            return (
              <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${checked && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                  : checked ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                  : disabled ? 'border border-transparent text-gray-300 cursor-not-allowed'
                  : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
                <input type="checkbox" checked={checked} disabled={disabled} className="accent-blue-600"
                  onChange={previewMode ? undefined : () => {
                    const next = checked ? selected.filter(s => s !== opt) : [...selected, opt]
                    onAnswer(q.id, next.join(','))
                  }} />
                {opt}
              </label>
            )
          })}
        </div>
      )}

      {/* TRUE/FALSE/NOT GIVEN */}
      {q.type === 'true_false_ng' && (
        <div className="flex gap-2 pl-8 flex-wrap">
          {['TRUE', 'FALSE', 'NOT GIVEN'].map(opt => {
            const displayAns = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
            const isSelected = displayAns === opt
            return (
              <button key={opt}
                onClick={previewMode ? undefined : () => onAnswer(q.id, opt)}
                disabled={previewMode}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition
                  ${isSelected && previewMode && showAnswers ? 'bg-green-500 text-white border-green-500'
                    : isSelected ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* YES/NO/NOT GIVEN */}
      {q.type === 'yes_no_ng' && (
        <div className="flex gap-2 pl-8 flex-wrap">
          {['YES', 'NO', 'NOT GIVEN'].map(opt => {
            const displayAns = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
            const isSelected = displayAns === opt
            return (
              <button key={opt}
                onClick={previewMode ? undefined : () => onAnswer(q.id, opt)}
                disabled={previewMode}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition
                  ${isSelected && previewMode && showAnswers ? 'bg-green-500 text-white border-green-500'
                    : isSelected ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* Text input: fill_blank, diagram_completion */}
      {['fill_blank', 'diagram_completion'].includes(q.type) && (
        <div className="pl-8">
          {q.imageUrl && <img src={q.imageUrl} alt="diagram" className="w-full max-w-sm rounded-lg mb-2 border" />}
          <input type="text"
            value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
            readOnly={previewMode}
            onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
            placeholder={previewMode ? '' : 'Nhập đáp án...'}
            className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-64 bg-transparent transition`} />
        </div>
      )}

      {/* Matching types — select dropdown */}
      {MATCHING_TYPES.includes(q.type) && (
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
              className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-48 bg-transparent transition`} />
          )}
        </div>
      )}
    </div>
  )
}

// Render a group of questions (from questionGroups) with the appropriate header/UI
function GroupBlock({ group, answers, onAnswer, globalOffset, previewMode, showAnswers }) {
  const from = group.qNumberStart
  const to = group.qNumberEnd

  // Note completion: render inline fill blanks in note content
  if (group.type === 'note_completion') {
    const questionMap = {}
    ;(group.questions || []).forEach(q => { questionMap[q.number] = q })

    const parseContent = (content) => {
      const parts = content.split(/(\[Q:\d+\])/)
      return parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = questionMap[qNum]
          const val = previewMode && showAnswers ? (q?.correctAnswer || '') : (q ? (answers[q.id] || '') : '')
          return (
            <span key={i} className="inline-flex items-center mx-1">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1 rounded mr-0.5">{qNum}</span>
              <input
                type="text"
                value={val}
                readOnly={previewMode}
                onChange={previewMode ? undefined : e => q && onAnswer(q.id, e.target.value)}
                placeholder={previewMode ? '' : '...'}
                className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-[#e2e8f0] focus:border-[#3b82f6]'} outline-none px-1 py-0.5 text-sm w-24 bg-white transition text-center`}
              />
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

  // Matching Information: tick-grid table (shared MatchingTickGrid component)
  if (group.type === 'matching_information') {
    const letters = (group.matchingOptions || []).map(mo => mo.optionLetter).filter(Boolean)
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-600 text-xs mb-1">{group.instruction}</p>}
          <p className="text-gray-500 text-xs italic">You may use any letter more than once.</p>
        </div>
        <MatchingTickGrid
          letters={letters}
          questions={group.questions || []}
          answers={answers}
          onAnswer={onAnswer}
          previewMode={previewMode}
          showAnswers={showAnswers}
          accentColor="blue"
          globalOffset={globalOffset}
        />
      </div>
    )
  }

  // Summary + Word Bank (drag-drop)
  if (group.type === 'drag_word_bank') {
    return (
      <div id={`q-${from}`} className="scroll-mt-4">
        <DragWordBankGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
      </div>
    )
  }

  // Table completion
  if (group.type === 'table_completion') {
    return <TableCompletionRender group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  }

  // Matching drag-drop (2-column)
  if (group.type === 'matching_drag') {
    return (
      <div id={`q-${from}`} className="scroll-mt-4">
        <MatchingDragGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
      </div>
    )
  }

  // Diagram Label Completion
  if (group.type === 'diagram_label') {
    return <DiagramLabelGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  }

  // Matching Headings
  if (group.type === 'matching_headings') {
    return <MatchingHeadingsGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  }

  // MCQ Multi: each sub-question rendered with its range prefix
  if (group.type === 'mcq_multi') {
    const maxChoices = group.maxChoices || 2
    const questions = group.questions || []

    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <p className="font-bold text-gray-800 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-gray-700">{group.instruction}</p>}
        </div>
        {questions.map((q, qi) => {
          const qStart = from + qi * maxChoices
          const qEnd = qStart + maxChoices - 1
          const opts = q.options
            ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options)
            : []
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
            <div key={q.id} className="mb-4">
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
                        : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
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

  // Default: render individual QuestionBlocks with a type header
  const firstQ = group.questions?.[0]
  const groupType = firstQ?.type || group.type
  return (
    <div className="mb-6">
      <TypeHeader type={groupType} from={from} to={to} />
      {(group.questions || []).map((q, qi) => (
        <QuestionBlock
          key={q.id}
          q={q}
          globalIdx={globalOffset + qi}
          answers={answers}
          onAnswer={onAnswer}
          maxChoices={group.maxChoices || 2}
          previewMode={previewMode}
          showAnswers={showAnswers}
        />
      ))}
    </div>
  )
}

export default function ReadingExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === 'true'

  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activePassage, setActivePassage] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [phase, setPhase] = useState('start')
  const [showAnswers, setShowAnswers] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [showNavNumbers, setShowNavNumbers] = useState(true)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(52)
  const bottomBarRef = useRef(null)
  const rightPanelRef = useRef(null)
  const bodyRef = useRef(null)
  const isDraggingRef = useRef(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('reading-split-ratio')
    const n = parseFloat(saved)
    return (!isNaN(n) && n >= 25 && n <= 75) ? n : 50
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    getReadingExam(id).then(data => setExam(data)).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (phase === 'result' && result) {
      getFullTestStatus(id)
        .then(data => { if (data.isComplete) setFullTestStatus(data) })
        .catch(() => {})
    }
  }, [phase, result])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleDividerMouseDown = (e) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)

    const onMouseMove = (ev) => {
      if (!isDraggingRef.current || !bodyRef.current) return
      const rect = bodyRef.current.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(75, Math.max(25, ratio))
      setSplitRatio(clamped)
      localStorage.setItem('reading-split-ratio', clamped)
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const resetSplit = (e) => {
    e.stopPropagation()
    setSplitRatio(50)
    localStorage.removeItem('reading-split-ratio')
  }

  useEffect(() => {
    if (phase !== 'exam' || result || previewMode) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result, previewMode])

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
    if (!bottomBarRef.current) return
    const obs = new ResizeObserver(() => setBottomBarHeight(bottomBarRef.current?.offsetHeight || 52))
    obs.observe(bottomBarRef.current)
    return () => obs.disconnect()
  }, [])

  const onAnswer = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }))

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      const r = await submitReadingExam(id, answers)
      setResult(r)
      setPhase('result')
    } catch (e) { /* submit error handled by submitting state */ }
    finally { setSubmitting(false) }
  }

  // Get all questions for a passage (from groups or direct)
  const getPassageQuestions = (passage) => {
    if (passage.questionGroups && passage.questionGroups.length > 0) {
      return passage.questionGroups.flatMap(g => g.questions || [])
    }
    return passage.questions || []
  }

  // Get total question slots for a passage (uses qNumberEnd - qNumberStart + 1 for groups)
  const getPassageTotalSlots = (passage) => {
    if (passage.questionGroups && passage.questionGroups.length > 0) {
      return passage.questionGroups.reduce((sum, g) => sum + (g.qNumberEnd - g.qNumberStart + 1), 0)
    }
    return (passage.questions || []).length
  }

  // Get navigator items: one entry per slot number (expands ranges for mcq_multi etc.)
  const getPassageNavItems = (passage) => {
    if (!passage.questionGroups || passage.questionGroups.length === 0) {
      return (passage.questions || []).map(q => ({ number: q.number, qId: q.id }))
    }
    return passage.questionGroups.flatMap(g => {
      const items = []
      for (let n = g.qNumberStart; n <= g.qNumberEnd; n++) {
        let qId = null
        if (g.type === 'mcq_multi') {
          const maxC = g.maxChoices || 2
          const qi = Math.floor((n - g.qNumberStart) / maxC)
          qId = g.questions?.[qi]?.id ?? null
        } else {
          qId = (g.questions || []).find(q => q.number === n)?.id ?? null
        }
        items.push({ number: n, qId })
      }
      return items
    })
  }

  const jumpToQuestion = (qNumber) => {
    // Find which passage contains this question number
    let passageIdx = -1
    for (let i = 0; i < exam.passages.length; i++) {
      const pQs = getPassageQuestions(exam.passages[i])
      if (pQs.some(q => q.number === qNumber)) { passageIdx = i; break }
    }
    if (passageIdx === -1) return

    const doScroll = () => {
      let el = document.getElementById(`q-${qNumber}`)
      if (!el) {
        // Fallback for token-based groups: scroll to group start
        for (const group of (exam.passages[passageIdx].questionGroups || [])) {
          if (qNumber >= group.qNumberStart && qNumber <= group.qNumberEnd) {
            el = document.getElementById(`q-${group.qNumberStart}`)
            break
          }
        }
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (passageIdx !== activePassage) {
      setActivePassage(passageIdx)
      setTimeout(doScroll, 50)
    } else {
      doScroll()
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>

  const allQ = exam.passages.flatMap(p => getPassageQuestions(p))
  const totalSlots = exam.passages.reduce((sum, p) => sum + getPassageTotalSlots(p), 0)
  const allNavItems = exam.passages.flatMap(p => getPassageNavItems(p))
  const answered = allNavItems.filter(item => item.qId && answers[item.qId]).length

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">📖</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h1>
        <p className="text-gray-500 text-sm mb-1">{exam.passages.length} Passages · {totalSlots} câu hỏi</p>
        <p className="text-gray-500 text-sm mb-8">Thời gian: <span className="font-semibold text-blue-600">60 phút</span></p>
        <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-8 space-y-1">
          <p>• Đọc passage bên trái, trả lời câu hỏi bên phải</p>
          <p>• Có thể chuyển qua lại giữa các passage</p>
          <p>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition">
          Bắt đầu làm bài
        </button>
        <button onClick={() => navigate('/reading')} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition">← Quay lại</button>
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────
  if (phase === 'result' && result) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] text-white px-6 py-4">
        <h1 className="font-bold text-lg">Kết quả Reading</h1>
        <p className="text-blue-200 text-sm">{exam.title}</p>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-6xl font-bold text-blue-600 mb-2">{result.score}</div>
          <div className="text-gray-500">Band Score IELTS</div>
          <div className="text-gray-600 mt-2">Đúng {result.correct}/{result.total} câu</div>
          <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${result.total > 0 ? (result.correct / result.total) * 100 : 0}%` }} />
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
        <button onClick={() => navigate('/reading')} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
          Làm đề khác
        </button>
      </div>
    </div>
  )

  // ── Exam ──────────────────────────────────────────────────────
  const passage = exam.passages[activePassage]
  const useGroups = passage.questionGroups && passage.questionGroups.length > 0

  // Compute global question offset for this passage
  const passageOffsets = exam.passages.reduce((acc, p, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + getPassageQuestions(exam.passages[i - 1]).length)
    return acc
  }, [])

  const passageStartIdx = passageOffsets[activePassage]
  const passageQuestions = getPassageQuestions(passage)

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
              <span className="text-blue-200 text-xs">{answered}/{totalSlots} câu</span>
              <div className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 300 ? 'bg-red-500' : timeLeft < 600 ? 'bg-yellow-500 text-black' : 'bg-blue-700'}`}>
                {fmt(timeLeft)}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div ref={bodyRef} className={`flex-1 flex flex-col md:flex-row overflow-hidden${isDragging ? ' select-none' : ''}`}>
        {/* Left: Passage text */}
        <div
          className="overflow-y-auto bg-white px-8 py-6 border-b md:border-b-0 md:border-r border-gray-200"
          style={{ width: isMobile ? '100%' : `${splitRatio}%` }}
        >
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1 leading-snug">{passage.title}</h2>
          {passage.subtitle && <p className="text-sm text-gray-500 text-center mb-2 italic">{passage.subtitle}</p>}
          <div className="w-16 h-0.5 bg-blue-500 mx-auto mb-6" />
          <div className="text-gray-800 text-[0.92rem] leading-8 font-serif">
            {passage.body
              ? passage.body
                  .split(/\n\s*\n|\n/)
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map((para, i) => {
                    if (passage.letteredParagraphs) {
                      const letter = String.fromCharCode(65 + i)
                      return (
                        <p key={i} className="mb-5">
                          <span className="font-bold text-blue-700 mr-2">{letter}</span>
                          {para.charAt(0).toUpperCase() + para.slice(1)}
                        </p>
                      )
                    }
                    const capitalized = para.charAt(0).toUpperCase() + para.slice(1)
                    return <p key={i} className="mb-5 indent-6">{capitalized}</p>
                  })
              : null
            }
          </div>
        </div>

        {/* Drag divider */}
        <div
          className="group relative flex-shrink-0 hidden md:flex flex-col items-center justify-center w-2 hover:w-3 transition-all duration-100 cursor-col-resize select-none"
          style={{ backgroundColor: isDragging ? '#93c5fd' : undefined }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={`w-full h-full absolute inset-0 transition-colors ${isDragging ? 'bg-blue-300' : 'bg-gray-200 group-hover:bg-blue-200'}`} />
          {/* Handle dots */}
          <div className="relative z-10 flex flex-col gap-1 pointer-events-none">
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-500'}`} />
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-500'}`} />
          </div>
          {/* Reset button — appears on hover */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={resetSplit}
            title="Reset 50/50"
            className="absolute top-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-300 rounded text-gray-500 hover:text-blue-600 hover:border-blue-400 text-[10px] px-1 py-0.5 shadow-sm leading-none"
          >
            ⇔
          </button>
        </div>

        {/* Right: Questions */}
        <div
          ref={rightPanelRef}
          className="overflow-y-auto bg-gray-50 px-6 py-5 max-md:w-full"
          style={{ width: isMobile ? '100%' : `${100 - splitRatio}%` }}
        >
          {useGroups ? (
            // New group-based rendering
            (() => {
              let groupOffset = passageStartIdx
              return [...passage.questionGroups].sort((a, b) => a.qNumberStart - b.qNumberStart).map((group, gi) => {
                const el = (
                  <GroupBlock
                    key={group.id || gi}
                    group={group}
                    answers={answers}
                    onAnswer={onAnswer}
                    globalOffset={groupOffset}
                    previewMode={previewMode}
                    showAnswers={showAnswers}
                  />
                )
                groupOffset += (group.questions || []).length
                return el
              })
            })()
          ) : (
            // Backward compat: flat questions grouped by type
            groupByType(passageQuestions).map((group, gi) => {
              const from = passageStartIdx + group.startOffset + 1
              const to = from + group.qs.length - 1
              return (
                <div key={gi}>
                  <TypeHeader type={group.type} from={from} to={to} />
                  {group.qs.map((q, qi) => (
                    <QuestionBlock
                      key={q.id}
                      q={q}
                      globalIdx={passageStartIdx + group.startOffset + qi}
                      answers={answers}
                      onAnswer={onAnswer}
                    />
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom navigator bar — 2 rows */}
      {!previewMode && (
        <div ref={bottomBarRef} className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* Row 1: question numbers for active passage only (collapsible) */}
          {showNavNumbers && (
            <div className="px-6 py-4 border-b border-gray-100 flex justify-center bg-white">
              <div className="flex flex-wrap gap-3 justify-center max-w-5xl">
                {getPassageNavItems(passage).map(({ number, qId }) => {
                  const isAnswered = qId && answers[qId];
                  return (
                    <button
                      key={number}
                      onClick={() => jumpToQuestion(number)}
                      className={`w-10 h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center border
                        ${isAnswered
                          ? 'bg-[#002D5B] border-[#002D5B] text-white shadow-sm'
                          : 'bg-white border-gray-300 text-[#002D5B] hover:border-[#0066FF] hover:text-[#0066FF]'}`}
                    >
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 2: controls & Passage Pills */}
          <div className="px-6 h-[52px] flex items-center justify-between gap-6">
            {/* Left: icons + Grid toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                title="Bảng câu hỏi"
                onClick={() => setShowQuestionPanel(v => !v)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showQuestionPanel ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-[#0066FF] hover:text-[#0066FF]'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button
                title={showNavNumbers ? 'Thu gọn' : 'Mở rộng'}
                onClick={() => setShowNavNumbers(v => !v)}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:border-[#002D5B] hover:text-[#002D5B] transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {showNavNumbers ? <polyline points="18 15 12 9 6 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
                </svg>
              </button>
            </div>

            {/* Middle: Passage Pills */}
            <PassagePills
              items={exam.passages.map(p => {
                const navItems = getPassageNavItems(p)
                return {
                  label: `Passage ${p.number}`,
                  answered: navItems.filter(s => s.qId && answers[s.qId]).length,
                  total: navItems.length,
                }
              })}
              activeIndex={activePassage}
              onChange={setActivePassage}
            />

            {/* Right: Submit Button */}
            <div className="flex items-center shrink-0">
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question panel — popup bottom-left above bottom bar */}
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
              {exam.passages.map((p, pi) => {
                const navItems = [...getPassageNavItems(p)].sort((a, b) => a.number - b.number)
                const isActive = activePassage === pi
                return (
                  <div key={pi}>
                    <p className={`text-xs font-bold mb-2 ${isActive ? 'text-[#1a56db]' : 'text-gray-500'}`}>
                      Passage {p.number}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {navItems.map(({ number, qId }) => (
                        <button
                          key={number}
                          onClick={() => { jumpToQuestion(number); setShowQuestionPanel(false) }}
                          className={`w-8 h-8 rounded text-xs font-bold transition
                            ${qId && answers[qId]
                              ? 'bg-[#1a56db] border border-[#1a56db] text-white'
                              : isActive
                                ? 'bg-[#f1f5f9] border border-[#cbd5e1] text-[#475569]'
                                : 'bg-white border border-[#e2e8f0] text-[#1e293b]'}`}
                        >
                          {number}
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
              <button onClick={() => navigate('/reading')} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition">
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
              Đã làm: <span className="text-[#1a56db]">{answered}/{totalSlots}</span> câu
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
