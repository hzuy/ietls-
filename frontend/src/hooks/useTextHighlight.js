import { useState, useCallback, useEffect } from 'react'
import { getOffsetWithinElement } from '../components/exam/HighlightLayer'

/**
 * Tìm range cho text trong rootEl nếu range bị mất hoặc disconnected sau khi re-render.
 */
export function findTextRange(rootEl, searchText) {
  if (!rootEl || !searchText) return null
  try {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent) return NodeFilter.FILTER_SKIP
        if (node.parentElement?.closest?.('[data-highlight-popover], script, style')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const textNodes = []
    let fullText = ''
    let node
    while ((node = walker.nextNode())) {
      const len = node.textContent.length
      textNodes.push({ node, start: fullText.length, end: fullText.length + len })
      fullText += node.textContent
    }

    const matchIdx = fullText.indexOf(searchText)
    if (matchIdx === -1) return null
    const matchEnd = matchIdx + searchText.length

    const startInfo = textNodes.find(tn => matchIdx >= tn.start && matchIdx < tn.end)
    const endInfo = textNodes.find(tn => matchEnd > tn.start && matchEnd <= tn.end)

    if (!startInfo || !endInfo) return null

    const range = document.createRange()
    range.setStart(startInfo.node, matchIdx - startInfo.start)
    range.setEnd(endInfo.node, matchEnd - endInfo.start)
    return range
  } catch {
    return null
  }
}

/**
 * Hook quản lý highlight và note cho text bài thi IELTS.
 * Hỗ trợ toàn bộ giao diện:
 *   - Các đoạn văn bản có data-para-index (HighlightLayer cho Reading passage)
 *   - Bất kỳ text nào được bôi đen trong toàn bộ giao diện: câu hỏi, tiêu đề, hướng dẫn (CSS Custom Highlight API)
 *
 * @param {object} options
 * @param {React.RefObject} [options.containerRef] — ref gắn vào root container chứa toàn bộ giao diện bài thi
 * @param {React.RefObject} [options.passageRef]   — alias tương thích ngược của containerRef
 * @param {number}          options.scopeIndex     — passage/section index (dùng để lọc highlights theo section/passage)
 */
export function useTextHighlight({ containerRef, passageRef, scopeIndex = 0 }) {
  const rootRef = containerRef || passageRef
  const [highlights, setHighlights] = useState([])
  const [selectionBubble, setSelectionBubble] = useState(null) // { x, y, paraIndex?, start?, end?, range?, text? }
  const [highlightMenu, setHighlightMenu] = useState(null)     // { id, x, y, note? }
  const [noteEditor, setNoteEditor] = useState(null)           // { x, y, paraIndex?, start?, end?, range?, id?, value }

  const closeAll = useCallback(() => {
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      if (typeof sel.empty === 'function') {
        try { sel.empty() } catch {}
      }
    }
    setSelectionBubble(null)
    setHighlightMenu(null)
    setNoteEditor(null)
  }, [])

  // Đóng popover khi đổi scope (passage / section)
  useEffect(() => { closeAll() }, [scopeIndex, closeAll])

  // Đồng bộ CSS Custom Highlight API cho các text không phải paragraph (câu hỏi, tiêu đề, v.v.)
  useEffect(() => {
    if (typeof CSS === 'undefined' || !CSS.highlights) return
    const rootEl = rootRef?.current
    const active = highlights.filter(h => (h.scopeIndex ?? h.passageIndex ?? 0) === scopeIndex)

    // Re-connect ranges cho non-paragraph text nếu DOM vừa re-mount/re-render
    for (const h of active) {
      if (h.paraIndex == null) {
        if (!h.range || !h.range.startContainer || !h.range.startContainer.isConnected) {
          if (rootEl && h.text) {
            const fresh = findTextRange(rootEl, h.text)
            if (fresh) h.range = fresh
          }
        }
      }
    }

    const plainRanges = active
      .filter(h => !h.note && h.paraIndex == null && h.range && h.range.startContainer?.isConnected && !h.range.collapsed)
      .map(h => h.range)
    const noteRanges = active
      .filter(h => !!h.note && h.paraIndex == null && h.range && h.range.startContainer?.isConnected && !h.range.collapsed)
      .map(h => h.range)

    try {
      if (plainRanges.length > 0) {
        CSS.highlights.set('exam-highlight', new Highlight(...plainRanges))
      } else {
        CSS.highlights.delete('exam-highlight')
      }

      if (noteRanges.length > 0) {
        CSS.highlights.set('exam-highlight-note', new Highlight(...noteRanges))
      } else {
        CSS.highlights.delete('exam-highlight-note')
      }
    } catch {
      // CSS Highlight API safe fallback
    }

    return () => {
      try {
        CSS.highlights.delete('exam-highlight')
        CSS.highlights.delete('exam-highlight-note')
      } catch {}
    }
  }, [highlights, scopeIndex, rootRef])

  // Đóng khi click ra ngoài, nhấn Escape, hoặc khi lăn chuột/cuộn trang
  useEffect(() => {
    if (!selectionBubble && !highlightMenu && !noteEditor) return

    const onKeyDown = (e) => { if (e.key === 'Escape') closeAll() }
    const onMouseDown = (e) => {
      if (e.target.closest?.('[data-highlight-popover]')) return
      if (e.target.closest?.('mark[data-highlight-id]')) return
      closeAll()
    }
    const onScrollOrWheel = (e) => {
      if (e.target?.closest?.('[data-highlight-popover]')) return
      closeAll()
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('scroll', onScrollOrWheel, { capture: true, passive: true })
    window.addEventListener('wheel', onScrollOrWheel, { passive: true })
    window.addEventListener('touchmove', onScrollOrWheel, { passive: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScrollOrWheel, { capture: true })
      window.removeEventListener('wheel', onScrollOrWheel)
      window.removeEventListener('touchmove', onScrollOrWheel)
    }
  }, [selectionBubble, highlightMenu, noteEditor, closeAll])

  /** Gắn vào onMouseUp của container */
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !sel.toString().trim()) {
      setSelectionBubble(null)
      return
    }
    const range = sel.getRangeAt(0)
    const rootEl = rootRef?.current
    if (!rootEl || !rootEl.contains(range.commonAncestorContainer)) {
      setSelectionBubble(null)
      return
    }

    // Không mở bubble nếu bôi đen bên trong popover highlight hoặc text input, button thanh công cụ
    const commonEl = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement
    if (commonEl?.closest?.('[data-highlight-popover], input[type="text"], input[type="password"], input[type="number"], textarea, audio, .exam-bar-btn, .exam-chip')) {
      setSelectionBubble(null)
      return
    }

    // Kiểm tra xem vùng chọn có nằm trong element có data-para-index không (thường là đoạn văn passage)
    let node = range.startContainer
    let paraEl = node.nodeType === 3 ? node.parentElement : node
    while (paraEl && paraEl !== rootEl && paraEl.getAttribute?.('data-para-index') == null) {
      paraEl = paraEl.parentElement
    }

    const hasParaIndex = paraEl && paraEl.getAttribute?.('data-para-index') != null
    let paraIndex = null
    let start = null
    let end = null

    if (hasParaIndex) {
      paraIndex = parseInt(paraEl.getAttribute('data-para-index'), 10)
      const startRaw = getOffsetWithinElement(paraEl, range.startContainer, range.startOffset)
      const endRaw = getOffsetWithinElement(paraEl, range.endContainer, range.endOffset)
      if (startRaw != null && endRaw != null && startRaw !== endRaw) {
        start = Math.min(startRaw, endRaw)
        end = Math.max(startRaw, endRaw)
      }
    }

    const rect = range.getBoundingClientRect()
    setHighlightMenu(null)
    setNoteEditor(null)
    setSelectionBubble({
      x: rect.left + rect.width / 2,
      y: rect.top,
      paraIndex,
      start,
      end,
      range: range.cloneRange(),
      text: sel.toString().trim(),
    })
  }, [rootRef])

  /** Click lên container để mở menu highlight (cho cả thẻ <mark> và CSS Custom Highlight) */
  const handleContainerClick = useCallback((e) => {
    if (e.target.closest?.('[data-highlight-popover]')) return

    // 1. Nếu click vào thẻ <mark> do HighlightLayer render
    const mark = e.target.closest?.('mark[data-highlight-id]')
    if (mark) {
      const id = mark.getAttribute('data-highlight-id')
      const target = highlights.find(h => h.id === id)
      if (target) {
        e.preventDefault?.()
        e.stopPropagation?.()
        const rect = mark.getBoundingClientRect()
        setSelectionBubble(null)
        setNoteEditor(null)
        setHighlightMenu({
          id: target.id,
          x: rect.left + rect.width / 2,
          y: rect.top,
          note: target.note,
        })
        return
      }
    }

    // 2. Nếu click vào vùng text được CSS Custom Highlight (câu hỏi, tiêu đề...)
    const x = e.clientX
    const y = e.clientY
    const active = highlights.filter(h => (h.scopeIndex ?? h.passageIndex ?? 0) === scopeIndex && h.range && h.range.startContainer?.isConnected)
    for (const h of active) {
      try {
        const rects = h.range.getClientRects()
        for (const r of rects) {
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            e.preventDefault?.()
            e.stopPropagation?.()
            setSelectionBubble(null)
            setNoteEditor(null)
            setHighlightMenu({
              id: h.id,
              x: r.left + r.width / 2,
              y: r.top,
              note: h.note,
            })
            return
          }
        }
      } catch {}
    }
  }, [highlights, scopeIndex])

  const hasOverlap = useCallback((paraIndex, start, end, ignoreId) => {
    return highlights.some(h =>
      h.id !== ignoreId && (h.scopeIndex ?? h.passageIndex ?? 0) === scopeIndex && h.paraIndex === paraIndex &&
      !(end <= h.start || start >= h.end)
    )
  }, [highlights, scopeIndex])

  const makeId = () => `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const applyHighlight = useCallback(() => {
    if (!selectionBubble) return
    const { paraIndex, start, end, range, text } = selectionBubble
    const newId = makeId()

    if (paraIndex != null && start != null && end != null) {
      if (!hasOverlap(paraIndex, start, end)) {
        setHighlights(prev => [...prev, {
          id: newId,
          scopeIndex,
          paraIndex,
          start,
          end,
          range: range ? range.cloneRange() : undefined,
          text,
        }])
      }
    } else if (range) {
      setHighlights(prev => [...prev, {
        id: newId,
        scopeIndex,
        range: range.cloneRange(),
        text,
      }])
    }

    window.getSelection()?.removeAllRanges()
    setSelectionBubble(null)
  }, [selectionBubble, hasOverlap, scopeIndex])

  const openNoteEditorForSelection = useCallback(() => {
    if (!selectionBubble) return
    setNoteEditor({ ...selectionBubble, value: '' })
    setSelectionBubble(null)
  }, [selectionBubble])

  const saveNoteEditor = useCallback(() => {
    if (!noteEditor) return
    const { paraIndex, start, end, range, text, id, value } = noteEditor
    const note = value.trim() || undefined

    if (id) {
      setHighlights(prev => prev.map(h => (h.id === id ? { ...h, note } : h)))
    } else {
      const newId = makeId()
      if (paraIndex != null && start != null && end != null) {
        if (!hasOverlap(paraIndex, start, end)) {
          setHighlights(prev => [...prev, {
            id: newId,
            scopeIndex,
            paraIndex,
            start,
            end,
            range: range ? range.cloneRange() : undefined,
            text,
            note,
          }])
        }
      } else if (range) {
        setHighlights(prev => [...prev, {
          id: newId,
          scopeIndex,
          range: range.cloneRange(),
          text,
          note,
        }])
      }
    }

    window.getSelection()?.removeAllRanges()
    setNoteEditor(null)
  }, [noteEditor, hasOverlap, scopeIndex])

  const openHighlightMenu = useCallback((highlight, e) => {
    setSelectionBubble(null)
    setNoteEditor(null)
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    const x = rect ? rect.left + rect.width / 2 : e?.clientX
    const y = rect ? rect.top : e?.clientY
    setHighlightMenu({ id: highlight.id, x, y, note: highlight.note })
  }, [])

  const clearHighlight = useCallback((highlightId) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId))
    setHighlightMenu(null)
  }, [])

  const editHighlightNote = useCallback(() => {
    if (!highlightMenu) return
    const target = highlights.find(h => h.id === highlightMenu.id)
    if (!target) return
    setNoteEditor({ id: target.id, x: highlightMenu.x, y: highlightMenu.y, value: target.note || '' })
    setHighlightMenu(null)
  }, [highlightMenu, highlights])

  /** Highlights chỉ thuộc scope hiện tại */
  const scopeHighlights = highlights.filter(h => (h.scopeIndex ?? h.passageIndex ?? 0) === scopeIndex)

  return {
    highlights,
    setHighlights,
    scopeHighlights,
    selectionBubble,
    highlightMenu,
    noteEditor,
    setNoteEditor,
    handleMouseUp,
    handleContainerClick,
    applyHighlight,
    openNoteEditorForSelection,
    saveNoteEditor,
    openHighlightMenu,
    clearHighlight,
    editHighlightNote,
  }
}
