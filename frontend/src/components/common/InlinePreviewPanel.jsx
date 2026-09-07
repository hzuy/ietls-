export default function InlinePreviewPanel({ title, showAnswers, setShowAnswers, onClose, children, hideAnswers = false }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-900">Xem trước — {title}</span>
          {!hideAnswers && (
            <button
              type="button"
              onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${showAnswers ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
            >
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition font-medium cursor-pointer"
        >
          Thu gọn ↑
        </button>
      </div>
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
