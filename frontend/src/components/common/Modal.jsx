import { useEffect, useRef } from 'react'

const SIZES = { xs: 'max-w-xs', sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell: role="dialog" + aria-modal, Escape to close,
 * Tab/Shift+Tab focus trap, and focus restored to the trigger on unmount.
 * Parent controls visibility by mounting/unmounting this component.
 */
export default function Modal({ onClose, title, size = 'md', children }) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) closeRef.current?.() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZES[size] || SIZES.md} max-h-[90vh] overflow-y-auto outline-none flex flex-col`}
      >
        {children}
      </div>
    </div>
  )
}
