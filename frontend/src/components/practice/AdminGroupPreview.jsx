import { PreviewTokenLine, buildTokenNumMap } from './PreviewTokenLine'
import { toImgSrc } from '../../utils/practiceConfig'

// Unified preview for all question group types (Reading + Listening admin)
export default function AdminGroupPreview({ group, showAnswers }) {
  const qStart     = group.qNumberStart
  const qEnd       = group.qNumberEnd
  const maxChoices = group.maxChoices || 2

  const Banner = () => (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
      <p className="font-bold text-gray-800 mb-0.5">Questions {qStart}–{qEnd}</p>
      {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
    </div>
  )

  // ── True / False / Not Given ──────────────────────────────────────────────
  if (group.type === 'true_false_ng' || group.type === 'yes_no_ng') {
    const choices = group.type === 'true_false_ng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="mb-3 pl-1">
            <div className="flex gap-2 items-start mb-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
              <p className="text-sm text-gray-700 leading-5">{q.questionText}</p>
            </div>
            <div className="flex gap-2 pl-7">
              {choices.map(c => (
                <span key={c} className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${showAnswers && q.correctAnswer === c ? 'bg-[#1a56db] text-white border-[#1a56db]' : 'border-gray-200 text-gray-400'}`}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Note Completion ───────────────────────────────────────────────────────
  if (group.type === 'note_completion') {
    const hasSections = (group.noteSections || []).length > 0
    const tokenNumMap = hasSections ? buildTokenNumMap(group) : {}
    return (
      <div className="mb-4">
        <Banner />
        {hasSections ? (
          (group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3">
              {ns.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{ns.title}</p>}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} className="rounded-lg p-3 space-y-1">
                {(ns.lines || []).map((line, li) => (
                  line.lineType === 'heading'
                    ? <p key={li} className="font-bold text-[#1e293b] text-[0.95rem] pt-1 pb-0.5">{line.content || ''}</p>
                    : <PreviewTokenLine key={li} content={line.content || ''} questions={group.questions} showAnswers={showAnswers} tokenNumMap={tokenNumMap} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-2">
            {(group.questions || []).map((q, qi) => (
              <div key={qi} className="flex gap-2 items-center text-sm">
                <span className="w-5 h-5 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs flex items-center justify-center shrink-0">{qStart + qi}</span>
                <span className="flex-1 text-gray-700">{q.questionText}</span>
                <span className={`border-b-2 ${showAnswers ? 'border-[#1a56db] text-[#1a56db] font-semibold' : 'border-gray-200 text-gray-400'} min-w-24 text-center text-sm`}>
                  {showAnswers ? q.correctAnswer : '___'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── MCQ (single answer) ───────────────────────────────────────────────────
  if (group.type === 'mcq') {
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          return (
            <div key={qi} className="mb-4">
              <p className="text-sm text-gray-800 mb-2 flex gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
                <span>{q.questionText}</span>
              </p>
              <div className="space-y-1 pl-8">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const isCorrect = showAnswers && q.correctAnswer === opt
                  return (
                    <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe] text-[#1a56db]' : 'text-gray-600'}`}>
                      <span className="text-xs text-gray-400 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-bold text-[#1a56db]">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── MCQ Multi ─────────────────────────────────────────────────────────────
  if (group.type === 'mcq_multi') {
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => {
          const qS = qStart + qi * maxChoices
          const qE = qS + maxChoices - 1
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          const correctList = showAnswers ? (q.correctAnswer || '').split(',').filter(Boolean) : []
          return (
            <div key={qi} className="mb-4">
              {q.questionText && (
                <p className="text-sm text-gray-800 mb-2 flex gap-2">
                  <span className="font-bold text-gray-700 shrink-0">{qS}–{qE}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const isCorrect = showAnswers && correctList.includes(opt)
                  return (
                    <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe] text-[#1a56db]' : 'text-gray-600'}`}>
                      <span className="text-xs text-gray-400 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-bold text-[#1a56db]">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Matching Information (Reading) / Matching (Listening) ─────────────────
  if (group.type === 'matching_information' || group.type === 'matching') {
    return (
      <div className="mb-4">
        <Banner />
        {(group.matchingOptions || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(group.matchingOptions || []).map((mo, mi) => (
              <span key={mi} className="text-xs px-2 py-0.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
                <span className="font-bold text-[#1a56db]">{mo.letter || mo.optionLetter}.</span> {mo.text || mo.optionText}
              </span>
            ))}
          </div>
        )}
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="flex items-center gap-2 mb-2 text-sm">
            <span className="w-6 text-xs font-bold text-gray-500 shrink-0">{qStart + qi}.</span>
            <span className="flex-1 text-gray-700">{q.questionText}</span>
            <span className={`font-bold text-sm ${showAnswers ? 'text-[#1a56db]' : 'text-gray-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Map / Diagram Labeling (Listening) ────────────────────────────────────
  if (group.type === 'map_diagram') {
    const letters = (group.matchingOptions || []).map(mo => mo.letter || mo.optionLetter).filter(Boolean)
    return (
      <div className="mb-4">
        <Banner />
        {group.imageUrl && (
          <img src={toImgSrc(group.imageUrl)} alt="diagram" className="w-full max-w-sm rounded-lg mb-3 border" />
        )}
        {letters.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 border-r border-gray-200 min-w-[180px]" />
                  {letters.map(l => (
                    <th key={l} className="px-2 py-2 text-center font-semibold text-gray-700 w-10 border-r border-gray-100 last:border-r-0 text-xs">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(group.questions || []).map((q, qi) => {
                  const correct = q.correctAnswer || ''
                  return (
                    <tr key={qi} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-2.5 border-r border-gray-200 align-middle">
                        <span className="font-bold text-[#1a56db] mr-1.5 text-xs">{qStart + qi}.</span>
                        <span className="text-gray-700 text-xs leading-snug">{q.questionText}</span>
                      </td>
                      {letters.map(l => {
                        const isCorrect = showAnswers && correct === l
                        return (
                          <td key={l} className="px-2 py-2.5 text-center border-r border-gray-100 last:border-r-0 align-middle">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded border text-sm font-bold
                              ${isCorrect ? 'bg-[#eff6ff] border-[#1a56db] text-[#1a56db]' : 'bg-white border-gray-200 text-transparent'}`}>✓</span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          (group.questions || []).map((q, qi) => (
            <div key={qi} className="flex items-center gap-2 mb-2 text-sm">
              <span className="w-6 text-xs font-bold text-gray-500 shrink-0">{qStart + qi}.</span>
              <span className="flex-1 text-gray-700">{q.questionText}</span>
              <span className={`font-bold text-sm ${showAnswers ? 'text-[#1a56db]' : 'text-gray-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
            </div>
          ))
        )}
      </div>
    )
  }

  // ── Drag Word Bank ────────────────────────────────────────────────────────
  if (group.type === 'drag_word_bank') {
    const wordBank    = group.matchingOptions || []
    const tokenNumMap = buildTokenNumMap(group)
    return (
      <div className="mb-4">
        <Banner />
        <div className="rounded-xl p-3 border border-[#e2e8f0] bg-white mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Word Bank</p>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((wb, wi) => (
              <span key={wi} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bfdbfe] bg-white text-sm">
                <span className="font-bold text-xs text-[#1a56db]">{wb.letter || wb.optionLetter}</span>
                <span className="text-gray-700">{wb.text || wb.optionText}</span>
              </span>
            ))}
          </div>
        </div>
        {(group.noteSections || []).map((ns, nsi) => (
          <div key={nsi} className="mb-3">
            {ns.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{ns.title}</p>}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} className="rounded-lg p-3 space-y-1">
              {(ns.lines || []).map((line, li) => {
                const content = line.contentWithTokens || line.content || ''
                const parts   = content.split(/(\[Q:\d+\])/)
                return (
                  <p key={li} className="text-sm leading-8 text-gray-700">
                    {parts.map((part, pi) => {
                      const match = part.match(/\[Q:(\d+)\]/)
                      if (match) {
                        const qNum       = parseInt(match[1])
                        const displayNum = tokenNumMap[qNum] ?? qNum
                        const q          = (group.questions || []).find(q => q.number === qNum)
                        const ans        = showAnswers ? (q?.correctAnswer || '') : ''
                        const ansWord    = ans ? (wordBank.find(wb => (wb.letter || wb.optionLetter) === ans) || {}) : {}
                        return (
                          <span key={pi} className="inline-flex items-center gap-1 mx-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs shrink-0">{displayNum}</span>
                            <span className={`inline-block min-w-20 border-b-2 ${showAnswers && ans ? 'border-[#1a56db] text-[#1a56db] font-semibold' : 'border-gray-300 text-gray-400'} px-1 text-sm text-center`}>
                              {ans ? `${ans}. ${ansWord.text || ansWord.optionText || ''}` : '___'}
                            </span>
                          </span>
                        )
                      }
                      return <span key={pi}>{part}</span>
                    })}
                  </p>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Matching Drag ─────────────────────────────────────────────────────────
  if (group.type === 'matching_drag') {
    const opts = group.matchingOptions || []
    return (
      <div className="mb-4">
        <Banner />
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            {(group.questions || []).map((q, qi) => {
              const answer    = showAnswers ? (q.correctAnswer || '') : ''
              const answerOpt = opts.find(o => (o.letter || o.optionLetter) === answer)
              return (
                <div key={qi} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs shrink-0 mt-0.5">{qStart + qi}</span>
                    <span>{q.questionText}</span>
                  </p>
                  <div className={`min-h-[36px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm ${answer ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                    {answer ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1a56db] text-xs shrink-0">{answer}</span>
                        <span className="text-[#1a56db] text-xs leading-snug">{answerOpt?.text || answerOpt?.optionText || ''}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Kéo hoặc click đáp án...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="w-48 shrink-0">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Options</p>
            <div className="space-y-1.5">
              {opts.map((opt, oi) => (
                <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs">
                  <span className="font-bold text-[#1a56db] shrink-0">{opt.letter || opt.optionLetter}</span>
                  <span className="text-gray-700 leading-relaxed">{opt.text || opt.optionText}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Diagram Label Completion ──────────────────────────────────────────────
  if (group.type === 'diagram_label') {
    return (
      <div className="mb-4">
        <Banner />
        {group.imageUrl && (
          <img src={toImgSrc(group.imageUrl)}
            alt="diagram" className="mx-auto mb-3 rounded-xl border object-contain w-full max-w-[600px] bg-gray-50" />
        )}
        <div className="space-y-2">
          {(group.questions || []).map((q, qi) => {
            const hint   = q.hint || q.questionText || ''
            const answer = showAnswers ? (q.correctAnswer || '') : ''
            return (
              <div key={qi} className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs shrink-0">{qStart + qi}</span>
                <div className={`flex-1 min-h-[34px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm ${answer ? 'border-rose-400 bg-rose-50 text-rose-700 font-semibold' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                  {answer || <span className="text-gray-400 text-xs italic">________</span>}
                </div>
                {hint && <span className="text-xs text-gray-500 italic">{hint}</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Matching Headings ─────────────────────────────────────────────────────
  if (group.type === 'matching_headings') {
    const headings = group.matchingOptions || []
    return (
      <div className="mb-4">
        <Banner />
        <div className="flex gap-3">
          <div className="w-48 shrink-0">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">List of Headings</p>
            <div className="space-y-1.5">
              {headings.map((h, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs">
                  <span className="font-bold text-green-700 shrink-0">{h.letter || h.optionLetter}</span>
                  <span className="text-gray-700 leading-relaxed">{h.text || h.optionText}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {(group.questions || []).map((q, qi) => {
              const [paraKey, paraLabel] = (q.questionText || '|').split('|')
              const answer        = showAnswers ? (q.correctAnswer || '') : ''
              const answerHeading = headings.find(h => (h.letter || h.optionLetter) === answer)
              return (
                <div key={qi} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-sm text-gray-800 mb-2 flex gap-2 items-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-xs shrink-0 mt-0.5">{qStart + qi}</span>
                    <span>
                      <span className="font-semibold">Paragraph {paraKey}</span>
                      {paraLabel && <span className="text-gray-500"> — {paraLabel}</span>}
                    </span>
                  </p>
                  <div className={`min-h-[36px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm ${answer ? 'border-green-500 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                    {answer ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-700 text-xs shrink-0">{answer}</span>
                        <span className="text-green-700 text-xs leading-snug">{answerHeading?.text || answerHeading?.optionText || ''}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Kéo hoặc click heading...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Table Completion ──────────────────────────────────────────────────────
  if (group.type === 'table_completion') {
    const section = (group.noteSections || [])[0]
    if (!section) return <div className="mb-4"><Banner /></div>
    const tLines      = section.lines || []
    const tHeaderLine = tLines.find(l => l.lineType === 'heading')
    const tDataLines  = tLines.filter(l => l.lineType !== 'heading')
    const tHeaders    = tHeaderLine ? (tHeaderLine.content || '').split('|') : []
    const tokenNumMap = buildTokenNumMap(group)
    return (
      <div className="mb-4">
        <Banner />
        {section.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{section.title}</p>}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            {tHeaders.length > 0 && tHeaders.some(h => (h || '').trim()) && (
              <thead>
                <tr className="bg-gray-100">
                  {tHeaders.map((h, i) => (
                    <th key={i} className="text-left px-3 py-2 text-xs font-bold text-gray-700 border-b border-r last:border-r-0 border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tDataLines.map((dl, ri) => {
                const cells = (dl.content || '').split('|')
                return (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-b border-r last:border-r-0 border-gray-200 leading-relaxed">
                        <PreviewTokenLine content={cell} questions={group.questions} showAnswers={showAnswers} tokenNumMap={tokenNumMap} />
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

  return (
    <div className="mb-4">
      <Banner />
      <p className="text-xs text-gray-400 italic px-1">Dạng câu hỏi: <span className="font-mono">{group.type}</span></p>
    </div>
  )
}
