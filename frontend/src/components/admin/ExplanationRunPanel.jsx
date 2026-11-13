import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, Loader2, RotateCcw, X,
} from 'lucide-react'
import { copyRunReportText, getRunReportCounts, retryableNumbers } from '../../utils/explanationRunReport'

const STATUS_META = {
  running: {
    title: 'Đang sinh giải thích AI',
    tone: 'border-sky-300 bg-sky-50/70 text-sky-900',
    icon: Loader2,
  },
  partial: {
    title: 'Đã sinh xong một phần',
    tone: 'border-amber-300 bg-amber-50/80 text-amber-950',
    icon: AlertTriangle,
  },
  blocked: {
    title: 'Chưa thể sinh giải thích',
    tone: 'border-rose-300 bg-rose-50/80 text-rose-950',
    icon: AlertTriangle,
  },
  cancelled: {
    title: 'Đã dừng sinh giải thích',
    tone: 'border-amber-300 bg-amber-50/70 text-amber-950',
    icon: AlertTriangle,
  },
  interrupted: {
    title: 'Lần sinh trước bị gián đoạn',
    tone: 'border-amber-300 bg-amber-50/70 text-amber-950',
    icon: AlertTriangle,
  },
  done: {
    title: 'Đã sinh giải thích xong',
    tone: 'border-emerald-300 bg-emerald-50/70 text-emerald-950',
    icon: CheckCircle2,
  },
}

/**
 * Báo cáo trong phiên cho một lần sinh giải thích AI (Cambridge Exam).
 *
 * Ba trạng thái: đang chạy (có huỷ, tiến trình), kết quả một phần (danh sách câu lỗi
 * + lý do + thử lại), hoàn tất. Không dùng window.alert; mọi thứ nằm trong trang
 * và đọc được bởi screen reader qua aria-live.
 */
export default function ExplanationRunPanel({
  report = null,
  isGenerating = false,
  isCancelling = false,
  progress = null,
  onCancel,
  onRetryFailed,
  onOpenGroup,
  onDismiss,
  className = '',
}) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const panelRef = useRef(null)
  const revealedReportRef = useRef(null)

  const counts = useMemo(() => getRunReportCounts(report), [report])
  const retryNumbers = useMemo(() => retryableNumbers(report), [report])
  const finishedReportKey = report?.finishedAt ? `${report.startedAt}:${report.finishedAt}` : null
  const hasIssues = counts.errors > 0 || counts.needsRetry > 0

  useEffect(() => {
    if (isGenerating || !hasIssues || !finishedReportKey || revealedReportRef.current === finishedReportKey) return
    revealedReportRef.current = finishedReportKey
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    panelRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }, [finishedReportKey, hasIssues, isGenerating])

  if (!report && !isGenerating) return null

  const status = isGenerating ? 'running' : (report?.status || 'done')
  const meta = STATUS_META[status] || STATUS_META.done
  const Icon = isGenerating ? Loader2 : meta.icon

  const current = Number(progress?.current) || 0
  const total = Number(progress?.total) || Number(report?.totalQuestions) || 0
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const rows = report?.rows || []
  const needsRetry = report?.needsRetry || []

  const handleCopy = async () => {
    const text = copyRunReportText(report)
    setCopyError(false)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setCopyError(true)
    }
  }

  return (
    <section
      ref={panelRef}
      data-testid="explanation-run-panel"
      data-status={status}
      aria-label="Báo cáo sinh giải thích AI"
      className={`scroll-mt-28 rounded-xl border shadow-xs overflow-hidden [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 ${meta.tone} ${className}`}
    >
      <div className="px-3.5 py-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isGenerating && !isCancelling ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="text-xs font-bold m-0">
                {isCancelling ? 'Đang dừng tiến trình sinh AI...' : meta.title}
              </h4>
              <span
                className="text-[11px] font-medium tabular-nums opacity-80"
                data-testid="explanation-run-counts"
                aria-live="polite"
              >
                {counts.generated > 0 ? `Đã xong ${counts.generated} câu` : null}
                {counts.totalQuestions > 0 ? `${counts.generated > 0 ? ' · ' : ''}mục tiêu ${counts.totalQuestions} câu` : null}
                {counts.errors > 0 ? ` · ${counts.errors} lỗi` : null}
                {counts.needsRetry > 0 ? ` · ${counts.needsRetry} cần kiểm tra` : null}
              </span>
            </div>

            {isGenerating && (
              <p className="text-[11px] opacity-80 m-0">
                {isCancelling
                  ? 'Nhóm đang chạy sẽ hoàn tất rồi dừng; các câu đã xong đã được lưu.'
                  : (progress?.groupLabel || progress?.label || 'Đang khởi tạo...')}
              </p>
            )}
            {status === 'done' && counts.errors === 0 && (
              <p className="text-[11px] opacity-80 m-0">Không có câu nào bị lỗi trong lần chạy này.</p>
            )}
            {status === 'done' && counts.generated === 0 && counts.errors === 0 && (
              <p className="text-[11px] opacity-80 m-0">Không có câu nào cần sinh (có thể đã có lời giải).</p>
            )}
            {status === 'cancelled' && (
              <p className="text-[11px] opacity-80 m-0">Các câu đã hoàn thành trước khi hủy vẫn được giữ nguyên.</p>
            )}
            {status === 'interrupted' && (
              <p className="text-[11px] opacity-80 m-0">Tab/trình duyệt đã đóng khi đang chạy. Bạn có thể sinh tiếp các câu còn thiếu.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isGenerating && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="h-7 px-2.5 rounded-lg border border-current/20 bg-white/70 text-[11px] font-semibold hover:bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? 'Đang dừng...' : 'Hủy sinh'}
            </button>
          )}
          {!isGenerating && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-7 h-7 rounded-lg border border-current/15 bg-white/60 hover:bg-white transition flex items-center justify-center cursor-pointer"
              title="Đóng báo cáo"
              aria-label="Đóng báo cáo sinh giải thích"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isGenerating && total > 0 && (
        <div className="h-1 w-full bg-black/10" aria-hidden="true">
          <div
            className={`h-full transition-all duration-300 ${isCancelling ? 'bg-amber-500' : 'bg-sky-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {(rows.length > 0 || needsRetry.length > 0) && (
        <div className="px-3.5 pb-3 space-y-2">
          {rows.length > 0 && (
            <ul className="space-y-1.5 m-0 p-0 list-none">
              {rows.map((row, idx) => (
                <li
                  key={row.id || `${row.number}-${idx}`}
                  className="rounded-lg border border-current/15 bg-white/70 px-2.5 py-2 flex flex-wrap items-start justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5 break-words [overflow-wrap:anywhere]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold">
                        {row.number ? `Câu ${row.number}` : 'Cả đề'}
                      </span>
                      {row.groupLabel && (
                        <span className="text-[10px] font-medium opacity-70">{row.groupLabel}</span>
                      )}
                    </div>
                    <p className="text-[11px] m-0 leading-snug">{row.message}</p>
                    {row.hint && <p className="text-[10px] m-0 opacity-75 leading-snug">{row.hint}</p>}
                  </div>
                  {onOpenGroup && row.groupId != null && (
                    <button
                      type="button"
                      onClick={() => onOpenGroup(row.groupId)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md border border-current/20 bg-white hover:bg-white/60 transition cursor-pointer shrink-0"
                    >
                      Mở nhóm
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {needsRetry.length > 0 && (
            <div className="rounded-lg border border-amber-300/70 bg-amber-100/50 px-2.5 py-2">
              <p className="text-[11px] font-semibold m-0 mb-1">Cần kiểm tra lại (kết quả dự phòng chưa chắc chắn)</p>
              <p className="text-[11px] m-0 opacity-80">
                {needsRetry.map(item => `Câu ${item.number}`).join(', ')}
                {' — '}
                {needsRetry[0]?.message || 'Nên mở từng câu để xem lại lời giải.'}
              </p>
            </div>
          )}

          {rows.some(row => row.technical) && (
            <details open className="rounded-lg border border-current/15 bg-white/60 px-2.5 py-2">
              <summary className="text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
                Chi tiết kỹ thuật
              </summary>
              <pre className="mt-2 mb-0 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug opacity-80">
                {rows.filter(row => row.technical).map(row => `${row.number ? `Câu ${row.number}: ` : ''}${row.technical}`).join('\n')}
              </pre>
            </details>
          )}

          {!isGenerating && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {retryNumbers.length > 0 && onRetryFailed && (
                <button
                  type="button"
                  onClick={() => onRetryFailed(retryNumbers)}
                  className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-[11px] font-semibold hover:bg-zinc-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Thử lại {retryNumbers.length} câu lỗi
                </button>
              )}
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-8 px-3 rounded-lg border border-current/20 bg-white/70 text-[11px] font-semibold hover:bg-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span aria-live="polite">{copied ? 'Đã sao chép' : 'Sao chép chi tiết'}</span>
                </button>
              )}
            </div>
          )}
          {copyError && <p role="alert" className="text-xs m-0">Không sao chép được. Hãy mở chi tiết kỹ thuật và sao chép thủ công.</p>}
        </div>
      )}
    </section>
  )
}
