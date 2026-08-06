import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HeroStats from './HeroStats'

describe('HeroStats Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('animates stats to target values after 1500ms duration', async () => {
    render(
      <MemoryRouter>
        <HeroStats />
      </MemoryRouter>
    )

    act(() => {
      // Advance time beyond 1500ms animation duration
      vi.advanceTimersByTime(2000)
    })

    // Target values: 2.5 band, 3000 students, 200 eight+
    expect(screen.getByText('2.5 band')).toBeInTheDocument()
    expect(screen.getByText('3000')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })
})
