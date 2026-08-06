import MatchingTickGrid from '../MatchingTickGrid'
import DragWordBankGroup from '../DragWordBankGroup'
import MatchingDragGroup from '../MatchingDragGroup'
import DiagramLabelGroup from '../DiagramLabelGroup'
import MatchingHeadingsGroup from '../MatchingHeadingsGroup'
import TableCompletionRender from '../TableCompletionRender'

// ─── Reading Practice group block (full rendering for all question types) ──────
export default function ReadingPracticeGroupBlock({ group, answers, onAnswer }) {
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
                className="border-b-2 border-[#e2e8f0] focus:border-[#3B82F6] outline-none px-1 py-0.5 text-sm w-24 bg-white transition text-center" />
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
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
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
