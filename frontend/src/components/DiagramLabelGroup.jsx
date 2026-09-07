import { resolveImg } from '../utils/media'

export default function DiagramLabelGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const questions = group.questions || []

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 mb-3 text-sm">
        <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-zinc-600 text-xs">{group.instruction}</p>}
      </div>

      {group.imageUrl && (
        <div className="flex justify-center mb-4">
          <img
            src={resolveImg(group.imageUrl)}
            alt="diagram"
            className="rounded-xl border border-zinc-200 object-contain bg-zinc-50"
            style={{ width: '100%', maxWidth: '600px' }}
          />
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, qi) => {
          const hint = q.questionText || ''
          const correctAns = q.correctAnswer || ''
          const userAns = previewMode && showAnswers ? correctAns : (answers[q.id] || '')

          return (
            <div key={q.id} className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs shrink-0">
                {q.number}
              </span>
              <input
                type="text"
                value={userAns}
                disabled={previewMode}
                onChange={previewMode ? undefined : (e) => onAnswer(q.id, e.target.value)}
                placeholder="________"
                className={`flex-1 min-w-0 border-b-2 bg-transparent px-2 py-1 text-sm focus:outline-none transition
                  ${previewMode && showAnswers
                    ? 'border-green-500 text-green-700 font-semibold cursor-default'
                    : previewMode
                    ? 'border-zinc-300 text-zinc-400 cursor-default'
                    : 'border-zinc-300 focus:border-zinc-900 text-zinc-900'}`}
              />
              {hint && (
                <span className="text-xs text-zinc-500 italic shrink-0">{hint}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
