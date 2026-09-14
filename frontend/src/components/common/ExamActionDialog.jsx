import { useId } from 'react'

/**
 * ExamActionDialog — khung modal xác nhận DUY NHẤT dùng chung cho mọi hộp thoại
 * "Nộp bài?" / "Rời khỏi phòng thi?" trên toàn bộ phòng thi User (Reading,
 * Listening, Writing, Speaking, PracticeExamPage). Thay cho việc mỗi trang tự
 * viết JSX modal riêng (khác kích thước, khác icon, khác cỡ nút).
 *
 * Component chỉ lo phần khung + typography + cụm nút — không tự quyết định
 * tiêu đề/nội dung, để caller truyền đúng nội dung rút gọn theo từng ngữ cảnh.
 *
 * Props:
 *   open           — boolean, hiển thị/ẩn dialog
 *   title          — string, tiêu đề (vd "Rời khỏi phòng thi?")
 *   description    — string | ReactNode, nội dung mô tả ngắn
 *   cancelLabel    — string, nhãn nút hủy/ở lại (vd "Ở lại", "Tiếp tục làm")
 *   confirmLabel   — string, nhãn nút xác nhận (vd "Thoát", "Nộp bài")
 *   onCancel       — () => void
 *   onConfirm      — () => void
 *   confirmDisabled — boolean, disable nút xác nhận (vd đang submit)
 */
export default function ExamActionDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDisabled = false,
}) {
  const titleId = useId()
  const descId = useId()

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        className="relative w-full max-w-[380px] sm:max-w-[400px] p-6 rounded-2xl border border-zinc-200 bg-white shadow-lg animate-dialog-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-900 text-left">
          {title}
        </h2>
        <p id={descId} className="text-sm text-zinc-500 mt-1.5 leading-relaxed text-left">
          {description}
        </p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center h-9 px-5 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-full hover:bg-zinc-100 transition-colors leading-none cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="inline-flex items-center justify-center h-9 px-5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-xs leading-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
