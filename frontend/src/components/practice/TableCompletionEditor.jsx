/**
 * LƯU Ý KIẾN TRÚC: Đây là 1 trong 2 bản implementation song song cho loại câu hỏi này.
 * Bản kia: src/components/admin/editors/TableCompletionEditor.jsx
 * 2 bản đã fork khác nhau (xem chi tiết trong CLAUDE.md — phần "Known Issues").
 * Khi sửa bug hoặc thêm tính năng ở đây, cân nhắc đồng bộ sang bản kia nếu áp dụng được.
 * Kế hoạch dài hạn: hợp nhất thành 1 bản tham số hóa (numberingMode: auto/manual, themeSource)
 * — chưa thực hiện, cần đánh giá riêng.
 */
import { useState, useRef } from 'react'
import { inputCls, labelCls, getQuestionGroupTheme } from '../../utils/practiceConfig'

// Đồng bộ group.questions với các token [Q:n] còn thực sự tồn tại trong nội dung bảng.
// Khi người dùng xóa token khỏi ô/hàng/cột, câu hỏi tương ứng phải bị loại (tránh câu "mồ côi").
function syncQuestionsToTokens(contentStrings, questions, qNumberStart) {
  const present = new Set()
  for (const s of contentStrings) for (const m of (s || '').matchAll(/\[Q:(\d+)\]/g)) present.add(Number(m[1]))
  const kept = (questions || []).filter(q => present.has(q.number))
  const maxNum = kept.length ? Math.max(...kept.map(q => q.number)) : qNumberStart
  return { questions: kept, qNumberEnd: Math.max(qNumberStart, maxNum) }
}

export default function TableCompletionEditor({ group, onChange }) {
  const cellRefs = useRef({})
  const theme = getQuestionGroupTheme(group?.type || 'table_completion')

  const section = (group.noteSections && group.noteSections.length > 0)
    ? group.noteSections[0]
    : { title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }

  const headingLine = section.lines.find(l => l.lineType === 'heading') || { content: '' }
  const dataLines = section.lines.filter(l => l.lineType !== 'heading')
  const headers = (headingLine.content || '').split('|')
  const [colCount, setColCount] = useState(headers.length || 3)

  const allTokenNums = section.lines.flatMap(l => {
    const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
    return matches.map(m => parseInt(m[1]))
  })
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  const tokenOrder = []
  const _seenTokens = new Set()
  allTokenNums.forEach(n => { if (!_seenTokens.has(n)) { _seenTokens.add(n); tokenOrder.push(n) } })
  const tokenDisplayMap = {}
  tokenOrder.forEach((n, idx) => { tokenDisplayMap[n] = group.qNumberStart + idx })

  const updateSection = (newLines, newTitle = section.title) => {
    onChange({ ...group, noteSections: [{ title: newTitle, lines: newLines }], ...syncQuestionsToTokens(newLines.map(l => l.content), group.questions || [], group.qNumberStart) })
  }

  const updateTitle = (val) => updateSection(section.lines, val)

  const updateHeader = (colIdx, val) => {
    const newHeaders = [...headers]
    while (newHeaders.length < colCount) newHeaders.push('')
    newHeaders[colIdx] = val
    const newHeadingContent = newHeaders.slice(0, colCount).join('|')
    const newLines = section.lines.map(l => l.lineType === 'heading' ? { ...l, content: newHeadingContent } : l)
    updateSection(newLines)
  }

  const updateCell = (rowIdx, colIdx, val) => {
    const newDataLines = [...dataLines]
    const cells = (newDataLines[rowIdx].content || '').split('|')
    while (cells.length < colCount) cells.push('')
    cells[colIdx] = val
    newDataLines[rowIdx] = { ...newDataLines[rowIdx], content: cells.slice(0, colCount).join('|') }
    const newLines = [headingLine, ...newDataLines]
    onChange({ ...group, noteSections: [{ title: section.title, lines: newLines }], ...syncQuestionsToTokens(newLines.map(l => l.content), group.questions || [], group.qNumberStart) })
  }

  const insertBlank = (rowIdx, colIdx) => {
    const key = `${rowIdx}-${colIdx}`
    const el = cellRefs.current[key]
    const cells = (dataLines[rowIdx].content || '').split('|')
    while (cells.length < colCount) cells.push('')
    const oldVal = cells[colIdx] || ''
    const pos = el ? el.selectionStart : oldVal.length
    const token = `[Q:${nextQNum}]`
    const newVal = oldVal.slice(0, pos) + token + oldVal.slice(pos)
    cells[colIdx] = newVal

    const newDataLines = [...dataLines]
    newDataLines[rowIdx] = { ...newDataLines[rowIdx], content: cells.slice(0, colCount).join('|') }
    const newLines = [headingLine, ...newDataLines]

    const existingNums = new Set((group.questions || []).map(q => q.number))
    const newQuestions = existingNums.has(nextQNum) ? (group.questions || [])
      : [...(group.questions || []), { number: nextQNum, correctAnswer: '' }].sort((a, b) => a.number - b.number)

    onChange({
      ...group,
      noteSections: [{ title: section.title, lines: newLines }],
      questions: newQuestions,
      qNumberEnd: Math.max(group.qNumberStart, nextQNum)
    })
  }

  const addRow = () => {
    const emptyRow = Array.from({ length: colCount }, () => '').join('|')
    const newLines = [...section.lines, { content: emptyRow, lineType: 'content' }]
    updateSection(newLines)
  }

  const removeRow = (rowIdx) => {
    const newDataLines = dataLines.filter((_, i) => i !== rowIdx)
    updateSection([headingLine, ...newDataLines])
  }

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Tiêu đề bảng (tùy chọn)</label>
        <input type="text" className={inputCls} placeholder="VD: A typical 45-minute guitar lesson"
          value={section.title || ''} onChange={e => updateTitle(e.target.value)} />
      </div>
      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-lg p-4`}>
        <div className="flex items-center gap-3 mb-3">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Bảng Table Completion</p>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">Số cột:</span>
            <button type="button" onClick={() => colCount > 2 && setColCount(colCount - 1)} disabled={colCount <= 2}
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold transition">−</button>
            <span className="w-5 text-center text-sm font-bold text-slate-700">{colCount}</span>
            <button type="button" onClick={() => colCount < 6 && setColCount(colCount + 1)} disabled={colCount >= 6}
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold transition">+</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className={`${theme.headerBg}`}>
                {Array.from({ length: colCount }, (_, ci) => (
                  <th key={ci} className={`px-2 py-1.5 border ${theme.subBoxBorder} font-normal min-w-[100px]`}>
                    <input type="text"
                      className={`w-full bg-transparent border-none outline-none text-xs font-bold ${theme.subBoxText} text-center`}
                      placeholder={`Tiêu đề cột ${ci + 1}`}
                      value={headers[ci] || ''} onChange={e => updateHeader(ci, e.target.value)} />
                  </th>
                ))}
                  <th className={`w-8 border ${theme.subBoxBorder} ${theme.headerBg}`} />
              </tr>
            </thead>
            <tbody>
              {dataLines.map((dl, ri) => {
                const cells = (dl.content || '').split('|')
                return (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {Array.from({ length: colCount }, (_, ci) => (
                      <td key={ci} className="px-2 py-1.5 border border-slate-200 align-top min-w-[100px]">
                        <div className="flex items-start gap-1">
                          <textarea ref={el => { cellRefs.current[`${ri}-${ci}`] = el }} rows={2}
                            className={`flex-1 border ${theme.subBoxBorder} rounded px-1.5 py-1 text-xs font-mono focus:outline-none resize-none`}
                            placeholder={`text [Q:${nextQNum}] text`}
                            value={cells[ci] || ''} onChange={e => updateCell(ri, ci, e.target.value)}
                            style={{ minHeight: '48px' }} />
                          <button type="button" onClick={() => insertBlank(ri, ci)}
                            className={`shrink-0 text-[10px] ${theme.subBoxBtn} ${theme.subBoxHover} px-1.5 py-1 rounded font-semibold whitespace-nowrap leading-tight mt-0.5`}>
                            +Ô<br />trống
                          </button>
                        </div>
                      </td>
                    ))}
                    <td className="border border-slate-200 px-1 text-center align-middle">
                      {dataLines.length > 1 && (
                        <button type="button" onClick={() => removeRow(ri)} className="text-red-500 hover:text-red-600 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addRow} className={`mt-2 text-xs ${theme.subBoxText} font-semibold hover:underline`}>+ Thêm hàng</button>
      </div>
      {tokenOrder.length > 0 && (
        <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-lg p-3`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-bold ${theme.subBoxText}`}>Đáp án (từ ô trống trong bảng)</p>
            <p className="text-[10px] text-slate-400">Dùng <span className="font-mono bg-slate-100 px-1 rounded">/</span> để tách nhiều đáp án. VD: <span className="font-mono">word1/word2</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tokenOrder.map(tokenNum => {
              const displayNum = tokenDisplayMap[tokenNum]
              const q = group.questions.find(q => q.number === tokenNum)
              return (
                <div key={tokenNum} className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${theme.subBoxText} w-14 shrink-0`}>Q{displayNum}:</span>
                  <input className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm focus:outline-none`}
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
