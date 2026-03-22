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
            ${isHovered ? 'border-[#1a56db] bg-[#eff6ff]'
            : answer ? 'border-[#3b82f6] bg-[#eff6ff]'
            : isClickTarget ? 'border-[#1a56db] border-dashed bg-blue-50'
            : 'border-gray-300 border-dashed bg-white'}
            ${!previewMode ? 'cursor-pointer' : ''}`}
        >
          {answer ? (
            <>
              <span className="font-bold text-[#1a56db] text-xs">{answer}</span>
              <span className="text-[#1a56db] font-medium text-xs leading-tight">{answerWord}</span>
              {!previewMode && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={e => clearBlank(qNum, e)}
                  className="ml-0.5 text-gray-400 hover:text-red-500 leading-none text-base"
                >×</button>
              )}
            </>
          ) : (
            <span className="text-gray-400 text-xs italic">{qNum}</span>
          )}
        </span>
      )
    })
  }

  return (
    <div className="mb-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs mb-1">{group.instruction}</p>}
        {!previewMode && <p className="text-gray-500 text-xs italic">Kéo từ Word Bank vào ô trống, hoặc click từ → click ô.</p>}
      </div>

      {/* Summary text with inline drop targets */}
      <div className="rounded-xl p-4 mb-4 text-sm leading-9" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        {(group.noteSections || []).map((ns, nsi) => (
          <div key={nsi} className={nsi > 0 ? 'mt-3' : ''}>
            {ns.title && <div className="font-bold text-gray-700 mb-1.5 pb-1 border-b border-amber-200">{ns.title}</div>}
            {(ns.lines || []).map((line, li) => {
              const content = line.contentWithTokens || line.content || ''
              if (line.lineType === 'heading') {
                return <p key={li} className="font-bold text-gray-800 text-[0.95rem] mt-2">{content}</p>
              }
              return <p key={li} className="leading-9">{parseContent(content)}</p>
            })}
          </div>
        ))}
      </div>

      {/* Word Bank */}
      <div className={`rounded-xl p-3 border ${previewMode ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
        <p className={`text-xs font-bold uppercase mb-2 ${previewMode ? 'text-indigo-700' : 'text-gray-500'}`}>Word Bank</p>
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
                    ? 'border-indigo-200 bg-white cursor-default text-gray-700'
                    : isUsed
                    ? 'opacity-35 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                    : isSelectedItem
                    ? 'border-[#1a56db] bg-[#eff6ff] cursor-pointer shadow-sm'
                    : 'border-[#3b82f6] bg-white hover:bg-blue-50 cursor-grab active:cursor-grabbing'}`}
              >
                <span className={`font-bold text-xs ${previewMode ? 'text-indigo-600' : 'text-[#1a56db]'}`}>{wb.optionLetter}</span>
                <span>{wb.optionText}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
