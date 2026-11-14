import React, { useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Loader2, RotateCcw, X } from 'lucide-react'
import { copyRunReportText, getRunProgress, retryableNumbers, redactRunTechnical } from '../../utils/explanationRunReport'

const TITLES = {
  running: 'Đang sinh giải thích AI', partial: 'Đã sinh xong một phần',
  blocked: 'Chưa thể sinh giải thích', cancelled: 'Đã dừng sinh giải thích',
  interrupted: 'Lần sinh trước bị gián đoạn', done: 'Đã sinh giải thích xong',
}

/** One task surface for all four editors. Reading details never starts a request. */
export default function ExplanationRunPanel({
  report = null, isGenerating = false, isCancelling = false, progress = null,
  onCancel, onRetryFailed, onOpenGroup, onOpenQuestion, onResume, onDismiss, className = '',
}) {
  const [copyState, setCopyState] = useState('idle')
  const [disclosure, setDisclosure] = useState(null)
  const panelRef = useRef(null)
  const summaryRef = useRef(null)
  const detailsId = useId()
  const status = isGenerating ? 'running' : (report?.status || 'done')
  const runKey = report?.startedAt || 'remote'
  const expanded = disclosure?.key === runKey ? disclosure.open : status === 'blocked'
  const stats = getRunProgress(report, progress)
  const rows = report?.rows || []
  const needsRetry = report?.needsRetry || []
  const retryNumbers = useMemo(() => retryableNumbers(report), [report])
  const errorNumbers = [...new Set(rows.filter(row => row.attempted !== false).map(row => Number(row.number)).filter(Boolean))]
  const groupedErrors = useMemo(() => {
    const groups = new Map()
    for (const row of report?.rows || []) {
      const key = `${row.kind}:${row.message}:${row.hint}`
      const entry = groups.get(key) || { ...row, questions: [] }
      if (row.number && !entry.questions.some(q => q.number === row.number)) entry.questions.push(row)
      groups.set(key, entry)
    }
    return [...groups.values()]
  }, [report])
  if (!report && !isGenerating) return null
  const issues = rows.length > 0 || needsRetry.length > 0
  const Icon = isGenerating ? Loader2 : issues || status === 'interrupted' ? AlertTriangle : CheckCircle2
  const reveal = () => {
    setDisclosure({ key: runKey, open: true })
    setTimeout(() => summaryRef.current?.focus(), 0)
  }
  const openQuestion = row => {
    if (onOpenQuestion) return onOpenQuestion(row.number, row.groupId)
    const root = panelRef.current?.closest('form, fieldset')
    const button = root?.querySelector(`[data-explanation-question="${Number(row.number)}"]`)
    if (button) button.click()
    else if (onOpenGroup && row.groupId != null) onOpenGroup(row.groupId)
  }
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(redactRunTechnical(copyRunReportText(report)))
      setCopyState('done')
    } catch { setCopyState('error') }
  }
  const buttonClass = 'min-h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  return (
    <section ref={panelRef} data-testid="explanation-run-panel" data-status={status}
      aria-label="Báo cáo sinh giải thích AI"
      className={`${isGenerating ? 'sm:sticky sm:top-20 z-30' : ''} scroll-mt-28 rounded-xl border border-zinc-200 bg-white text-zinc-800 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h4 className="m-0 flex items-center gap-2 text-sm font-semibold">
            <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${isGenerating && !isCancelling ? 'animate-spin motion-reduce:animate-none' : ''} ${issues && !isGenerating ? 'text-amber-700' : 'text-zinc-600'}`} />
            {isCancelling ? 'Đang dừng…' : TITLES[status] || TITLES.partial}
          </h4>
          {isGenerating && (isCancelling || progress?.groupLabel || report?.scope === 'retry') && <p className="mt-1 mb-0 text-xs text-zinc-500 break-words">{isCancelling
            ? 'Đang hủy yêu cầu hiện tại. Các câu đã lưu vẫn được giữ lại.'
            : progress?.groupLabel || (report?.scope === 'retry' ? 'Đang thử lại các câu đã chọn…' : 'Đang xử lý các câu trong lượt này…')}</p>}
          {status === 'interrupted' && <p className="mt-1 mb-0 text-xs text-zinc-600">Đây là kết quả gần nhất trước khi mất kết nối. Kiểm tra lời giải đã lưu trước khi tạo tiếp.</p>}
        </div>
        {isGenerating && onCancel && <button type="button" onClick={onCancel} disabled={isCancelling} className={buttonClass}>{isCancelling ? 'Đang dừng…' : 'Dừng tạo'}</button>}
        {!isGenerating && onDismiss && <button type="button" onClick={onDismiss} aria-label="Đóng báo cáo sinh giải thích" className="h-9 w-9 shrink-0 rounded-lg text-zinc-500 hover:bg-zinc-100 cursor-pointer"><X aria-hidden="true" className="mx-auto h-4 w-4" /></button>}
      </div>
      {isGenerating && stats.total > 0 && <div className="px-4 pb-3">
        <div role="progressbar" aria-label="Tiến trình xử lý câu hỏi" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.processed}
          className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-zinc-700 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${stats.percent}%` }} />
        </div>
        <p className="mt-2 mb-0 text-xs tabular-nums text-zinc-600">Đã xử lý {stats.processed}/{stats.total} câu · {stats.percent}%</p>
      </div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 text-xs" data-testid="explanation-run-counts">
        <span aria-live="polite" className="tabular-nums">Đã lưu {stats.generated} câu</span>
        {rows.length > 0 && <button type="button" onClick={reveal} aria-expanded={expanded} aria-controls={detailsId} className="min-h-8 text-rose-700 font-semibold underline underline-offset-4 cursor-pointer">{errorNumbers.length ? `${errorNumbers.length} câu lỗi` : 'Lỗi tác vụ'} — xem chi tiết</button>}
        {needsRetry.length > 0 && <button type="button" onClick={reveal} aria-expanded={expanded} aria-controls={detailsId} className="min-h-8 text-amber-800 font-semibold underline underline-offset-4 cursor-pointer">{new Set(needsRetry.map(row => row.number)).size} câu cần kiểm tra</button>}
        {stats.remaining > 0 && <span className="text-zinc-500 tabular-nums">{isGenerating ? 'Còn' : 'Chưa xử lý'} {stats.remaining} câu</span>}
        {status === 'done' && !issues && !stats.generated && <span className="text-zinc-500">Không có câu nào cần sinh (có thể đã có lời giải).</span>}
        {!isGenerating && report?.scope === 'retry' && <span className="text-zinc-500">Phạm vi: thử lại các câu đã chọn</span>}
        {!isGenerating && onResume && <button type="button" onClick={onResume} className={buttonClass}>Tạo các câu chưa có lời giải</button>}
      </div>
      {issues && <div id={detailsId} hidden={!expanded} role="region" aria-label="Chi tiết lỗi sinh AI" className="border-t border-zinc-200">
        <div className="flex min-h-11 items-center justify-between gap-2 px-4 py-2">
          <h5 ref={summaryRef} tabIndex={-1} className="m-0 text-xs font-semibold outline-none">Lỗi và câu cần kiểm tra</h5>
          <button type="button" onClick={() => setDisclosure({ key: runKey, open: false })} className="min-h-9 px-2 text-xs text-zinc-600 hover:text-zinc-950 cursor-pointer">Thu gọn</button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto overscroll-contain space-y-3 px-4 pb-4">
          {report?.scopeNumbers && rows.some(row => row.number && !report.scopeNumbers.includes(Number(row.number))) && <p className="m-0 text-xs text-zinc-500">Danh sách vẫn giữ lỗi ngoài phạm vi thử lại; tiến trình chỉ tính các câu đã chọn.</p>}
          {groupedErrors.map((entry, index) => <div key={index} role={status === 'blocked' ? 'alert' : undefined} className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
            <p className="m-0 text-sm font-medium break-words">{entry.message}</p>
            {entry.hint && <p className="mt-1 mb-0 text-xs leading-relaxed text-zinc-600">{entry.hint}</p>}
            {entry.validationIssues?.length > 0 && <ul className="mt-2 pl-4 text-xs leading-relaxed">{entry.validationIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
            <div className="mt-2 flex flex-wrap gap-2">{entry.questions.map(row => <button type="button" key={row.number} onClick={() => openQuestion(row)} className={buttonClass}>Xem câu {row.number}</button>)}</div>
          </div>)}
          {needsRetry.map(row => <div key={`${row.groupId}:${row.number}`} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
            <p className="m-0 text-xs font-semibold">Câu {row.number} · Cần kiểm tra lại (kết quả dự phòng chưa chắc chắn)</p>
            <p className="mt-1 mb-2 text-xs text-zinc-600">{row.message}</p>
            <button type="button" onClick={() => openQuestion(row)} className={buttonClass}>Xem câu {row.number}</button>
          </div>)}
          {rows.some(row => row.technical) && <details className="rounded-lg border border-zinc-200 px-3 py-2">
            <summary className="cursor-pointer text-xs text-zinc-600">Chi tiết kỹ thuật</summary>
            <pre className="mt-2 mb-0 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{[...new Set(rows.filter(row => row.technical).map(row => redactRunTechnical(row.technical)))].join('\n')}</pre>
          </details>}
          <div className="flex flex-wrap gap-2">
            {retryNumbers.length > 0 && <button type="button" disabled={isGenerating || !onRetryFailed} onClick={() => onRetryFailed?.(retryNumbers)} className={buttonClass}><RotateCcw aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />Thử lại {retryNumbers.length} câu lỗi</button>}
            {rows.length > 0 && <button type="button" onClick={copy} className={buttonClass}><Copy aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" /><span aria-live="polite">{copyState === 'done' ? 'Đã sao chép' : 'Sao chép chi tiết'}</span></button>}
          </div>
          {isGenerating && <p className="m-0 text-xs text-zinc-500">Bạn vẫn có thể xem câu. Thử lại và chỉnh sửa sẽ được mở khi lượt hiện tại dừng.</p>}
          {copyState === 'error' && <p role="alert" className="m-0 text-xs text-rose-700">Không sao chép được. Hãy mở chi tiết kỹ thuật và sao chép thủ công.</p>}
        </div>
      </div>}
    </section>
  )
}
