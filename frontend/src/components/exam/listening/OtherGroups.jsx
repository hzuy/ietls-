import TableCompletionRender from '../../TableCompletionRender'
import DragWordBankGroup from '../../DragWordBankGroup'
import MatchingDragGroup from '../../MatchingDragGroup'
import DiagramLabelGroup from '../../DiagramLabelGroup'
import MatchingHeadingsGroup from '../../MatchingHeadingsGroup'
import NoteCompletionGroup from './NoteCompletionGroup'
import MCQGroup from './MCQGroup'
import MapDiagramGroup from './MapDiagramGroup'

function InstructionBanner({ group }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
      <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-gray-700">{group.instruction}</p>}
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
              <span className="font-bold text-[var(--primary-hover)] mr-2">{mo.optionLetter}.</span>{mo.optionText}
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

// ── Dispatcher ────────────────────────────────────────────────────────────────
export function GroupBlock({ group, answers, onAnswer, previewMode, showAnswers }) {
  if (group.type === 'note_completion') return <NoteCompletionGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'table_completion') return <TableCompletionRender group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'mcq')             return <MCQGroup group={group} answers={answers} onAnswer={onAnswer} isMulti={false} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'mcq_multi')       return <MCQGroup group={group} answers={answers} onAnswer={onAnswer} isMulti={true} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'map_diagram')     return <MapDiagramGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'matching')        return <MatchingGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'drag_word_bank')  return <div id={`question-${group.qNumberStart}`} className="scroll-mt-4"><DragWordBankGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} /></div>
  if (group.type === 'matching_drag')   return <div id={`question-${group.qNumberStart}`} className="scroll-mt-4"><MatchingDragGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} /></div>
  if (group.type === 'diagram_label')    return <DiagramLabelGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  if (group.type === 'matching_headings') return <MatchingHeadingsGroup group={group} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
  return null
}

// ── Legacy direct-question support ───────────────────────────────────────────
export function QuestionBlock({ q, globalIdx, answers, onAnswer, previewMode, showAnswers }) {
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
      {q.type === 'fill_blank' && (
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

export function groupByType(questions) {
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
