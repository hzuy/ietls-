import { useState } from 'react'

function parseParagraph(questionText) {
  const parts = (questionText || '').split('|')
  return { key: parts[0] || '', label: parts[1] || '' }
}

export default function MatchingHeadingsGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const [draggingKey, setDraggingKey] = useState(null)
  const [dragOverQId, setDragOverQId] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)

  const headings = group.matchingOptions || []
  const questions = group.questions || []
  const allowReuse = group.canReuse || false

  const clearPreviousSlot = (headingKey) => {
    if (allowReuse) return
    questions.forEach(q => {
      if (answers[q.id] === headingKey) onAnswer(q.id, '')
    })
  }

  const handleDrop = (qId) => {
    if (!draggingKey) return
    clearPreviousSlot(draggingKey)
    onAnswer(qId, draggingKey)
    setDraggingKey(null)
    setDragOverQId(null)
  }

  const handleHeadingClick = (key) => {
    if (previewMode) return
    setSelectedKey(k => k === key ? null : key)
  }

  const handleParaClick = (qId) => {
    if (previewMode) return
    if (selectedKey) {
      clearPreviousSlot(selectedKey)
      onAnswer(qId, selectedKey)
      setSelectedKey(null)
    }
  }

  const clearSlot = (qId, e) => {
    e.stopPropagation()
    onAnswer(qId, '')
  }

  const usedKeys = new Set(Object.values(answers).filter(Boolean))

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs mb-1">{group.instruction}</p>}
        {!previewMode && (
          <p className="text-gray-500 text-xs italic">Kéo heading vào paragraph, hoặc click heading → click paragraph.</p>
        )}
      </div>

      <div className="flex gap-3">
        {/* Left: headings pool */}
        <div className="w-52 shrink-0">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">List of Headings</p>
          <div className="space-y-1.5">
            {headings.map(h => {
              const isSelected = selectedKey === h.optionLetter
              const isDragging = draggingKey === h.optionLetter
              const isUsed = !allowReuse && usedKeys.has(h.optionLetter)
              return (
                <div
                  key={h.optionLetter}
                  draggable={!previewMode}
                  onDragStart={() => { setDraggingKey(h.optionLetter); setSelectedKey(null) }}
                  onDragEnd={() => { setDraggingKey(null); setDragOverQId(null) }}
                  onClick={() => handleHeadingClick(h.optionLetter)}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs transition select-none
                    ${previewMode
                      ? 'border-gray-200 bg-white cursor-default'
                      : isSelected
                      ? 'border-green-500 bg-green-50 cursor-pointer shadow-sm'
                      : isDragging
                      ? 'opacity-40 border-gray-200 bg-white'
                      : isUsed
                      ? 'border-gray-200 bg-gray-50 opacity-40 cursor-grab'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50 cursor-grab active:cursor-grabbing'}`}
                >
                  <span className="font-bold text-green-700 shrink-0">{h.optionLetter}</span>
                  <span className="text-gray-700 leading-relaxed">{h.optionText}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: paragraphs with drop zones */}
        <div className="flex-1 space-y-2">
          {questions.map(q => {
            const { key: paraKey, label: paraLabel } = parseParagraph(q.questionText)
            const answer = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
            const answerHeading = headings.find(h => h.optionLetter === answer)
            const isOver = dragOverQId === q.id
            const isClickable = !!(selectedKey && !previewMode)

            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-sm text-gray-800 mb-2 flex gap-2 items-start leading-relaxed">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-xs shrink-0 mt-0.5">
                    {q.number}
                  </span>
                  <span>
                    <span className="font-semibold">Paragraph {paraKey}</span>
                    {paraLabel && <span className="text-gray-500 font-normal"> — {paraLabel}</span>}
                  </span>
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverQId(q.id) }}
                  onDragLeave={() => setDragOverQId(null)}
                  onDrop={() => handleDrop(q.id)}
                  onClick={() => handleParaClick(q.id)}
                  className={`min-h-[38px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm transition
                    ${!previewMode ? 'cursor-pointer' : ''}
                    ${isOver ? 'border-green-500 bg-green-50'
                    : answer ? 'border-green-500 bg-green-50'
                    : isClickable ? 'border-green-400 border-dashed bg-green-50/50'
                    : 'border-dashed border-gray-300 bg-gray-50'}`}
                >
                  {answer ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-bold text-green-700 text-xs shrink-0">{answer}</span>
                      <span className="text-green-700 text-xs flex-1 leading-snug">{answerHeading?.optionText}</span>
                      {!previewMode && (
                        <button onClick={e => clearSlot(q.id, e)} className="text-gray-400 hover:text-red-500 text-base leading-none shrink-0">×</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs italic">
                      {previewMode ? '—' : 'Kéo hoặc click heading...'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
