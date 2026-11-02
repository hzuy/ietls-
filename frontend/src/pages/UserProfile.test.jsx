import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UserProfile from './UserProfile'
import { getMe, updateProfile, changePassword } from '../services/userService'

const { setUser, handleLogout } = vi.hoisted(() => ({ setUser: vi.fn(), handleLogout: vi.fn() }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Learner', email: 'learner@example.com' }, setUser, handleLogout }),
}))
vi.mock('../services/userService', () => ({
  getMe: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(), getUserStats: vi.fn(),
}))

async function openProfile() {
  render(<MemoryRouter><UserProfile /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('Ngày tham gia')).not.toHaveValue('—'))
}

function submitPassword(newPassword = 'new-password', confirmation = newPassword) {
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'old-password' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: newPassword } })
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: confirmation } })
  fireEvent.submit(screen.getByLabelText('Mật khẩu hiện tại').closest('form'))
}

describe('UserProfile alert feedback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    localStorage.clear()
    getMe.mockResolvedValue({ name: 'Learner', createdAt: '2026-01-01', hasPassword: true })
  })

  it('alerts after saving information and updates the local user', async () => {
    updateProfile.mockResolvedValue({ name: 'Updated learner' })
    await openProfile()
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Updated learner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Cập nhật thành công!'))
    expect(updateProfile).toHaveBeenCalledWith('Updated learner')
    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated learner' }))
    expect(JSON.parse(localStorage.getItem('user')).name).toBe('Updated learner')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['info', 'password'])('alerts API failures for %s', async (tab) => {
    const error = { response: { data: { message: 'Yêu cầu không hợp lệ' } } }
    updateProfile.mockRejectedValue(error)
    changePassword.mockRejectedValue(error)
    await openProfile()
    if (tab === 'info') fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    else submitPassword()
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Yêu cầu không hợp lệ'))
  })

  it.each([
    ['short', 'short', 'Mật khẩu mới phải có ít nhất 8 ký tự'],
    ['new-password', 'different-password', 'Mật khẩu xác nhận không khớp'],
  ])('alerts validation errors without sending a password request (%s)', async (password, confirmation, message) => {
    await openProfile()
    submitPassword(password, confirmation)
    expect(window.alert).toHaveBeenCalledWith(message)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('alerts password success and clears password fields', async () => {
    changePassword.mockResolvedValue({})
    await openProfile()
    submitPassword()
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'))
    expect(handleLogout).toHaveBeenCalledOnce()
    expect(changePassword).toHaveBeenCalledWith('old-password', 'new-password')
    await waitFor(() => expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveValue(''))
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('')
    expect(screen.getByLabelText('Xác nhận mật khẩu mới')).toHaveValue('')
  })

  it('blocks duplicate submissions while a password change is pending', async () => {
    changePassword.mockReturnValue(new Promise(() => {}))
    await openProfile()
    submitPassword()
    const form = screen.getByLabelText('Mật khẩu hiện tại').closest('form')
    fireEvent.submit(form)
    expect(changePassword).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Đang đổi mật khẩu…' })).toBeDisabled()
    expect(handleLogout).not.toHaveBeenCalled()
  })

  it('shows Google guidance instead of an unusable password form', async () => {
    getMe.mockResolvedValue({ name: 'Learner', createdAt: '2026-01-01', hasPassword: false })
    await openProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(screen.getByText(/Vui lòng quản lý mật khẩu trong tài khoản Google/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()
  })

  it('shows specific server validation errors and keeps the session on a failed change', async () => {
    changePassword.mockRejectedValue({ response: { data: { message: 'Dữ liệu không hợp lệ', errors: [{ field: 'newPassword', message: 'Mật khẩu không hợp lệ' }] } } })
    await openProfile()
    submitPassword()
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Mật khẩu không hợp lệ'))
    expect(handleLogout).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('new-password')
    expect(screen.getByLabelText('Mật khẩu hiện tại').closest('form').querySelector('button[type="submit"]')).toBeEnabled()
  })
})
