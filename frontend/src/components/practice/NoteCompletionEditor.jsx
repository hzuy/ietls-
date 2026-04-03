import { useRef } from 'react'

export default function NoteCompletionEditor({ group, onChange }) {
  const lineRefs = useRef({})

  const allTokenNums = group.noteSections.flatMap(ns =>
    ns.lines.flatMap(l => {
      const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  const tokenOrder = []
  const _seenTokens = new Set()
  allTokenNums.forEach(n => { if (!_seenTokens.has(n)) { _seenTokens.add(n); tokenOrder.push(n) } })
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

  const updateLineType = (nsi, li, type) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, lineType: type })
    })
    onChange({ ...group, noteSections: sections })
  }

  const addLine = (nsi) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: [...ns.lines, { content: '', lineType: 'content' }]
    })
    onChange({ ...group, noteSections: sections })
  }

  const removeLine = (nsi, li) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.filter((_, j) => j !== li)
    })
    onChange({ ...group, noteSections: sections })
  }

  const addSection = () => {
    onChange({ ...group, noteSections: [...group.noteSections, { title: '', lines: [{ content: '', lineType: 'content' }] }] })
  }

  const removeSection = (nsi) => {
    onChange({ ...group, noteSections: group.noteSections.filter((_, i) => i !== nsi) })
  }

  const updateSectionTitle = (nsi, val) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, title: val })
    onChange({ ...group, noteSections: sections })
  }

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-amber-700">Nội dung Note/Form</p>
          <button type="button" onClick={addSection} className="text-xs text-amber-600 font-semibold hover:underline">+ Thêm phần</button>
        </div>
        <div className="space-y-4">
          {group.noteSections.map((ns, nsi) => (
            <div key={nsi} className="bg-white rounded-lg border border-amber-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold placeholder-gray-300 focus:outline-none focus:border-amber-400"
                  placeholder="Tiêu đề phần (VD: The park, Event details...)"
                  value={ns.title} onChange={e => updateSectionTitle(nsi, e.target.value)} />
                {group.noteSections.length > 1 && (
                  <button type="button" onClick={() => removeSection(nsi)} className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                )}
              </div>
              <div className="space-y-2">
                {ns.lines.map((line, li) => {
                  const isHeading = line.lineType === 'heading'
                  return (
                    <div key={li} className={`flex items-start gap-2 rounded-lg p-1 ${isHeading ? 'bg-gray-50' : ''}`}>
                      <button type="button"
                        title={isHeading ? 'Heading — click để đổi sang Nội dung' : 'Nội dung — click để đổi sang Heading'}
                        onClick={() => updateLineType(nsi, li, isHeading ? 'content' : 'heading')}
                        className={`shrink-0 text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded border transition ${isHeading ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300' : 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200'}`}>
                        {isHeading ? 'H' : '•'}
                      </button>
                      <textarea ref={el => lineRefs.current[`${nsi}-${li}`] = el} rows={1}
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono ${isHeading ? 'font-bold border-gray-300 focus:border-gray-400 bg-gray-50 text-gray-700' : 'border-gray-200 focus:border-amber-400'}`}
                        placeholder={isHeading ? 'VD: THE PARK / BENEFITS OF...' : `VD: Area: [Q:${group.qNumberStart}] hectares`}
                        value={line.content} onChange={e => updateLine(nsi, li, e.target.value)}
                        style={{ minHeight: '34px' }} />
                      {!isHeading && (
                        <button type="button" onClick={() => insertBlank(nsi, li)}
                          className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-amber-200 whitespace-nowrap">
                          + Ô trống
                        </button>
                      )}
                      {ns.lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(nsi, li)} className="shrink-0 text-red-400 hover:text-red-600 text-xs py-1.5">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addLine(nsi)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">+ Thêm dòng</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {tokenOrder.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#1a56db]">Đáp án (từ ô trống trong note)</p>
            <p className="text-[10px] text-gray-400">Dùng <span className="font-mono bg-gray-100 px-1 rounded">/</span> để tách nhiều đáp án. VD: <span className="font-mono">intestine/gut</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tokenOrder.map(tokenNum => {
              const displayNum = tokenDisplayMap[tokenNum]
              const q = group.questions.find(q => q.number === tokenNum)
              return (
                <div key={tokenNum} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1a56db] w-14 shrink-0">Q{displayNum}:</span>
                  <input className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                    placeholder="VD: word hoặc word1/word2"
                    value={q?.correctAnswer || ''} onChange={e => updateAnswer(tokenNum, e.target.value)} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
