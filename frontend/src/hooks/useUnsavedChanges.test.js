import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useUnsavedChanges } from './useUnsavedChanges'

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
