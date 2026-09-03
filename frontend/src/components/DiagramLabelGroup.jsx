import { resolveImg } from '../utils/media'

export default function DiagramLabelGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const questions = group.questions || []

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
      </div>

      {group.imageUrl && (
        <div className="flex justify-center mb-4">
          <img
            src={resolveImg(group.imageUrl)}
            alt="diagram"
            className="rounded-xl border border-gray-200 object-contain bg-gray-50"
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
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[var(--primary-hover)] font-bold text-xs shrink-0">
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
                    ? 'border-blue-400 text-[var(--primary-hover)] font-semibold cursor-default'
                    : previewMode
                    ? 'border-gray-300 text-gray-500 cursor-default'
                    : 'border-gray-300 focus:border-blue-400 text-gray-800'}`}
              />
              {hint && (
                <span className="text-xs text-gray-500 italic shrink-0">{hint}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
