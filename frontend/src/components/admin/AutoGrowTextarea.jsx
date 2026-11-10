import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react'

// Shared by question editors: keep the whole value visible on load, edits,
// token insertion and responsive width changes without replacing the DOM node.
const AutoGrowTextarea = forwardRef(function AutoGrowTextarea({
  value, defaultValue, className = '', style, onInput, rows = 1, ...props
}, forwardedRef) {
  const elementRef = useRef(null)
  const resize = useCallback(() => {
    const element = elementRef.current
    if (!element) return
    const computed = getComputedStyle(element)
    const borders = (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.borderBottomWidth) || 0)
    const minimum = parseFloat(computed.minHeight) || 34
    element.style.height = 'auto'
    element.style.height = `${Math.max(element.scrollHeight + borders, minimum)}px`
  }, [])
  const setRef = useCallback(element => {
    elementRef.current = element
    if (typeof forwardedRef === 'function') forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }, [forwardedRef])

  useLayoutEffect(resize, [value, defaultValue, rows, resize])
  useLayoutEffect(() => {
    const element = elementRef.current
    let lastWidth = element.getBoundingClientRect().width
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width
      if (width !== lastWidth) { lastWidth = width; resize() }
    })
    observer?.observe(element)
    window.addEventListener('resize', resize)
    document.fonts?.addEventListener('loadingdone', resize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      document.fonts?.removeEventListener('loadingdone', resize)
    }
  }, [resize])

  return <textarea {...props} ref={setRef} rows={rows} value={value} defaultValue={defaultValue}
    className={`min-w-0 max-w-full ${className}`}
    style={{ ...style, boxSizing: 'border-box', overflowY: 'hidden', resize: 'none', overflowWrap: 'anywhere' }}
    onInput={event => { onInput?.(event); resize() }} />
})

export default AutoGrowTextarea
