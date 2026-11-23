import { Flag } from 'lucide-react'
import { lineText } from '../utils/noteLine'
// Shared render component for table_completion groups
// Used by both ReadingExam and ListeningExam

function CellContent({ content, questions, answers, onAnswer, previewMode, showAnswers, flaggedSet, onToggleFlag }) {
  const parts = (content || '').split(/(\[Q:\d+\])/)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = questions.find(q => q.number === qNum)
          if (!q) return <span key={i} className="inline-block w-16 border-b border-zinc-300 mx-1" />
          const val = previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')
          const flagged = Boolean(flaggedSet?.has?.(qNum))
          return (
            <span key={i} id={`question-${qNum}`} className="inline-flex items-center gap-1 mx-1 align-middle scroll-mt-4">
              {onToggleFlag && !previewMode ? (
                <button
                  type="button"
                  onClick={() => onToggleFlag(qNum)}
                  title={flagged ? `Bỏ đánh dấu câu ${qNum}` : `Đánh dấu câu ${qNum} để xem lại`}
                  aria-label={flagged ? `Bỏ đánh dấu câu ${qNum}` : `Đánh dấu câu ${qNum} để xem lại`}
                  aria-pressed={flagged}
                  className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full border font-bold text-xs shrink-0 transition-colors cursor-pointer ${
                    flagged
                      ? 'bg-amber-50 border-amber-500 text-amber-800'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-900 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                >
                  {qNum}
                  {flagged && <Flag className="w-2.5 h-2.5 text-amber-600 fill-amber-500 absolute -top-1 -right-1" aria-hidden="true" />}
                </button>
              ) : (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs shrink-0">{qNum}</span>
              )}
              <input
                type="text"
                value={val}
                readOnly={previewMode}
                onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
                placeholder={previewMode ? '' : '...'}
                className={`h-8 leading-normal border ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-zinc-300 focus:border-zinc-900 text-zinc-900'} rounded-full outline-none px-3 py-0 text-[15px] w-32 bg-white text-center transition`}
              />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function TableCompletionRender({ group, answers, onAnswer, previewMode, showAnswers, flaggedSet, onToggleFlag }) {
  const section = (group.noteSections || [])[0]
  if (!section) return null

  const lines = section.lines || []
  const headerLine = lines.find(l => l.lineType === 'heading')
  const dataLines = lines.filter(l => l.lineType !== 'heading')
  const headers = headerLine
    ? lineText(headerLine).split('|')
    : []
  const questions = group.questions || []

  return (
    <div id={`q-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 text-[15px] leading-relaxed">
        <p className="font-semibold text-zinc-900 text-base mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-zinc-600">{group.instruction}</p>}
      </div>
      {section.title && (
        <p className="text-base font-semibold text-zinc-900 mb-2">{section.title}</p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-xs bg-white">
        <table className="w-full border-collapse text-base">
          {headers.length > 0 && headers.some(h => (h || '').trim()) && (
            <thead>
              <tr className="bg-zinc-50/70">
                {headers.map((h, i) => (
                  <th key={i} className="text-left px-4 py-2.5 text-[13px] font-bold text-zinc-700 border-b border-zinc-200 border-r last:border-r-0 border-zinc-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {dataLines.map((line, li) => {
              const cells = lineText(line).split('|')
              return (
                <tr key={li} className={li % 2 === 1 ? 'bg-zinc-50/40' : 'bg-white'}>
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 border-b border-r last:border-r-0 border-zinc-200 text-base text-zinc-800 leading-relaxed">
                      <CellContent
                        content={cell}
                        questions={questions}
                        answers={answers}
                        onAnswer={onAnswer}
                        previewMode={previewMode}
                        showAnswers={showAnswers}
                        flaggedSet={flaggedSet}
                        onToggleFlag={onToggleFlag}
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
