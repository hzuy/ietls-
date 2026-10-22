import React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../common/Modal'

/**
 * Exit confirmation modal when user attempts to leave the page while AI generation is in progress.
 *
 * Guaranteed:
 * - Only mounts/blocks when an actual generation loop is active.
 * - Reassures user that completed questions (x/y) are safely saved in DB.
 * - Offers safe termination ("Dừng và thoát") that aborts the HTTP loop before navigating.
 */
export default function AIGenerationExitConfirmModal({
  isOpen = false,
  onClose,
  onConfirmExit,
  currentCount = 0,
  totalCount = 0,
  isCancelling = false,
}) {
  if (!isOpen) return null

  const hasTotal = Number(totalCount) > 0
  const progressLabel = hasTotal ? `${currentCount}/${totalCount}` : String(currentCount)

  return (
    <Modal isOpen={isOpen} onClose={isCancelling ? undefined : onClose} title="Rời khỏi trang khi AI đang sinh?">
      <div className="p-5 sm:p-6" data-testid="ai-exit-confirm-modal">
        {/* Header: icon + tiêu đề, căn hàng theo baseline của dòng tiêu đề */}
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <div role="heading" aria-level="2" className="text-[15px] font-semibold leading-5 text-zinc-900">
              Rời khỏi trang khi AI đang sinh?
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Tiến trình sinh giải thích AI đang diễn ra.
            </p>
          </div>
        </div>

        {/* Nội dung cảnh báo: 1 khối, 2 đoạn thẳng hàng, không lặp tiêu đề */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-xs leading-5 text-amber-900 text-pretty">
          {hasTotal ? (
            <p>
              Hệ thống đã lưu an toàn{' '}
              <strong className="font-semibold text-amber-950">{progressLabel}</strong>{' '}
              câu hỏi đã hoàn thành vào cơ sở dữ liệu.
            </p>
          ) : (
            <p>Các câu hỏi đã hoàn thành đã được lưu an toàn vào cơ sở dữ liệu.</p>
          )}
          <p className="mt-1.5 text-amber-800">
            Nếu bạn rời khỏi trang bây giờ, tiến trình sẽ bị dừng và các câu còn lại sẽ chưa có lời giải thích.
          </p>
        </div>

        {/* Actions: cùng chiều cao, xếp dọc trên mobile */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 shadow-2xs transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            Ở lại tiếp tục
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            disabled={isCancelling}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isCancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {isCancelling ? 'Đang dừng...' : 'Dừng và thoát'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
