import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplanationChipGrid from './ExplanationChipGrid'

describe('ExplanationChipGrid', () => {
  it('renders nothing when questionsList is empty', () => {
    const { container } = render(<ExplanationChipGrid questions={[]} group={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders CSS grid with 5 columns on desktop and uniform chip dimensions for 1 question', () => {
    const questions = [{ number: 1, explanation: { status: 'ai_generated' } }]
    const { container } = render(<ExplanationChipGrid questions={questions} />)

    expect(screen.getByText(/Giải thích 4 bước/i)).toBeInTheDocument()
    const gridEl = container.querySelector('.grid')
    expect(gridEl.className).toContain('grid-cols-2')
    expect(gridEl.className).toContain('sm:grid-cols-3')
    expect(gridEl.className).toContain('md:grid-cols-4')
    expect(gridEl.className).toContain('lg:grid-cols-5')

    const chip = screen.getByRole('button', { name: /Câu 1/i })
    expect(chip.className).toContain('h-10')
    expect(chip.className).toContain('w-full')
    expect(screen.getByText('AI sinh')).toBeInTheDocument()
  })

  it('renders correctly with groups of 5 questions with uniform size', () => {
    const questions = [1, 2, 3, 4, 5].map(n => ({ number: n }))
    render(<ExplanationChipGrid questions={questions} />)

    for (let i = 1; i <= 5; i++) {
      const chip = screen.getByRole('button', { name: new RegExp(`Câu ${i}`, 'i') })
      expect(chip).toBeInTheDocument()
      expect(chip.className).toContain('h-10')
      expect(chip.className).toContain('w-full')
    }
  })

  it('renders correctly with groups of 7 questions', () => {
    const questions = [1, 2, 3, 4, 5, 6, 7].map(n => ({
      number: n,
      explanation: n === 3 ? { status: 'teacher_edited' } : n === 4 ? { status: 'conflict_pending' } : null,
    }))
    render(<ExplanationChipGrid questions={questions} />)

    expect(screen.getAllByRole('button').length).toBe(7)
    expect(screen.getByText('Đã sửa')).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
  })

  it('renders correctly with groups of 10 questions', () => {
    const group = {
      qNumberStart: 1,
      qNumberEnd: 10,
      explanations: {
        1: { status: 'teacher_reviewed' },
      },
    }
    render(<ExplanationChipGrid group={group} />)

    expect(screen.getAllByRole('button').length).toBe(10)
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument()
  })

  it('shows per-question run status (lỗi / cần kiểm tra) with the failure reason as tooltip', () => {
    const questions = [{ number: 1 }, { number: 2 }, { number: 3 }]
    render(
      <ExplanationChipGrid
        questions={questions}
        runStatusByNumber={{ 1: 'error', 2: 'retry', 3: 'done' }}
        runErrorMessageByNumber={{ 1: 'AI phản hồi quá lâu nên chưa có kết quả.' }}
      />
    )

    expect(screen.getByText('Lỗi')).toBeInTheDocument()
    expect(screen.getByText('Cần kiểm tra')).toBeInTheDocument()

    const errorChip = screen.getByRole('button', { name: /Câu 1/i })
    expect(errorChip).toHaveAttribute('title', expect.stringContaining('AI phản hồi quá lâu'))

    const retryChip = screen.getByRole('button', { name: /Câu 2/i })
    expect(retryChip).toHaveAttribute('title', expect.stringContaining('kết quả dự phòng chưa chắc chắn'))

    // Câu 3 đã xong: không có nhãn lỗi, giữ tooltip mặc định.
    expect(screen.getByRole('button', { name: /Câu 3/i })).toHaveAttribute(
      'title',
      expect.stringContaining('Xem, duyệt')
    )
  })

  it('triggers onSelectQuestion callback with question, qNum, and explanation', () => {
    const handleSelect = vi.fn()
    const questions = [
      { number: 4, explanation: { status: 'teacher_reviewed', reasoning: 'Done' } },
    ]
    render(<ExplanationChipGrid questions={questions} onSelectQuestion={handleSelect} />)

    const chip = screen.getByRole('button', { name: /Câu 4/i })
    fireEvent.click(chip)

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({
      qNum: 4,
      explanation: expect.objectContaining({ status: 'teacher_reviewed' }),
    }))
  })
})
