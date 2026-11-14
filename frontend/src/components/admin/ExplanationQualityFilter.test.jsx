import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplanationQualityFilter from './ExplanationQualityFilter'

describe('ExplanationQualityFilter', () => {
  it('filters saved explanation reasons independently from generation errors', () => {
    const open = vi.fn()
    render(<ExplanationQualityFilter groups={[{ id: 2, questions: [
      { number: 1, explanation: { status: 'conflict_pending' } },
      { number: 2, explanation: { status: 'possibly_stale' } },
      { number: 3, explanation: { status: 'teacher_reviewed' } },
    ] }]} onOpenQuestion={open} />)
    fireEvent.click(screen.getByText('Cần kiểm tra lời giải (2)'))
    fireEvent.click(screen.getByRole('button', { name: 'Nội dung đã đổi (1)' }))
    expect(screen.queryByRole('button', { name: /Xem câu 1/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Xem câu 2/ }))
    expect(open).toHaveBeenCalledWith(2, 2)
    expect(screen.queryByRole('button', { name: /Xem câu 3/ })).not.toBeInTheDocument()
  })
})
