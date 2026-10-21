import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AIGenerationExitConfirmModal from './AIGenerationExitConfirmModal'

/**
 * Modal xác nhận rời trang khi AI đang sinh giải thích.
 *
 * Hồi quy: khi tiến trình đang được hủy (isCancelling), cả hai nút phải bị vô
 * hiệu để tránh việc người dùng bấm "Dừng và thoát" lần nữa hoặc "Ở lại" trong
 * lúc yêu cầu hủy đang bay, gây trạng thái treo khóa sinh giải thích.
 */
describe('AIGenerationExitConfirmModal', () => {
  it('hiện nội dung tiến trình và cho phép chọn khi chưa hủy', async () => {
    const onClose = vi.fn()
    const onConfirmExit = vi.fn()

    render(
      <AIGenerationExitConfirmModal
        isOpen
        onClose={onClose}
        onConfirmExit={onConfirmExit}
        currentCount={3}
        totalCount={10}
      />
    )

    expect(screen.getByTestId('ai-exit-confirm-modal')).toBeInTheDocument()
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /3\/10/.test(el.textContent || ''))
    ).toBeInTheDocument()

    const stay = screen.getByRole('button', { name: 'Ở lại tiếp tục' })
    const exit = screen.getByRole('button', { name: 'Dừng và thoát' })
    expect(stay).toBeEnabled()
    expect(exit).toBeEnabled()

    await userEvent.click(stay)
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.click(exit)
    expect(onConfirmExit).toHaveBeenCalledTimes(1)
  })

  it('vô hiệu hóa cả hai nút khi đang hủy tiến trình', async () => {
    const onClose = vi.fn()
    const onConfirmExit = vi.fn()

    render(
      <AIGenerationExitConfirmModal
        isOpen
        isCancelling
        onClose={onClose}
        onConfirmExit={onConfirmExit}
        currentCount={3}
        totalCount={10}
      />
    )

    const stay = screen.getByRole('button', { name: 'Ở lại tiếp tục' })
    const exit = screen.getByRole('button', { name: 'Đang dừng...' })
    expect(stay).toBeDisabled()
    expect(exit).toBeDisabled()

    await userEvent.click(stay)
    await userEvent.click(exit)
    expect(onClose).not.toHaveBeenCalled()
    expect(onConfirmExit).not.toHaveBeenCalled()
  })

  it('không render khi đóng', () => {
    render(
      <AIGenerationExitConfirmModal isOpen={false} onClose={vi.fn()} onConfirmExit={vi.fn()} />
    )
    expect(screen.queryByTestId('ai-exit-confirm-modal')).not.toBeInTheDocument()
  })
})
