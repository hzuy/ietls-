import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ChangePassword from './ChangePassword'
import { changePassword, getMe } from '../services/userService'

const { handleLogout } = vi.hoisted(() => ({ handleLogout: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ handleLogout }) }))
vi.mock('../services/userService', () => ({ changePassword: vi.fn(), getMe: vi.fn() }))

async function openPage() {
  render(<MemoryRouter initialEntries={['/change-password']}><Routes>
    <Route path="/change-password" element={<ChangePassword />} />
    <Route path="/" element={<p>Trang chủ</p>} />
  </Routes></MemoryRouter>)
  if (localStorage.getItem('token')) await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận đổi mật khẩu' })).toBeEnabled())
}
function fill(password = 'new-password') {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'old-password' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi mật khẩu' }))
}

describe('mandatory password change', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    localStorage.setItem('token', 'test-token')
    getMe.mockResolvedValue({ hasPassword: true })
  })

  it('redirects guests to the home login flow without requesting profile data', async () => {
    localStorage.clear()
    await openPage()
    expect(screen.getByText('Trang chủ')).toBeInTheDocument()
    expect(getMe).not.toHaveBeenCalled()
  })

  it('alerts and logs out after a successful change', async () => {
    changePassword.mockResolvedValue({})
    await openPage()
    fill()
    await waitFor(() => expect(handleLogout).toHaveBeenCalledOnce())
    expect(window.alert).toHaveBeenCalledWith('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('')
  })

  it.each(['old-password', 'ế'.repeat(25), '1234567'])('shows server validation after checking the current password', async password => {
    changePassword.mockRejectedValue({ response: { data: { message: 'Mật khẩu mới không hợp lệ' } } })
    await openPage()
    fill(password)
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Mật khẩu mới không hợp lệ'))
    expect(changePassword).toHaveBeenCalledWith('old-password', password)
    expect(handleLogout).not.toHaveBeenCalled()
  })

  it('keeps the form and session usable after network failure', async () => {
    changePassword.mockRejectedValue(new Error('network failed'))
    await openPage()
    fill()
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Không thể đổi mật khẩu. Vui lòng kiểm tra kết nối và thử lại.'))
    expect(handleLogout).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Xác nhận đổi mật khẩu' })).toBeEnabled()
  })

  it('clears a stale mandatory flag for Google-only accounts and offers a way home', async () => {
    localStorage.setItem('requirePasswordChange', 'true')
    getMe.mockResolvedValue({ hasPassword: false })
    render(<MemoryRouter><ChangePassword /></MemoryRouter>)
    expect(await screen.findByText(/Vui lòng quản lý mật khẩu trong tài khoản Google/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()
    expect(localStorage.getItem('requirePasswordChange')).toBeNull()
  })
})
