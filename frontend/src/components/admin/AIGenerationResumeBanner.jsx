import React from 'react'
import { Sparkles, Loader2, AlertCircle, Play, X } from 'lucide-react'

/**
 * Shared banner to handle state restoration when entering/re-entering an exam/practice page:
 * - When checking server status during initial mount grace window
 * - When an active generation is ongoing (multi-tab / concurrent session)
 * - When a previous generation was interrupted (with evidence)
 * - When there are remaining ungenerated questions (neutral)
 */
export default function AIGenerationResumeBanner({
  banner = null,
  disabled = false,
  className = '',
}) {
  if (!banner) return null

  const { variant, title, message, actionLabel, onAction, onDismiss } = banner

  if (variant === 'checking') {
    return (
      <div
        data-testid="ai-resume-banner-checking"
        className={`bg-zinc-100 border border-zinc-200 rounded-xl p-3 mb-4 flex items-center gap-2.5 text-xs text-zinc-600 ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500 shrink-0" />
        <span>{message || 'Đang kiểm tra trạng thái sinh AI...'}</span>
      </div>
    )
  }

  if (variant === 'running') {
    return (
      <div
        data-testid="ai-resume-banner-running"
        className={`bg-sky-50 border border-sky-200 rounded-xl p-3.5 mb-4 flex items-center justify-between gap-3 text-xs text-sky-900 ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold">{message}</span>
            <p className="text-[11px] text-sky-700 mt-0.5">
              Các nút thao tác đang được tạm khóa để tránh xung đột dữ liệu.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'interrupted' || variant === 'unprocessed') {
    const isInterrupted = variant === 'interrupted'
    return (
      <div
        data-testid={`ai-resume-banner-${variant}`}
        className={`border rounded-xl p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs ${
          isInterrupted
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-zinc-50 border-zinc-200 text-zinc-800'
        } ${className}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          {isInterrupted ? (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            {title && <span className="font-bold tracking-tight block">{title}</span>}
            <span className="text-[11px] text-zinc-600 block mt-0.5">{message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onAction && actionLabel && (
            <button
              type="button"
              onClick={onAction}
              disabled={disabled}
              className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed ${
                isInterrupted
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{actionLabel}</span>
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Đóng thông báo"
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/50 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
