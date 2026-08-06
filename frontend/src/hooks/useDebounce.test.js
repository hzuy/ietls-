import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

describe('useDebounce Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 400))
    expect(result.current).toBe('initial')
  })

  it('updates value only after specified delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'first', delay: 400 }
    })

    rerender({ value: 'second', delay: 400 })
    expect(result.current).toBe('first') // Not updated immediately

    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(result.current).toBe('first') // Still first at 399ms

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('second') // Updated at 400ms
  })
})
