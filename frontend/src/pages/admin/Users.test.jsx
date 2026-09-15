import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Users from './Users'
import * as adminService from '../../services/adminService'
import { ToastProvider } from '../../context/ToastContext'

const mockUsersData = {
  users: [
    {
      id: 1,
      name: 'Nguyen Van A',
      email: 'userA@test.com',
      role: 'user',
      isLocked: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      _count: { attempts: 5 },
      avgScore: 6.5,
    },
    {
      id: 2,
      name: 'Tran Thi B',
      email: 'userB@test.com',
      role: 'user',
      isLocked: true,
      createdAt: '2026-02-01T00:00:00.000Z',
      _count: { attempts: 2 },
      avgScore: 7.0,
    },
  ],
  total: 2,
  pages: 1,
  totalActive: 1,
  totalLocked: 1,
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderUsers(queryClient = createTestQueryClient()) {
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Users />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('Users page — TanStack Query & Skeleton caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders user list and stats after data loads', async () => {
    vi.spyOn(adminService, 'getAdminUsers').mockResolvedValue(mockUsersData)

    renderUsers()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
    expect(screen.getByText('(2 người)')).toBeInTheDocument()
    expect(screen.getByText('userA@test.com')).toBeInTheDocument()
    expect(screen.getByText('userB@test.com')).toBeInTheDocument()
  })

  it('renders instantly from cache without spinner or skeleton', async () => {
    const qc = createTestQueryClient()
    // Pre-populate cache
    qc.setQueryData(
      ['admin', 'users', { search: '', page: 1, limit: 10, status: '', sort: 'newest' }],
      mockUsersData
    )
    vi.spyOn(adminService, 'getAdminUsers').mockResolvedValue(mockUsersData)

    renderUsers(qc)

    // Data is immediately visible synchronously
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
  })

  it('calls toggleUserLock on lock/unlock mutation and invalidates cache', async () => {
    vi.spyOn(adminService, 'getAdminUsers').mockResolvedValue(mockUsersData)
    vi.spyOn(adminService, 'toggleUserLock').mockResolvedValue({ message: 'Success', isLocked: true })

    renderUsers()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()

    // Find the lock button for the first user
    const lockButtons = screen.getAllByTitle('Khoá tài khoản')
    fireEvent.click(lockButtons[0])

    // Lock confirmation modal should appear
    expect(screen.getByRole('heading', { name: 'Khoá tài khoản' })).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: 'Khoá' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(adminService.toggleUserLock).toHaveBeenCalledWith(1)
    })
  })

  it('calls deleteAdminUser on delete mutation and closes modal', async () => {
    vi.spyOn(adminService, 'getAdminUsers').mockResolvedValue(mockUsersData)
    vi.spyOn(adminService, 'deleteAdminUser').mockResolvedValue({ message: 'Deleted' })

    renderUsers()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()

    const deleteButtons = screen.getAllByTitle('Xoá tài khoản')
    fireEvent.click(deleteButtons[0])

    // Delete confirmation modal should appear
    expect(screen.getByRole('heading', { name: 'Xác nhận xóa' })).toBeInTheDocument()

    const confirmDelBtn = screen.getByRole('button', { name: 'Xóa' })
    fireEvent.click(confirmDelBtn)

    await waitFor(() => {
      expect(adminService.deleteAdminUser).toHaveBeenCalledWith(1)
    })
  })

  it('re-queries with the selected status when the status dropdown changes', async () => {
    vi.spyOn(adminService, 'getAdminUsers').mockResolvedValue(mockUsersData)

    renderUsers()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Lọc theo trạng thái' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Không hoạt động' }))

    await waitFor(() => {
      expect(adminService.getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'locked' })
      )
    })
    expect(screen.getByText('Không hoạt động', { selector: 'button span' })).toBeInTheDocument()
  })
})
