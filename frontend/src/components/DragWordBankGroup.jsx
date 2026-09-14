import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

// Danh sách phương án Word Bank hiển thị trong popover chọn nhanh của 1 ô trống.
// Tách riêng để logic render item (highlight đang chọn / khóa từ đã dùng / xoá) không
// lặp lại và dễ test độc lập nếu cần sau này.
function WordBankOptionList({ wordBank, currentAnswer, usedLetters, onSelect, onClear }) {
  return (
    <div
      role="listbox"
      aria-label="Chọn đáp án từ Word Bank"
      className="max-h-60 overflow-y-auto p-1 text-xs leading-normal font-sans"
    >
      {wordBank.map(wb => {
        const isCurrent = currentAnswer === wb.optionLetter
        // Đã dùng ở MỘT ô khác (không phải ô đang mở) → khóa hẳn, không cho chọn trùng.
        const isUsedElsewhere = !isCurrent && usedLetters.has(wb.optionLetter)
        return (
          <button
            key={wb.optionLetter}
            type="button"
            role="option"
            aria-selected={isCurrent}
            aria-disabled={isUsedElsewhere}
            disabled={isUsedElsewhere}
            onClick={() => onSelect(wb.optionLetter)}
            className={`w-full flex items-center gap-2 py-1.5 px-3 rounded-full transition-colors text-left whitespace-nowrap
              ${isUsedElsewhere
                ? 'opacity-40 pointer-events-none cursor-not-allowed select-none bg-zinc-50 text-zinc-400'
                : isCurrent
                ? 'bg-zinc-900 text-white cursor-pointer'
                : 'hover:bg-zinc-100 cursor-pointer'}`}
          >
            <span className={`w-4 text-center shrink-0 font-semibold ${isCurrent || isUsedElsewhere ? '' : 'text-zinc-900'}`}>{wb.optionLetter}</span>
            <span className={`truncate font-normal ${isCurrent || isUsedElsewhere ? '' : 'text-zinc-700'}`}>{wb.optionText}</span>
          </button>
        )
      })}
      {currentAnswer && (
        <button
          type="button"
          onClick={onClear}
          className="w-full flex items-center gap-2 py-1.5 px-3 rounded-full cursor-pointer transition-colors text-left whitespace-nowrap text-red-500 hover:bg-red-50 mt-1 border-t border-zinc-100 pt-2"
        >
          Xóa đáp án
        </button>
      )}
    </div>
  )
}

export default function DragWordBankGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const [dragging, setDragging] = useState(null)    // letter being dragged
  const [dragOver, setDragOver] = useState(null)     // qNum being hovered over
  const [selected, setSelected] = useState(null)     // letter selected by click (Word Bank → click ô)
  const [openQNum, setOpenQNum] = useState(null)      // qNum đang mở popover chọn nhanh

  const popoverRef = useRef(null)
  const triggerRefs = useRef({})

  const questionMap = {}
  ;(group.questions || []).forEach(q => { questionMap[q.number] = q })

  const wordBank = group.matchingOptions || []

  // Letters currently placed in blanks for this group
  const usedLetters = new Set(
    Object.keys(questionMap).map(num => {
      const q = questionMap[num]
      return q ? answers[q.id] : null
    }).filter(Boolean)
  )

  const closePopover = useCallback((returnFocus = true) => {
    setOpenQNum(prev => {
      if (returnFocus && prev != null) triggerRefs.current[prev]?.focus()
      return null
    })
  }, [])

  // Click ra ngoài / phím Escape → đóng popover, trả focus về đúng ô vừa mở.
  useEffect(() => {
    if (openQNum == null) return
    const handlePointerDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) closePopover(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closePopover(true)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openQNum, closePopover])

  const handleDrop = (qNum) => {
    if (!dragging) return
    const q = questionMap[qNum]
    if (q) onAnswer(q.id, dragging)
    setDragging(null)
    setDragOver(null)
  }

  // Click trực tiếp vào ô trống:
  //  - Nếu đã "chọn sẵn" 1 từ từ Word Bank (flow kéo-thả thay thế cũ) → điền ngay, không mở popover.
  //  - Ngược lại → mở/đóng popover chọn nhanh cho đúng ô này (chọn mới hoặc đổi/xoá đáp án đang có).
  const handleBlankClick = (qNum) => {
    if (previewMode) return
    const q = questionMap[qNum]
    if (!q) return
    if (selected) {
      onAnswer(q.id, selected)
      setSelected(null)
      return
    }
    setOpenQNum(prev => (prev === qNum ? null : qNum))
  }

  const clearBlank = (qNum, e) => {
    e.stopPropagation()
    const q = questionMap[qNum]
    if (q) onAnswer(q.id, '')
  }

  const handleWordBankClick = (letter) => {
    if (previewMode) return
    setSelected(s => s === letter ? null : letter)
  }

  const selectFromPopover = (qNum, letter) => {
    const q = questionMap[qNum]
    if (q) onAnswer(q.id, letter)
    closePopover(true)
  }

  const clearFromPopover = (qNum) => {
    const q = questionMap[qNum]
    if (q) onAnswer(q.id, '')
    closePopover(true)
  }

  const parseContent = (content) => {
    const parts = (content || '').split(/(\[Q:\d+\])/)
    return parts.map((part, i) => {
      const match = part.match(/\[Q:(\d+)\]/)
      if (!match) return <span key={i}>{part}</span>

      const qNum = parseInt(match[1])
      const q = questionMap[qNum]
      const answer = previewMode && showAnswers ? q?.correctAnswer : (q ? answers[q.id] : null)
      const answerWord = wordBank.find(wb => wb.optionLetter === answer)?.optionText
      const isHovered = dragOver === qNum
      const isClickTarget = !!(selected && !answer && !previewMode)
      const isOpen = openQNum === qNum

      return (
        <span key={i} className="relative inline-block align-middle">
          <span
            ref={el => { triggerRefs.current[qNum] = el }}
            data-testid={`blank-${qNum}`}
            role={previewMode ? undefined : 'button'}
            tabIndex={previewMode ? undefined : 0}
            aria-haspopup={previewMode ? undefined : 'listbox'}
            aria-expanded={previewMode ? undefined : isOpen}
            aria-label={`Câu ${qNum}${answer ? `: đã chọn ${answer}. ${answerWord || ''}` : ': chưa có đáp án'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(qNum) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(qNum)}
            onClick={() => handleBlankClick(qNum)}
            onKeyDown={e => {
              if (previewMode) return
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBlankClick(qNum) }
            }}
            className={`inline-flex items-center gap-1 mx-1 min-w-[80px] text-[13px] leading-tight align-baseline transition-colors
              ${answer
                ? 'font-normal px-2.5 py-0.5 rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900'
                : 'px-2.5 py-0.5 rounded-full border border-dashed border-zinc-300'}
              ${isHovered ? 'border-zinc-900 bg-zinc-100' : ''}
              ${isClickTarget && !answer ? 'border-zinc-900 bg-zinc-100' : ''}
              ${!previewMode ? 'cursor-pointer hover:border-zinc-500 hover:bg-zinc-50' : ''}
              ${isOpen ? 'ring-2 ring-zinc-900 ring-offset-1' : ''}`}
          >
            {answer ? (
              <>
                <span className="font-semibold">{answer}</span>
                <span className="truncate max-w-[140px]">{answerWord}</span>
                {!previewMode && (
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => clearBlank(qNum, e)}
                    aria-label={`Xóa đáp án câu ${qNum}`}
                    className="ml-0.5 shrink-0 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  ><X className="w-3 h-3" /></button>
                )}
              </>
            ) : (
              <span className="text-zinc-400 italic">{qNum}</span>
            )}
          </span>

          {isOpen && (
            <div
              ref={popoverRef}
              role="presentation"
              onClick={e => e.stopPropagation()}
              className="absolute z-40 top-full left-0 mt-1 min-w-[240px] w-max max-w-[320px] bg-white rounded-2xl shadow-lg border border-zinc-200"
            >
              <WordBankOptionList
                wordBank={wordBank}
                currentAnswer={answer}
                usedLetters={usedLetters}
                onSelect={letter => selectFromPopover(qNum, letter)}
                onClear={() => clearFromPopover(qNum)}
              />
            </div>
          )}
        </span>
      )
    })
  }

  return (
    <div className="mb-6">
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
        <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-zinc-600 text-xs mb-1">{group.instruction}</p>}
        {!previewMode && <p className="text-zinc-500 text-xs italic">Kéo từ Word Bank vào ô trống, hoặc click vào ô để chọn nhanh.</p>}
      </div>

      {/* Summary text with inline drop targets */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5 mb-4 text-sm leading-9">
        {(group.noteSections || []).map((ns, nsi) => (
          <div key={nsi} className={nsi > 0 ? 'mt-3' : ''}>
            {ns.title && <div className="font-semibold text-zinc-900 mb-1.5 pb-1 border-b border-zinc-200">{ns.title}</div>}
            {(ns.lines || []).map((line, li) => {
              const content = line.contentWithTokens || line.content || ''
              if (line.lineType === 'heading') {
                return <p key={li} className="font-semibold text-zinc-900 text-[0.95rem] mt-2">{content}</p>
              }
              return <p key={li} className="leading-9 text-zinc-800">{parseContent(content)}</p>
            })}
          </div>
        ))}
      </div>

      {/* Word Bank */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-zinc-500">Word Bank</p>
        <div className="flex flex-wrap gap-2">
          {wordBank.map(wb => {
            const isUsed = usedLetters.has(wb.optionLetter)
            const isSelectedItem = selected === wb.optionLetter
            return (
              <div
                key={wb.optionLetter}
                draggable={!isUsed && !previewMode}
                onDragStart={() => { setDragging(wb.optionLetter); setSelected(null) }}
                onDragEnd={() => { setDragging(null); setDragOver(null) }}
                onClick={() => handleWordBankClick(wb.optionLetter)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-sm transition select-none
                  ${previewMode
                    ? 'border-zinc-200 bg-white cursor-default text-zinc-700'
                    : isUsed
                    ? 'opacity-35 cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400'
                    : isSelectedItem
                    ? 'border-zinc-900 bg-zinc-100 cursor-pointer shadow-xs font-medium text-zinc-900'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 cursor-grab active:cursor-grabbing text-zinc-800'}`}
              >
                <span className="font-bold text-xs text-zinc-900">{wb.optionLetter}</span>
                <span>{wb.optionText}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
