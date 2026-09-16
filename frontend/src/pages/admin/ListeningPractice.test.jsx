import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ListeningPractice from './ListeningPractice'
import { ToastProvider } from '../../context/ToastContext'
import * as practiceService from '../../services/practiceService'

function render(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  )
}

describe('ListeningPractice — double-click protection on delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(practiceService, 'getListeningPracticeList').mockResolvedValue([
      { id: 21, title: 'Bài nghe cần xóa', thumbnailUrl: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('disables the ConfirmDeleteModal "Xóa" button while deleting, so a double-click sends only one delete request', async () => {
    let resolveDelete
    const deletePromise = new Promise((resolve) => { resolveDelete = resolve })
    vi.spyOn(practiceService, 'deleteListeningPractice').mockReturnValue(deletePromise)

    render(<ListeningPractice />)

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }))
    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: 'Xóa' })
    fireEvent.click(confirmBtn)

    const pendingBtn = await within(dialog).findByRole('button', { name: /Đang xóa/i })
    expect(pendingBtn).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(practiceService.deleteListeningPractice).toHaveBeenCalledTimes(1)

    resolveDelete()
    await waitFor(() => expect(practiceService.getListeningPracticeList).toHaveBeenCalledTimes(2))
  })
})
