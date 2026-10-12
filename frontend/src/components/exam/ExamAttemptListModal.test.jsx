import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ExamAttemptListModal from './ExamAttemptListModal'

describe('ExamAttemptListModal', () => {
  const mockAttempts = [
    {
      attemptId: 'att-1',
      examId: 'exam-1',
      skill: 'listening',
      bandScore: 7.5,
      finishedAt: '2026-10-12T08:00:00Z',
      correct: 32,
      total: 40,
    },
    {
      attemptId: 'att-2',
      examId: 'exam-1',
      skill: 'listening',
      bandScore: 6.5,
      finishedAt: '2026-10-11T08:00:00Z',
      correct: 27,
      total: 40,
    },
  ]

  it('renders fixed header and separated scrollable body', () => {
    render(
      <MemoryRouter>
        <ExamAttemptListModal
          open={true}
          onClose={vi.fn()}
          skill="listening"
          skillLabel="Listening Test 1"
          attempts={mockAttempts}
        />
      </MemoryRouter>
    )

    // Header content
    expect(screen.getByText('Lịch sử làm bài')).toBeInTheDocument()
    expect(screen.getByText('Listening Test 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument()

    // Attempts content
    expect(screen.getByText('Lần 2')).toBeInTheDocument()
    expect(screen.getByText('Band 7.5')).toBeInTheDocument()
    expect(screen.getByText('32/40 câu')).toBeInTheDocument()

    expect(screen.getByText('Lần 1')).toBeInTheDocument()
    expect(screen.getByText('Band 6.5')).toBeInTheDocument()
  })

  it('calls onReview when "Xem lại" button is clicked', () => {
    const handleReview = vi.fn()
    render(
      <MemoryRouter>
        <ExamAttemptListModal
          open={true}
          onClose={vi.fn()}
          skill="listening"
          skillLabel="Listening Test 1"
          attempts={mockAttempts}
          onReview={handleReview}
        />
      </MemoryRouter>
    )

    const reviewButtons = screen.getAllByRole('button', { name: /Xem lại/i })
    expect(reviewButtons).toHaveLength(2)
    fireEvent.click(reviewButtons[0])
    expect(handleReview).toHaveBeenCalledWith(mockAttempts[0])
  })

  it('renders empty message when attempts is empty', () => {
    render(
      <MemoryRouter>
        <ExamAttemptListModal
          open={true}
          onClose={vi.fn()}
          skill="reading"
          skillLabel="Reading Test 1"
          attempts={[]}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Bạn chưa có lượt làm bài nào cho đề này.')).toBeInTheDocument()
  })

  it('does not render anything when open is false', () => {
    const { container } = render(
      <MemoryRouter>
        <ExamAttemptListModal
          open={false}
          onClose={vi.fn()}
          skill="reading"
          skillLabel="Reading Test 1"
          attempts={mockAttempts}
        />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })
})
