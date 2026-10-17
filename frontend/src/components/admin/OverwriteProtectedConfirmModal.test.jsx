import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OverwriteProtectedConfirmModal from './OverwriteProtectedConfirmModal'

describe('OverwriteProtectedConfirmModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <OverwriteProtectedConfirmModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders counts of reviewed and edited questions', () => {
    render(
      <OverwriteProtectedConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        reviewedCount={3}
        editedCount={2}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Đề thi có 5 câu hỏi cần được bảo vệ/i)).toBeInTheDocument()
    expect(screen.getByText(/3/i)).toBeInTheDocument()
    expect(screen.getByText(/2/i)).toBeInTheDocument()
  })

  it('defaults to keeping protected questions (overwriteProtected: false)', () => {
    const handleConfirm = vi.fn()
    render(
      <OverwriteProtectedConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        reviewedCount={2}
        editedCount={1}
        onConfirm={handleConfirm}
      />
    )

    const proceedBtn = screen.getByRole('button', { name: /Tiếp tục \(Giữ nguyên câu đã duyệt\)/i })
    fireEvent.click(proceedBtn)

    expect(handleConfirm).toHaveBeenCalledWith({ overwriteProtected: false })
  })

  it('sends overwriteProtected: true when checkbox is checked', () => {
    const handleConfirm = vi.fn()
    render(
      <OverwriteProtectedConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        reviewedCount={2}
        editedCount={1}
        onConfirm={handleConfirm}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    const proceedBtn = screen.getByRole('button', { name: /Xác nhận ghi đè tất cả/i })
    fireEvent.click(proceedBtn)

    expect(handleConfirm).toHaveBeenCalledWith({ overwriteProtected: true })
  })
})
