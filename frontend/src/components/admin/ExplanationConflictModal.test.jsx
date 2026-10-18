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

  it('renders teacher_note instead of reasoning when teacher_note is provided (Batch 1b)', () => {
    const conflictsWithNote = [
      {
        number: 1,
        type: 'mcq',
        questionText: 'Ekman became interested...',
        inputAnswer: 'peers',
        aiAnswer: 'patients',
        evidence: 'patients quote',
        reasoning: 'Học sinh đọc reasoning này',
        teacher_note: 'Ghi chú giáo viên: đáp án đúng là patients, không phải peers',
      },
    ]

    render(
      <ExplanationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflicts={conflictsWithNote}
        onConfirmResolve={vi.fn()}
      />
    )

    expect(screen.getByText(/Ghi chú đối chiếu từ AI \(chỉ giáo viên thấy\):/i)).toBeInTheDocument()
    expect(screen.getByText(/Ghi chú giáo viên: đáp án đúng là patients, không phải peers/i)).toBeInTheDocument()
    expect(screen.queryByText('Học sinh đọc reasoning này')).not.toBeInTheDocument()
  })

  it('falls back to reasoning when teacher_note is absent for legacy data (Batch 1b backward compatibility)', () => {
    const legacyConflicts = [
      {
        number: 2,
        type: 'true_false_ng',
        questionText: 'Rainforest statement',
        inputAnswer: 'FALSE',
        aiAnswer: 'TRUE',
        evidence: 'over 50 percent',
        reasoning: 'Lập luận cũ chưa có teacher_note',
      },
    ]

    render(
      <ExplanationConflictModal
        isOpen={true}
        onClose={vi.fn()}
        conflicts={legacyConflicts}
        onConfirmResolve={vi.fn()}
      />
    )

    expect(screen.getByText(/Lập luận & Phản biện của AI:/i)).toBeInTheDocument()
    expect(screen.getByText(/Lập luận cũ chưa có teacher_note/i)).toBeInTheDocument()
  })
})
