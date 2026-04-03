import { useState, useRef } from 'react'
import api from '../../utils/axios'
import {
  GROUP_TYPES, GROUP_INSTRUCTIONS, SECTION_HINTS,
  emptyListeningForm, emptyGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
  SERVER_BASE, toImgSrc,
} from './adminConstants'
import ExamList from './ExamList'
import { useExamSeriesList, useSeriesBooks, InlinePreviewPanel, ListeningFormPreview } from './ReadingTab'

// ─── TAB: LISTENING ───────────────────────────────────────────────────────────

function TableCompletionEditor({ group, onChange }) {
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
    const newLines = [
      { content: newHeaderCells.join('|'), lineType: 'heading' },
      ...newDataLines,
    ]
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

  const removeRow = (ri) => {
    rebuildSection(headers, dataLines.filter((_, i) => i !== ri))
  }

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
        <input
          type="text"
          className={inputCls}
          placeholder="VD: A typical 45-minute guitar lesson"
          value={section.title || ''}
          onChange={e => updateTitle(e.target.value)}
        />
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-bold text-emerald-700">Bảng Table Completion</p>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Số cột:</span>
            <button type="button" onClick={() => colCount > 2 && setColCount(colCount - 1)}
              disabled={colCount <= 2}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-xs font-bold transition">−</button>
            <span className="w-5 text-center text-sm font-bold text-gray-700">{colCount}</span>
            <button type="button" onClick={() => colCount < 6 && setColCount(colCount + 1)}
              disabled={colCount >= 6}
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
                      value={headers[ci] || ''}
                      onChange={e => updateHeader(ci, e.target.value)} />
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
                          <textarea
                            ref={el => { cellRefs.current[`${ri}-${ci}`] = el }}
                            rows={2}
                            className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-emerald-400 resize-none"
                            placeholder={`text [Q:${nextQNum}] text`}
                            value={cells[ci] || ''}
                            onChange={e => updateCell(ri, ci, e.target.value)}
                            style={{ minHeight: '48px' }}
                          />
                          <button type="button" onClick={() => insertBlank(ri, ci)}
                            className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-1 rounded font-semibold hover:bg-emerald-200 whitespace-nowrap leading-tight mt-0.5">
                            +Ô<br />trống
                          </button>
                        </div>
                      </td>
                    ))}
                    <td className="border border-gray-200 px-1 text-center align-middle">
                      {dataLines.length > 1 && (
                        <button type="button" onClick={() => removeRow(ri)}
                          className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addRow}
          className="mt-2 text-xs text-emerald-600 font-semibold hover:underline">+ Thêm hàng</button>
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
                  <input
                    className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                    placeholder="VD: word hoặc word1/word2"
                    value={q?.correctAnswer || ''}
                    onChange={e => updateAnswer(tokenNum, e.target.value)} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function NoteCompletionEditor({ group, onChange }) {
  const lineRefs = useRef({})

  const allTokenNums = group.noteSections.flatMap(ns =>
    ns.lines.flatMap(l => {
      const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  // Unique token numbers in order of first appearance in the note
  const tokenOrder = []
  const _seenTokens = new Set()
  allTokenNums.forEach(n => { if (!_seenTokens.has(n)) { _seenTokens.add(n); tokenOrder.push(n) } })
  // Map token number → display number (qNumberStart + position), updates live when qNumberStart changes
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

    onChange({
      ...group,
      noteSections: sections,
      questions: newQuestions,
      qNumberEnd: Math.max(group.qNumberStart, nextQNum)
    })
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
          <button type="button" onClick={addSection}
            className="text-xs text-amber-600 font-semibold hover:underline">+ Thêm phần</button>
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
                  <button type="button" onClick={() => removeSection(nsi)}
                    className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                )}
              </div>
              <div className="space-y-2">
                {ns.lines.map((line, li) => {
                  const isHeading = line.lineType === 'heading'
                  return (
                    <div key={li} className={`flex items-start gap-2 rounded-lg p-1 ${isHeading ? 'bg-gray-50' : ''}`}>
                      <button
                        type="button"
                        title={isHeading ? 'Heading — click để đổi sang Nội dung' : 'Nội dung — click để đổi sang Heading'}
                        onClick={() => updateLineType(nsi, li, isHeading ? 'content' : 'heading')}
                        className={`shrink-0 text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded border transition ${
                          isHeading
                            ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                            : 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200'
                        }`}
                      >
                        {isHeading ? 'H' : '•'}
                      </button>
                      <textarea
                        ref={el => lineRefs.current[`${nsi}-${li}`] = el}
                        rows={1}
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono ${
                          isHeading
                            ? 'font-bold border-gray-300 focus:border-gray-400 bg-gray-50 text-gray-700'
                            : 'border-gray-200 focus:border-amber-400'
                        }`}
                        placeholder={isHeading ? 'VD: THE PARK / BENEFITS OF...' : `VD: Area: [Q:${group.qNumberStart}] hectares`}
                        value={line.content}
                        onChange={e => updateLine(nsi, li, e.target.value)}
                        style={{ minHeight: '34px' }}
                      />
                      {!isHeading && (
                        <button type="button" onClick={() => insertBlank(nsi, li)}
                          className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-amber-200 whitespace-nowrap">
                          + Ô trống
                        </button>
                      )}
                      {ns.lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(nsi, li)}
                          className="shrink-0 text-red-400 hover:text-red-600 text-xs py-1.5">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addLine(nsi)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium">+ Thêm dòng</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tokenOrder.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#1a56db]">Đáp án (từ ô trống trong note)</p>
            <p className="text-[10px] text-gray-400">Dùng <span className="font-mono bg-gray-100 px-1 rounded">/</span> để tách nhiều đáp án chấp nhận được. VD: <span className="font-mono">intestine/gut</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tokenOrder.map(tokenNum => {
              const displayNum = tokenDisplayMap[tokenNum]
              const q = group.questions.find(q => q.number === tokenNum)
              return (
                <div key={tokenNum} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1a56db] w-14 shrink-0">Q{displayNum}:</span>
                  <input
                    className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                    placeholder="VD: word hoặc word1/word2"
                    value={q?.correctAnswer || ''}
                    onChange={e => updateAnswer(tokenNum, e.target.value)} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MCQGroupEditor({ group, onChange }) {
  const isMulti = group.type === 'mcq_multi'
  const maxChoices = group.maxChoices || 2

  const defaultOpts = isMulti ? ['', '', '', '', ''] : ['', '', '', '']

  const addQuestion = () => {
    if (isMulti) {
      const nextNum = group.qNumberStart + group.questions.length * maxChoices
      const newQs = [...group.questions, { number: nextNum, questionText: '', options: [...defaultOpts], correctAnswer: '' }]
      const newEnd = group.qNumberStart + newQs.length * maxChoices - 1
      onChange({ ...group, qNumberEnd: newEnd, questions: newQs })
    } else {
      const nextNum = group.questions.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
      onChange({
        ...group,
        qNumberEnd: nextNum,
        questions: [...group.questions, { number: nextNum, questionText: '', options: [...defaultOpts], correctAnswer: '' }]
      })
    }
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    if (isMulti) {
      const newEnd = newQs.length > 0 ? group.qNumberStart + newQs.length * maxChoices - 1 : group.qNumberStart
      onChange({ ...group, questions: newQs, qNumberEnd: Math.max(group.qNumberStart, newEnd) })
    } else {
      onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
    }
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  const updateOption = (qi, oi, val) => {
    const newOpts = [...(group.questions[qi].options || defaultOpts)]
    newOpts[oi] = val
    // If the edited option was part of correctAnswer, clear it (text changed)
    updateQ(qi, 'options', newOpts)
  }

  const addOption = (qi) => {
    const opts = [...(group.questions[qi].options || defaultOpts), '']
    updateQ(qi, 'options', opts)
  }

  const removeOption = (qi, oi) => {
    const opts = (group.questions[qi].options || defaultOpts).filter((_, i) => i !== oi)
    // Also remove from correctAnswer if the removed option was selected
    const removedText = (group.questions[qi].options || defaultOpts)[oi]
    const correct = (group.questions[qi].correctAnswer || '').split(',').filter(c => c && c !== removedText)
    const q = { ...group.questions[qi], options: opts, correctAnswer: correct.join(',') }
    onChange({ ...group, questions: group.questions.map((orig, i) => i !== qi ? orig : q) })
  }

  const toggleCorrect = (qi, optText) => {
    if (!optText.trim()) return
    const current = (group.questions[qi].correctAnswer || '').split(',').filter(Boolean)
    const next = current.includes(optText)
      ? current.filter(c => c !== optText)
      : [...current, optText]
    updateQ(qi, 'correctAnswer', next.join(','))
  }

  return (
    <div className="space-y-3">
      {isMulti && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-indigo-700 shrink-0">Số đáp án cần chọn:</span>
          <input
            type="number" min={1} max={10}
            className="w-16 border border-indigo-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-indigo-400"
            value={maxChoices}
            onChange={e => {
              const newMax = parseInt(e.target.value) || 2
              const newEnd = group.qNumberStart + (group.questions.length * newMax) - 1
              onChange({ ...group, maxChoices: newMax, qNumberEnd: Math.max(group.qNumberStart, newEnd) })
            }}
          />
          <span className="text-xs text-indigo-500">(mặc định 2 — "Choose TWO")</span>
        </div>
      )}

      {group.questions.map((q, qi) => {
        const opts = q.options || defaultOpts
        const correctList = (q.correctAnswer || '').split(',').filter(Boolean)
        const correctCount = correctList.length
        const warn = isMulti && correctCount !== maxChoices

        return (
          <div key={qi} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700">
                {isMulti
                  ? `Câu ${group.qNumberStart + qi * maxChoices}–${group.qNumberStart + qi * maxChoices + maxChoices - 1}`
                  : `Câu ${q.number}`}
              </span>
              <button type="button" onClick={() => removeQuestion(qi)}
                className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
            </div>
            <textarea rows={2}
              className="w-full border border-blue-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:border-blue-400"
              placeholder="Nội dung câu hỏi..."
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />

            {isMulti ? (
              /* Multi: dynamic options with checkboxes for correct answer */
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-medium">Tick ô bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctList.includes(opt)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{letter}.</span>
                      <input
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none ${isCorrect ? 'border-[#e2e8f0] focus:border-[#3b82f6] bg-[#eff6ff]' : 'border-blue-200 focus:border-blue-400'}`}
                        placeholder={`Lựa chọn ${letter}...`}
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                      />
                      <input
                        type="checkbox"
                        checked={isCorrect}
                        disabled={!opt.trim()}
                        onChange={() => toggleCorrect(qi, opt)}
                        title="Đánh dấu đáp án đúng"
                        className="w-4 h-4 accent-[#1a56db] shrink-0 cursor-pointer"
                      />
                      {opts.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)}
                          className="text-red-300 hover:text-red-500 text-xs shrink-0">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addOption(qi)}
                  className="text-xs text-blue-400 hover:text-blue-600 font-medium mt-1">+ Thêm lựa chọn</button>
                {warn && (
                  <p className={`text-xs font-semibold mt-1 ${correctCount < maxChoices ? 'text-amber-600' : 'text-red-500'}`}>
                    ⚠ Đang chọn {correctCount}/{maxChoices} đáp án đúng
                    {correctCount < maxChoices ? ` — cần chọn thêm ${maxChoices - correctCount}` : ` — chọn thừa ${correctCount - maxChoices}`}
                  </p>
                )}
              </div>
            ) : (
              /* Single MCQ: fixed options + text correct answer */
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {opts.map((opt, oi) => (
                    <input key={oi}
                      className="border border-blue-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                      placeholder={`${String.fromCharCode(65+oi)}. ...`}
                      value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                  ))}
                </div>
                <input
                  className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                  placeholder="Đáp án đúng (VD: A. text)"
                  value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)} />
              </>
            )}
          </div>
        )
      })}
      <button type="button" onClick={addQuestion}
        className="w-full border-2 border-dashed border-blue-200 rounded-xl py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
        + Thêm câu hỏi {isMulti ? 'MCQ Multi' : 'MCQ'}
      </button>
    </div>
  )
}

function MatchingEditor({ group, onChange }) {
  const isMap = group.type === 'map_diagram'

  const updateOption = (oi, field, val) => {
    onChange({ ...group, matchingOptions: group.matchingOptions.map((mo, i) => i !== oi ? mo : { ...mo, [field]: val }) })
  }

  const addOption = () => {
    const nextLetter = String.fromCharCode(65 + group.matchingOptions.length)
    onChange({ ...group, matchingOptions: [...group.matchingOptions, { letter: nextLetter, text: '' }] })
  }

  const removeOption = (oi) => {
    onChange({ ...group, matchingOptions: group.matchingOptions.filter((_, i) => i !== oi) })
  }

  const addQuestion = () => {
    const nextNum = group.questions.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
    onChange({ ...group, qNumberEnd: nextNum, questions: [...group.questions, { number: nextNum, questionText: '', correctAnswer: '' }] })
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  const options = group.matchingOptions.filter(mo => (mo.letter || mo.optionLetter))
  const usedAnswers = new Set(group.questions.map(q => q.correctAnswer).filter(Boolean))
  const [imgUploading, setImgUploading] = useState(false)
  const imgRef = useRef(null)

  const uploadImage = async (file) => {
    setImgUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await api.post('/admin/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      onChange({ ...group, imageUrl: res.data.imageUrl })
    } catch { alert('Lỗi upload ảnh') }
    finally { setImgUploading(false) }
  }

  return (
    <div className="space-y-3">
      {isMap && (
        <div>
          <label className={labelCls}>Hình ảnh Map/Diagram</label>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="URL ảnh (tự điền sau upload)"
              value={group.imageUrl || ''} onChange={e => onChange({ ...group, imageUrl: e.target.value })} />
            <button type="button" onClick={() => imgRef.current?.click()} disabled={imgUploading}
              className={`${btnSecondary} whitespace-nowrap`}>
              {imgUploading ? 'Đang upload...' : '🖼 Upload ảnh'}
            </button>
            <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp" className="hidden"
              ref={imgRef}
              onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
          </div>
          {group.imageUrl && (
            <img
              src={group.imageUrl.startsWith('/') ? `http://localhost:3001${group.imageUrl}` : group.imageUrl}
              alt="map/diagram" className="mt-2 max-h-56 rounded-xl border object-contain w-full bg-gray-50" />
          )}
        </div>
      )}

      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-[#1a56db]">Danh sách lựa chọn (A, B, C...)</p>
          <button type="button" onClick={addOption}
            className="text-xs text-[#1a56db] font-semibold hover:underline">+ Thêm</button>
        </div>
        <div className="space-y-2">
          {group.matchingOptions.map((mo, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input className="w-10 border border-[#bfdbfe] rounded px-1 py-1 text-xs text-center font-bold focus:outline-none"
                value={mo.letter} onChange={e => updateOption(oi, 'letter', e.target.value)} />
              <input className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                placeholder="Nội dung lựa chọn..."
                value={mo.text} onChange={e => updateOption(oi, 'text', e.target.value)} />
              <button type="button" onClick={() => removeOption(oi)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {group.questions.map((q, qi) => (
          <div key={qi} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
            <span className="text-xs font-bold text-gray-500 w-10 shrink-0">Q{q.number}:</span>
            <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-gray-400"
              placeholder={isMap ? 'Tên mục (VD: Farm shop, Disabled entry...)' : 'Đối tượng cần matching (VD: Cafe, Shop...)'}
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
            <select className="border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6] bg-white max-w-[260px]"
              value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)}>
              <option value="">-- Đáp án --</option>
              {options.filter(mo => {
                const letter = mo.letter || mo.optionLetter
                // If canReuse is true, we don't filter out used answers
                return group.canReuse || letter === q.correctAnswer || !usedAnswers.has(letter)
              }).map(mo => {
                const letter = mo.letter || mo.optionLetter
                const text = mo.text || mo.optionText || ''
                return <option key={letter} value={letter}>{text ? `${letter} - ${text}` : letter}</option>
              })}
            </select>
            <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 text-xs">✕</button>
          </div>
        ))}
        <button type="button" onClick={addQuestion}
          className="w-full border-2 border-dashed border-blue-200 rounded-xl py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
          + Thêm câu hỏi
        </button>
      </div>
    </div>
  )
}

// ─── GROUP EDITOR ─────────────────────────────────────────────────────────────

function GroupEditor({ group, onChange, onRemove }) {
  const typeLabel = GROUP_TYPES.find(t => t.value === group.type)?.label || group.type

  const typeColors = {
    note_completion: 'bg-amber-100 text-amber-800 border-amber-300',
    table_completion: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    mcq: 'bg-blue-100 text-blue-800 border-blue-300',
    mcq_multi: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    matching: 'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
    map_diagram: 'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
    drag_word_bank: 'bg-sky-100 text-sky-800 border-sky-300',
    matching_drag: 'bg-violet-100 text-violet-800 border-violet-300',
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeColors[group.type] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-gray-500 font-medium">
          Câu {group.qNumberStart}–{group.qNumberEnd}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Từ câu</label>
            <input type="number" min={1}
              className="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
              value={group.qNumberStart}
              onChange={e => {
                const newStart = parseInt(e.target.value) || 1
                const newGroup = { ...group, qNumberStart: newStart }
                if (group.type === 'mcq_multi') {
                  newGroup.qNumberEnd = Math.max(newStart, newStart + group.questions.length * (group.maxChoices || 2) - 1)
                }
                onChange(newGroup)
              }} />
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-red-50">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2}
            className={`${inputCls} resize-none`}
            placeholder="VD: Choose the correct letter, A, B or C."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'matching' || group.type === 'map_diagram') && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
      </div>
    </div>
  )
}

function ListeningTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptyListeningForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openSection, setOpenSection] = useState(0)
  const [uploading, setUploading] = useState({})
  const [transcribing, setTranscribing] = useState({})
  const [addingGroupSection, setAddingGroupSection] = useState(null)
  const fileRefs = useRef({})
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_listening_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_listening_${editingId || 'new'}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
      setTimeout(() => setToast(''), 3000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    setLoadingEdit(true)
    try {
      const res = await api.get(`/admin/exams/${id}`)
      const exam = res.data
      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        sections: exam.listeningSections.map(s => ({
          number: s.number,
          context: s.context || '',
          audioUrl: s.audioUrl || '',
          transcript: s.transcript || '',
          questionGroups: (s.questionGroups || []).map(g => ({
            _id: g.id,
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || '',
            noteSections: (g.noteSections || []).map(ns => ({
              title: ns.title || '',
              lines: (ns.lines || []).map(l => ({ content: l.contentWithTokens || '', lineType: l.lineType || 'content' }))
            })),
            matchingOptions: (g.matchingOptions || []).map(mo => ({ letter: mo.optionLetter, text: mo.optionText })),
            questions: (g.questions || []).map(q => ({
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['','','',''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        }))
      })
      setEditingId(id)
      setOpenSection(0)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { alert('Lỗi tải đề để sửa') }
    finally { setLoadingEdit(false) }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyListeningForm()); setOpenSection(0); setEditHighlight(false) }

  const updateSection = (si, field, val) => {
    const s = [...form.sections]
    s[si] = { ...s[si], [field]: val }
    setForm({ ...form, sections: s })
  }

  const uploadAudio = async (si, file) => {
    setUploading(u => ({ ...u, [si]: true }))
    try {
      const formData = new FormData()
      formData.append('audio', file)
      const res = await api.post('/admin/upload-audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      updateSection(si, 'audioUrl', res.data.audioUrl)
    } catch { alert('Lỗi upload audio') }
    finally { setUploading(u => ({ ...u, [si]: false })) }
  }

  const transcribeAudio = async (si) => {
    const audioUrl = form.sections[si].audioUrl
    if (!audioUrl) return
    setTranscribing(t => ({ ...t, [si]: true }))
    try {
      const res = await api.post('/admin/transcribe', { audioUrl })
      updateSection(si, 'transcript', res.data.transcript || '')
    } catch { alert('Lỗi phiên âm audio') }
    finally { setTranscribing(t => ({ ...t, [si]: false })) }
  }

  const addGroup = (si, type) => {
    const s = [...form.sections]
    const lastGroup = s[si].questionGroups[s[si].questionGroups.length - 1]
    const startNum = lastGroup ? lastGroup.qNumberEnd + 1 : 1
    const newGroup = emptyGroupOf(type, startNum)
    newGroup.qNumberEnd = startNum
    s[si] = { ...s[si], questionGroups: [...s[si].questionGroups, newGroup] }
    setForm({ ...form, sections: s })
    setAddingGroupSection(null)
  }

  const updateGroup = (si, gi, newGroup) => {
    const s = [...form.sections]
    const groups = [...s[si].questionGroups]
    groups[gi] = newGroup
    s[si] = { ...s[si], questionGroups: groups }
    setForm({ ...form, sections: s })
  }

  const removeGroup = (si, gi) => {
    const s = [...form.sections]
    s[si] = { ...s[si], questionGroups: s[si].questionGroups.filter((_, i) => i !== gi) }
    setForm({ ...form, sections: s })
  }

  const moveGroup = (si, gi, dir) => {
    const s = [...form.sections]
    const groups = [...s[si].questionGroups]
    const ni = gi + dir
    if (ni < 0 || ni >= groups.length) return
    ;[groups[gi], groups[ni]] = [groups[ni], groups[gi]]
    s[si] = { ...s[si], questionGroups: groups }
    setForm({ ...form, sections: s })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        sections: form.sections.map(s => ({
          number: s.number,
          context: s.context,
          audioUrl: s.audioUrl || null,
          transcript: s.transcript || null,
          questionGroups: s.questionGroups.map(g => ({
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || null,
            noteSections: g.noteSections,
            matchingOptions: g.matchingOptions,
            questions: g.questions
          }))
        }))
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_listening_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/listening', payload)
        localStorage.removeItem('draft_listening_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyListeningForm())
        setOpenSection(0)
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi lưu đề Listening')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa đề này?')) return
    try {
      await api.delete(`/admin/exams/${id}`)
      onRefresh()
    } catch { alert('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all duration-500 ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-gray-100'}`}>
        <h3 className="font-bold text-gray-800 mb-5">
          {editingId ? `✏️ Sửa đề Listening #${editingId}` : 'Tạo đề Listening mới'}
        </h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        {draftBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-yellow-700">📋 Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">✏️ Đang sửa đề #{editingId}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-blue-200 bg-white text-blue-500 hover:border-blue-400 hover:text-blue-700 transition">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>Tên đề</label>
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Listening"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-xs font-bold text-blue-700 mb-2">📚 Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <select className={inputCls} value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value, bookNumber: '' })}>
                <option value="">-- Không gắn --</option>
                {liveExamSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <select className={inputCls} value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })} disabled={!form.seriesId}>
                <option value="">-- Chọn cuốn --</option>
                {seriesBooks.map(b => <option key={b.bookNumber} value={b.bookNumber}>{b.bookNumber}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <select className={inputCls} value={form.testNumber} onChange={e => setForm({ ...form, testNumber: e.target.value })} disabled={!form.bookNumber}>
                <option value="">-- Chọn test --</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Test {n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {form.sections.map((section, si) => (
            <div key={si} className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === si ? -1 : si)}
                className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="font-bold text-sm text-gray-800">Section {section.number}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{SECTION_HINTS[section.number] || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{section.questionGroups.length} nhóm · {section.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)} câu</span>
                  {section.audioUrl && <span className="text-xs bg-[#eff6ff] text-[#1a56db] font-semibold px-2 py-0.5 rounded-full">🎵 Audio</span>}
                  {section.transcript && <span className="text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">📝 Transcript</span>}
                  <span className="text-gray-400 text-xs">{openSection === si ? '▲' : '▼'}</span>
                </div>
              </button>

              {openSection === si && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelCls}>File MP3 — Section {section.number}</label>
                    <div className="flex gap-2">
                      <input className={inputCls} placeholder="URL audio sau khi upload"
                        value={section.audioUrl} onChange={e => updateSection(si, 'audioUrl', e.target.value)} />
                      <button type="button" onClick={() => fileRefs.current[si]?.click()} disabled={uploading[si]}
                        className={`${btnSecondary} whitespace-nowrap`}>
                        {uploading[si] ? 'Đang upload...' : '📁 Upload MP3'}
                      </button>
                      <input type="file" accept=".mp3,.wav,.ogg,.m4a,.aac" className="hidden"
                        ref={el => fileRefs.current[si] = el}
                        onChange={e => e.target.files[0] && uploadAudio(si, e.target.files[0])} />
                    </div>
                    {section.audioUrl && (
                      <audio
                        controls
                        src={section.audioUrl.startsWith('/') ? `http://localhost:3001${section.audioUrl}` : section.audioUrl}
                        className="w-full mt-2 rounded-lg"
                        style={{ height: '40px' }}
                      />
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Mô tả tình huống (Context)</label>
                    <textarea className={`${inputCls} h-16 resize-none`}
                      placeholder={section.number <= 2 ? 'VD: Two friends are discussing their weekend plans...' : 'VD: A professor is giving a lecture about climate change...'}
                      value={section.context} onChange={e => updateSection(si, 'context', e.target.value)} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>Transcript</label>
                      <button type="button" onClick={() => transcribeAudio(si)}
                        disabled={!section.audioUrl || transcribing[si]}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          backgroundColor: section.audioUrl && !transcribing[si] ? '#EFF6FF' : '#F3F4F6',
                          color: section.audioUrl && !transcribing[si] ? '#2563EB' : '#9CA3AF',
                          border: `1px solid ${section.audioUrl && !transcribing[si] ? '#BFDBFE' : '#E5E7EB'}`,
                          cursor: section.audioUrl && !transcribing[si] ? 'pointer' : 'not-allowed'
                        }}>
                        {transcribing[si] ? (
                          <>
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                            </svg>
                            Đang phiên âm...
                          </>
                        ) : <>🤖 AI Phiên âm</>}
                      </button>
                    </div>
                    <textarea className={`${inputCls} h-28 resize-none`}
                      placeholder={section.audioUrl ? 'Nhấn "🤖 AI Phiên âm" hoặc nhập thủ công...' : 'Upload audio để dùng AI phiên âm...'}
                      value={section.transcript} onChange={e => updateSection(si, 'transcript', e.target.value)} />
                  </div>

                  <div>
                    <label className={labelCls}>Nhóm câu hỏi ({section.questionGroups.length})</label>
                    <div className="space-y-3 mb-3">
                      {section.questionGroups.map((group, gi) => (
                        <div key={group._id || gi} className="flex gap-2 items-start">
                          <div className="flex flex-col gap-1 pt-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveGroup(si, gi, -1)}
                              disabled={gi === 0}
                              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition"
                              title="Di chuyển lên">▲</button>
                            <button
                              type="button"
                              onClick={() => moveGroup(si, gi, 1)}
                              disabled={gi === section.questionGroups.length - 1}
                              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition"
                              title="Di chuyển xuống">▼</button>
                          </div>
                          <div className="flex-1">
                            <GroupEditor
                              group={group}
                              onChange={newGroup => updateGroup(si, gi, newGroup)}
                              onRemove={() => removeGroup(si, gi)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {addingGroupSection === si ? (
                      <div className="border border-dashed border-[#1a56db] rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-600 mb-3">Chọn loại nhóm câu hỏi:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {GROUP_TYPES.map(t => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => addGroup(si, t.value)}
                              className="text-left px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#1a56db] hover:text-[#1a56db] hover:bg-blue-50 transition font-medium"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setAddingGroupSection(null)}
                          className="mt-2 text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingGroupSection(si)}
                        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#1a56db] hover:text-[#1a56db] transition font-medium">
                        + Thêm nhóm câu hỏi
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Listening' : '💾 Tạo đề Listening'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          {showPreview ? '▲ Thu gọn preview' : '👁 Xem trước nội dung đề'}
        </button>
      </form>

      {showPreview && (
        <InlinePreviewPanel
          title={form.title || 'Listening'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <ListeningFormPreview form={form} showAnswers={showAnswers} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Listening ({exams.filter(e => e.skill === 'listening').length})</h3>
        <ExamList exams={exams} skill="listening" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} />
      </div>
    </div>
  )
}

export default ListeningTab
