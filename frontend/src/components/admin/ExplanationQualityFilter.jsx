import { useMemo, useRef, useState } from 'react'
import { collectExplanationIssues } from '../../utils/explanationIssues'
import { retryableNumbers, redactRunTechnical } from '../../utils/explanationRunReport'

export default function ExplanationQualityFilter({ sections = [], groups = [], report = null, issues = null,
  isGenerating = false, onOpenQuestion, onOpenGroup, onRetryFailed }) {
  const rootRef = useRef(null)
  const [disclosure, setDisclosure] = useState(null)
  const collected = useMemo(() => issues || collectExplanationIssues({ sections, groups, report }), [issues, sections, groups, report])
  const { questions, general, report: activeReport } = collected
  const retryNumbers = retryableNumbers(activeReport)
  if (!questions.length && !general.length) return null
  const runKey = activeReport?.startedAt || 'saved'
  const expanded = disclosure?.key === runKey ? disclosure.open : activeReport?.status === 'blocked'
  const open = question => {
    if (onOpenQuestion) return onOpenQuestion(question.number, question.groupId)
    const button = rootRef.current?.closest('form, fieldset')?.querySelector(`[data-explanation-question="${question.number}"]`)
    if (button) button.click()
    else if (onOpenGroup && question.groupId != null) onOpenGroup(question.groupId)
  }
  return <details ref={rootRef} open={expanded} onToggle={event => setDisclosure({ key: runKey, open: event.currentTarget.open })}
    className="border-b border-zinc-200 text-zinc-700">
    <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
      Cần kiểm tra lời giải{questions.length ? ` (${questions.length})` : ''}
    </summary>
    {general.map((row, index) => <div key={row.id || index} role="alert" className="mb-3 text-xs text-rose-800">
      <p className="m-0 break-words">{redactRunTechnical(row.message)}</p>
      {row.validationIssues?.length > 0 && <ul className="mt-1 mb-0 pl-4">{row.validationIssues.map((issue, i) => <li key={i}>{redactRunTechnical(issue)}</li>)}</ul>}
    </div>)}
    <ul className="m-0 flex list-none flex-wrap gap-1.5 px-0 pb-3">
      {questions.map(question => <li key={question.number}>
        <button type="button" onClick={() => open(question)}
          aria-label={`Xem câu ${question.number} · ${question.message}`} title={question.message}
          className="min-h-11 min-w-12 rounded-lg border border-zinc-200 bg-white px-3 text-xs tabular-nums hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer">
          Câu {question.number}
        </button>
      </li>)}
    </ul>
    {retryNumbers.length > 0 && <button type="button" disabled={isGenerating || !onRetryFailed} onClick={() => onRetryFailed?.(retryNumbers)}
      className="mb-3 min-h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
      Thử lại {retryNumbers.length} câu lỗi
    </button>}
  </details>
}
