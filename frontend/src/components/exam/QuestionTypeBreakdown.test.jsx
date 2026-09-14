import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import QuestionTypeBreakdown from './QuestionTypeBreakdown'

describe('QuestionTypeBreakdown Component', () => {
  const mockQuestionTypes = [
    { name: 'mcq', total: 10, correct: 9, wrong: 1, missed: 0 }, // 90% -> Thành thạo
    { name: 'fill_blank', total: 10, correct: 6, wrong: 4, missed: 0 }, // 60% -> Cần ôn lại
    { name: 'matching_headings', total: 10, correct: 3, wrong: 5, missed: 2 }, // 30% -> Cần luyện thêm
  ]

  it('renders all table columns, type names, and status badges properly', () => {
    render(<QuestionTypeBreakdown questionTypes={mockQuestionTypes} />)

    expect(screen.getByText('Phân tích theo dạng câu hỏi')).toBeInTheDocument()
    expect(screen.getByText('Dạng bài')).toBeInTheDocument()
    expect(screen.getByText('Số câu')).toBeInTheDocument()
    expect(screen.getByText('Đúng / Tổng')).toBeInTheDocument()
    expect(screen.getByText('Tỷ lệ chính xác')).toBeInTheDocument()
    expect(screen.getByText('Đánh giá')).toBeInTheDocument()

    // Row 1: 90%
    expect(screen.getByText('Multiple Choice (Single)')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('Thành thạo')).toBeInTheDocument()

    // Row 2: 60%
    expect(screen.getByText('Summary / Note Completion')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('Cần ôn lại')).toBeInTheDocument()

    // Row 3: 30%
    expect(screen.getByText('Matching Headings')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('Cần luyện thêm')).toBeInTheDocument()
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
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Cần ôn lại')).toBeInTheDocument()
  })

  it('renders nothing when questionTypes and sections are empty', () => {
    const { container } = render(<QuestionTypeBreakdown questionTypes={[]} sections={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
