import { EXPLANATION_ATTENTION_LABELS } from '../../utils/explanationPresentation'
import { useMemo, useRef, useState } from 'react'

const REASONS = EXPLANATION_ATTENTION_LABELS

/** Saved explanation quality is independent of the current generation attempt. */
export default function ExplanationQualityFilter({ sections = [], groups = [], onOpenQuestion }) {
  const [reason, setReason] = useState('all')
  const rootRef = useRef(null)
  const questions = useMemo(() => {
    const results = new Map()
    for (const group of [...groups, ...sections.flatMap(section => section.questionGroups || [])]) {
      for (const question of group.questions || []) {
        let explanation = question.explanation || group.explanations?.[question.number]
        if (typeof explanation === 'string') { try { explanation = JSON.parse(explanation) } catch { continue } }
        if (!REASONS[explanation?.status]) continue
        results.set(Number(question.number), { number: Number(question.number), reason: explanation.status, groupId: group.id ?? group._id })
      }
    }
    return [...results.values()].sort((a, b) => a.number - b.number)
  }, [groups, sections])
  if (!questions.length) return null
  const open = question => {
    if (onOpenQuestion) return onOpenQuestion(question.number, question.groupId)
    rootRef.current?.closest('form, fieldset')?.querySelector(`[data-explanation-question="${question.number}"]`)?.click()
  }
  return <details ref={rootRef} className="mb-4 rounded-lg border border-zinc-200 bg-white text-zinc-700">
    <summary className="min-h-11 cursor-pointer px-4 py-3 text-xs font-semibold focus-visible:outline-2">Cần kiểm tra lời giải ({questions.length})</summary>
    <div className="space-y-3 px-4 pb-4">
      <p className="m-0 text-xs text-zinc-500">Mở câu để xem lý do và xử lý.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc lý do cần kiểm tra lời giải">
        {[['all', 'Tất cả'], ...Object.entries(REASONS)].map(([key, label]) => <button type="button" key={key} onClick={() => setReason(key)} aria-pressed={reason === key}
          className={`min-h-9 rounded-lg border px-3 text-xs cursor-pointer focus-visible:outline-2 ${reason === key ? 'border-zinc-800 bg-zinc-800 text-white' : 'border-zinc-200 hover:bg-zinc-50'}`}>{label} ({questions.filter(q => key === 'all' || q.reason === key).length})</button>)}
      </div>
      <ul className="m-0 list-none space-y-2 p-0">
        {questions.filter(q => reason === 'all' || q.reason === reason).map(question => <li key={question.number}>
          <button type="button" onClick={() => open(question)} className="min-h-9 text-left text-xs font-medium underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 cursor-pointer">Xem câu {question.number} · {REASONS[question.reason]}</button>
        </li>)}
      </ul>
    </div>
  </details>
}
