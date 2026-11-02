import { beforeEach, expect, it } from 'vitest'
import api from './axios'
import { queryClient } from '../lib/queryClient'

beforeEach(() => {
  localStorage.clear()
  queryClient.clear()
  window.history.replaceState({}, '', '/')
})

function rejectResponse(status, data) {
  return { adapter: config => Promise.reject({ config, response: { status, data } }) }
}

it('restores the mandatory-change flag from the backend after a client removes it', async () => {
  window.history.replaceState({}, '', '/change-password')
  localStorage.setItem('token', 'session')
  queryClient.setQueryData(['private'], ['private-value'])
  await expect(api.get('/user/stats', rejectResponse(403, { code: 'PASSWORD_CHANGE_REQUIRED' }))).rejects.toBeDefined()
  expect(localStorage.getItem('requirePasswordChange')).toBe('true')
  expect(localStorage.getItem('token')).toBe('session')
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
})

it('clears expired/revoked sessions and private caches', async () => {
  localStorage.setItem('token', 'old-session')
  localStorage.setItem('user', '{}')
  queryClient.setQueryData(['private'], ['private-value'])
  await expect(api.get('/auth/me', rejectResponse(401, { code: 'SESSION_REVOKED' }))).rejects.toBeDefined()
  expect(localStorage.getItem('token')).toBeNull()
  expect(localStorage.getItem('user')).toBeNull()
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
})

it('does not log out for incorrect current passwords or rate limiting', async () => {
  localStorage.setItem('token', 'active-session')
  for (const status of [400, 429]) {
    await expect(api.put('/auth/change-password', {}, rejectResponse(status, { message: 'Retry' }))).rejects.toBeDefined()
    expect(localStorage.getItem('token')).toBe('active-session')
  }
})
