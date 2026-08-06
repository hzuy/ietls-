function InstructionBanner({ group }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
      <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-gray-700">{group.instruction}</p>}
    </div>
  )
}

function NoteTokenLine({ content, groupQuestions, answers, onAnswer, previewMode, showAnswers }) {
  const parts = content.split(/(\[Q:\d+\])/)
  return (
    <p className="text-sm leading-9 text-gray-700">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = groupQuestions.find(q => q.number === qNum)
          if (!q) return <span key={i} className="inline-block w-24 border-b-2 border-gray-400 mx-1" />
          const val = previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')
          const cls = previewMode && showAnswers
            ? 'inline-block w-28 border-b-2 border-green-500 outline-none px-1 text-sm bg-transparent text-center font-semibold text-green-700'
            : 'inline-block w-28 border-b-2 border-blue-400 focus:border-blue-600 outline-none px-1 text-sm bg-transparent text-center'
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{qNum}</span>
              <input
                type="text"
                value={val}
                readOnly={previewMode}
                onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
                className={cls}
                placeholder={previewMode ? '' : '...'}
              />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// ── Note Completion Group ─────────────────────────────────────────────────────
export default function NoteCompletionGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const hasSections = (group.noteSections || []).length > 0
  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {hasSections ? (
        (group.noteSections || []).map(ns => (
          <div key={ns.id} className="mb-4">
            {ns.title && (
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-1">{ns.title}</p>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-0.5">
              {(ns.lines || []).map(line => (
                line.lineType === 'heading'
                  ? <p key={line.id} className="font-bold text-gray-800 text-[0.95rem] pt-2 pb-0.5">{line.contentWithTokens}</p>
                  : <NoteTokenLine key={line.id} content={line.contentWithTokens}
                      groupQuestions={group.questions} answers={answers} onAnswer={onAnswer}
                      previewMode={previewMode} showAnswers={showAnswers} />
              ))}
            </div>
          </div>
        ))
      ) : (
        (group.questions || []).map(q => (
          <div key={q.id} id={`question-${q.number}`} className="mb-3 flex gap-2 items-center scroll-mt-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{q.number}</span>
            <span className="text-sm text-gray-700 flex-1">{q.questionText}</span>
            <input type="text"
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              readOnly={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              placeholder={previewMode ? '' : '...'}
              className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-blue-400 focus:border-blue-600'} outline-none px-2 py-0.5 text-sm w-36 bg-transparent`} />
          </div>
        ))
      )}
    </div>
  )
}
