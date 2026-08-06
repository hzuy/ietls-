import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProgressAnalysis from './ProgressAnalysis'
import * as statsService from '../services/statsService'

// Mock navbar and footer dependencies
vi.mock('../components/Navbar', () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}))
vi.mock('../components/Footer', () => ({
  default: () => <div data-testid="mock-footer">Footer</div>,
}))

describe('ProgressAnalysis - Single-fetch on mount & zero refetch on tab switches', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock API services returning sample data
    vi.spyOn(statsService, 'getErrorBreakdown').mockResolvedValue([
      { skillType: 'reading', questionType: 'true_false_ng', total: 10, correct: 8, wrong: 2, skipped: 0, errorRate: 0.2 },
      { skillType: 'listening', questionType: 'note_completion', total: 5, correct: 3, wrong: 1, skipped: 1, errorRate: 0.4 },
    ])
    vi.spyOn(statsService, 'getTrendData').mockResolvedValue([
      { attemptId: 1, finishedAt: '2026-08-01', total: 10, correct: 8, incorrect: 2, accuracyRate: 0.8 },
    ])
    vi.spyOn(statsService, 'getWritingCriteria').mockResolvedValue([
      { criterion: 'task_achievement', avgScore: 6.0, sampleCount: 2, latestScore: 6.5, latestComment: 'Good', trend: 'up' },
    ])
    vi.spyOn(statsService, 'getSpeakingCriteria').mockResolvedValue([
      { criterion: 'fluency', avgScore: 6.5, sampleCount: 3, latestScore: 7.0, latestComment: 'Fluent', trend: 'up' },
    ])
    vi.spyOn(statsService, 'getAIAdvice').mockResolvedValue({
      insufficientData: false,
      advice: { summary: 'Good job', skills: {}, actionItems: [] },
    })
  })

  it('fetches stats ONCE on mount and DOES NOT re-fetch when switching tabs 5 times', async () => {
    render(
      <MemoryRouter>
        <ProgressAnalysis />
      </MemoryRouter>
    )

    // Wait for initial stats load
    await waitFor(() => {
      expect(screen.getByText('Phân tích Lỗi sai & Lộ trình 4 Kỹ năng')).toBeInTheDocument()
    })

    // Verify initial call count = 1 for each stats service helper
    expect(statsService.getErrorBreakdown).toHaveBeenCalledTimes(1)
    expect(statsService.getTrendData).toHaveBeenCalledTimes(1)
    expect(statsService.getWritingCriteria).toHaveBeenCalledTimes(1)
    expect(statsService.getSpeakingCriteria).toHaveBeenCalledTimes(1)

    // 1. Switch tab to Reading
    fireEvent.click(screen.getByText('Reading'))
    // 2. Switch tab to Listening
    fireEvent.click(screen.getByText('Listening'))
    // 3. Switch tab to Writing
    fireEvent.click(screen.getByText('Writing'))
    // 4. Switch tab to Speaking
    fireEvent.click(screen.getByText('Speaking'))
    // 5. Switch tab back to Tất cả kỹ năng
    fireEvent.click(screen.getByText('Tất cả kỹ năng'))

    // Verify call counts remain strictly 1 despite 5 tab switches!
    expect(statsService.getErrorBreakdown).toHaveBeenCalledTimes(1)
    expect(statsService.getTrendData).toHaveBeenCalledTimes(1)
    expect(statsService.getWritingCriteria).toHaveBeenCalledTimes(1)
    expect(statsService.getSpeakingCriteria).toHaveBeenCalledTimes(1)
  })
})
