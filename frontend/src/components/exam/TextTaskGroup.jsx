import { lineText } from '../../utils/noteLine'

export default function TextTaskGroup({ group, answers = {}, onAnswer, previewMode, showAnswers, numberKeys = false, listening = false }) {
  const questions = group.questions || []
  const input = q => {
    if (!q) return null
    const key = numberKeys ? q.number : q.id
    return <label className="inline-flex items-center gap-2 mx-1">
      <span className="text-xs font-semibold text-zinc-800">{q.number}</span>
      <input name={`answer-${q.number}`} autoComplete="off" aria-label={`Answer ${q.number}`} className="w-36 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300" value={previewMode && showAnswers ? q.correctAnswer || '' : answers[key] || ''} readOnly={previewMode} onChange={e => onAnswer?.(key, e.target.value)} />
    </label>
  }
  const tokens = text => String(text || '').split(/(\[Q:\d+\])/).map((part, i) => {
    const match = part.match(/^\[Q:(\d+)\]$/)
    return <span key={i}>{match ? input(questions.find(q => q.number === Number(match[1]))) : part}</span>
  })
  const sections = group.noteSections || []
  return <div id={`${listening ? 'question' : 'q'}-${group.qNumberStart}`} className="mb-6">
    <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <p className="font-semibold text-zinc-900">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      <p className="mt-1 text-zinc-600">{group.instruction}</p>
    </div>
    {sections.length ? sections.map((section, si) => <div key={si} className="mb-4">
      {section.title && <h3 className="mb-3 font-semibold text-zinc-900">{section.title}</h3>}
      <div className="space-y-3 text-sm leading-9 text-zinc-800">
        {(section.lines || []).map((line, li) => <div key={li}>
          {group.type === 'flow_chart_completion' && li > 0 && <div aria-hidden="true" className="text-center text-zinc-500">↓</div>}
          <p className={line.lineType === 'heading' ? 'font-semibold' : group.type === 'flow_chart_completion' ? 'rounded-lg border border-zinc-200 p-3' : ''}>{tokens(lineText(line))}</p>
        </div>)}
      </div>
    </div>) : <div className="space-y-4">{questions.map(q => <div key={q.id ?? q.number} id={`${listening ? 'question' : 'q'}-${q.number}`} className="flex flex-wrap items-center gap-2 text-sm text-zinc-900"><span>{q.questionText}</span>{input(q)}</div>)}</div>}
  </div>
}
