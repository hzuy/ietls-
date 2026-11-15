import { useMemo } from 'react'
import { getRunProgress } from '../../utils/explanationRunReport'
import { collectExplanationIssues } from '../../utils/explanationIssues'
import ExplanationQualityFilter from './ExplanationQualityFilter'

/** One issue list for saved explanations and the current AI run. */
export default function ExplanationRunPanel({ report = null, sections = [], groups = [], isGenerating = false,
  isCancelling = false, progress = null, onCancel, onRetryFailed, onOpenQuestion, onOpenGroup, className = '' }) {
  const issues = useMemo(() => collectExplanationIssues({ report, sections, groups }), [report, sections, groups])
  const stats = getRunProgress(report, progress)
  if (!isGenerating && !issues.questions.length && !issues.general.length) return null
  return <section data-testid="explanation-run-panel" data-status={isGenerating ? 'running' : report?.status || 'saved'}
    aria-label="Trạng thái lời giải" className={`min-w-0 ${className}`}>
    {isGenerating && <div className="mb-1 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
        <span aria-live="polite" className="min-w-0 tabular-nums">{isCancelling ? 'Đang dừng…' : 'Đang sinh giải thích AI'}{stats.total > 0 ? ` · Đã xử lý ${stats.processed}/${stats.total} câu · ${stats.percent}%` : ''}</span>
        {onCancel && <button type="button" onClick={onCancel} disabled={isCancelling}
          className="min-h-9 rounded-lg border border-zinc-200 px-3 text-xs hover:bg-zinc-50 focus-visible:outline-2 disabled:opacity-50 cursor-pointer">{isCancelling ? 'Đang dừng…' : 'Dừng tạo'}</button>}
      </div>
      {stats.total > 0 && <div role="progressbar" aria-label="Tiến trình xử lý câu hỏi" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.processed}
        className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full w-full origin-left rounded-full bg-zinc-600 transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${stats.percent / 100})` }} />
      </div>}
    </div>}
    <ExplanationQualityFilter issues={issues} isGenerating={isGenerating} onOpenQuestion={onOpenQuestion} onOpenGroup={onOpenGroup} onRetryFailed={onRetryFailed} />
  </section>
}
