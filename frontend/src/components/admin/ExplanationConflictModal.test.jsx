import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplanationConflictModal from './ExplanationConflictModal'

describe('ExplanationConflictModal', () => {
  const sampleConflicts = [
    {
      number: 1,
      type: 'mcq',
      questionText: 'Ekman became interested in lying after a question from his:',
      inputAnswer: 'peers',
      aiAnswer: 'patients',
      evidence: 'one of the patients told him that she had lied to him',
      reasoning: 'AI phân tích câu hỏi bắt nguồn từ bệnh nhân',
    },
  ]

  it('does not render when isOpen is false', () => {
    render(
      <ExplanationConflictModal
        isOpen={false}
        onClose={vi.fn()}
        conflicts={sampleConflicts}
        onConfirmResolve={vi.fn()}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders conflict details and allows selecting choice', () => {
    const handleResolve = vi.fn()
    render(
      <ExplanationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflicts={sampleConflicts}
        onConfirmResolve={handleResolve}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Phát hiện lệch đáp án \(1 câu\)/i)).toBeInTheDocument()
    expect(screen.getByText('peers')).toBeInTheDocument()
    expect(screen.getByText('patients')).toBeInTheDocument()
    expect(screen.getByText(/one of the patients told him/i)).toBeInTheDocument()

    // Click confirm button
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận & Lưu giải thích/i })
    fireEvent.click(confirmBtn)

    expect(handleResolve).toHaveBeenCalledWith({ 1: 'ai' })
  })
})
