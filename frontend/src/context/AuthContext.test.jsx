import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { queryClient } from '../lib/queryClient'

vi.mock('../components/AuthModal', () => ({ default: () => null }))

function Consumer() {
  const { user, handleLogout } = useAuth()
  const location = useLocation()
  return <><span>{user?.name || 'Guest'}</span><span>{location.pathname}</span><button onClick={handleLogout}>Log out</button></>
}

beforeEach(() => {
  localStorage.clear()
  queryClient.clear()
})

it('clears authentication and all account query data when logging out after a password change', () => {
  localStorage.setItem('token', 'old-session')
  localStorage.setItem('user', JSON.stringify({ name: 'Learner', role: 'user' }))
  localStorage.setItem('requirePasswordChange', 'true')
  queryClient.setQueryData(['admin', 'profile'], { email: 'private@example.test' })
  queryClient.setQueryData(['myHistory'], ['private-history'])
  render(<MemoryRouter initialEntries={['/profile']}><AuthProvider><Consumer /></AuthProvider></MemoryRouter>)
  expect(screen.getByText('Learner')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(screen.getByText('Guest')).toBeInTheDocument()
  expect(screen.getByText('/')).toBeInTheDocument()
  expect(localStorage.getItem('token')).toBeNull()
  expect(localStorage.getItem('user')).toBeNull()
  expect(localStorage.getItem('requirePasswordChange')).toBeNull()
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
})
