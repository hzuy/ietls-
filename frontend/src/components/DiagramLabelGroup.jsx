const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

export default function DiagramLabelGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const questions = group.questions || []

  const toImgSrc = (url) => {
    if (!url) return null
    return url.startsWith('http') ? url : BACKEND_URL + url
  }

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
      </div>

      {group.imageUrl && (
        <div className="flex justify-center mb-4">
          <img
            src={toImgSrc(group.imageUrl)}
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
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs shrink-0">
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
                    ? 'border-rose-400 text-rose-700 font-semibold cursor-default'
                    : previewMode
                    ? 'border-gray-300 text-gray-500 cursor-default'
                    : 'border-gray-300 focus:border-rose-400 text-gray-800'}`}
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
