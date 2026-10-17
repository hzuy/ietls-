import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ShieldCheck, RefreshCw, X, Loader2 } from 'lucide-react'

/**
 * Modal cảnh báo khi sinh cả đề mà đã có câu được duyệt (teacher_reviewed)
 * hoặc đã sửa tay (teacher_edited).
 *
 * Mặc định: Giữ nguyên các câu đã duyệt/sửa (overwriteProtected: false).
 * Chỉ khi teacher tích chọn xác nhận ghi đè thì mới gửi overwriteProtected: true.
 */
export default function OverwriteProtectedConfirmModal({
  isOpen,
  onClose,
  reviewedCount = 0,
  editedCount = 0,
  onConfirm,
  isSubmitting = false,
}) {
  const [allowOverwrite, setAllowOverwrite] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAllowOverwrite(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const totalProtected = reviewedCount + editedCount

  const handleProceed = () => {
    onConfirm({ overwriteProtected: allowOverwrite })
  }

  const modalElement = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative border border-zinc-100 flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">
                Phát hiện câu hỏi đã duyệt / sửa tay
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Đề thi có {totalProtected} câu hỏi cần được bảo vệ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4 text-sm text-zinc-600">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold mb-1">
                Chi tiết các câu hỏi bảo vệ:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {reviewedCount > 0 && (
                  <li><strong>{reviewedCount}</strong> câu đã được duyệt (<code className="bg-amber-100/70 px-1 py-0.5 rounded text-[11px]">teacher_reviewed</code>)</li>
                )}
                {editedCount > 0 && (
                  <li><strong>{editedCount}</strong> câu đã sửa nội dung tay (<code className="bg-amber-100/70 px-1 py-0.5 rounded text-[11px]">teacher_edited</code>)</li>
                )}
              </ul>
              <p className="mt-2 text-amber-800/90">
                Mặc định hệ thống sẽ <strong>bỏ qua và giữ nguyên</strong> toàn bộ các câu này để không làm mất công sức duyệt/chỉnh sửa của bạn.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition select-none">
            <input
              type="checkbox"
              id="confirm-overwrite-checkbox"
              checked={allowOverwrite}
              onChange={(e) => setAllowOverwrite(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 border-zinc-300 accent-red-600 cursor-pointer"
            />
            <span className="text-xs text-zinc-700 leading-snug">
              <strong className="text-red-600 font-semibold block">Ghi đè tất cả các câu đã duyệt / sửa tay</strong>
              AI sẽ tạo lại lời giải mới cho toàn bộ đề thi, thay thế cả những câu bạn đã duyệt hoặc sửa trước đó.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition disabled:opacity-50"
          >
            Hủy thao tác
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition flex items-center gap-1.5 ${
              allowOverwrite
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                : 'bg-zinc-900 hover:bg-zinc-800 shadow-zinc-200'
            } disabled:opacity-50`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : allowOverwrite ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Xác nhận ghi đè tất cả</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tiếp tục (Giữ nguyên câu đã duyệt)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalElement, document.body)
}
