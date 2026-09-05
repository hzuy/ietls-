import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const noop = () => {}
noop.success = () => {}
noop.error = () => {}
noop.info = () => {}

const defaultToastContext = {
  showToast: noop,
  removeToast: () => {},
}

const ToastContext = createContext(defaultToastContext)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const toastItem = { id, message: String(message || ''), type }

    setToasts(prev => [...prev, toastItem])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    return id
  }, [removeToast])

  // Convenience helper functions
  showToast.success = (msg, duration) => showToast(msg, 'success', duration)
  showToast.error = (msg, duration) => showToast(msg, 'error', duration)
  showToast.info = (msg, duration) => showToast(msg, 'info', duration)

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container: below mobile header on small screens, top-right on sm+ */}
      <aside
        aria-live="polite"
        aria-label="Thông báo"
        className="fixed top-16 sm:top-5 right-3 sm:right-5 left-3 sm:left-auto z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-[calc(100vw-24px)] sm:max-w-sm sm:w-full items-end"
      >
        {toasts.map(t => {
          let bgStyle = 'bg-blue-50 border-blue-200 text-blue-900 shadow-blue-100/50'
          let IconComp = Info
          let iconColor = 'text-blue-600'

          if (t.type === 'success') {
            bgStyle = 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100/50'
            IconComp = CheckCircle2
            iconColor = 'text-emerald-600'
          } else if (t.type === 'error') {
            bgStyle = 'bg-rose-50 border-rose-200 text-rose-900 shadow-rose-100/50'
            IconComp = AlertCircle
            iconColor = 'text-rose-600'
          }

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto w-full flex items-start gap-3 p-3.5 rounded-xl border shadow-lg ${bgStyle} transition-all duration-200`}
            >
              <IconComp className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-sm font-medium leading-snug break-words">
                {t.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Đóng thông báo"
                className="shrink-0 p-1 -mr-1 -mt-0.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </aside>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  return context || defaultToastContext
}
