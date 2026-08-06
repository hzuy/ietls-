import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SidebarOffer from './SidebarOffer'

describe('SidebarOffer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders initial formatted countdown time correctly', () => {
    render(<SidebarOffer />)
    // Initial timeLeft = (9 * 3600) + (2 * 60) + 45 = 32565s => 0d 9h 2m 45s
    expect(screen.getByText('0d 9h 2m 45s')).toBeInTheDocument()
  })

  it('decrements countdown timer by 1 second after 1000ms', () => {
    render(<SidebarOffer />)
    expect(screen.getByText('0d 9h 2m 45s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('0d 9h 2m 44s')).toBeInTheDocument()
  })

  it('clears interval timer when unmounted', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = render(<SidebarOffer />)

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
