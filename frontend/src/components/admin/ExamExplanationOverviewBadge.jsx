import React from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'

/**
 * Overview badge for Cambridge Exam AI explanations (Batch 2 - Requirement 3.3).
 *
 * Rules:
 * - Monochrome / gray palette (border-zinc-200 / border-zinc-300 / zinc text).
 * - Clear text labels for all states, not relying on color alone.
 * - Excludes groups that cannot be explained (missing image / not supported) from the denominator.
 * - Số liệu của lần sinh AI gần nhất (lỗi / cần kiểm tra) do run report cung cấp,
 *   không lấy từ DB, và chỉ hiển thị khi có vấn đề.
 */
export default function ExamExplanationOverviewBadge({
  stats,
  compact = false,
  runErrorCount = 0,
  runAttentionCount = 0,
  onOpenRunPanel = null,
  className = ''
}) {
  const hasStats = Boolean(stats && (stats.supportedSlots > 0 || stats.unsupportedSlots > 0))
  const hasRunIssues = runErrorCount > 0 || runAttentionCount > 0

  if (!hasStats && !hasRunIssues) return null

  const tooltipText = hasStats
    ? `Đã có ${stats.explainedSlots}/${stats.supportedSlots} câu có lời giải.${
      stats.hasUnsupported ? ` Đã loại ${stats.unsupportedSlots} câu hình ảnh/bản đồ chưa có ảnh đính kèm.` : ''
    } (1 câu MCQ nhiều đáp án tính theo số câu quy đổi)`
    : 'Báo cáo lần sinh giải thích gần nhất'

  if (compact) {
    return (
      <span className={`inline-flex h-7 w-28 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-600 ${className}`}>
        {hasStats ? `${stats.explainedSlots}/${stats.supportedSlots} lời giải` : `${runErrorCount} lỗi`}
      </span>
    )
  }

  const runIssuesLabel = [
    runErrorCount > 0 ? `${runErrorCount} câu lỗi` : '',
    runAttentionCount > 0 ? `${runAttentionCount} câu cần kiểm tra` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {hasStats && (
        <div
          className="inline-flex h-8 w-36 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-2xs"
          title={tooltipText}
          data-testid="exam-explanation-overview-badge"
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="font-semibold text-zinc-800">
            {stats.explainedSlots}/{stats.supportedSlots}
          </span>
          <span>lời giải</span>
          {stats.hasUnsupported && (
            <span className="text-[10px] text-zinc-400 font-normal">
              (-{stats.unsupportedSlots} thiếu ảnh)
            </span>
          )}
        </div>
      )}

      {hasStats && stats.hasAttention && (
        <div
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-800 shadow-2xs"
          title={`Cần chú ý: ${(stats.attentionReasons || []).join(', ') || `${stats.attentionSlots} câu`}`}
          data-testid="exam-explanation-attention-badge"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
          <span>{stats.attentionSlots} câu cần chú ý</span>
        </div>
      )}

      {hasRunIssues && (
        <button
          type="button"
          onClick={onOpenRunPanel || undefined}
          disabled={!onOpenRunPanel}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-2xs transition enabled:hover:bg-zinc-50 enabled:cursor-pointer disabled:cursor-default"
          title={`Lần sinh AI gần nhất: ${runIssuesLabel}. Bấm để xem báo cáo.`}
          data-testid="exam-explanation-run-issues"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
          <span>{runIssuesLabel}</span>
        </button>
      )}
    </div>
  )
}
