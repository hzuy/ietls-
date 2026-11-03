import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => null,
  useGoogleLogin: (opts) => () => opts?.onSuccess?.({ access_token: 'fake-google-token' }),
}))
vi.mock('../utils/alertUtils', () => ({ showAlert: vi.fn() }))
vi.mock('../services/userService', () => ({
  login: vi.fn(),
  register: vi.fn(),
  googleAuth: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}))

import AuthModal from './AuthModal'
import { login, register, verifyEmail, resendVerification } from '../services/userService'
import { showAlert } from '../utils/alertUtils'

function setup(tab = 'register') {
  const onSuccess = vi.fn()
  const onTabChange = vi.fn()
  render(
    <MemoryRouter>
      <AuthModal tab={tab} onTabChange={onTabChange} onSuccess={onSuccess} onClose={vi.fn()} />
    </MemoryRouter>
  )
  return { onSuccess, onTabChange }
}

const submit = name => screen.getAllByRole('button', { name }).find(b => b.closest('form'))

function fillRegister() {
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Lan' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lan@example.com' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } })
  fireEvent.click(submit('Đăng ký'))
}

describe('AuthModal email verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it.each(['login', 'register'])('provides a working password visibility toggle for %s', tab => {
    setup(tab)
    const password = screen.getByLabelText('Mật khẩu')
    fireEvent.change(password, { target: { value: 'Newpass8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('Newpass8')
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(register).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })

  it('reads eight-character registration passwords from live autofilled inputs', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: true, message: 'Đã gửi mã' })
    setup('register')
    screen.getByLabelText('Họ và tên').value = 'Lan'
    screen.getByLabelText('Email').value = 'lan@example.com'
    screen.getByLabelText('Mật khẩu').value = 'Newpass8'
    fireEvent.submit(screen.getByLabelText('Mật khẩu').closest('form'))
    await waitFor(() => expect(register).toHaveBeenCalledWith({ name: 'Lan', email: 'lan@example.com', password: 'Newpass8' }))
    expect(await screen.findByText('Xác thực email')).toBeInTheDocument()
  })

  it('uses a browser alert for password validation and clears silently when edited', async () => {
    setup('register')
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'short' } })
    fireEvent.submit(screen.getByLabelText('Mật khẩu').closest('form'))
    expect(showAlert).toHaveBeenCalledWith('Mật khẩu phải có ít nhất 8 ký tự', 'error')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Newpass8' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reads live login credentials even when browser autofill does not emit change events', async () => {
    login.mockResolvedValue({ token: 'test-token', user: { id: 1 }, requirePasswordChange: false })
    setup('login')
    screen.getByLabelText('Email').value = 'lan@example.com'
    screen.getByLabelText('Mật khẩu').value = 'Newpass8'
    fireEvent.submit(screen.getByLabelText('Mật khẩu').closest('form'))
    await waitFor(() => expect(login).toHaveBeenCalledWith('lan@example.com', 'Newpass8'))
  })

  it('shows the code step after registering instead of logging in', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: true, message: 'Long backend text with detailed instructions that should not be shown in the OTP notification.' })
    setup('register')
    fillRegister()

    expect(await screen.findByText('Xác thực email')).toBeInTheDocument()
    expect(screen.getByText('lan@example.com')).toBeInTheDocument()
    expect(showAlert).toHaveBeenCalledWith('Mã OTP đã được gửi tới lan@example.com.', 'success')
    expect(screen.queryByText(/Long backend text/)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText(/Gửi lại sau 60s/)).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logs in after a correct code', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: true, message: 'Đã gửi mã' })
    verifyEmail.mockResolvedValue({ token: 't', user: { id: 1, email: 'lan@example.com' }, requirePasswordChange: false })
    const { onSuccess } = setup('register')
    fillRegister()

    const input = await screen.findByLabelText('Mã xác thực')
    fireEvent.change(input, { target: { value: '12a3456' } })
    expect(input.value).toBe('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 1, email: 'lan@example.com' }))
    expect(verifyEmail).toHaveBeenCalledWith('lan@example.com', '123456')
    expect(localStorage.getItem('token')).toBe('t')
  })

  it('shows a browser alert for a wrong verification code', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: true, message: 'Đã gửi mã' })
    verifyEmail.mockRejectedValue({ response: { data: { code: 'INVALID_CODE', reason: 'invalid', message: 'Mã xác thực không đúng. Bạn còn 4 lần thử.' } } })
    const { onSuccess } = setup('register')
    fillRegister()

    fireEvent.change(await screen.findByLabelText('Mã xác thực'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực' }))

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Mã xác thực không đúng. Bạn còn 4 lần thử.', 'error'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('offers resend right away when the first mail failed', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: false, message: 'Chưa gửi được email' })
    resendVerification.mockResolvedValue({ message: 'Đã gửi mã mới', retryAfter: 60 })
    setup('register')
    fillRegister()

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Chưa gửi được mã OTP tới lan@example.com. Bạn có thể thử gửi lại.', 'warning'))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }))

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Mã OTP mới đã được gửi.', 'success'))
    expect(resendVerification).toHaveBeenCalledWith('lan@example.com')
    expect(screen.getByText(/Gửi lại sau 60s/)).toBeInTheDocument()
  })

  it('moves an unverified login to the code step', async () => {
    login.mockRejectedValue({ response: { status: 403, data: { code: 'EMAIL_NOT_VERIFIED', email: 'lan@example.com', mailSent: true, message: 'Email chưa được xác thực' } } })
    setup('login')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lan@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } })
    fireEvent.click(submit('Đăng nhập'))

    expect(await screen.findByText('Xác thực email')).toBeInTheDocument()
    expect(showAlert).toHaveBeenCalledWith('Mã OTP đã được gửi tới lan@example.com.', 'success')
    expect(screen.queryByText('Email chưa được xác thực')).not.toBeInTheDocument()
  })

  it('renders native Google button and handles google login', async () => {
    const { googleAuth } = await import('../services/userService')
    googleAuth.mockResolvedValueOnce({
      token: 'jwt-google-token',
      user: { id: 10, email: 'google@example.com' },
      requirePasswordChange: false,
    })

    const { onSuccess } = setup('login')
    const googleBtn = screen.getByRole('button', { name: 'Đăng nhập bằng Google' })
    expect(googleBtn).toBeInTheDocument()

    fireEvent.click(googleBtn)
    await waitFor(() => {
      expect(googleAuth).toHaveBeenCalledWith({ accessToken: 'fake-google-token' })
      expect(onSuccess).toHaveBeenCalledWith({ id: 10, email: 'google@example.com' })
      expect(localStorage.getItem('token')).toBe('jwt-google-token')
    })
  })
})

