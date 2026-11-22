import { StickyNote, X, Trash2 } from 'lucide-react'

/**
 * ExamNotepad — khung ghi chú nhanh (take note) trong lúc làm bài thi.
 * Nút mở đặt trên header của Reading / Listening / Practice.
 * Nội dung được lưu cùng draft để F5 không bị mất.
 */
export function ExamNotepadButton({ open, hasContent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ghi chú nhanh (Take note)"
      aria-label="Ghi chú nhanh"
      aria-expanded={open}
      className={`exam-bar-btn relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs sm:text-[13px] font-medium transition-colors cursor-pointer ${
        open
          ? 'bg-zinc-900 border-zinc-900 text-white'
          : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900'
      }`}
    >
      <StickyNote className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Ghi chú</span>
      {hasContent && !open && (
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
      )}
    </button>
  )
}

export default function ExamNotepad({ open, value, onChange, onClose }) {
  if (!open) return null

  return (
    <div
      data-highlight-popover
      role="dialog"
      aria-label="Ghi chú làm bài"
      className="fixed right-4 top-16 z-40 w-[min(360px,calc(100vw-2rem))] bg-white border border-zinc-200 rounded-2xl shadow-xl flex flex-col overflow-hidden"
    >
      <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <StickyNote className="w-4 h-4 text-amber-600" aria-hidden="true" />
          <span>Ghi chú nháp</span>
        </div>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              title="Xóa ghi chú"
              aria-label="Xóa ghi chú"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng ghi chú"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <textarea
          autoFocus
          rows={7}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ghi chú từ khóa, đáp án nghi ngờ, ý chính khi nghe/đọc..."
          className="w-full text-[15px] leading-relaxed text-zinc-800 bg-white border border-zinc-200 rounded-xl p-3 resize-y min-h-[140px] max-h-[50vh] focus:outline-none focus:border-zinc-900 placeholder:text-zinc-400"
        />
        <p className="mt-1.5 text-xs text-zinc-400">
          Ghi chú được lưu tự động trên thiết bị trong suốt quá trình làm bài.
        </p>
      </div>
    </div>
  )
}
