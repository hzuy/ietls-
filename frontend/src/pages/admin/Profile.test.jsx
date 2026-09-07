import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Profile from './Profile'
import * as adminService from '../../services/adminService'

const mockProfile = {
  id: 1,
  name: 'Admin Manager',
  email: 'admin@manager.com',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderProfile(queryClient = createTestQueryClient()) {
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Profile page — TanStack Query & Skeleton caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile data when query resolves', async () => {
    vi.spyOn(adminService, 'getAdminMe').mockResolvedValue(mockProfile)

    renderProfile()

    expect(await screen.findByRole('heading', { name: 'Admin Manager' })).toBeInTheDocument()
    expect(screen.getAllByText('admin@manager.com').length).toBeGreaterThan(0)
    expect(screen.getByText('Cài đặt tài khoản')).toBeInTheDocument()
  })

  it('renders immediately from cache without spinner or delay', async () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'profile'], mockProfile)
    vi.spyOn(adminService, 'getAdminMe').mockResolvedValue(mockProfile)

    renderProfile(qc)

    // Data is visible synchronously from cache
    expect(screen.getByRole('heading', { name: 'Admin Manager' })).toBeInTheDocument()
    expect(screen.getAllByText('admin@manager.com').length).toBeGreaterThan(0)
  })

  it('validates password mismatch and length before calling mutation', async () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'profile'], mockProfile)
    vi.spyOn(adminService, 'getAdminMe').mockResolvedValue(mockProfile)
    vi.spyOn(adminService, 'changeAdminPassword').mockResolvedValue({ message: 'Success' })

    renderProfile(qc)

    const inputs = screen.getAllByDisplayValue('')
    const currentPwInput = inputs[0]
    const newPwInput = inputs[1]
    const confirmPwInput = inputs[2]

    // Mismatched passwords
    fireEvent.change(currentPwInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPwInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmPwInput, { target: { value: 'different' } })

    const submitBtn = screen.getByRole('button', { name: 'Đổi mật khẩu' })
    fireEvent.click(submitBtn)

    expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument()
    expect(adminService.changeAdminPassword).not.toHaveBeenCalled()

    // Short password (< 6 chars)
    fireEvent.change(newPwInput, { target: { value: '123' } })
    fireEvent.change(confirmPwInput, { target: { value: '123' } })
    fireEvent.click(submitBtn)

    expect(screen.getAllByText('Mật khẩu mới phải ít nhất 6 ký tự').length).toBe(2)
    expect(adminService.changeAdminPassword).not.toHaveBeenCalled()
  })

  it('calls changeAdminPassword on valid form submission and displays success message', async () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'profile'], mockProfile)
    vi.spyOn(adminService, 'getAdminMe').mockResolvedValue(mockProfile)
    vi.spyOn(adminService, 'changeAdminPassword').mockResolvedValue({ message: 'Password updated' })

    renderProfile(qc)

    const inputs = screen.getAllByDisplayValue('')
    fireEvent.change(inputs[0], { target: { value: 'oldpass123' } })
    fireEvent.change(inputs[1], { target: { value: 'validpassword' } })
    fireEvent.change(inputs[2], { target: { value: 'validpassword' } })

    const submitBtn = screen.getByRole('button', { name: 'Đổi mật khẩu' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(adminService.changeAdminPassword).toHaveBeenCalledWith('oldpass123', 'validpassword')
    })

    expect(await screen.findByText('✓ Đổi mật khẩu thành công')).toBeInTheDocument()
  })
})
