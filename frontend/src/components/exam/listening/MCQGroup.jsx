function InstructionBanner({ group }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 text-sm">
      <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-zinc-600">{group.instruction}</p>}
    </div>
  )
}

// ── MCQ Group (single or multi) ───────────────────────────────────────────────
export default function MCQGroup({ group, answers, onAnswer, isMulti, previewMode, showAnswers }) {
  const maxChoices = group.maxChoices || 2
  const questions = group.questions || []

  if (isMulti) {
    return (
      <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
        <InstructionBanner group={group} />
        {questions.map((q, qi) => {
          const qStart = group.qNumberStart + qi * maxChoices
          const qEnd = qStart + maxChoices - 1
          const opts = q.options ? JSON.parse(q.options) : []
          const combined = answers[q.id] || ''
          const selected = combined.split(',').filter(Boolean)
          const correctSelected = previewMode && showAnswers
            ? (q.correctAnswer || '').split(',').filter(Boolean)
            : selected
          const limitReached = selected.length >= maxChoices

          const handleChange = (opt) => {
            if (previewMode) return
            const checked = selected.includes(opt)
            const next = checked ? selected.filter(s => s !== opt) : [...selected, opt]
            onAnswer(q.id, next.join(','))
          }

          return (
            <div key={q.id} id={`question-${qStart}`} className="mb-4 scroll-mt-4">
              {q.questionText && (
                <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2">
                  <span className="font-bold text-zinc-700 shrink-0">{qStart}–{qEnd}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.map(opt => {
                  const checked = previewMode && showAnswers ? correctSelected.includes(opt) : selected.includes(opt)
                  const disabled = previewMode || (!checked && limitReached)
                  return (
                    <label key={opt} className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition
                      ${checked && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                        : checked ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium cursor-pointer'
                        : disabled ? 'border border-transparent text-zinc-300 cursor-not-allowed'
                        : 'hover:bg-zinc-50 border border-transparent text-zinc-700 cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} className="accent-zinc-900"
                        onChange={() => handleChange(opt)} />
                      {opt}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Single MCQ — render each question separately
  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {questions.map(q => {
        const opts = q.options ? JSON.parse(q.options) : []
        const displayAnswer = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
        return (
          <div key={q.id} id={`question-${q.number}`} className="mb-5 scroll-mt-4">
            <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
              <span>{q.questionText}</span>
            </p>
            <div className="space-y-1 pl-8">
              {opts.map(opt => {
                const isSelected = displayAnswer === opt
                return (
                  <label key={opt} className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition
                    ${isSelected && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                      : isSelected ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium cursor-pointer'
                      : previewMode ? 'border border-transparent text-zinc-400 cursor-default'
                      : 'hover:bg-zinc-50 border border-transparent text-zinc-700 cursor-pointer'}`}>
                    <input type="radio" name={`q${q.id}`} checked={isSelected}
                      disabled={previewMode}
                      onChange={previewMode ? undefined : () => onAnswer(q.id, opt)}
                      className="accent-zinc-900" />
                    {opt}
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
