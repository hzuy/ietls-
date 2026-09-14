function InstructionBanner({ group }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 text-sm">
      <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-zinc-600">{group.instruction}</p>}
    </div>
  )
}

function NoteTokenLine({ content, groupQuestions, answers, onAnswer, previewMode, showAnswers }) {
  const parts = content.split(/(\[Q:\d+\])/)
  return (
    <p className="text-sm leading-9 text-zinc-800">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const q = groupQuestions.find(q => q.number === qNum)
          if (!q) return <span key={i} className="inline-block w-24 border border-zinc-300 rounded-full mx-1" />
          const val = previewMode && showAnswers ? (q?.correctAnswer || '') : (answers[q.id] || '')
          const cls = previewMode && showAnswers
            ? 'inline-block w-28 border border-green-500 rounded-full outline-none px-3 text-sm bg-white text-center font-semibold text-green-700'
            : 'inline-block w-28 border border-zinc-300 focus:border-zinc-900 rounded-full outline-none px-3 text-sm bg-white text-center text-zinc-900'
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs shrink-0">{qNum}</span>
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
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 pl-1">{ns.title}</p>
            )}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-0.5 shadow-xs">
              {(ns.lines || []).map(line => (
                line.lineType === 'heading'
                  ? <p key={line.id} className="font-semibold text-zinc-900 text-[0.95rem] pt-2 pb-0.5">{line.contentWithTokens}</p>
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
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-xs shrink-0">{q.number}</span>
            <span className="text-sm text-zinc-800 flex-1">{q.questionText}</span>
            <input type="text"
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              readOnly={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              placeholder={previewMode ? '' : '...'}
              className={`border ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-zinc-300 focus:border-zinc-900 text-zinc-900'} rounded-full outline-none px-3 py-1 text-sm w-36 bg-white`} />
          </div>
        ))
      )}
    </div>
  )
}
