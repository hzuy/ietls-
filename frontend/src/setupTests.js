import '@testing-library/jest-dom'
import { vi } from 'vitest'

if (typeof window !== 'undefined') {
  window.alert = vi.fn()

  // jsdom không implement ResizeObserver/scrollIntoView — cần cho Recharts
  // ResponsiveContainer và Headless UI Listbox (components/admin/Select.jsx)
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  }
}
