import React from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'

/**
 * Overview badge for Cambridge Exam AI explanations (Batch 2 - Requirement 3.3).
 *
 * Rules:
 * - Monochrome / gray palette (border-zinc-200 / border-zinc-300 / zinc text).
 * - Clear text labels for all states, not relying on color alone.
 * - Shows attention alert only when conflict_pending / needs_regeneration / possibly_stale exist.
 * - Excludes groups that cannot be explained (missing image / not supported) from the denominator.
 */
export default function ExamExplanationOverviewBadge({
  stats,
  compact = false,
  className = ''
}) {
  if (!stats || (stats.supportedSlots === 0 && stats.unsupportedSlots === 0)) {
    return null
  }

  const tooltipText = `Đã có ${stats.explainedSlots}/${stats.supportedSlots} câu có lời giải.${
    stats.hasUnsupported ? ` Đã loại ${stats.unsupportedSlots} câu hình ảnh/bản đồ chưa có ảnh đính kèm.` : ''
  } (1 câu MCQ nhiều đáp án tính theo số câu quy đổi)`

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] ${className}`}>
        <span className="font-medium text-zinc-600">
          {stats.explainedSlots}/{stats.supportedSlots} lời giải
        </span>
        {stats.hasAttention && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-zinc-300 bg-zinc-100 text-zinc-800"
            title={`Cần chú ý: ${stats.attentionReasons.join(', ')}`}
          >
            <AlertTriangle className="w-3 h-3 text-zinc-700 shrink-0" />
            <span>{stats.attentionSlots} cần chú ý</span>
          </span>
        )}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Base count badge */}
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200 bg-white text-zinc-700 shadow-2xs"
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

      {/* Attention badge */}
      {stats.hasAttention && (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-300 bg-zinc-100 text-zinc-800 shadow-2xs"
          title={`Cần chú ý: ${stats.attentionReasons.join(', ')}`}
          data-testid="exam-explanation-attention-badge"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
          <span>Cần chú ý: {stats.attentionSlots} câu</span>
        </div>
      )}
    </div>
  )
}
