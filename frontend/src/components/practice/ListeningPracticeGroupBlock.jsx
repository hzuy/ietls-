import { buildListeningTokenMap } from '../../utils/practiceUtils'
import { toImgSrc } from '../../utils/media'

function ListeningTokenLine({ content, answers, onAnswer, group, tokenNumMap, isDragWordBank }) {
  const parts = (content || '').split(/(\[Q:\d+\])/)
  return (
    <span className="text-sm leading-9 text-gray-800">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const displayNum = tokenNumMap[qNum] ?? qNum
          const val = answers[qNum] || ''
          if (isDragWordBank) {
            return (
              <span key={i} className="inline-flex items-center gap-1 mx-1">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{displayNum}</span>
                <select value={val} onChange={e => onAnswer(qNum, e.target.value)}
                  className="border-b-2 border-blue-400 bg-transparent outline-none text-sm px-1 text-blue-700 max-w-36">
                  <option value="">—</option>
                  {(group.matchingOptions || []).map((mo, mi) => (
                    <option key={mi} value={mo.letter}>{mo.letter}. {mo.text}</option>
                  ))}
                </select>
              </span>
            )
          }
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">{displayNum}</span>
              <input type="text" value={val} onChange={e => onAnswer(qNum, e.target.value)}
                className="border-b-2 border-blue-400 outline-none px-1 text-sm w-24 bg-transparent transition" />
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

export default function ListeningPracticeGroupBlock({ group, answers, onAnswer }) {
  const tokenNumMap = ['note_completion', 'table_completion', 'drag_word_bank'].includes(group.type)
    ? buildListeningTokenMap(group) : {}
  const opts = group.matchingOptions || []

  return (
    <div id={`q-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
        <p className="font-bold text-gray-800 mb-0.5">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
        {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
      </div>

      {/* note_completion */}
      {group.type === 'note_completion' && (group.noteSections || []).map((ns, nsi) => (
        <div key={nsi} className="mb-4">
          {ns.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{ns.title}</p>}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
            {(ns.lines || []).map((line, li) => (
              line.lineType === 'heading'
                ? <p key={li} className="font-bold text-gray-800 pt-1">{line.content}</p>
                : <p key={li}><ListeningTokenLine content={line.content} answers={answers} onAnswer={onAnswer} group={group} tokenNumMap={tokenNumMap} isDragWordBank={false} /></p>
            ))}
          </div>
        </div>
      ))}

      {/* table_completion */}
      {group.type === 'table_completion' && (() => {
        const section = (group.noteSections || [])[0]
        if (!section) return null
        const tLines = section.lines || []
        const headerLine = tLines.find(l => l.lineType === 'heading')
        const dataLines = tLines.filter(l => l.lineType !== 'heading')
        const headers = headerLine ? (headerLine.content || '').split('|') : []
        return (
          <div>
            {section.title && <p className="text-xs font-bold text-gray-500 uppercase mb-2">{section.title}</p>}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-sm">
                {headers.length > 0 && headers.some(h => h.trim()) && (
                  <thead><tr className="bg-gray-100">
                    {headers.map((h, i) => <th key={i} className="text-left px-3 py-2 text-xs font-bold text-gray-700 border-b border-r last:border-r-0 border-gray-200">{h}</th>)}
                  </tr></thead>
                )}
                <tbody>
                  {dataLines.map((dl, ri) => {
                    const cells = (dl.content || '').split('|')
                    return (
                      <tr key={ri} className={ri % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                        {cells.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2.5 border-b border-r last:border-r-0 border-gray-200">
                            <ListeningTokenLine content={cell} answers={answers} onAnswer={onAnswer} group={group} tokenNumMap={tokenNumMap} isDragWordBank={false} />
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
      })()}

      {/* mcq */}
      {group.type === 'mcq' && (group.questions || []).map(q => (
        <div key={q.number} id={`q-${q.number}`} className="mb-5 scroll-mt-4">
          <p className="text-sm text-gray-800 mb-2 flex gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
            <span>{q.questionText}</span>
          </p>
          <div className="space-y-1.5 pl-8">
            {(Array.isArray(q.options) ? q.options : []).filter(o => o && o.trim()).map((opt, oi) => {
              const isSelected = answers[q.number] === opt
              return (
                <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition cursor-pointer
                  ${isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <input type="radio" name={`q${q.number}`} checked={isSelected} onChange={() => onAnswer(q.number, opt)} className="accent-blue-600 shrink-0" />
                  <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}

      {/* mcq_multi */}
      {group.type === 'mcq_multi' && (group.questions || []).map(q => {
        const maxChoices = group.maxChoices || 2
        const selected = (answers[q.number] || '').split(',').filter(Boolean)
        const toggleOpt = (opt) => {
          const next = selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt]
          onAnswer(q.number, next.join(','))
        }
        return (
          <div key={q.number} id={`q-${q.number}`} className="mb-5 scroll-mt-4">
            <p className="text-sm text-gray-800 mb-2 flex gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
              <span>{q.questionText}</span>
            </p>
            <p className="text-xs text-gray-400 pl-8 mb-2">Chọn {maxChoices} đáp án</p>
            <div className="space-y-1.5 pl-8">
              {(Array.isArray(q.options) ? q.options : []).filter(o => o && o.trim()).map((opt, oi) => {
                const isSelected = selected.includes(opt)
                return (
                  <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition cursor-pointer
                    ${isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOpt(opt)} className="accent-blue-600 shrink-0" />
                    <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* matching */}
      {group.type === 'matching' && (
        <div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opts.map((mo, mi) => (
              <span key={mi} className="text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="font-bold text-blue-700">{mo.letter}.</span> {mo.text}
              </span>
            ))}
          </div>
          {(group.questions || []).map(q => (
            <div key={q.number} id={`q-${q.number}`} className="flex items-center gap-3 mb-3 scroll-mt-4">
              <span className="text-xs font-bold text-gray-500 w-7 shrink-0">{q.number}.</span>
              <span className="flex-1 text-sm text-gray-700">{q.questionText}</span>
              <select value={answers[q.number] || ''} onChange={e => onAnswer(q.number, e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white min-w-32">
                <option value="">— Chọn —</option>
                {opts.map(mo => <option key={mo.letter} value={mo.letter}>{mo.letter}. {mo.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* map_diagram */}
      {group.type === 'map_diagram' && (
        <div>
          {group.imageUrl && (
            <img src={toImgSrc(group.imageUrl)}
              alt="diagram" className="w-full max-w-sm rounded-xl border mb-4 object-contain bg-gray-50" />
          )}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opts.map((mo, mi) => (
              <span key={mi} className="text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="font-bold text-blue-700">{mo.letter}.</span> {mo.text}
              </span>
            ))}
          </div>
          {(group.questions || []).map(q => (
            <div key={q.number} id={`q-${q.number}`} className="flex items-center gap-3 mb-3 scroll-mt-4">
              <span className="text-xs font-bold text-gray-500 w-7 shrink-0">{q.number}.</span>
              <span className="flex-1 text-sm text-gray-700">{q.questionText}</span>
              <select value={answers[q.number] || ''} onChange={e => onAnswer(q.number, e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white min-w-32">
                <option value="">— Chọn —</option>
                {opts.map(mo => <option key={mo.letter} value={mo.letter}>{mo.letter}. {mo.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* drag_word_bank */}
      {group.type === 'drag_word_bank' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="w-full text-xs font-bold text-gray-500 uppercase mb-1">Word Bank</p>
            {opts.map((mo, mi) => (
              <span key={mi} className="text-xs px-3 py-1.5 bg-white border border-blue-200 rounded-lg font-medium text-gray-700">
                <span className="text-blue-600 font-bold">{mo.letter}.</span> {mo.text}
              </span>
            ))}
          </div>
          {(group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3">
              {ns.title && <p className="text-xs font-bold text-gray-500 uppercase mb-2">{ns.title}</p>}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
                {(ns.lines || []).map((line, li) => (
                  <p key={li}><ListeningTokenLine content={line.content} answers={answers} onAnswer={onAnswer} group={group} tokenNumMap={tokenNumMap} isDragWordBank={true} /></p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* matching_drag */}
      {group.type === 'matching_drag' && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
            {(group.questions || []).map(q => (
              <div key={q.number} id={`q-${q.number}`} className="bg-white rounded-xl border border-gray-200 p-3 scroll-mt-4">
                <p className="text-sm text-gray-800 mb-2 flex gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
                  <span>{q.questionText}</span>
                </p>
                <select value={answers[q.number] || ''} onChange={e => onAnswer(q.number, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="">— Chọn đáp án —</option>
                  {opts.map(mo => <option key={mo.letter} value={mo.letter}>{mo.letter}. {mo.text}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="w-44 shrink-0">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Options</p>
            <div className="space-y-1.5">
              {opts.map((mo, oi) => (
                <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs">
                  <span className="font-bold text-blue-600 shrink-0">{mo.letter}</span>
                  <span className="text-gray-700">{mo.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
