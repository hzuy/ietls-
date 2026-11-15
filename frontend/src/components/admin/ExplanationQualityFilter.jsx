import { EXPLANATION_ATTENTION_LABELS } from '../../utils/explanationPresentation'
import { useMemo, useRef } from 'react'

const REASONS = EXPLANATION_ATTENTION_LABELS

/** Saved explanation quality is independent of the current generation attempt. */
export default function ExplanationQualityFilter({ sections = [], groups = [], onOpenQuestion }) {
  const rootRef = useRef(null)
  const questions = useMemo(() => {
    const results = new Map()
    for (const group of [...groups, ...sections.flatMap(section => section.questionGroups || [])]) {
      for (const question of group.questions || []) {
        let explanation = question.explanation || group.explanations?.[question.number]
        if (typeof explanation === 'string') { try { explanation = JSON.parse(explanation) } catch { continue } }
        if (!REASONS[explanation?.status] || explanation.status === 'draft_ready') continue
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
  return <details ref={rootRef} className="mb-4 border-b border-zinc-200 text-zinc-700">
    <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Cần kiểm tra lời giải ({questions.length})</summary>
    <ul className="m-0 flex list-none flex-wrap gap-1.5 px-0 pb-3">
      {questions.map(question => <li key={question.number}>
        <button type="button" onClick={() => open(question)}
          aria-label={`Xem câu ${question.number} · ${REASONS[question.reason]}`}
          title={REASONS[question.reason]}
          className="min-h-11 min-w-12 rounded-lg border border-zinc-200 bg-white px-3 text-xs tabular-nums hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer">
          Câu {question.number}
        </button>
      </li>)}
    </ul>
  </details>
}
