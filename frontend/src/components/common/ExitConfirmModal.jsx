/**
 * ExitConfirmModal — Hộp thoại xác nhận khi người dùng muốn rời khỏi phòng thi.
 *
 * Props:
 *   open     — boolean, hiển thị/ẩn modal
 *   onStay   — () => void, khi bấm "Ở lại"
 *   onLeave  — () => void, khi bấm "Thoát"
 */
export default function ExitConfirmModal({ open, onStay, onLeave }) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      aria-describedby="exit-modal-desc"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onStay}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center shrink-0">
            <svg
              className="w-4.5 h-4.5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
              width={18}
              height={18}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h2
              id="exit-modal-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug"
            >
              Rời khỏi phòng thi?
            </h2>
          </div>
        </div>

        {/* Message */}
        <p
          id="exit-modal-desc"
          className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed -mt-1"
        >
          Bài làm của bạn sẽ được lưu tự động dưới dạng{' '}
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Đang làm dở</span>.
          Bạn có thể tiếp tục từ chỗ này vào lần sau.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            id="exit-modal-stay-btn"
            type="button"
            onClick={onStay}
            className="h-8 px-3.5 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 text-xs font-medium rounded-md transition-colors cursor-pointer inline-flex items-center justify-center leading-none"
          >
            Ở lại
          </button>
          <button
            id="exit-modal-leave-btn"
            type="button"
            onClick={onLeave}
            className="h-8 px-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer inline-flex items-center justify-center leading-none"
          >
            Thoát
          </button>
        </div>
      </div>
    </div>
  )
}
