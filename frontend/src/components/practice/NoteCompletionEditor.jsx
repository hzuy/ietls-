/**
 * LƯU Ý KIẾN TRÚC: Đây là 1 trong 2 bản implementation song song cho loại câu hỏi này.
 * Bản kia: src/components/admin/editors/NoteCompletionEditor.jsx
 * 2 bản đã fork khác nhau (xem chi tiết trong CLAUDE.md — phần "Known Issues").
 * Khi sửa bug hoặc thêm tính năng ở đây, cân nhắc đồng bộ sang bản kia nếu áp dụng được.
 * Kế hoạch dài hạn: hợp nhất thành 1 bản tham số hóa (numberingMode: auto/manual, themeSource)
 * — chưa thực hiện, cần đánh giá riêng.
 */
import { useRef } from 'react'
import { getQuestionGroupTheme } from '../../utils/practiceConfig'

// Đồng bộ group.questions với các token [Q:n] còn thực sự tồn tại trong nội dung.
// Khi người dùng xóa token khỏi text, câu hỏi tương ứng phải bị loại (tránh câu "mồ côi").
function syncQuestionsToTokens(contentStrings, questions, qNumberStart) {
  const present = new Set()
  for (const s of contentStrings) for (const m of (s || '').matchAll(/\[Q:(\d+)\]/g)) present.add(Number(m[1]))
  const kept = (questions || []).filter(q => present.has(q.number))
  const maxNum = kept.length ? Math.max(...kept.map(q => q.number)) : qNumberStart
  return { questions: kept, qNumberEnd: Math.max(qNumberStart, maxNum) }
}
const noteContents = (sections) => (sections || []).flatMap(ns => (ns.lines || []).map(l => l.content))

export default function NoteCompletionEditor({ group, onChange }) {
  const lineRefs = useRef({})
  const theme = getQuestionGroupTheme(group?.type || 'note_completion')

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
    onChange({ ...group, noteSections: sections, ...syncQuestionsToTokens(noteContents(sections), group.questions, group.qNumberStart) })
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
    onChange({ ...group, noteSections: sections, ...syncQuestionsToTokens(noteContents(sections), group.questions, group.qNumberStart) })
  }

  const addSection = () => {
    onChange({ ...group, noteSections: [...group.noteSections, { title: '', lines: [{ content: '', lineType: 'content' }] }] })
  }

  const removeSection = (nsi) => {
    const sections = group.noteSections.filter((_, i) => i !== nsi)
    onChange({ ...group, noteSections: sections, ...syncQuestionsToTokens(noteContents(sections), group.questions, group.qNumberStart) })
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
      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Nội dung Note/Form</p>
          <button type="button" onClick={addSection} className={`text-xs ${theme.subBoxText} font-semibold hover:underline`}>+ Thêm phần</button>
        </div>
        <div className="space-y-4">
          {group.noteSections.map((ns, nsi) => (
            <div key={nsi} className={`bg-white rounded-lg border ${theme.subBoxBorder} p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold placeholder-gray-300 focus:outline-none focus:border-amber-400"
                  placeholder="Tiêu đề phần (VD: The park, Event details...)"
                  value={ns.title} onChange={e => updateSectionTitle(nsi, e.target.value)} />
                {group.noteSections.length > 1 && (
                  <button type="button" onClick={() => removeSection(nsi)} className="text-red-500 hover:text-red-600 text-xs px-2">✕</button>
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
                        className={`shrink-0 text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded border transition ${isHeading ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300' : `${theme.subBoxBtn} ${theme.subBoxHover}`}`}>
                        {isHeading ? 'H' : '•'}
                      </button>
                      <textarea ref={el => lineRefs.current[`${nsi}-${li}`] = el} rows={1}
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono ${isHeading ? 'font-bold border-gray-300 focus:border-gray-400 bg-gray-50 text-gray-700' : `${theme.subBoxBorder} focus:border-amber-400`}`}
                        placeholder={isHeading ? 'VD: THE PARK / BENEFITS OF...' : `VD: Area: [Q:${group.qNumberStart}] hectares`}
                        value={line.content} onChange={e => updateLine(nsi, li, e.target.value)}
                        style={{ minHeight: '34px' }} />
                      {!isHeading && (
                        <button type="button" onClick={() => insertBlank(nsi, li)}
                          className={`shrink-0 text-xs ${theme.subBoxBtn} ${theme.subBoxHover} px-2 py-1.5 rounded-lg font-semibold whitespace-nowrap`}>
                          + Ô trống
                        </button>
                      )}
                      {ns.lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(nsi, li)} className="shrink-0 text-red-500 hover:text-red-600 text-xs py-1.5">✕</button>
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
        <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-3`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-bold ${theme.subBoxText}`}>Đáp án (từ ô trống trong note)</p>
            <p className="text-[10px] text-gray-400">Dùng <span className="font-mono bg-gray-100 px-1 rounded">/</span> để tách nhiều đáp án. VD: <span className="font-mono">intestine/gut</span></p>
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
