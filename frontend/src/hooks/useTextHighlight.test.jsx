import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useTextHighlight } from './useTextHighlight'
import HighlightPopovers from '../components/exam/HighlightPopovers'

describe('useTextHighlight hook', () => {
  it('initializes with empty highlights and closed popovers', () => {
    const { result } = renderHook(() => {
      const ref = useRef(null)
      return useTextHighlight({ passageRef: ref, scopeIndex: 0 })
    })

    expect(result.current.highlights).toEqual([])
    expect(result.current.scopeHighlights).toEqual([])
    expect(result.current.selectionBubble).toBeNull()
    expect(result.current.highlightMenu).toBeNull()
    expect(result.current.noteEditor).toBeNull()
  })

  it('allows adding and removing highlights programmatically', () => {
    const { result } = renderHook(() => {
      const ref = useRef(null)
      return useTextHighlight({ passageRef: ref, scopeIndex: 0 })
    })

    act(() => {
      result.current.setHighlights([
        { id: 'hl-1', scopeIndex: 0, paraIndex: 0, start: 5, end: 15 },
        { id: 'hl-2', scopeIndex: 1, paraIndex: 0, start: 0, end: 10 },
      ])
    })

    expect(result.current.highlights.length).toBe(2)
    // scopeHighlights only includes scopeIndex: 0
    expect(result.current.scopeHighlights.length).toBe(1)
    expect(result.current.scopeHighlights[0].id).toBe('hl-1')

    // Clear highlight hl-1
    act(() => {
      result.current.clearHighlight('hl-1')
    })

    expect(result.current.highlights.length).toBe(1)
    expect(result.current.scopeHighlights.length).toBe(0)
  })

  it('opens note editor and saves notes correctly', () => {
    const { result } = renderHook(() => {
      const ref = useRef(null)
      return useTextHighlight({ passageRef: ref, scopeIndex: 0 })
    })

    act(() => {
      result.current.setHighlights([
        { id: 'hl-1', scopeIndex: 0, paraIndex: 0, start: 5, end: 15 },
      ])
    })

    // Edit note
    act(() => {
      result.current.openHighlightMenu(result.current.highlights[0], { clientX: 100, clientY: 100 })
    })
    expect(result.current.highlightMenu).not.toBeNull()

    act(() => {
      result.current.editHighlightNote()
    })
    expect(result.current.noteEditor).not.toBeNull()
    expect(result.current.noteEditor.id).toBe('hl-1')

    // Save note
    act(() => {
      result.current.setNoteEditor(prev => ({ ...prev, value: 'Key evidence' }))
    })
    act(() => {
      result.current.saveNoteEditor()
    })

    expect(result.current.highlights[0].note).toBe('Key evidence')
  })

  it('dismisses popovers and clears native selection on scroll and wheel', () => {
    const mockRemoveAllRanges = vi.fn()
    const spy = vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges: mockRemoveAllRanges,
      isCollapsed: false,
      rangeCount: 1,
      toString: () => '',
    })

    const { result } = renderHook(() => {
      const ref = useRef(null)
      return useTextHighlight({ passageRef: ref, scopeIndex: 0 })
    })

    act(() => {
      result.current.setHighlights([
        { id: 'hl-1', scopeIndex: 0, paraIndex: 0, start: 5, end: 15 },
      ])
    })

    act(() => {
      result.current.openHighlightMenu({ id: 'hl-1', note: 'test' }, { clientX: 100, clientY: 100 })
    })

    expect(result.current.highlightMenu).not.toBeNull()

    // Cuộn trang / Lăn chuột (scroll)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.highlightMenu).toBeNull()
    expect(mockRemoveAllRanges).toHaveBeenCalled()

    // Lăn bánh xe chuột (wheel)
    act(() => {
      result.current.openHighlightMenu({ id: 'hl-1', note: 'test' }, { clientX: 100, clientY: 100 })
    })
    expect(result.current.highlightMenu).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('wheel'))
    })
    expect(result.current.highlightMenu).toBeNull()
    spy.mockRestore()
  })

  it('tracks hoveredNote on handleMouseMove over mark elements and clears on move away', () => {
    const { result } = renderHook(() => {
      const ref = useRef(null)
      return useTextHighlight({ passageRef: ref, scopeIndex: 0 })
    })

    act(() => {
      result.current.setHighlights([
        { id: 'hl-note', scopeIndex: 0, paraIndex: 0, start: 0, end: 5, note: 'Important Note' },
        { id: 'hl-plain', scopeIndex: 0, paraIndex: 0, start: 10, end: 15 },
      ])
    })

    expect(result.current.hoveredNote).toBeNull()

    // Giả lập DOM mark element có data-highlight-id="hl-note"
    const markEl = document.createElement('mark')
    markEl.setAttribute('data-highlight-id', 'hl-note')
    markEl.getBoundingClientRect = () => ({
      left: 100, right: 150, top: 200, bottom: 220, width: 50, height: 20
    })

    // Hover vào mark có note
    act(() => {
      result.current.handleMouseMove({
        target: markEl,
        clientX: 120,
        clientY: 210,
      })
    })

    expect(result.current.hoveredNote).toEqual({
      id: 'hl-note',
      x: 125,
      y: 200,
      note: 'Important Note',
    })

    // Hover ra ngoài (vào div không phải mark)
    const outsideEl = document.createElement('div')
    act(() => {
      result.current.handleMouseMove({
        target: outsideEl,
        clientX: 500,
        clientY: 500,
      })
    })

    expect(result.current.hoveredNote).toBeNull()
  })

  it('clears hoveredNote on wheel or scroll', () => {
    const { result } = renderHook(() => {
      const ref = useRef(null)
      return useTextHighlight({ passageRef: ref, scopeIndex: 0 })
    })

    act(() => {
      result.current.setHighlights([
        { id: 'hl-note', scopeIndex: 0, paraIndex: 0, start: 0, end: 5, note: 'Important Note' },
      ])
    })

    const markEl = document.createElement('mark')
    markEl.setAttribute('data-highlight-id', 'hl-note')
    markEl.getBoundingClientRect = () => ({
      left: 100, right: 150, top: 200, bottom: 220, width: 50, height: 20
    })

    act(() => {
      result.current.handleMouseMove({
        target: markEl,
        clientX: 120,
        clientY: 210,
      })
    })

    expect(result.current.hoveredNote).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('wheel'))
    })

    expect(result.current.hoveredNote).toBeNull()
  })
})

describe('HighlightPopovers component', () => {
  it('renders selection bubble and triggers apply highlight and open note', () => {
    const onApply = vi.fn()
    const onNote = vi.fn()

    render(
      <HighlightPopovers
        selectionBubble={{ x: 200, y: 150 }}
        highlightMenu={null}
        noteEditor={null}
        onApplyHighlight={onApply}
        onOpenNote={onNote}
      />
    )

    const hlBtn = screen.getByRole('button', { name: /highlight/i })
    const noteBtn = screen.getByRole('button', { name: /note/i })
    expect(hlBtn).toBeInTheDocument()
    expect(noteBtn).toBeInTheDocument()

    fireEvent.click(hlBtn)
    expect(onApply).toHaveBeenCalledTimes(1)

    fireEvent.click(noteBtn)
    expect(onNote).toHaveBeenCalledTimes(1)
  })

  it('renders highlight menu with Remove note button for noted text', () => {
    const onClear = vi.fn()

    render(
      <HighlightPopovers
        selectionBubble={null}
        highlightMenu={{ id: 'hl-test', x: 250, y: 180, note: 'Important point' }}
        noteEditor={null}
        onClearHighlight={onClear}
      />
    )

    const removeBtn = screen.getByRole('button', { name: /remove note/i })
    expect(removeBtn).toBeInTheDocument()

    fireEvent.click(removeBtn)
    expect(onClear).toHaveBeenCalledWith('hl-test')
  })

  it('renders note editor with textarea, cancel, and save buttons', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const onChange = vi.fn()

    render(
      <HighlightPopovers
        selectionBubble={null}
        highlightMenu={null}
        noteEditor={{ x: 300, y: 200, value: 'My note' }}
        onSaveNote={onSave}
        onCancelNote={onCancel}
        onNoteChange={onChange}
      />
    )

    const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
    expect(textarea).toHaveValue('My note')

    fireEvent.change(textarea, { target: { value: 'New text' } })
    expect(onChange).toHaveBeenCalledWith('New text')

    fireEvent.click(screen.getByRole('button', { name: /hủy/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /lưu/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('renders small hover tooltip when hoveredNote is present', () => {
    render(
      <HighlightPopovers
        selectionBubble={null}
        highlightMenu={null}
        noteEditor={null}
        hoveredNote={{ id: 'hl-test', x: 250, y: 180, note: 'Ghi chú quan trọng' }}
      />
    )

    const tooltip = screen.getByTestId('note-hover-tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Ghi chú quan trọng')
  })

  it('hides hover tooltip when selection bubble, menu, or note editor is active', () => {
    const { rerender } = render(
      <HighlightPopovers
        selectionBubble={{ x: 200, y: 150 }}
        highlightMenu={null}
        noteEditor={null}
        hoveredNote={{ id: 'hl-test', x: 250, y: 180, note: 'Ghi chú' }}
      />
    )
    expect(screen.queryByTestId('note-hover-tooltip')).not.toBeInTheDocument()

    rerender(
      <HighlightPopovers
        selectionBubble={null}
        highlightMenu={{ id: 'hl-test', x: 250, y: 180, note: 'Ghi chú' }}
        noteEditor={null}
        hoveredNote={{ id: 'hl-test', x: 250, y: 180, note: 'Ghi chú' }}
      />
    )
    expect(screen.queryByTestId('note-hover-tooltip')).not.toBeInTheDocument()

    rerender(
      <HighlightPopovers
        selectionBubble={null}
        highlightMenu={null}
        noteEditor={{ x: 250, y: 180, value: 'Ghi chú' }}
        hoveredNote={{ id: 'hl-test', x: 250, y: 180, note: 'Ghi chú' }}
      />
    )
    expect(screen.queryByTestId('note-hover-tooltip')).not.toBeInTheDocument()
  })
})
