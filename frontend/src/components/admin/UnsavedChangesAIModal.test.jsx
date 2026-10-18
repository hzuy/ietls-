import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnsavedChangesAIModal from './UnsavedChangesAIModal'

describe('UnsavedChangesAIModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <UnsavedChangesAIModal
        isOpen={false}
        onClose={vi.fn()}
        onSaveAndGenerate={vi.fn()}
        onContinueWithoutSaving={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title and explanation note when open', () => {
    render(
      <UnsavedChangesAIModal
        isOpen={true}
        onClose={vi.fn()}
        onSaveAndGenerate={vi.fn()}
        onContinueWithoutSaving={vi.fn()}
      />
    )
    expect(screen.getByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    expect(screen.getByText(/Hệ thống AI sẽ phân tích dựa trên dữ liệu/)).toBeInTheDocument()
  })

  it('calls onSaveAndGenerate when teacher clicks "Lưu đề rồi sinh AI"', () => {
    const handleSave = vi.fn()
    render(
      <UnsavedChangesAIModal
        isOpen={true}
        onClose={vi.fn()}
        onSaveAndGenerate={handleSave}
        onContinueWithoutSaving={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Lưu đề rồi sinh AI/i }))
    expect(handleSave).toHaveBeenCalledTimes(1)
  })

  it('calls onContinueWithoutSaving when teacher clicks "Tiếp tục sinh AI theo CSDL hiện tại"', () => {
    const handleContinue = vi.fn()
    render(
      <UnsavedChangesAIModal
        isOpen={true}
        onClose={vi.fn()}
        onSaveAndGenerate={vi.fn()}
        onContinueWithoutSaving={handleContinue}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục sinh AI theo CSDL hiện tại/i }))
    expect(handleContinue).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when teacher clicks "Hủy và quay lại sửa"', () => {
    const handleClose = vi.fn()
    render(
      <UnsavedChangesAIModal
        isOpen={true}
        onClose={handleClose}
        onSaveAndGenerate={vi.fn()}
        onContinueWithoutSaving={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Hủy và quay lại sửa/i }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
