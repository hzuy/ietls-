import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PasswordInput from './PasswordInput'
import { useState } from 'react'

it('reveals and hides the same password without submitting or changing its value', () => {
  const submit = vi.fn(event => event.preventDefault())
  render(<form onSubmit={submit}><label htmlFor="password">Mật khẩu</label><PasswordInput id="password" name="password" defaultValue="Newpass8" autoComplete="new-password" /></form>)
  const input = screen.getByLabelText('Mật khẩu')
  expect(input).toHaveAttribute('type', 'password')
  expect(input).toHaveAttribute('autocomplete', 'new-password')
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
  expect(input).toHaveAttribute('type', 'text')
  expect(input).toHaveValue('Newpass8')
  expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute('aria-pressed', 'true')
  expect(new FormData(input.form).get('password')).toBe('Newpass8')
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
  expect(input).toHaveAttribute('type', 'password')
  expect(submit).not.toHaveBeenCalled()
})

it('keeps each field visibility independent and disables the toggle with the input', () => {
  render(<><PasswordInput id="current" visibilityLabel="mật khẩu hiện tại" /><PasswordInput id="new" visibilityLabel="mật khẩu mới" disabled /></>)
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu hiện tại' }))
  expect(document.getElementById('current')).toHaveAttribute('type', 'text')
  expect(document.getElementById('new')).toHaveAttribute('type', 'password')
  expect(screen.getByRole('button', { name: 'Hiện mật khẩu mới' })).toBeDisabled()
})

it('preserves a controlled field autofilled without a change event when revealing it', () => {
  function ControlledPassword() {
    const [value, setValue] = useState('short')
    return <><label htmlFor="autofill">Mật khẩu</label><PasswordInput id="autofill" value={value} onChange={event => setValue(event.target.value)} /></>
  }
  render(<ControlledPassword />)
  const input = screen.getByLabelText('Mật khẩu')
  input.value = 'Newpass8'
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
  expect(input).toHaveValue('Newpass8')
  expect(input).toHaveAttribute('type', 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
  expect(input).toHaveValue('Newpass8')
})
