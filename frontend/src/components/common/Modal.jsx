import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const SIZES = { xs: 'max-w-xs', sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' }
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell rendered into document.body via Portal:
 * role="dialog" + aria-modal, Escape to close, Tab focus trap,
 * and true viewport-centering (z-50 backdrop + my-auto container).
 */
export default function Modal({ onClose, title, size = 'md', zIndex = 'z-50', className = '', children }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const prevFocus = document.activeElement
    const node = dialogRef.current
    const focusables = () =>
      Array.from(node?.querySelectorAll(FOCUSABLE) || []).filter(el => el.offsetParent !== null)

    // Move focus into the dialog on open
    ;(focusables()[0] || node)?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) { e.preventDefault(); node?.focus(); return }
      const idx = f.indexOf(document.activeElement)
      if (e.shiftKey) {
        if (idx <= 0) { e.preventDefault(); f[f.length - 1].focus() }
      } else if (idx === -1 || idx === f.length - 1) {
        e.preventDefault(); f[0].focus()
      }
    }
    node?.addEventListener('keydown', onKeyDown)
    return () => {
      node?.removeEventListener('keydown', onKeyDown)
      if (prevFocus instanceof HTMLElement) prevFocus.focus()
    }
  }, [])

  const modalElement = (
    <div
      className={`fixed inset-0 ${zIndex} bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto`}
      onMouseDown={e => { if (e.target === e.currentTarget) closeRef.current?.() }}
      onClick={e => { if (e.target === e.currentTarget) closeRef.current?.() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size] || SIZES.md} rounded-2xl border border-zinc-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[90vh] overflow-y-auto outline-none flex flex-col ${className}`}
      >
        {children}
      </div>
    </div>
  )

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalElement, document.body)
  }

  return modalElement
}
