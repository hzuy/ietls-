import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmExitModal from './ConfirmExitModal'

describe('ConfirmExitModal', () => {
  it('isOpen=false → không render gì', () => {
    const { container } = render(<ConfirmExitModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mặc định: message trấn an autosave + nút "Thoát" là btn-danger (đỏ), nút huỷ là btn-primary', () => {
    render(<ConfirmExitModal isOpen onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText('Tiến trình sẽ được lưu tự động — bạn có thể quay lại làm tiếp sau.')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Thoát' })
    expect(confirm).toHaveClass('btn-danger')
    expect(confirm).not.toHaveClass('btn-secondary')
    expect(screen.getByRole('button', { name: 'Tiếp tục làm' })).toHaveClass('btn-primary')
  })

  it('message tuỳ biến (Speaking) hiển thị đúng', () => {
    render(<ConfirmExitModal isOpen message="Bản ghi âm sẽ bị mất" onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText('Bản ghi âm sẽ bị mất')).toBeInTheDocument()
  })

  it('nút Tiếp tục làm → onClose; nút Thoát → onConfirm; click nền → onClose', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { container } = render(<ConfirmExitModal isOpen onClose={onClose} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục làm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thoát' }))
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
