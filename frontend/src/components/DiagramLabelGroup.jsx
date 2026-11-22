import { resolveImg } from '../utils/media'

export default function DiagramLabelGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const questions = group.questions || []

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 text-[15px] leading-relaxed">
        <p className="font-semibold text-zinc-900 text-base mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-zinc-600">{group.instruction}</p>}
      </div>

      {group.imageUrl && (
        <div className="flex justify-center mb-4">
          <img
            src={resolveImg(group.imageUrl)}
            alt="diagram"
            className="rounded-2xl border border-zinc-200 object-contain bg-zinc-50"
            style={{ width: '100%', maxWidth: '600px' }}
          />
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q) => {
          const hint = q.questionText || ''
          const correctAns = q.correctAnswer || ''
          const userAns = previewMode && showAnswers ? correctAns : (answers[q.id] || '')

          return (
            <div key={q.id} className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-[13px] shrink-0">
                {q.number}
              </span>
              <input
                type="text"
                value={userAns}
                disabled={previewMode}
                onChange={previewMode ? undefined : (e) => onAnswer(q.id, e.target.value)}
                placeholder="Nhập đáp án..."
                className={`flex-1 min-w-0 border bg-white px-3.5 py-1.5 text-[15px] rounded-full focus:outline-none transition
                  ${previewMode && showAnswers
                    ? 'border-green-500 text-green-700 font-semibold cursor-default'
                    : previewMode
                    ? 'border-zinc-300 text-zinc-400 cursor-default'
                    : 'border-zinc-300 focus:border-zinc-900 text-zinc-900'}`}
              />
              {hint && (
                <span className="text-[13px] text-zinc-500 italic shrink-0">{hint}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
