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
              <span className="text-xs font-bold text-zinc-900 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full mr-1">{qNum}</span>
              <input type="text" value={val}
                onChange={e => q && onAnswer(q.id, e.target.value)}
                placeholder="..."
                className="border border-zinc-300 focus:border-zinc-900 outline-none px-3 py-0.5 text-sm w-28 rounded-full bg-white text-zinc-900 transition text-center" />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })
    }
    return (
      <div id={`q-${from}`} className="mb-6 scroll-mt-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-semibold text-zinc-900 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-zinc-600 text-xs">{group.instruction}</p>}
        </div>
        <div className="rounded-2xl p-5 text-sm bg-white border border-zinc-200 shadow-xs">
          {(group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3 last:mb-0">
              {ns.title && <div className="font-semibold text-zinc-900 mb-1.5 border-b border-zinc-200 pb-1">{ns.title}</div>}
              <ul className="space-y-2">
                {(ns.lines || []).map((line, li) => (
                  line.lineType === 'heading'
                    ? <li key={li} className="list-none font-semibold text-zinc-900 text-[0.95rem] pt-1 pb-0.5">{line.contentWithTokens || line.content || ''}</li>
                    : <li key={li} className="flex items-start gap-1.5 text-zinc-700 leading-relaxed">
                        <span className="text-zinc-400 mt-1 shrink-0">•</span>
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
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-semibold text-zinc-900 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-zinc-600 text-xs mb-1">{group.instruction}</p>}
          <p className="text-zinc-400 text-xs italic">You may use any letter more than once.</p>
        </div>
        <MatchingTickGrid letters={letters} questions={group.questions || []} answers={answers} onAnswer={onAnswer} accentColor="zinc" />
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
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-semibold text-zinc-900 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-zinc-600 text-xs">{group.instruction}</p>}
        </div>
        {(group.questions || []).map((q, qi) => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          const combined = answers[q.id] || ''
          const selected = combined.split(',').filter(Boolean)
          const limitReached = selected.length >= maxChoices
          return (
            <div key={q.id} className="mb-4">
              {q.questionText && (
                <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2">
                  <span className="font-bold text-zinc-700 shrink-0">{from + qi * maxChoices}–{from + qi * maxChoices + maxChoices - 1}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const checked = selected.includes(opt)
                  const disabled = !checked && limitReached
                  return (
                    <label key={oi} className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition
                      ${checked ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium cursor-pointer'
                      : disabled ? 'border border-transparent text-zinc-300 cursor-not-allowed'
                      : 'hover:bg-zinc-50 border border-transparent text-zinc-700 cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} className="accent-zinc-900"
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
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-semibold text-zinc-900 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-zinc-600 text-xs">{group.instruction}</p>}
        </div>
        {(group.questions || []).map(q => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          return (
            <div key={q.id} id={`q-${q.number}`} className="mb-5 scroll-mt-4">
              <p className="text-sm text-zinc-900 mb-2 flex gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
                <span>{q.questionText}</span>
              </p>
              <div className="space-y-1.5 pl-8">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const isSelected = answers[q.id] === opt
                  return (
                    <label key={oi} className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition cursor-pointer
                      ${isSelected ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium' : 'hover:bg-zinc-50 border border-transparent text-zinc-700'}`}>
                      <input type="radio" name={`q${q.id}`} checked={isSelected} onChange={() => onAnswer(q.id, opt)} className="accent-zinc-900 shrink-0" />
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
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-semibold text-zinc-900 mb-1">Questions {from}–{to}</p>
          {group.instruction && <p className="text-zinc-600 text-xs">{group.instruction}</p>}
        </div>
        {(group.questions || []).map(q => (
          <div key={q.id} id={`q-${q.number}`} className="mb-6 scroll-mt-4">
            <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
              <span>{q.questionText}</span>
            </p>
            <div className="space-y-1.5 pl-8">
              {tfOpts.map(opt => {
                const isSelected = answers[q.id] === opt
                return (
                  <label key={opt} className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition cursor-pointer
                    ${isSelected ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium' : 'hover:bg-zinc-50 border border-transparent text-zinc-700'}`}>
                    <input type="radio" name={`q${q.id}`} checked={isSelected} onChange={() => onAnswer(q.id, opt)} className="accent-zinc-900 shrink-0" />
                    <span>{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default: text input
  return (
    <div id={`q-${from}`} className="mb-6 scroll-mt-4">
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
        <p className="font-semibold text-zinc-900 mb-1">Questions {from}–{to}</p>
        {group.instruction && <p className="text-zinc-600 text-xs">{group.instruction}</p>}
      </div>
      {(group.questions || []).map(q => (
        <div key={q.id} id={`q-${q.number}`} className="mb-6 scroll-mt-4">
          <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
            <span>{q.questionText}</span>
          </p>
          <div className="pl-8">
            <input type="text" value={answers[q.id] || ''} onChange={e => onAnswer(q.id, e.target.value)}
              placeholder="Nhập đáp án..."
              className="border-b-2 border-zinc-300 focus:border-zinc-900 outline-none px-2 py-1 text-sm w-64 bg-transparent text-zinc-900 transition" />
          </div>
        </div>
      ))}
    </div>
  )
}
