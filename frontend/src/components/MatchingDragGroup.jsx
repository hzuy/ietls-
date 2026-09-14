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
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-3 text-sm">
        <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-zinc-600 text-xs mb-1">{group.instruction}</p>}
        {!previewMode && <p className="text-zinc-500 text-xs italic">Kéo đáp án từ cột phải vào ô, hoặc click chọn → click ô.</p>}
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
              <div key={q.id} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs">
                <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
                  <span>{q.questionText}</span>
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverQId(q.id) }}
                  onDragLeave={() => setDragOverQId(null)}
                  onDrop={() => handleDrop(q.id)}
                  onClick={() => handleSlotClick(q.id)}
                  className={`min-h-[38px] rounded-full border-2 px-3.5 py-1.5 flex items-center text-sm transition
                    ${!previewMode ? 'cursor-pointer' : ''}
                    ${isOver ? 'border-zinc-900 bg-zinc-100'
                    : answer ? 'border-zinc-900 bg-zinc-50'
                    : isClickable ? 'border-zinc-400 border-dashed bg-zinc-50'
                    : 'border-dashed border-zinc-300 bg-zinc-50/50'}`}
                >
                  {answer ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-bold text-zinc-900 text-xs shrink-0">{answer}</span>
                      <span className="text-zinc-900 font-medium text-xs flex-1 leading-snug">{answerOpt?.optionText}</span>
                      {!previewMode && (
                        <button onClick={e => clearSlot(q.id, e)} className="text-zinc-400 hover:text-red-500 text-base leading-none shrink-0">×</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-xs italic">
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
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">Options</p>
          <div className="space-y-1.5">
            {(() => {
              const groupAnswerValues = questions.map(q => answers[q.id]).filter(Boolean)
              const usedLetters = new Set(groupAnswerValues)
              
              return options.map(opt => {
                const isSelectedOpt = selectedLetter === opt.optionLetter
                const isDraggingThis = draggingLetter === opt.optionLetter
                const isUsed = !allowReuse && usedLetters.has(opt.optionLetter)
                
                return (
                  <div
                    key={opt.optionLetter}
                    draggable={!previewMode}
                    onDragStart={() => { setDraggingLetter(opt.optionLetter); setSelectedLetter(null) }}
                    onDragEnd={() => { setDraggingLetter(null); setDragOverQId(null) }}
                  onClick={() => handleOptionClick(opt.optionLetter)}
                  className={`flex items-start gap-2 px-3.5 py-2 rounded-full border text-xs transition select-none
                    ${previewMode
                      ? 'border-zinc-200 bg-white cursor-default'
                      : isSelectedOpt
                      ? 'border-zinc-900 bg-zinc-100 cursor-pointer shadow-xs font-medium text-zinc-900'
                      : isDraggingThis
                      ? 'opacity-40 border-zinc-200 bg-white'
                      : isUsed
                      ? 'border-zinc-200 bg-zinc-50 opacity-40 cursor-grab'
                      : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 cursor-grab active:cursor-grabbing text-zinc-700'}`}
                >
                  <span className="font-bold text-zinc-900 shrink-0">{opt.optionLetter}</span>
                  <span className="text-zinc-700 leading-relaxed">{opt.optionText}</span>
                </div>
              )
            })})()}
          </div>
        </div>
      </div>
    </div>
  )
}
