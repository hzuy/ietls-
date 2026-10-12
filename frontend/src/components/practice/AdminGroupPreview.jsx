import { PreviewTokenLine, buildTokenNumMap } from './PreviewTokenLine'
import { toImgSrc } from '../../utils/practiceConfig'
import { deriveCorrectIndices } from '../../utils/mcqAnswer'

// Unified neutral preview for all question group types (Reading + Listening admin)
// Matches the user-side clean black & white / zinc design system.
const BADGE_CLASS = 'bg-zinc-100 text-zinc-700 border-zinc-200'

export default function AdminGroupPreview({ group, showAnswers }) {
  const qStart     = group.qNumberStart
  const qEnd       = group.qNumberEnd
  const maxChoices = group.maxChoices || 2

  // Header strip: neutral zinc-50 header matching user-facing instruction banners
  const Banner = () => (
    <div className="-mx-4 -mt-4 mb-4 px-4 py-3.5 bg-zinc-50 border-b border-zinc-200 text-sm flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="font-bold text-zinc-900 mb-0">Questions {qStart}–{qEnd}</p>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${BADGE_CLASS}`}>
          {group.type}
        </span>
      </div>
      {group.instruction && <p className="text-zinc-600 text-xs mt-0.5">{group.instruction}</p>}
    </div>
  )

  // ── True / False / Not Given ──────────────────────────────────────────────
  if (group.type === 'true_false_ng' || group.type === 'yes_no_ng') {
    const choices = group.type === 'true_false_ng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
    return (
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="mb-3 pl-1">
            <div className="flex gap-2.5 items-start mb-2">
              <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
              <p className="text-sm text-zinc-900 leading-5">{q.questionText}</p>
            </div>
            <div className="flex gap-2 pl-7.5">
              {choices.map(c => (
                <span key={c} className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${showAnswers && q.correctAnswer === c ? 'bg-emerald-50 text-emerald-800 border-emerald-400' : 'border-zinc-200 text-zinc-500 bg-white'}`}>{c}</span>
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {hasSections ? (
          (group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3">
              {ns.title && <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{ns.title}</p>}
              <div className="rounded-xl p-3.5 space-y-1 bg-zinc-50/60 border border-zinc-200">
                {(ns.lines || []).map((line, li) => (
                  line.lineType === 'heading'
                    ? <p key={li} className="font-bold text-zinc-900 text-[0.95rem] pt-1 pb-0.5">{line.content || ''}</p>
                    : <PreviewTokenLine key={li} content={line.content || ''} questions={group.questions} showAnswers={showAnswers} tokenNumMap={tokenNumMap} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-2">
            {(group.questions || []).map((q, qi) => (
              <div key={qi} className="flex gap-2.5 items-center text-sm">
                <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs flex items-center justify-center shrink-0">{qStart + qi}</span>
                <span className="flex-1 text-zinc-900">{q.questionText}</span>
                <span className={`border-b-2 ${showAnswers ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-zinc-300 text-zinc-400'} min-w-24 text-center text-sm`}>
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {(group.questions || []).map((q, qi) => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          const shownOpts = opts.filter(o => o && String(o).trim())
          const correctIdx = showAnswers ? new Set(deriveCorrectIndices(q.correctAnswer, shownOpts)) : new Set()
          return (
            <div key={qi} className="mb-4">
              <p className="text-sm text-zinc-900 mb-2 flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
                <span>{q.questionText}</span>
              </p>
              <div className="space-y-1 pl-8.5">
                {shownOpts.map((opt, oi) => {
                  const isCorrect = correctIdx.has(oi)
                  return (
                    <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${isCorrect ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium' : 'text-zinc-700 hover:bg-zinc-50'}`}>
                      <span className="text-xs text-zinc-400 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-bold text-emerald-700">✓</span>}
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {(group.questions || []).map((q, qi) => {
          const qS = qStart + qi * maxChoices
          const qE = qS + maxChoices - 1
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          const shownOpts = opts.filter(o => o && String(o).trim())
          const correctIdx = showAnswers ? new Set(deriveCorrectIndices(q.correctAnswer, shownOpts)) : new Set()
          return (
            <div key={qi} className="mb-4">
              {q.questionText && (
                <p className="text-sm text-zinc-900 mb-2 flex gap-2">
                  <span className="font-bold text-zinc-700 shrink-0">{qS}–{qE}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {shownOpts.map((opt, oi) => {
                  const isCorrect = correctIdx.has(oi)
                  return (
                    <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${isCorrect ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium' : 'text-zinc-700 hover:bg-zinc-50'}`}>
                      <span className="text-xs text-zinc-400 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-bold text-emerald-700">✓</span>}
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {(group.matchingOptions || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(group.matchingOptions || []).map((mo, mi) => (
              <span key={mi} className="text-xs px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-800 rounded-lg">
                <span className="font-bold text-zinc-900 mr-1">{mo.letter || mo.optionLetter}.</span> {mo.text || mo.optionText}
              </span>
            ))}
          </div>
        )}
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="flex items-center gap-2.5 mb-2 text-sm">
            <span className="w-6 text-xs font-bold text-zinc-500 shrink-0">{qStart + qi}.</span>
            <span className="flex-1 text-zinc-900">{q.questionText}</span>
            <span className={`font-bold text-sm ${showAnswers ? 'text-emerald-700' : 'text-zinc-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Map / Diagram Labeling (Listening) ────────────────────────────────────
  if (group.type === 'map_diagram') {
    const letters = (group.matchingOptions || []).map(mo => mo.letter || mo.optionLetter).filter(Boolean)
    return (
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {group.imageUrl && (
          <img src={toImgSrc(group.imageUrl)} alt="diagram" className="w-full max-w-sm rounded-lg mb-3 border border-zinc-200" />
        )}
        {letters.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="text-left px-4 py-2 border-r border-zinc-200 min-w-[180px]" />
                  {letters.map(l => (
                    <th key={l} className="px-2 py-2 text-center font-semibold text-zinc-700 w-10 border-r border-zinc-100 last:border-r-0 text-xs">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(group.questions || []).map((q, qi) => {
                  const correct = q.correctAnswer || ''
                  return (
                    <tr key={qi} className="border-b border-zinc-100 last:border-b-0">
                      <td className="px-4 py-2.5 border-r border-zinc-200 align-middle">
                        <span className="font-bold text-zinc-900 mr-1.5 text-xs">{qStart + qi}.</span>
                        <span className="text-zinc-900 text-xs leading-snug">{q.questionText}</span>
                      </td>
                      {letters.map(l => {
                        const isCorrect = showAnswers && correct === l
                        return (
                          <td key={l} className="px-2 py-2.5 text-center border-r border-zinc-100 last:border-r-0 align-middle">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded border text-sm font-bold
                              ${isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-zinc-200 text-transparent'}`}>✓</span>
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
              <span className="w-6 text-xs font-bold text-zinc-500 shrink-0">{qStart + qi}.</span>
              <span className="flex-1 text-zinc-900">{q.questionText}</span>
              <span className={`font-bold text-sm ${showAnswers ? 'text-emerald-700' : 'text-zinc-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        <div className="rounded-xl p-3 border border-zinc-200 bg-zinc-50/60 mb-3">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Word Bank</p>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((wb, wi) => (
              <span key={wi} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-sm shadow-2xs">
                <span className="font-bold text-xs text-zinc-900">{wb.letter || wb.optionLetter}</span>
                <span className="text-zinc-700">{wb.text || wb.optionText}</span>
              </span>
            ))}
          </div>
        </div>
        {(group.noteSections || []).map((ns, nsi) => (
          <div key={nsi} className="mb-3">
            {ns.title && <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">{ns.title}</p>}
            <div className="rounded-xl p-3.5 space-y-1 bg-zinc-50/60 border border-zinc-200">
              {(ns.lines || []).map((line, li) => {
                const content = line.contentWithTokens || line.content || ''
                const parts   = content.split(/(\[Q:\d+\])/)
                return (
                  <p key={li} className="text-sm leading-8 text-zinc-900">
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
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs shrink-0">{displayNum}</span>
                            <span className={`inline-block min-w-20 border-b-2 ${showAnswers && ans ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-zinc-300 text-zinc-400'} px-1 text-sm text-center`}>
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        <div className="flex gap-4">
          <div className="flex-1 space-y-2.5">
            {(group.questions || []).map((q, qi) => {
              const answer    = showAnswers ? (q.correctAnswer || '') : ''
              const answerOpt = opts.find(o => (o.letter || o.optionLetter) === answer)
              return (
                <div key={qi} className="bg-zinc-50/60 rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm text-zinc-900 mb-2 leading-relaxed flex gap-2.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs shrink-0 mt-0.5">{qStart + qi}</span>
                    <span>{q.questionText}</span>
                  </p>
                  <div className={`min-h-[36px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm ${answer ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800' : 'border-dashed border-zinc-300 bg-white'}`}>
                    {answer ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-800 text-xs shrink-0">{answer}</span>
                        <span className="text-emerald-800 text-xs leading-snug">{answerOpt?.text || answerOpt?.optionText || ''}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs italic">Kéo hoặc click đáp án...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="w-52 shrink-0">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Options</p>
            <div className="space-y-1.5">
              {opts.map((opt, oi) => (
                <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs shadow-2xs">
                  <span className="font-bold text-zinc-900 shrink-0">{opt.letter || opt.optionLetter}</span>
                  <span className="text-zinc-700 leading-relaxed">{opt.text || opt.optionText}</span>
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {group.imageUrl && (
          <img src={toImgSrc(group.imageUrl)}
            alt="diagram" className="mx-auto mb-3 rounded-xl border border-zinc-200 object-contain w-full max-w-[600px] bg-zinc-50" />
        )}
        <div className="space-y-2">
          {(group.questions || []).map((q, qi) => {
            const hint   = q.hint || q.questionText || ''
            const answer = showAnswers ? (q.correctAnswer || '') : ''
            return (
              <div key={qi} className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs shrink-0">{qStart + qi}</span>
                <div className={`flex-1 min-h-[34px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm ${answer ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold' : 'border-dashed border-zinc-300 bg-zinc-50'}`}>
                  {answer || <span className="text-zinc-400 text-xs italic">________</span>}
                </div>
                {hint && <span className="text-xs text-zinc-500 italic">{hint}</span>}
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
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        <div className="flex gap-4">
          <div className="w-52 shrink-0">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">List of Headings</p>
            <div className="space-y-1.5">
              {headings.map((h, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs shadow-2xs">
                  <span className="font-bold text-zinc-900 shrink-0">{h.letter || h.optionLetter}</span>
                  <span className="text-zinc-700 leading-relaxed">{h.text || h.optionText}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            {(group.questions || []).map((q, qi) => {
              const [paraKey, paraLabel] = (q.questionText || '|').split('|')
              const answer        = showAnswers ? (q.correctAnswer || '') : ''
              const answerHeading = headings.find(h => (h.letter || h.optionLetter) === answer)
              return (
                <div key={qi} className="bg-zinc-50/60 rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm text-zinc-900 mb-2 flex gap-2.5 items-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs shrink-0 mt-0.5">{qStart + qi}</span>
                    <span>
                      <span className="font-semibold text-zinc-900">Paragraph {paraKey}</span>
                      {paraLabel && <span className="text-zinc-500"> — {paraLabel}</span>}
                    </span>
                  </p>
                  <div className={`min-h-[36px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm ${answer ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold' : 'border-dashed border-zinc-300 bg-white'}`}>
                    {answer ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-800 text-xs shrink-0">{answer}</span>
                        <span className="text-emerald-800 text-xs leading-snug">{answerHeading?.text || answerHeading?.optionText || ''}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs italic">Kéo hoặc click heading...</span>
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
    if (!section) return <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs"><Banner /></div>
    const tLines      = section.lines || []
    const tHeaderLine = tLines.find(l => l.lineType === 'heading')
    const tDataLines  = tLines.filter(l => l.lineType !== 'heading')
    const tHeaders    = tHeaderLine ? (tHeaderLine.content || '').split('|') : []
    const tokenNumMap = buildTokenNumMap(group)
    return (
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
        <Banner />
        {section.title && <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">{section.title}</p>}
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full border-collapse text-sm">
            {tHeaders.length > 0 && tHeaders.some(h => (h || '').trim()) && (
              <thead>
                <tr className="bg-zinc-100">
                  {tHeaders.map((h, i) => (
                    <th key={i} className="text-left px-3 py-2 text-xs font-bold text-zinc-700 border-b border-r last:border-r-0 border-zinc-200">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tDataLines.map((dl, ri) => {
                const cells = (dl.content || '').split('|')
                return (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-zinc-50' : 'bg-white'}>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-b border-r last:border-r-0 border-zinc-200 leading-relaxed">
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
    <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 overflow-hidden shadow-2xs">
      <Banner />
      <p className="text-xs text-zinc-400 italic px-1">Dạng câu hỏi: <span className="font-mono">{group.type}</span></p>
    </div>
  )
}
