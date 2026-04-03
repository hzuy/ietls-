import { useRef } from 'react'
import { inputCls, labelCls } from '../../utils/practiceConfig'

export default function TableCompletionEditor({ group, onChange }) {
  const cellRefs = useRef({})
  const section = (group.noteSections || [])[0] || { title: '', lines: [] }
  const lines = section.lines || []
  const headerLine = lines.find(l => l.lineType === 'heading') || { content: '', lineType: 'heading' }
  const dataLines = lines.filter(l => l.lineType !== 'heading')
  const headers = (headerLine.content || '').split('|')
  const colCount = Math.max(2, headers.length)

  const allTokenNums = dataLines.flatMap(dl =>
    (dl.content || '').split('|').flatMap(cell => {
      const matches = [...cell.matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  const tokenOrder = []
  const _seenTokens = new Set()
  allTokenNums.forEach(n => { if (!_seenTokens.has(n)) { _seenTokens.add(n); tokenOrder.push(n) } })
  const tokenDisplayMap = {}
  tokenOrder.forEach((n, idx) => { tokenDisplayMap[n] = group.qNumberStart + idx })

  const rebuildSection = (newHeaderCells, newDataLines) => {
    const newLines = [{ content: newHeaderCells.join('|'), lineType: 'heading' }, ...newDataLines]
    onChange({ ...group, noteSections: [{ ...section, lines: newLines }, ...(group.noteSections || []).slice(1)] })
  }

  const setColCount = (n) => {
    const newHeaders = Array.from({ length: n }, (_, i) => headers[i] !== undefined ? headers[i] : `Cột ${i + 1}`)
    const newDataLines = dataLines.map(dl => {
      const cells = (dl.content || '').split('|')
      const newCells = Array.from({ length: n }, (_, i) => cells[i] || '')
      return { ...dl, content: newCells.join('|') }
    })
    rebuildSection(newHeaders, newDataLines)
  }

  const updateHeader = (ci, val) => {
    const newHeaders = headers.map((h, i) => i === ci ? val : h)
    rebuildSection(newHeaders, dataLines)
  }

  const updateCell = (ri, ci, val) => {
    const newDataLines = dataLines.map((dl, i) => {
      if (i !== ri) return dl
      const cells = (dl.content || '').split('|')
      const newCells = Array.from({ length: colCount }, (_, j) => j === ci ? val : (cells[j] || ''))
      return { ...dl, content: newCells.join('|') }
    })
    rebuildSection(headers, newDataLines)
  }

  const insertBlank = (ri, ci) => {
    const key = `${ri}-${ci}`
    const el = cellRefs.current[key]
    const cells = ((dataLines[ri] || {}).content || '').split('|')
    const oldVal = cells[ci] || ''
    const pos = el ? el.selectionStart : oldVal.length
    const token = `[Q:${nextQNum}]`
    const newVal = oldVal.slice(0, pos) + token + oldVal.slice(pos)
    const newDataLines = dataLines.map((dl, i) => {
      if (i !== ri) return dl
      const cs = (dl.content || '').split('|')
      const newCs = Array.from({ length: colCount }, (_, j) => j === ci ? newVal : (cs[j] || ''))
      return { ...dl, content: newCs.join('|') }
    })
    const existingNums = new Set(group.questions.map(q => q.number))
    const newQuestions = existingNums.has(nextQNum) ? group.questions
      : [...group.questions, { number: nextQNum, correctAnswer: '' }].sort((a, b) => a.number - b.number)
    const newLines = [{ content: headers.join('|'), lineType: 'heading' }, ...newDataLines]
    onChange({
      ...group,
      noteSections: [{ ...section, lines: newLines }, ...(group.noteSections || []).slice(1)],
      questions: newQuestions,
      qNumberEnd: Math.max(group.qNumberStart, nextQNum),
    })
  }

  const addRow = () => {
    const newDataLines = [...dataLines, { content: Array(colCount).fill('').join('|'), lineType: 'content' }]
    rebuildSection(headers, newDataLines)
  }

  const removeRow = (ri) => { rebuildSection(headers, dataLines.filter((_, i) => i !== ri)) }

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  const updateTitle = (val) => {
    onChange({ ...group, noteSections: [{ ...section, title: val }, ...(group.noteSections || []).slice(1)] })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Tiêu đề bảng (tùy chọn)</label>
        <input type="text" className={inputCls} placeholder="VD: A typical 45-minute guitar lesson"
          value={section.title || ''} onChange={e => updateTitle(e.target.value)} />
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-bold text-emerald-700">Bảng Table Completion</p>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Số cột:</span>
            <button type="button" onClick={() => colCount > 2 && setColCount(colCount - 1)} disabled={colCount <= 2}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-xs font-bold transition">−</button>
            <span className="w-5 text-center text-sm font-bold text-gray-700">{colCount}</span>
            <button type="button" onClick={() => colCount < 6 && setColCount(colCount + 1)} disabled={colCount >= 6}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-xs font-bold transition">+</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-100">
                {Array.from({ length: colCount }, (_, ci) => (
                  <th key={ci} className="px-2 py-1.5 border border-emerald-200 font-normal min-w-[100px]">
                    <input type="text"
                      className="w-full bg-transparent border-none outline-none text-xs font-bold text-emerald-800 placeholder-emerald-400 text-center"
                      placeholder={`Tiêu đề cột ${ci + 1}`}
                      value={headers[ci] || ''} onChange={e => updateHeader(ci, e.target.value)} />
                  </th>
                ))}
                <th className="w-8 border border-emerald-200 bg-emerald-100" />
              </tr>
            </thead>
            <tbody>
              {dataLines.map((dl, ri) => {
                const cells = (dl.content || '').split('|')
                return (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Array.from({ length: colCount }, (_, ci) => (
                      <td key={ci} className="px-2 py-1.5 border border-gray-200 align-top min-w-[100px]">
                        <div className="flex items-start gap-1">
                          <textarea ref={el => { cellRefs.current[`${ri}-${ci}`] = el }} rows={2}
                            className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-emerald-400 resize-none"
                            placeholder={`text [Q:${nextQNum}] text`}
                            value={cells[ci] || ''} onChange={e => updateCell(ri, ci, e.target.value)}
                            style={{ minHeight: '48px' }} />
                          <button type="button" onClick={() => insertBlank(ri, ci)}
                            className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-1 rounded font-semibold hover:bg-emerald-200 whitespace-nowrap leading-tight mt-0.5">
                            +Ô<br />trống
                          </button>
                        </div>
                      </td>
                    ))}
                    <td className="border border-gray-200 px-1 text-center align-middle">
                      {dataLines.length > 1 && (
                        <button type="button" onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addRow} className="mt-2 text-xs text-emerald-600 font-semibold hover:underline">+ Thêm hàng</button>
      </div>
      {tokenOrder.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#1a56db]">Đáp án (từ ô trống trong bảng)</p>
            <p className="text-[10px] text-gray-400">Dùng <span className="font-mono bg-gray-100 px-1 rounded">/</span> để tách nhiều đáp án. VD: <span className="font-mono">word1/word2</span></p>
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
