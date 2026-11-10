import { createRef } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AutoGrowTextarea from './AutoGrowTextarea'

afterEach(() => vi.restoreAllMocks())

describe('AutoGrowTextarea', () => {
  it('fits existing content, controlled updates, and shorter values including borders', () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(function () { return this.value.length > 20 ? 180 : 30 })
    const { rerender } = render(<AutoGrowTextarea aria-label="Content" value={'Long content '.repeat(20)} onChange={() => {}} style={{ border: '2px solid black' }} />)
    const field = screen.getByRole('textbox')
    expect(field.style.height).toBe('184px')
    rerender(<AutoGrowTextarea aria-label="Content" value="Short" onChange={() => {}} style={{ border: '2px solid black' }} />)
    expect(field.style.height).toBe('34px')
    expect(field).toHaveStyle({ overflowY: 'hidden', overflowWrap: 'anywhere' })
  })
  it('grows on paste/input and forwards the actual textarea ref for token insertion', () => {
    const ref = createRef()
    const input = vi.fn()
    render(<AutoGrowTextarea ref={ref} aria-label="Content" defaultValue="Short" onInput={input} />)
    Object.defineProperty(ref.current, 'scrollHeight', { configurable: true, value: 200 })
    fireEvent.input(ref.current, { target: { value: 'Pasted content '.repeat(40) } })
    expect(parseFloat(ref.current.style.height)).toBeGreaterThanOrEqual(200)
    ref.current.setSelectionRange(4, 4)
    expect(ref.current.selectionStart).toBe(4)
    expect(input).toHaveBeenCalledOnce()
  })
  it('reflows when the container width changes and disconnects the observer', () => {
    let callback
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class { constructor(cb) { callback = cb } observe() {} disconnect = disconnect })
    const { unmount } = render(<AutoGrowTextarea aria-label="Content" defaultValue="Text" />)
    const field = screen.getByRole('textbox')
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({ width: 180 })
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 240 })
    callback()
    expect(parseFloat(field.style.height)).toBeGreaterThanOrEqual(240)
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
