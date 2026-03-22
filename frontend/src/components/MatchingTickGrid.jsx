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
 *   accentColor  'purple'|'blue'  — color for question numbers
 *   globalOffset number     — base index for scroll anchors (omit if not needed)
 */
export default function MatchingTickGrid({
  letters,
  questions,
  answers,
  onAnswer,
  previewMode,
  showAnswers,
  accentColor = 'purple',
  globalOffset,
}) {
  const numClass = 'text-[#1a56db]'

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-2.5 border-r border-gray-200 min-w-[200px]" />
            {letters.map(l => (
              <th key={l} className="px-2 py-2.5 text-center font-semibold text-gray-700 w-12 border-r border-gray-100 last:border-r-0">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q, qi) => {
            const currentAns = previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')
            const rowSelected = !!currentAns
            const rowId = `q-${q.number}`
            return (
              <tr
                key={q.id}
                id={rowId}
                className={`border-b border-gray-100 last:border-b-0 transition-colors scroll-mt-4
                  ${rowSelected ? 'bg-[#eff6ff]' : 'hover:bg-gray-50/60'}`}
              >
                <td className="px-4 py-3 border-r border-gray-200 align-middle">
                  <span className={`font-bold mr-1.5 ${numClass}`}>{q.number}.</span>
                  <span className="text-gray-700 leading-snug">{q.questionText}</span>
                </td>
                {letters.map(l => {
                  const isSelected = currentAns === l
                  return (
                    <td key={l} className="px-2 py-3 text-center border-r border-gray-100 last:border-r-0 align-middle">
                      <button
                        type="button"
                        onClick={previewMode ? undefined : () => onAnswer(q.id, currentAns === l ? '' : l)}
                        disabled={previewMode}
                        className={`w-7 h-7 flex items-center justify-center mx-auto text-sm font-bold transition-all
                          rounded border
                          ${isSelected
                            ? 'bg-[#eff6ff] border-[#1a56db] text-[#1a56db]'
                            : previewMode
                              ? 'bg-white border-gray-200 text-transparent cursor-default'
                              : 'bg-white border-gray-300 text-transparent hover:bg-gray-50 hover:border-gray-400 cursor-pointer'
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
