import { selectedOptionValues } from '../../../utils/mcqAnswer'
import { Flag } from 'lucide-react'

function preventToggleOnTextSelect(e) {
  const sel = typeof window !== 'undefined' ? window.getSelection?.()?.toString?.() : ''
  if (sel && sel.trim().length > 0) e.preventDefault()
}

function InstructionBanner({ group }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 text-[15px] leading-relaxed">
      <p className="font-semibold text-zinc-900 text-base mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-zinc-600">{group.instruction}</p>}
    </div>
  )
}

// ── MCQ Group (single or multi) ───────────────────────────────────────────────
export default function MCQGroup({ group, answers, onAnswer, isMulti, previewMode, showAnswers, flaggedSet, onToggleFlag }) {
  const maxChoices = group.maxChoices || 2
  const questions = group.questions || []

  if (isMulti) {
    return (
      <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
        <InstructionBanner group={group} />
        {questions.map((q, qi) => {
          const qStart = group.qNumberStart + qi * maxChoices
          const qEnd = qStart + maxChoices - 1
          const opts = Array.isArray(q.options) ? q.options : q.options ? JSON.parse(q.options) : []
          const combined = answers[q.id] || ''
          const selected = selectedOptionValues(combined, opts)
          const correctSelected = previewMode && showAnswers
            ? selectedOptionValues(q.correctAnswer, opts)
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
                <p className="text-base text-zinc-900 mb-2.5 leading-relaxed flex gap-2.5">
                  <span className="font-bold text-zinc-700 shrink-0">{qStart}–{qEnd}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.map(opt => {
                  const checked = previewMode && showAnswers ? correctSelected.includes(opt) : selected.includes(opt)
                  const disabled = previewMode || (!checked && limitReached)
                  return (
                    <label key={opt} onClick={preventToggleOnTextSelect} className={`exam-option rounded-full
                      ${checked && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                        : checked ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium cursor-pointer'
                        : disabled ? 'border border-transparent text-zinc-300 cursor-not-allowed'
                        : 'hover:bg-zinc-50 border border-transparent text-zinc-700 cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} className="accent-zinc-900"
                        onChange={() => handleChange(opt)} />
                      <span>{opt}</span>
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
        const opts = Array.isArray(q.options) ? q.options : q.options ? JSON.parse(q.options) : []
        const displayAnswer = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
        const flagged = Boolean(flaggedSet?.has?.(q.number))
        return (
          <div key={q.id} id={`question-${q.number}`} className="mb-5 scroll-mt-4">
            <div className="text-base text-zinc-900 mb-2.5 leading-relaxed flex items-start gap-2.5">
              {onToggleFlag && !previewMode ? (
                <button
                  type="button"
                  onClick={() => onToggleFlag(q.number)}
                  title={flagged ? `Bỏ đánh dấu câu ${q.number}` : `Đánh dấu câu ${q.number} để xem lại`}
                  aria-label={flagged ? `Bỏ đánh dấu câu ${q.number}` : `Đánh dấu câu ${q.number} để xem lại`}
                  aria-pressed={flagged}
                  className={`relative inline-flex items-center justify-center w-7 h-7 rounded-full border font-bold text-[13px] shrink-0 mt-0.5 transition-colors cursor-pointer ${
                    flagged
                      ? 'bg-amber-50 border-amber-500 text-amber-800'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                >
                  {q.number}
                  {flagged && <Flag className="w-2.5 h-2.5 text-amber-600 fill-amber-500 absolute -top-1 -right-1" aria-hidden="true" />}
                </button>
              ) : (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-[13px] shrink-0 mt-0.5">{q.number}</span>
              )}
              <span className="flex-1">{q.questionText}</span>
            </div>
            <div className="space-y-1 pl-9">
              {opts.map(opt => {
                const isSelected = displayAnswer === opt
                return (
                  <label key={opt} onClick={preventToggleOnTextSelect} className={`exam-option rounded-full
                    ${isSelected && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                      : isSelected ? 'bg-zinc-100 border border-zinc-900 text-zinc-900 font-medium cursor-pointer'
                      : previewMode ? 'border border-transparent text-zinc-400 cursor-default'
                      : 'hover:bg-zinc-50 border border-transparent text-zinc-700 cursor-pointer'}`}>
                    <input type="radio" name={`q${q.id}`} checked={isSelected}
                      disabled={previewMode}
                      onChange={previewMode ? undefined : () => onAnswer(q.id, opt)}
                      className="accent-zinc-900" />
                    <span>{opt}</span>
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
