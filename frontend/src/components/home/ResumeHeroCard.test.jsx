import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ResumeHeroCard, { parseDraftDetails } from './ResumeHeroCard'

describe('ResumeHeroCard Component', () => {
  const mockDraft = {
    userId: 'u1',
    examId: '10',
    skillType: 'reading',
    examTitle: 'Cambridge 19 · Test 1 Reading',
    totalQuestions: 40,
    timeRemaining: 1800, // 30 mins
    savedAt: '2026-09-09T10:00:00.000Z',
    data: {
      1: 'TRUE',
      2: 'FALSE',
      3: 'NOT GIVEN',
      4: 'A',
    },
  }

  it('parses draft details correctly', () => {
    const details = parseDraftDetails(mockDraft)
    expect(details.title).toBe('Cambridge 19 · Test 1 Reading')
    expect(details.answeredCount).toBe(4)
    expect(details.totalQuestions).toBe(40)
    expect(details.percentage).toBe(10) // (4 / 40) * 100 = 10%
    expect(details.timeLeftFormatted).toBe('30:00')
  })

  it('renders card with all details, badge, and progress bar', () => {
    render(<ResumeHeroCard draft={mockDraft} onResume={vi.fn()} onDiscard={vi.fn()} />)

    expect(screen.getByTestId('resume-hero-card')).toBeInTheDocument()
    // MỤC 2: badge đổi sang viết hoa chữ đầu câu
    expect(screen.getByText('Tiếp tục bài làm')).toBeInTheDocument()
    expect(screen.getByText('Cambridge 19 · Test 1 Reading')).toBeInTheDocument()
    // MỤC 2: tiến độ chỉ hiển thị một lần (bỏ % lặp lại)
    const progressEls = screen.getAllByText((content, el) => {
      return el?.tagName?.toLowerCase() === 'span' && el?.textContent?.trim().includes('4/40') && el?.textContent?.trim().includes('câu đã làm')
    })
    expect(progressEls.length).toBeGreaterThan(0)
    expect(screen.getByText('30:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tiếp tục/i })).toBeInTheDocument()
    // Không còn nút Hủy bài nháp theo yêu cầu người dùng
    expect(screen.queryByText('Hủy bài nháp')).not.toBeInTheDocument()
  })

  it('triggers onResume callback when "Tiếp tục" button is clicked', () => {
    const onResume = vi.fn()
    render(<ResumeHeroCard draft={mockDraft} onResume={onResume} />)

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/i }))
    expect(onResume).toHaveBeenCalledWith(mockDraft)
  })

  it('returns null when draft is null or empty', () => {
    const { container } = render(<ResumeHeroCard draft={null} onResume={vi.fn()} onDiscard={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
