/**
 * MatchingTickGrid — shared grid for:
 *   - Map / Diagram Labelling (Listening)
 *   - Matching Information (Reading)
 *
 * Props:
 *   letters      string[]   — column headers (e.g. ['A','B','C','D','E'])
 *   questions    object[]   — { id, number, questionText, correctAnswer }
 *   answers      object     — { [questionId]: selectedLetter }
 *   onAnswer     fn(id, l)  — called when user clicks a cell
 *   previewMode  bool
 *   showAnswers  bool
 */
export default function MatchingTickGrid({
  letters,
  questions,
  answers,
  onAnswer,
  previewMode,
  showAnswers,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-xs bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/70">
            <th className="text-left px-4 py-2.5 border-r border-zinc-200 min-w-[200px]" />
            {letters.map(l => (
              <th key={l} className="px-2 py-2.5 text-center font-semibold text-zinc-700 w-12 border-r border-zinc-100 last:border-r-0">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const currentAns = previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')
            const rowSelected = !!currentAns
            const rowId = `q-${q.number}`
            return (
              <tr
                key={q.id}
                id={rowId}
                className={`border-b border-zinc-100 last:border-b-0 transition-colors scroll-mt-4
                  ${rowSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50/60'}`}
              >
                <td className="px-4 py-3 border-r border-zinc-200 align-middle">
                  <span className="font-bold mr-1.5 text-zinc-900">{q.number}.</span>
                  <span className="text-zinc-800 leading-snug">{q.questionText}</span>
                </td>
                {letters.map(l => {
                  const isSelected = currentAns === l
                  return (
                    <td key={l} className="px-2 py-3 text-center border-r border-zinc-100 last:border-r-0 align-middle">
                      <button
                        type="button"
                        onClick={previewMode ? undefined : () => onAnswer(q.id, currentAns === l ? '' : l)}
                        disabled={previewMode}
                        className={`w-7 h-7 flex items-center justify-center mx-auto text-sm font-bold transition-all
                          rounded-full border
                          ${isSelected
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs'
                            : previewMode
                              ? 'bg-white border-zinc-200 text-transparent cursor-default'
                              : 'bg-white border-zinc-300 text-transparent hover:bg-zinc-100 hover:border-zinc-400 cursor-pointer'
                          }`}
                      >
                        ✓
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
