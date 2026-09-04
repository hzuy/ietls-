// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ QUY ƯỚC DOM ID — file này (Reading) dùng prefix `q-${n}`.                     │
// │ Bản Listening tương ứng (components/exam/listening/OtherGroups.jsx +          │
// │ MCQGroup.jsx / NoteCompletionGroup.jsx) dùng prefix `question-${n}`.          │
// │ `ReadingExam.jumpToQuestion` tìm theo `q-...`; `ListeningExam.jumpToQuestion` │
// │ tìm theo `question-...`. Mỗi shell chỉ render đúng family của nó nên hiện KHÔNG│
// │ có bug — nhưng ĐỪNG gộp GroupBlock (Reading) với OtherGroups (Listening) nếu   │
// │ chưa thống nhất prefix trước, nếu không scroll/jump-to-question sẽ hỏng.       │
// └─────────────────────────────────────────────────────────────────────────────┘
import MatchingTickGrid from '../MatchingTickGrid'
import DragWordBankGroup from '../DragWordBankGroup'
import MatchingDragGroup from '../MatchingDragGroup'
import DiagramLabelGroup from '../DiagramLabelGroup'
import MatchingHeadingsGroup from '../MatchingHeadingsGroup'
import TableCompletionRender from '../TableCompletionRender'
import TypeHeader from './TypeHeaders'
import QuestionBlock from './QuestionBlock'

// Render a group of questions (from questionGroups) with the appropriate header/UI
export default function GroupBlock({ group, answers, onAnswer, globalOffset, previewMode, showAnswers }) {
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
                className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-[var(--border)] focus:border-[var(--primary)]'} outline-none px-1 py-0.5 text-sm w-24 bg-white transition text-center`}
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
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
          {(group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3 last:mb-0">
              {ns.title && <div className="font-bold text-gray-700 mb-1.5 border-b border-gray-200 pb-1">{ns.title}</div>}
              <ul className="space-y-2">
                {(ns.lines || []).map((line, li) => (
                  line.lineType === 'heading'
                    ? <li key={li} className="list-none font-bold text-slate-800 text-[0.95rem] pt-1 pb-0.5">{line.contentWithTokens || line.content || ''}</li>
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
