import { useEffect } from 'react'

export default function InlinePreviewPanel({
  title,
  showAnswers,
  setShowAnswers,
  onClose,
  children,
  hideAnswers = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ width: '95vw', height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-zinc-900">Preview — {title}</span>
            {!hideAnswers && typeof setShowAnswers === 'function' && (
              <button
                type="button"
                onClick={() => setShowAnswers(v => !v)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
                  showAnswers
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition font-medium cursor-pointer"
          >
            ✕ Đóng
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-5 bg-zinc-50/50">
          {children}
        </div>
      </div>
    </div>
  )
}
