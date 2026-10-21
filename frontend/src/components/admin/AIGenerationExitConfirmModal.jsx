import React from 'react'
import { AlertTriangle } from 'lucide-react'
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

  return (
    <Modal isOpen={isOpen} onClose={isCancelling ? undefined : onClose} title="Rời khỏi trang khi AI đang sinh?">
      <div className="space-y-4 pt-1" data-testid="ai-exit-confirm-modal">
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5 leading-relaxed">
            <p className="font-semibold text-amber-950">
              Tiến trình sinh giải thích AI đang diễn ra
            </p>
            <p>
              Hệ thống đã lưu an toàn{' '}
              <strong className="font-semibold text-zinc-900">
                {currentCount}/{totalCount > 0 ? totalCount : 'tất cả'}
              </strong>{' '}
              câu hỏi đã hoàn thành vào cơ sở dữ liệu.
            </p>
            <p className="text-amber-800">
              Nếu bạn rời khỏi trang bây giờ, tiến trình sẽ bị dừng và các câu còn lại sẽ chưa có lời giải thích.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ở lại tiếp tục
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            disabled={isCancelling}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCancelling ? 'Đang dừng...' : 'Dừng và thoát'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
