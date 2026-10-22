import { useEffect, useRef } from 'react'

/**
 * Chặn điều hướng nội bộ (sidebar, tab, breadcrumb…) khi AI đang sinh giải thích.
 *
 * Ứng dụng dùng BrowserRouter (không phải data router) nên không dùng được
 * `useBlocker`. Hook bắt sự kiện click ở pha capture trên document:
 * - huỷ lần điều hướng đầu tiên,
 * - gọi `onBlocked(proceed)` để mở modal xác nhận hiện có,
 * - khi người dùng xác nhận, `proceed()` bấm lại chính link đó để React Router
 *   điều hướng như bình thường (không cần gọi navigate, không reload trang).
 *
 * Chỉ áp dụng cho link nội bộ dạng `/...` (bỏ qua link ngoài, hash, tải file,
 * chuột giữa / Ctrl+Click mở tab mới).
 */
export function useAIExitGuard({ active = false, onBlocked }) {
  // Đánh dấu lần click được phát lại sau khi người dùng xác nhận.
  const allowNextClickRef = useRef(false)

  useEffect(() => {
    if (!active || typeof document === 'undefined') return

    const handleClick = (event) => {
      if (allowNextClickRef.current) {
        allowNextClickRef.current = false
        return
      }
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (event.target?.closest?.('[data-ai-exit-guard-ignore]')) return

      const link = event.target?.closest?.('a[href]')
      if (!link) return
      if (link.target && link.target !== '_self') return
      if (link.hasAttribute('download')) return

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return
      if (!href.startsWith('/')) return

      const currentPath = `${window.location.pathname}${window.location.search}`
      if (href === currentPath) return

      event.preventDefault()
      event.stopPropagation()

      onBlocked?.(() => {
        allowNextClickRef.current = true
        link.click()
      })
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [active, onBlocked])
}

export default useAIExitGuard
