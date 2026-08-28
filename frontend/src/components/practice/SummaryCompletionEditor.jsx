import { useRef } from 'react'
import { btnSecondary, getQuestionGroupTheme } from '../../utils/practiceConfig'

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

export default function SummaryCompletionEditor({ group, onChange }) {
  const lineRefs = useRef({})
  const theme = getQuestionGroupTheme(group?.type || 'summary_completion')

  // Guard: đảm bảo noteSections và matchingOptions luôn là array hợp lệ
  const noteSections = (group.noteSections && group.noteSections.length > 0)
    ? group.noteSections
    : [{ title: '', lines: [{ content: '', lineType: 'content' }] }]
  const matchingOptions = group.matchingOptions || []

  const allTokenNums = noteSections.flatMap(ns =>
    ns.lines.flatMap(l => {
      const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  const insertBlank = (nsi, li) => {
    const key = `${nsi}-${li}`
    const el = lineRefs.current[key]
    const pos = el ? el.selectionStart : (noteSections[nsi].lines[li].content || '').length
    const token = `[Q:${nextQNum}]`
    const oldContent = noteSections[nsi].lines[li].content || ''
    const newContent = oldContent.slice(0, pos) + token + oldContent.slice(pos)
    const sections = noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: newContent })
    })
    const existingNums = new Set((group.questions || []).map(q => q.number))
    const newQuestions = existingNums.has(nextQNum) ? (group.questions || [])
      : [...(group.questions || []), { number: nextQNum, correctAnswer: '' }].sort((a, b) => a.number - b.number)
    onChange({ ...group, noteSections: sections, questions: newQuestions, qNumberEnd: Math.max(group.qNumberStart, nextQNum) })
  }

  const updateLine = (nsi, li, val) => {
    const sections = noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: val })
    })
    onChange({ ...group, noteSections: sections, ...syncQuestionsToTokens(noteContents(sections), group.questions, group.qNumberStart) })
  }

  const updateLineType = (nsi, li, type) => {
    const sections = noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, lineType: type })
    })
    onChange({ ...group, noteSections: sections })
  }

  const addLine = (nsi) => {
    const sections = noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, lines: [...ns.lines, { content: '', lineType: 'content' }] })
    onChange({ ...group, noteSections: sections })
  }

  const removeLine = (nsi, li) => {
    const sections = noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, lines: ns.lines.filter((_, j) => j !== li) })
    onChange({ ...group, noteSections: sections, ...syncQuestionsToTokens(noteContents(sections), group.questions, group.qNumberStart) })
  }

  const addSection = () => {
    onChange({ ...group, noteSections: [...noteSections, { title: '', lines: [{ content: '', lineType: 'content' }] }] })
  }

  const updateSectionTitle = (nsi, val) => {
    const sections = noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, title: val })
    onChange({ ...group, noteSections: sections })
  }

  const updateOption = (oi, field, val) => {
    onChange({ ...group, matchingOptions: matchingOptions.map((mo, i) => i !== oi ? mo : { ...mo, [field]: val }) })
  }

  const addOption = () => {
    const nextLetter = String.fromCharCode(65 + matchingOptions.length)
    onChange({ ...group, matchingOptions: [...matchingOptions, { letter: nextLetter, text: '' }] })
  }

  const removeOption = (oi) => {
    onChange({ ...group, matchingOptions: matchingOptions.filter((_, i) => i !== oi) })
  }

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  return (
    <div className="space-y-4">
      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-3.5`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Word Bank (Khung từ vựng A, B, C...)</p>
          <button type="button" onClick={addOption} className={`text-xs ${theme.subBoxText} font-semibold hover:underline`}>+ Thêm lựa chọn</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {matchingOptions.map((mo, oi) => (
            <div key={oi} className="flex items-center gap-1.5 bg-white/80 rounded-lg p-1 border border-gray-200">
              <input className={`w-8 border ${theme.subBoxBorder} rounded px-1 py-0.5 text-xs text-center font-bold focus:outline-none bg-white`}
                value={mo.letter} onChange={e => updateOption(oi, 'letter', e.target.value)} />
              <input className="flex-1 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-lime-500 bg-white"
                placeholder="Từ/cụm từ..."
                value={mo.text} onChange={e => updateOption(oi, 'text', e.target.value)} />
              <button type="button" onClick={() => removeOption(oi)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Nội dung đoạn Summary</p>
          <button type="button" onClick={addSection} className={`text-xs ${theme.subBoxText} font-semibold hover:underline`}>+ Thêm phần</button>
        </div>
        <div className="space-y-4">
          {noteSections.map((ns, nsi) => (
            <div key={nsi} className={`bg-white rounded-lg border ${theme.subBoxBorder} p-3`}>
              <input
                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold placeholder-gray-300 focus:outline-none mb-2"
                placeholder="Tiêu đề phần (tùy chọn)"
                value={ns.title} onChange={e => updateSectionTitle(nsi, e.target.value)} />
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
                      <textarea
                        ref={el => lineRefs.current[`${nsi}-${li}`] = el}
                        rows={1}
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono ${isHeading ? 'font-bold border-gray-300 focus:border-gray-400 bg-gray-50 text-gray-700' : `${theme.subBoxBorder} focus:border-lime-500`}`}
                        placeholder={isHeading ? 'VD: THE PARK / BENEFITS OF...' : `VD: The process was [Q:${group.qNumberStart}] in the early stages.`}
                        value={line.content}
                        onChange={e => updateLine(nsi, li, e.target.value)}
                        style={{ minHeight: '34px' }}
                      />
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

      {group.questions.length > 0 && (
        <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-3`}>
          <p className={`text-xs font-bold ${theme.subBoxText} mb-2`}>Đáp án (chữ cái từ Word Bank)</p>
          <div className="grid grid-cols-2 gap-2">
            {group.questions.map(q => {
              const usedByOthers = new Set(group.questions.filter(other => other.number !== q.number && other.correctAnswer).map(other => other.correctAnswer))
              return (
                <div key={q.number} className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${theme.subBoxText} w-14 shrink-0`}>Q{q.number}:</span>
                  <select className={`flex-1 border ${theme.subBoxBorder} rounded-lg px-2 py-1 text-sm focus:outline-none bg-white`}
                    value={q.correctAnswer} onChange={e => updateAnswer(q.number, e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {matchingOptions.filter(mo => !usedByOthers.has(mo.letter)).map(mo => (
                      <option key={mo.letter} value={mo.letter}>{mo.letter}{mo.text ? ` - ${mo.text}` : ''}</option>
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
