import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderHook, render, screen } from '@testing-library/react'
import { useUnsavedChanges, NAV_LEAVE_MSG } from './useUnsavedChanges'
import { FormDirtyProvider, useFormDirty } from '../context/FormDirtyContext'

describe('useUnsavedChanges Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers beforeunload event listener when isDirty is true', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(({ isDirty }) => useUnsavedChanges(isDirty), {
      initialProps: { isDirty: true }
    })

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('does not trigger preventDefault when isDirty is false', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    renderHook(({ isDirty }) => useUnsavedChanges(isDirty), {
      initialProps: { isDirty: false }
    })

    const handlerCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'beforeunload')
    const handler = handlerCall[1]

    const event = { preventDefault: vi.fn(), returnValue: undefined }
    handler(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('triggers preventDefault when isDirty is true', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    renderHook(({ isDirty }) => useUnsavedChanges(isDirty), {
      initialProps: { isDirty: true }
    })

    const handlerCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'beforeunload')
    const handler = handlerCall[1]

    const event = { preventDefault: vi.fn(), returnValue: undefined }
    handler(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.returnValue).toBe('')
  })
})

// ─── Back / Forward: popstate sentinel-trap ────────────────────────────────────
describe('useUnsavedChanges — popstate sentinel-trap', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('arms a sentinel (pushState) + a popstate listener when isDirty', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState')
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useUnsavedChanges(true))

    expect(pushStateSpy).toHaveBeenCalledTimes(1)
    expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
  })

  it('arms nothing when not dirty', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState')
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useUnsavedChanges(false))

    expect(pushStateSpy).not.toHaveBeenCalled()
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('popstate', expect.any(Function))
  })

  it('on Back: confirm accepted → calls history.back() once (with the shared message)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    renderHook(() => useUnsavedChanges(true))
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(confirmSpy).toHaveBeenCalledWith(NAV_LEAVE_MSG)
    expect(backSpy).toHaveBeenCalledTimes(1)
  })

  it('on Back: confirm rejected → re-arms sentinel, does NOT call history.back()', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    renderHook(() => useUnsavedChanges(true))
    pushStateSpy.mockClear() // ignore the initial arm

    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(backSpy).not.toHaveBeenCalled()
    expect(pushStateSpy).toHaveBeenCalledTimes(1) // re-armed
  })

  it('ignores the popstate caused by its own history.back() (no double confirm)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    // history.back() itself would fire a popstate in a real browser — simulate that
    vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    renderHook(() => useUnsavedChanges(true))
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
  })

  it('removes the popstate listener when isDirty flips to false', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { rerender } = renderHook(({ isDirty }) => useUnsavedChanges(isDirty), {
      initialProps: { isDirty: true }
    })
    rerender({ isDirty: false })

    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
  })
})

// ─── Đăng ký trạng thái dirty lên FormDirtyContext ────────────────────────────
describe('useUnsavedChanges — FormDirtyContext registration', () => {
  const wrapper = ({ children }) => createElement(FormDirtyProvider, null, children)

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('no-ops without a provider (does not throw)', () => {
    expect(() => renderHook(() => useUnsavedChanges(true))).not.toThrow()
  })

  it('propagates isDirty up to the context and follows it back down to false', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }) => {
        useUnsavedChanges(isDirty)
        return useFormDirty()
      },
      { wrapper, initialProps: { isDirty: false } }
    )

    expect(result.current).toBe(false)

    rerender({ isDirty: true })
    expect(result.current).toBe(true)

    rerender({ isDirty: false })
    expect(result.current).toBe(false)
  })

  it('resets the context to false when the dirty component unmounts', () => {
    function DirtyReporter() {
      useUnsavedChanges(true)
      return null
    }
    function Probe() {
      return createElement('span', { 'data-testid': 'ctx' }, String(useFormDirty()))
    }

    const { rerender } = render(
      createElement(
        FormDirtyProvider,
        null,
        createElement(DirtyReporter, { key: 'reporter' }),
        createElement(Probe, { key: 'probe' }),
      ),
    )
    expect(screen.getByTestId('ctx').textContent).toBe('true')

    rerender(
      createElement(FormDirtyProvider, null, createElement(Probe, { key: 'probe' })),
    )
    expect(screen.getByTestId('ctx').textContent).toBe('false')
  })
})
