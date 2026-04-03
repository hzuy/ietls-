import { useState } from 'react'

export default function MatchingDragGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const [draggingLetter, setDraggingLetter] = useState(null)
  const [dragOverQId, setDragOverQId] = useState(null)
  const [selectedLetter, setSelectedLetter] = useState(null)

  const options = group.matchingOptions || []
  const questions = group.questions || []
  const allowReuse = group.canReuse || false

  const clearPreviousSlot = (letter) => {
    if (allowReuse) return
    questions.forEach(q => {
      if (answers[q.id] === letter) onAnswer(q.id, '')
    })
  }

  const handleDrop = (qId) => {
    if (!draggingLetter) return
    clearPreviousSlot(draggingLetter)
    onAnswer(qId, draggingLetter)
    setDraggingLetter(null)
    setDragOverQId(null)
  }

  const handleOptionClick = (letter) => {
    if (previewMode) return
    setSelectedLetter(l => l === letter ? null : letter)
  }

  const handleSlotClick = (qId) => {
    if (previewMode) return
    if (selectedLetter) {
      clearPreviousSlot(selectedLetter)
      onAnswer(qId, selectedLetter)
      setSelectedLetter(null)
    }
  }

  const clearSlot = (qId, e) => {
    e.stopPropagation()
    onAnswer(qId, '')
  }

  return (
    <div className="mb-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs mb-1">{group.instruction}</p>}
        {!previewMode && <p className="text-gray-500 text-xs italic">Kéo đáp án từ cột phải vào ô, hoặc click chọn → click ô.</p>}
      </div>

      <div className="flex gap-3">
        {/* Left: items with drop slots */}
        <div className="flex-1 space-y-2">
          {questions.map(q => {
            const answer = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
            const answerOpt = options.find(o => o.optionLetter === answer)
            const isOver = dragOverQId === q.id
            const isClickable = !!(selectedLetter && !previewMode)

            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[#1a56db] font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
                  <span>{q.questionText}</span>
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverQId(q.id) }}
                  onDragLeave={() => setDragOverQId(null)}
                  onDrop={() => handleDrop(q.id)}
                  onClick={() => handleSlotClick(q.id)}
                  className={`min-h-[38px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm transition
                    ${!previewMode ? 'cursor-pointer' : ''}
                    ${isOver ? 'border-[#1a56db] bg-[#eff6ff]'
                    : answer ? 'border-[#3b82f6] bg-[#eff6ff]'
                    : isClickable ? 'border-[#1a56db] border-dashed bg-blue-50/50'
                    : 'border-dashed border-gray-300 bg-gray-50'}`}
                >
                  {answer ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-bold text-[#1a56db] text-xs shrink-0">{answer}</span>
                      <span className="text-[#1a56db] text-xs flex-1 leading-snug">{answerOpt?.optionText}</span>
                      {!previewMode && (
                        <button onClick={e => clearSlot(q.id, e)} className="text-gray-400 hover:text-red-500 text-base leading-none shrink-0">×</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs italic">
                      {previewMode ? '—' : 'Kéo hoặc click đáp án...'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: options pool */}
        <div className="w-48 shrink-0">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Options</p>
          <div className="space-y-1.5">
            {options.map(opt => {
              const isSelectedOpt = selectedLetter === opt.optionLetter
              const isDraggingThis = draggingLetter === opt.optionLetter
              const usedLetters = new Set(Object.values(answers).filter(Boolean))
              const isUsed = !allowReuse && usedLetters.has(opt.optionLetter)
              return (
                <div
                  key={opt.optionLetter}
                  draggable={!previewMode}
                  onDragStart={() => { setDraggingLetter(opt.optionLetter); setSelectedLetter(null) }}
                  onDragEnd={() => { setDraggingLetter(null); setDragOverQId(null) }}
                  onClick={() => handleOptionClick(opt.optionLetter)}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs transition select-none
                    ${previewMode
                      ? 'border-gray-200 bg-white cursor-default'
                      : isSelectedOpt
                      ? 'border-[#1a56db] bg-[#eff6ff] cursor-pointer shadow-sm'
                      : isDraggingThis
                      ? 'opacity-40 border-gray-200 bg-white'
                      : isUsed
                      ? 'border-gray-200 bg-gray-50 opacity-40 cursor-grab'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 cursor-grab active:cursor-grabbing'}`}
                >
                  <span className="font-bold text-[#1a56db] shrink-0">{opt.optionLetter}</span>
                  <span className="text-gray-700 leading-relaxed">{opt.optionText}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
