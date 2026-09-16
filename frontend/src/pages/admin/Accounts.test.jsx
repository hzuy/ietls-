import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Accounts from './Accounts'
import * as adminService from '../../services/adminService'
import { ToastProvider } from '../../context/ToastContext'

const mockAccounts = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin',
    isLocked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Teacher User',
    email: 'teacher@test.com',
    role: 'teacher',
    isLocked: false,
    createdAt: '2026-02-01T00:00:00.000Z',
  },
]

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderAccounts(queryClient = createTestQueryClient()) {
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Accounts />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('Accounts page — TanStack Query & Skeleton caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('user', JSON.stringify({ email: 'admin@test.com', role: 'admin' }))
  })

  it('renders accounts list when data loads', async () => {
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)

    renderAccounts()

    expect(await screen.findByText('Teacher User')).toBeInTheDocument()
    expect(screen.getByText('teacher@test.com')).toBeInTheDocument()
  })

  it('renders immediately from cache without delay', async () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'accounts'], mockAccounts)
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)

    renderAccounts(qc)

    expect(screen.getByText('Teacher User')).toBeInTheDocument()
    expect(screen.getByText('teacher@test.com')).toBeInTheDocument()
  })

  it('lets picking a role in the dropdown update the selected value', async () => {
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)

    renderAccounts()
    await screen.findByText('Teacher User')

    fireEvent.click(screen.getByRole('button', { name: '+ Tạo tài khoản' }))

    expect(screen.getByRole('button', { name: 'Role' })).toHaveTextContent('Teacher (Quản lý đề thi)')

    fireEvent.click(screen.getByRole('button', { name: 'Role' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Admin (Quản lý hệ thống)' }))

    expect(screen.getByRole('button', { name: 'Role' })).toHaveTextContent('Admin (Quản lý hệ thống)')
  })

  it('sends only one toggle-lock request and re-disables the row action while it is in flight (modal closes immediately on confirm)', async () => {
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)
    let resolveToggle
    const togglePromise = new Promise((resolve) => { resolveToggle = resolve })
    const toggleSpy = vi.spyOn(adminService, 'toggleUserLock').mockReturnValue(togglePromise)

    renderAccounts()
    await screen.findByText('Teacher User')

    const lockRowBtn = screen.getByTitle('Khoá tài khoản')
    fireEvent.click(lockRowBtn)
    const confirmBtn = await screen.findByRole('button', { name: 'Khoá' })

    fireEvent.click(confirmBtn)
    await vi.waitFor(() => expect(toggleSpy).toHaveBeenCalledTimes(1))

    // Modal closes immediately; row action must stay disabled until the mutation settles
    // so a second click (e.g. a fast double-click) cannot start a second toggle.
    expect(screen.queryByRole('button', { name: 'Khoá' })).not.toBeInTheDocument()
    expect(lockRowBtn).toBeDisabled()
    fireEvent.click(lockRowBtn)
    expect(toggleSpy).toHaveBeenCalledTimes(1)

    resolveToggle({ isLocked: true })
    await vi.waitFor(() => expect(lockRowBtn).not.toBeDisabled())
  })

  it('disables the delete confirm button while the delete mutation is pending, so a double-click sends only one delete request', async () => {
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)
    let resolveDelete
    const deletePromise = new Promise((resolve) => { resolveDelete = resolve })
    const deleteSpy = vi.spyOn(adminService, 'deleteAdminAccount').mockReturnValue(deletePromise)

    renderAccounts()
    await screen.findByText('Teacher User')

    const deleteButtons = screen.getAllByTitle('Xóa tài khoản')
    fireEvent.click(deleteButtons[deleteButtons.length - 1])
    const confirmBtn = await screen.findByRole('button', { name: 'Xóa' })

    fireEvent.click(confirmBtn)
    const pendingBtn = await screen.findByRole('button', { name: /Đang xóa/ })
    expect(pendingBtn).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    resolveDelete()
  })
})
