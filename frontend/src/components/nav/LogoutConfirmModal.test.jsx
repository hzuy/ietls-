import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LogoutConfirmModal from './LogoutConfirmModal'

describe('LogoutConfirmModal', () => {
  it('does not render when open is false', () => {
    render(<LogoutConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders correctly with admin-standard modal styling when open', () => {
    const handleClose = vi.fn()
    const handleConfirm = vi.fn()

    render(<LogoutConfirmModal open={true} onClose={handleClose} onConfirm={handleConfirm} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Bạn có chắc muốn đăng xuất không?')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: 'Huỷ' })
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận' })

    expect(cancelBtn).toBeInTheDocument()
    expect(confirmBtn).toBeInTheDocument()

    // Clicking cancel calls onClose
    fireEvent.click(cancelBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)

    // Clicking confirm calls onConfirm
    fireEvent.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })
})
