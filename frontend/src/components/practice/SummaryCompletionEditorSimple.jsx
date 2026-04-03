import { useRef } from 'react'

// Simplified Summary Completion editor for Listening (no lineType toggle, no addSection)
export default function SummaryCompletionEditorSimple({ group, onChange }) {
  const lineRefs = useRef({})

  const allTokenNums = group.noteSections.flatMap(ns =>
    ns.lines.flatMap(l => {
      const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  const tokenOrder = []
  const _seen = new Set()
  allTokenNums.forEach(n => { if (!_seen.has(n)) { _seen.add(n); tokenOrder.push(n) } })
  const tokenDisplayMap = {}
  tokenOrder.forEach((n, idx) => { tokenDisplayMap[n] = group.qNumberStart + idx })

  const insertBlank = (nsi, li) => {
    const key = `${nsi}-${li}`
    const el = lineRefs.current[key]
    const pos = el ? el.selectionStart : (group.noteSections[nsi].lines[li].content || '').length
    const token = `[Q:${nextQNum}]`
    const oldContent = group.noteSections[nsi].lines[li].content || ''
    const newContent = oldContent.slice(0, pos) + token + oldContent.slice(pos)
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: newContent })
    })
    const existingNums = new Set(group.questions.map(q => q.number))
    const newQuestions = existingNums.has(nextQNum) ? group.questions
      : [...group.questions, { number: nextQNum, correctAnswer: '' }].sort((a, b) => a.number - b.number)
    onChange({ ...group, noteSections: sections, questions: newQuestions, qNumberEnd: Math.max(group.qNumberStart, nextQNum) })
  }

  const updateLine = (nsi, li, val) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: val })
    })
    onChange({ ...group, noteSections: sections })
  }

  const addLine = (nsi) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: [...ns.lines, { content: '' }]
    })
    onChange({ ...group, noteSections: sections })
  }

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  const updateMatchOpt = (oi, field, val) => {
    onChange({ ...group, matchingOptions: group.matchingOptions.map((mo, i) => i !== oi ? mo : { ...mo, [field]: val }) })
  }
  const addMatchOpt = () => {
    const nextLetter = String.fromCharCode(65 + group.matchingOptions.length)
    onChange({ ...group, matchingOptions: [...group.matchingOptions, { letter: nextLetter, text: '' }] })
  }
  const removeMatchOpt = (oi) => {
    onChange({ ...group, matchingOptions: group.matchingOptions.filter((_, i) => i !== oi) })
  }

  return (
    <div className="space-y-3">
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-sky-700">Word Bank</p>
          <button type="button" onClick={addMatchOpt} className="text-xs text-sky-600 font-semibold hover:underline">+ Thêm từ</button>
        </div>
        <div className="space-y-2">
          {group.matchingOptions.map((mo, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input className="w-10 border border-sky-200 rounded px-1 py-1 text-xs text-center font-bold focus:outline-none"
                value={mo.letter} onChange={e => updateMatchOpt(oi, 'letter', e.target.value)} />
              <input className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                placeholder="Từ/cụm từ..."
                value={mo.text} onChange={e => updateMatchOpt(oi, 'text', e.target.value)} />
              <button type="button" onClick={() => removeMatchOpt(oi)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-bold text-amber-700 mb-3">Nội dung Summary (dùng [Q:N] để chèn ô trống)</p>
        {group.noteSections.map((ns, nsi) => (
          <div key={nsi} className="space-y-2">
            {ns.lines.map((line, li) => (
              <div key={li} className="flex items-start gap-2">
                <textarea ref={el => lineRefs.current[`${nsi}-${li}`] = el} rows={1}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono focus:border-amber-400"
                  placeholder={`VD: The team studied [Q:${group.qNumberStart}] different methods...`}
                  value={line.content} onChange={e => updateLine(nsi, li, e.target.value)}
                  style={{ minHeight: '34px' }} />
                <button type="button" onClick={() => insertBlank(nsi, li)}
                  className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-amber-200 whitespace-nowrap">
                  + Ô trống
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addLine(nsi)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">+ Thêm dòng</button>
          </div>
        ))}
      </div>
      {tokenOrder.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
          <p className="text-xs font-bold text-[#1a56db] mb-2">Đáp án (chọn từ Word Bank)</p>
          <div className="grid grid-cols-2 gap-2">
            {tokenOrder.map(tokenNum => {
              const displayNum = tokenDisplayMap[tokenNum]
              const q = group.questions.find(q => q.number === tokenNum)
              return (
                <div key={tokenNum} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1a56db] w-14 shrink-0">Q{displayNum}:</span>
                  <select className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6] bg-white"
                    value={q?.correctAnswer || ''} onChange={e => updateAnswer(tokenNum, e.target.value)}>
                    <option value="">-- chọn --</option>
                    {group.matchingOptions.map((mo, mi) => (
                      <option key={mi} value={mo.letter}>{mo.letter}. {mo.text}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
