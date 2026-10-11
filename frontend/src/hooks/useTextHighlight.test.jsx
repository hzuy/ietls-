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
    vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges: mockRemoveAllRanges,
      isCollapsed: false,
      rangeCount: 1,
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
})
