import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { routeNeedsAuth, useAuthGate } from './useAuthGate'

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockOpenAuthModal = vi.fn()
let mockUser = null
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, openAuthModal: mockOpenAuthModal }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = null
})

// ─── routeNeedsAuth ───────────────────────────────────────────────────────────
describe('routeNeedsAuth — public routes', () => {
  it.each([
    '/',
    '/writing-samples',
    '/speaking-samples',
    '/writing-samples?task=task1',
    '/speaking-samples?part=task2',
    '/samples/writing/5',
    '/samples/speaking/9',
    '/change-password',
    '/full-test/123',            // FullTestDetail — public
    '/full-test/123?book=4',
    '/full-test/7/anything',
  ])('%s → false', (path) => {
    expect(routeNeedsAuth(path)).toBe(false)
  })
})

describe('routeNeedsAuth — private routes', () => {
  it.each([
    '/full-test',
    '/full-test/result',
    '/cambridge',
    '/practice-plus',
    '/practice/reading',
    '/practice/reading/5',
    '/practice/listening',
    '/practice/listening/7',
    '/reading/12',
    '/reading/12/result',
    '/listening/3',
    '/listening/3/result',
    '/writing/4',
    '/speaking/8',
    '/profile',
    '/progress',
  ])('%s → true', (path) => {
    expect(routeNeedsAuth(path)).toBe(true)
  })
})

describe('routeNeedsAuth — edge cases', () => {
  it('/full-test/result is NOT excluded by the /full-test/:id numeric guard', () => {
    expect(routeNeedsAuth('/full-test/result')).toBe(true)
  })

  it('/full-test/:id (numeric) IS excluded → public', () => {
    expect(routeNeedsAuth('/full-test/1')).toBe(false)
    expect(routeNeedsAuth('/full-test/999')).toBe(false)
  })

  it('/full-test exact still requires auth', () => {
    expect(routeNeedsAuth('/full-test')).toBe(true)
  })

  it('/writing-samples is NOT caught by the /writing prefix', () => {
    expect(routeNeedsAuth('/writing-samples')).toBe(false)
    expect(routeNeedsAuth('/speaking-samples')).toBe(false)
  })

  it('strips query + hash before matching', () => {
    expect(routeNeedsAuth('/practice/reading/5?resume=true')).toBe(true)
    expect(routeNeedsAuth('/profile#settings')).toBe(true)
    expect(routeNeedsAuth('/full-test?foo=bar')).toBe(true)
  })

  it('non-string input → false', () => {
    expect(routeNeedsAuth(undefined)).toBe(false)
    expect(routeNeedsAuth(null)).toBe(false)
    expect(routeNeedsAuth(123)).toBe(false)
  })

  it('does not match a similarly-named sibling (/profiles vs /profile)', () => {
    expect(routeNeedsAuth('/profiles')).toBe(false)
  })
})

// ─── useAuthGate ──────────────────────────────────────────────────────────────
describe('useAuthGate — guest (user = null)', () => {
  it('private path → opens auth modal with default tab "login" + redirectTo = path, does NOT navigate', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/cambridge')

    expect(mockOpenAuthModal).toHaveBeenCalledWith('login', '/cambridge')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('private path with { tab: "register" } → opens modal on the register tab', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/full-test', { tab: 'register' })

    expect(mockOpenAuthModal).toHaveBeenCalledWith('register', '/full-test')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('private path carries query string through to redirectTo', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/practice/reading/5?resume=true')

    expect(mockOpenAuthModal).toHaveBeenCalledWith('login', '/practice/reading/5?resume=true')
  })

  it('public path → navigates straight through, no modal', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/writing-samples')

    expect(mockNavigate).toHaveBeenCalledWith('/writing-samples')
    expect(mockOpenAuthModal).not.toHaveBeenCalled()
  })

  it('{ force: true } on a public path → still gated (opens modal)', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/full-test/123', { force: true })

    expect(mockOpenAuthModal).toHaveBeenCalledWith('login', '/full-test/123')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('{ force: false } on a private path → bypasses the gate (navigates)', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/cambridge', { force: false })

    expect(mockNavigate).toHaveBeenCalledWith('/cambridge')
    expect(mockOpenAuthModal).not.toHaveBeenCalled()
  })
})

describe('useAuthGate — logged in (user set)', () => {
  beforeEach(() => {
    mockUser = { id: 1, name: 'Duy' }
  })

  it('private path → navigates straight, never opens the modal', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/cambridge', { tab: 'register' })

    expect(mockNavigate).toHaveBeenCalledWith('/cambridge')
    expect(mockOpenAuthModal).not.toHaveBeenCalled()
  })

  it('public path → navigates', () => {
    const { result } = renderHook(() => useAuthGate())
    result.current('/writing-samples')

    expect(mockNavigate).toHaveBeenCalledWith('/writing-samples')
    expect(mockOpenAuthModal).not.toHaveBeenCalled()
  })
})
