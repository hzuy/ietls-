import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminLayout from './AdminLayout'
import * as authContext from '../context/AuthContext'
import * as adminService from '../services/adminService'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderLayout(role) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    role,
    user: { id: 1, name: 'Test', email: 'test@test.com' },
    handleLogout: vi.fn(),
  })
  const qc = createTestQueryClient()
  return rtlRender(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AdminLayout sidebar — mục "Nhật ký hoạt động"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(adminService, 'getTrashCount').mockResolvedValue(0)
    vi.spyOn(adminService, 'onTrashChanged').mockReturnValue(() => {})
  })

  it('is visible to admin', () => {
    renderLayout('admin')
    expect(screen.getByText('Nhật ký hoạt động')).toBeInTheDocument()
  })

  it('is hidden from teacher', () => {
    renderLayout('teacher')
    expect(screen.queryByText('Nhật ký hoạt động')).not.toBeInTheDocument()
  })
})
