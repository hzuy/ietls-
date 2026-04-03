// Shared render component for table_completion groups
// Used by both ReadingExam and ListeningExam

function CellContent({ content, questions, answers, onAnswer, previewMode, showAnswers }) {
  const parts = (content || '').split(/(\[Q:\d+\])/)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = questions.find(q => q.number === qNum)
          if (!q) return <span key={i} className="inline-block w-16 border-b border-gray-400 mx-1" />
          const val = previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')
          return (
            <span key={i} className="inline-flex items-center gap-0.5">
              <span className="text-xs font-semibold text-gray-500 mr-0.5">{qNum}.</span>
              <input
                type="text"
                value={val}
                readOnly={previewMode}
                onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
                placeholder={previewMode ? '' : '...'}
                className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-blue-400 focus:border-blue-600'} outline-none px-1 py-0.5 text-sm w-24 bg-transparent text-center transition`}
              />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function TableCompletionRender({ group, answers, onAnswer, previewMode, showAnswers }) {
  const section = (group.noteSections || [])[0]
  if (!section) return null

  const lines = section.lines || []
  const headerLine = lines.find(l => l.lineType === 'heading')
  const dataLines = lines.filter(l => l.lineType !== 'heading')
  const headers = headerLine
    ? (headerLine.contentWithTokens || headerLine.content || '').split('|')
    : []
  const questions = group.questions || []

  return (
    <div id={`q-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
        <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
      </div>
      {section.title && (
        <p className="text-sm font-semibold text-gray-700 mb-2">{section.title}</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          {headers.length > 0 && headers.some(h => (h || '').trim()) && (
            <thead>
              <tr className="bg-gray-100">
                {headers.map((h, i) => (
                  <th key={i} className="text-left px-4 py-2 text-xs font-bold text-gray-700 border-b border-gray-200 border-r last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {dataLines.map((line, li) => {
              const cells = (line.contentWithTokens || line.content || '').split('|')
              return (
                <tr key={li} className={li % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 border-b border-r last:border-r-0 border-gray-200 leading-relaxed">
                      <CellContent
                        content={cell}
                        questions={questions}
                        answers={answers}
                        onAnswer={onAnswer}
                        previewMode={previewMode}
                        showAnswers={showAnswers}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
