import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }))
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

  it('shows the code step after registering instead of logging in', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: true, message: 'Đã gửi mã' })
    setup('register')
    fillRegister()

    expect(await screen.findByText('Xác thực email')).toBeInTheDocument()
    expect(screen.getByText('lan@example.com')).toBeInTheDocument()
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

  it('shows the server error for a wrong code', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: true, message: 'Đã gửi mã' })
    verifyEmail.mockRejectedValue({ response: { data: { code: 'INVALID_CODE', reason: 'invalid', message: 'Mã xác thực không đúng. Bạn còn 4 lần thử.' } } })
    const { onSuccess } = setup('register')
    fillRegister()

    fireEvent.change(await screen.findByLabelText('Mã xác thực'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực' }))

    expect(await screen.findByText('Mã xác thực không đúng. Bạn còn 4 lần thử.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('offers resend right away when the first mail failed', async () => {
    register.mockResolvedValue({ email: 'lan@example.com', mailSent: false, message: 'Chưa gửi được email' })
    resendVerification.mockResolvedValue({ message: 'Đã gửi mã mới', retryAfter: 60 })
    setup('register')
    fillRegister()

    expect(await screen.findByText('Chưa gửi được email')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }))

    expect(await screen.findByText('Đã gửi mã mới')).toBeInTheDocument()
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
    expect(screen.getByText('Email chưa được xác thực')).toBeInTheDocument()
  })
})
