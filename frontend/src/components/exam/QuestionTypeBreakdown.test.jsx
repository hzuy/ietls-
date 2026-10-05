import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import QuestionTypeBreakdown from './QuestionTypeBreakdown'

describe('QuestionTypeBreakdown Component', () => {
  const mockQuestionTypes = [
    { name: 'mcq', total: 10, correct: 9, wrong: 1, missed: 0 },
    { name: 'fill_blank', total: 10, correct: 6, wrong: 4, missed: 0 },
    { name: 'matching_headings', total: 10, correct: 3, wrong: 5, missed: 2 },
  ]

  it('renders all table columns and type names properly', () => {
    render(<QuestionTypeBreakdown questionTypes={mockQuestionTypes} />)

    expect(screen.getByText('Bảng thống kê')).toBeInTheDocument()
    expect(screen.getByText('LOẠI')).toBeInTheDocument()
    expect(screen.getByText('SỐ CÂU')).toBeInTheDocument()
    expect(screen.getByText('ĐÚNG')).toBeInTheDocument()
    expect(screen.getByText('SAI')).toBeInTheDocument()
    expect(screen.getByText('BỎ QUA')).toBeInTheDocument()

    // Type names
    expect(screen.getByText('Multiple Choice (Single)')).toBeInTheDocument()
    expect(screen.getByText('Summary / Note Completion')).toBeInTheDocument()
    expect(screen.getByText('Matching Headings')).toBeInTheDocument()
  })

  it('aggregates question types from sections fallback when questionTypes is not provided', () => {
    const mockSections = [
      {
        number: 1,
        questions: [
          { number: 1, type: 'true_false_ng', status: 'correct', userAnswer: 'TRUE' },
          { number: 2, type: 'true_false_ng', status: 'wrong', userAnswer: 'FALSE' },
        ],
      },
    ]

    render(<QuestionTypeBreakdown sections={mockSections} />)

    expect(screen.getByText('True / False / Not Given')).toBeInTheDocument()
    // The new layout shows correct/wrong/missed circles, not a percentage
    const circles = screen.getAllByRole('cell')
    expect(circles.length).toBeGreaterThan(0)
  })

  it('renders nothing when questionTypes and sections are empty', () => {
    const { container } = render(<QuestionTypeBreakdown questionTypes={[]} sections={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
