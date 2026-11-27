import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuestionNumberBadge from './QuestionNumberBadge'

describe('QuestionNumberBadge', () => {
  it('renders interactive flag button and calls onToggleFlag with question number', () => {
    const onToggleFlag = vi.fn()
    render(<QuestionNumberBadge number={5} flagged={false} onToggleFlag={onToggleFlag} />)

    const btn = screen.getByRole('button', { name: 'Đánh dấu câu 5 để xem lại' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(btn)
    expect(onToggleFlag).toHaveBeenCalledWith(5)
  })

  it('shows flagged state and unflag label when flagged is true', () => {
    const onToggleFlag = vi.fn()
    render(<QuestionNumberBadge number={11} label="11–12" size="pill" flagged={true} onToggleFlag={onToggleFlag} />)

    const btn = screen.getByRole('button', { name: 'Bỏ đánh dấu câu 11–12' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn.className).toContain('border-amber-500')
    expect(btn.querySelector('svg')).toBeTruthy()
  })

  it('renders static span in previewMode or when onToggleFlag is omitted', () => {
    const { rerender } = render(<QuestionNumberBadge number={3} flagged={true} previewMode={true} onToggleFlag={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('3')).toBeInTheDocument()

    rerender(<QuestionNumberBadge number={4} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
