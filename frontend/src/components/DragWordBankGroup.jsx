import { useState } from 'react'

export default function DragWordBankGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const [dragging, setDragging] = useState(null)    // letter being dragged
  const [dragOver, setDragOver] = useState(null)     // qNum being hovered over
  const [selected, setSelected] = useState(null)     // letter selected by click

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

  const handleDrop = (qNum) => {
    if (!dragging) return
    const q = questionMap[qNum]
    if (q) onAnswer(q.id, dragging)
    setDragging(null)
    setDragOver(null)
  }

  const handleBlankClick = (qNum) => {
    if (previewMode) return
    const q = questionMap[qNum]
    if (!q) return
    if (selected) {
      onAnswer(q.id, selected)
      setSelected(null)
    } else if (answers[q.id]) {
      onAnswer(q.id, '')
    }
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

      return (
        <span
          key={i}
          onDragOver={e => { e.preventDefault(); setDragOver(qNum) }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => handleDrop(qNum)}
          onClick={() => handleBlankClick(qNum)}
          className={`inline-flex items-center gap-1 mx-1 min-w-[90px] px-2 py-0.5 border-2 rounded-lg text-sm align-middle transition
            ${isHovered ? 'border-zinc-900 bg-zinc-100'
            : answer ? 'border-zinc-900 bg-zinc-50'
            : isClickTarget ? 'border-zinc-900 border-dashed bg-zinc-100'
            : 'border-zinc-300 border-dashed bg-white'}
            ${!previewMode ? 'cursor-pointer' : ''}`}
        >
          {answer ? (
            <>
              <span className="font-bold text-zinc-900 text-xs">{answer}</span>
              <span className="text-zinc-900 font-medium text-xs leading-tight">{answerWord}</span>
              {!previewMode && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={e => clearBlank(qNum, e)}
                  className="ml-0.5 text-zinc-400 hover:text-red-500 leading-none text-base"
                >×</button>
              )}
            </>
          ) : (
            <span className="text-zinc-400 text-xs italic">{qNum}</span>
          )}
        </span>
      )
    })
  }

  return (
    <div className="mb-6">
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 mb-3 text-sm">
        <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-zinc-600 text-xs mb-1">{group.instruction}</p>}
        {!previewMode && <p className="text-zinc-500 text-xs italic">Kéo từ Word Bank vào ô trống, hoặc click từ → click ô.</p>}
      </div>

      {/* Summary text with inline drop targets */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 mb-4 text-sm leading-9">
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
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition select-none
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
