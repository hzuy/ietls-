import React from 'react'
import { Sparkles } from 'lucide-react'

/**
 * Overview badge for Cambridge Exam AI explanations (Batch 2 - Requirement 3.3).
 *
 * Rules:
 * - Monochrome / gray palette (border-zinc-200 / border-zinc-300 / zinc text).
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
      <span className={`inline-flex h-7 w-28 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-600 ${className}`}>
        {stats.explainedSlots}/{stats.supportedSlots} lời giải
      </span>
    )
  }

  return (
    <div className={`flex items-center ${className}`}>
      {/* Base count badge */}
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

    </div>
  )
}
