import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Profile from './Profile'
import * as adminService from '../../services/adminService'

const { handleLogout } = vi.hoisted(() => ({ handleLogout: vi.fn() }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ handleLogout }) }))

const mockProfile = {
  id: 1,
  name: 'Admin Manager',
  email: 'admin@manager.com',
  role: 'admin',
  hasPassword: true,
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

    expect(window.alert).toHaveBeenCalledWith('Mật khẩu xác nhận không khớp')
    expect(adminService.changeAdminPassword).not.toHaveBeenCalled()

    // Short password (< 8 chars)
    fireEvent.change(newPwInput, { target: { value: '123' } })
    fireEvent.change(confirmPwInput, { target: { value: '123' } })
    fireEvent.click(submitBtn)

    expect(window.alert).toHaveBeenCalledWith('Mật khẩu mới phải có ít nhất 8 ký tự')
    expect(adminService.changeAdminPassword).not.toHaveBeenCalled()
  })

  it.each(['admin', 'teacher'])('changes %s passwords with an alert and logs out', async (role) => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'profile'], { ...mockProfile, role })
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

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'))
    expect(handleLogout).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveValue('')
  })

  it('prevents duplicate submissions and disables the fields during the request', () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'profile'], mockProfile)
    vi.spyOn(adminService, 'changeAdminPassword').mockReturnValue(new Promise(() => {}))
    renderProfile(qc)
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'old-password' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'new-password' } })
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'new-password' } })
    const form = screen.getByLabelText('Mật khẩu hiện tại').closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(adminService.changeAdminPassword).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Đang đổi mật khẩu…' })).toBeDisabled()
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeDisabled()
  })

  it('shows Google guidance for staff accounts without a local password', () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'profile'], { ...mockProfile, hasPassword: false })
    renderProfile(qc)
    expect(screen.getByText(/Vui lòng quản lý mật khẩu trong tài khoản Google/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()
  })
})
