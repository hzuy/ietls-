import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GatedLink from './GatedLink'

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockGate = vi.fn()
vi.mock('../../hooks/useAuthGate', async (importOriginal) => {
  const actual = await importOriginal() // giữ routeNeedsAuth thật
  return { ...actual, useAuthGate: () => mockGate }
})

let mockUser = null
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const renderLink = (props) =>
  render(
    <MemoryRouter>
      <GatedLink {...props} />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = null
})

// ─── Rendering ────────────────────────────────────────────────────────────────
describe('GatedLink — rendering', () => {
  it('renders a real anchor with the correct href', () => {
    renderLink({ to: '/cambridge', children: 'Xem tất cả' })
    const link = screen.getByRole('link', { name: 'Xem tất cả' })
    expect(link).toHaveAttribute('href', '/cambridge')
  })

  it('forwards className / arbitrary props down to <Link>', () => {
    renderLink({ to: '/writing-samples', className: 'foo', 'data-x': 'y', children: 'x' })
    const link = screen.getByRole('link')
    expect(link).toHaveClass('foo')
    expect(link).toHaveAttribute('data-x', 'y')
  })
})

// ─── Left-click gating ────────────────────────────────────────────────────────
describe('GatedLink — guest (user = null)', () => {
  it('private route: left-click → preventDefault + gate(to, { tab: "login" })', () => {
    renderLink({ to: '/cambridge', children: 'x' })
    const link = screen.getByRole('link')

    const evt = createEvent.click(link, { button: 0 })
    fireEvent(link, evt)

    expect(evt.defaultPrevented).toBe(true)
    expect(mockGate).toHaveBeenCalledWith('/cambridge', { tab: 'login' })
  })

  it('private route with tab="register" → gate(to, { tab: "register" })', () => {
    renderLink({ to: '/full-test', tab: 'register', children: 'x' })
    fireEvent.click(screen.getByRole('link'))
    expect(mockGate).toHaveBeenCalledWith('/full-test', { tab: 'register' })
  })

  it('public route: left-click → NOT gated (let <Link> do SPA navigation)', () => {
    // Note: <Link> itself calls preventDefault() on a plain left-click to route
    // client-side, so `defaultPrevented` is not a signal for OUR interception —
    // the real signal is that gate() was never called.
    renderLink({ to: '/writing-samples', children: 'x' })
    fireEvent.click(screen.getByRole('link'))
    expect(mockGate).not.toHaveBeenCalled()
  })

  it('private route + Ctrl/Cmd-click → NOT intercepted (open-in-new-tab works)', () => {
    renderLink({ to: '/cambridge', children: 'x' })
    const link = screen.getByRole('link')

    const ctrl = createEvent.click(link, { button: 0, ctrlKey: true })
    fireEvent(link, ctrl)
    expect(ctrl.defaultPrevented).toBe(false)

    const meta = createEvent.click(link, { button: 0, metaKey: true })
    fireEvent(link, meta)
    expect(meta.defaultPrevented).toBe(false)

    expect(mockGate).not.toHaveBeenCalled()
  })

  it('calls a caller-supplied onClick before gating', () => {
    const onClick = vi.fn()
    renderLink({ to: '/cambridge', onClick, children: 'x' })
    fireEvent.click(screen.getByRole('link'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(mockGate).toHaveBeenCalled()
  })

  it('respects a caller onClick that calls preventDefault (skips gating)', () => {
    const onClick = vi.fn((e) => e.preventDefault())
    renderLink({ to: '/cambridge', onClick, children: 'x' })
    fireEvent.click(screen.getByRole('link'))

    expect(onClick).toHaveBeenCalled()
    expect(mockGate).not.toHaveBeenCalled()
  })
})

describe('GatedLink — logged in (user set)', () => {
  beforeEach(() => {
    mockUser = { id: 1, name: 'Duy' }
  })

  it('private route: left-click → NOT gated, <Link> handles it', () => {
    renderLink({ to: '/cambridge', children: 'x' })
    fireEvent.click(screen.getByRole('link'))
    expect(mockGate).not.toHaveBeenCalled()
  })
})
