import React from 'react'
import { Loader2, X, Sparkles } from 'lucide-react'

/**
 * Sticky progress bar displayed at top of questions list while AI is generating explanations.
 * Stays visible while scrolling down long reading passages or lists of questions.
 */
export default function AIGenerationStickyProgress({
  isGenerating = false,
  isCancelling = false,
  progress = null,
  onCancel,
  className = '',
}) {
  if (!isGenerating && !isCancelling) return null

  const current = progress?.current || 0
  const total = progress?.total || 0
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const label = progress?.label || (total > 0 ? `${current}/${total} câu` : 'đang khởi tạo...')

  return (
    <div
      data-testid="ai-generation-sticky-progress"
      className={`sticky top-[65px] z-30 mb-4 rounded-xl border shadow-sm transition-all overflow-hidden ${
        isCancelling
          ? 'bg-amber-50/95 border-amber-300 text-amber-900 backdrop-blur-xs'
          : 'bg-zinc-900/95 border-zinc-800 text-white backdrop-blur-xs'
      } ${className}`}
    >
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Loader2
            className={`w-4 h-4 shrink-0 animate-spin ${
              isCancelling ? 'text-amber-700' : 'text-sky-400'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight truncate">
                {isCancelling ? 'Đang dừng tiến trình sinh AI...' : `Đang sinh giải thích AI (${label})`}
              </span>
              {total > 0 && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                  isCancelling ? 'bg-amber-100 text-amber-800' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {pct}%
                </span>
              )}
            </div>
            <p className={`text-[11px] truncate mt-0.5 ${
              isCancelling ? 'text-amber-700' : 'text-zinc-400'
            }`}>
              {isCancelling
                ? 'Các câu đã hoàn thành được lưu an toàn vào cơ sở dữ liệu'
                : 'Các câu đã xong được lưu tự động sau mỗi nhóm, có thể hủy bất kỳ lúc nào'}
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isCancelling
                ? 'bg-amber-200 text-amber-800 hover:bg-amber-200'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>{isCancelling ? 'Đang hủy...' : 'Hủy sinh'}</span>
          </button>
        )}
      </div>

      {/* Progress track */}
      {total > 0 && (
        <div className="w-full bg-black/20 h-1">
          <div
            className={`h-full transition-all duration-300 ease-out ${
              isCancelling ? 'bg-amber-500' : 'bg-sky-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
