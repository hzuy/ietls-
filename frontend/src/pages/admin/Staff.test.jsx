import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Staff from './Staff'
import * as adminService from '../../services/adminService'
import { ToastProvider } from '../../context/ToastContext'

const mockStaff = [
  { id: 1, name: 'Admin User', email: 'admin@test.com', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 2, name: 'Teacher User', email: 'teacher@test.com', role: 'teacher', createdAt: '2026-02-01T00:00:00.000Z' },
]

function renderStaff() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Staff />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('Staff page — double-click protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('user', JSON.stringify({ id: 99, email: 'currentadmin@test.com', role: 'admin' }))
    vi.spyOn(adminService, 'getAdminStaff').mockResolvedValue(mockStaff)
  })

  it('disables the "Xóa" confirm button while removing staff, so a double-click sends only one request', async () => {
    let resolveRemove
    const removePromise = new Promise((resolve) => { resolveRemove = resolve })
    const removeSpy = vi.spyOn(adminService, 'removeStaff').mockReturnValue(removePromise)

    renderStaff()
    await screen.findByText('Teacher User')

    const removeButtons = screen.getAllByRole('button', { name: 'Xóa khỏi staff' })
    fireEvent.click(removeButtons[removeButtons.length - 1])
    const confirmBtn = await screen.findByRole('button', { name: 'Xóa' })
    fireEvent.click(confirmBtn)

    const pendingBtn = await screen.findByRole('button', { name: /Đang xóa/i })
    expect(pendingBtn).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(removeSpy).toHaveBeenCalledTimes(1)

    resolveRemove({ message: 'ok' })
  })
})
