import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnsavedChangesAIModal from './UnsavedChangesAIModal'

describe('UnsavedChangesAIModal', () => {
  it('renders nothing when closed', () => {
    expect(render(<UnsavedChangesAIModal isOpen={false} />).container).toBeEmptyDOMElement()
  })
  it('offers a single save-and-generate path instead of using stale saved content', () => {
    const save = vi.fn(), close = vi.fn()
    render(<UnsavedChangesAIModal isOpen onClose={close} onSaveAndGenerate={save} />)
    expect(screen.getByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    expect(screen.queryByText(/Tiếp tục sinh AI theo CSDL/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đề & tạo lời giải' }))
    expect(save).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại sửa' }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('disables actions while saving', () => {
    render(<UnsavedChangesAIModal isOpen isSaving onClose={vi.fn()} onSaveAndGenerate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Đang lưu đề…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quay lại sửa' })).toBeDisabled()
  })
})
