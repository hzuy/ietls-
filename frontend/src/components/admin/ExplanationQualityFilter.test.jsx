import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplanationQualityFilter from './ExplanationQualityFilter'

describe('ExplanationQualityFilter', () => {
  it('shows only compact question buttons and opens the selected question', () => {
    const open = vi.fn()
    render(<ExplanationQualityFilter groups={[{ id: 2, questions: [
      { number: 1, explanation: { status: 'conflict_pending' } },
      { number: 2, explanation: { status: 'possibly_stale' } },
      { number: 3, explanation: { status: 'teacher_reviewed' } },
    ] }]} onOpenQuestion={open} />)
    fireEvent.click(screen.getByText('Cần kiểm tra lời giải (2)'))
    expect(screen.getByRole('button', { name: /Xem câu 1/ })).toHaveTextContent('Câu 1')
    expect(screen.queryByRole('group', { name: /Lọc lý do/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Xem câu 2/ }))
    expect(open).toHaveBeenCalledWith(2, 2)
    expect(screen.queryByRole('button', { name: /Xem câu 3/ })).not.toBeInTheDocument()
  })

  it('stays collapsed initially and hides itself when no questions need attention', () => {
    const { container, rerender } = render(<ExplanationQualityFilter groups={[{ questions: [
      { number: 1, explanation: { status: 'needs_regeneration' } },
    ] }]} />)
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    rerender(<ExplanationQualityFilter groups={[{ questions: [
      { number: 1, explanation: { status: 'teacher_edited' } },
    ] }]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
