import { ROMAN_KEYS, inputCls, labelCls, getQuestionGroupTheme } from '../../utils/practiceConfig'

export default function MatchingHeadingsEditor({ group, onChange }) {
  const headings = group.matchingOptions || []
  const paragraphs = group.questions || []
  const usedAnswers = new Set(paragraphs.map(q => q.correctAnswer).filter(Boolean))
  const theme = getQuestionGroupTheme(group.type)

  const addHeading = () => {
    const key = ROMAN_KEYS[headings.length] || `${headings.length + 1}`
    onChange({ ...group, matchingOptions: [...headings, { letter: key, text: '' }] })
  }

  const removeHeading = (i) => {
    onChange({ ...group, matchingOptions: headings.filter((_, idx) => idx !== i) })
  }

  const updateHeading = (i, field, val) => {
    onChange({ ...group, matchingOptions: headings.map((h, idx) => idx !== i ? h : { ...h, [field]: val }) })
  }

  const addParagraph = () => {
    const paraKey = String.fromCharCode(65 + paragraphs.length)
    const nextNum = paragraphs.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
    onChange({ ...group, qNumberEnd: nextNum, questions: [...paragraphs, { number: nextNum, questionText: `${paraKey}|`, correctAnswer: '' }] })
  }

  const removeParagraph = (i) => {
    const newQs = paragraphs.filter((_, idx) => idx !== i)
    onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
  }

  const updateParagraphKey = (i, val) => {
    const [, label] = (paragraphs[i].questionText || '|').split('|')
    onChange({ ...group, questions: paragraphs.map((q, idx) => idx !== i ? q : { ...q, questionText: `${val}|${label || ''}` }) })
  }

  const updateParagraphLabel = (i, val) => {
    const [key] = (paragraphs[i].questionText || '|').split('|')
    onChange({ ...group, questions: paragraphs.map((q, idx) => idx !== i ? q : { ...q, questionText: `${key || ''}|${val}` }) })
  }

  const updateAnswer = (i, val) => {
    onChange({ ...group, questions: paragraphs.map((q, idx) => idx !== i ? q : { ...q, correctAnswer: val }) })
  }

  return (
    <div className="space-y-3">
      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-3.5`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Danh sách Heading</p>
          <button type="button" onClick={addHeading} className={`text-xs ${theme.subBoxText} font-semibold hover:underline`}>+ Thêm heading</button>
        </div>
        <div className="space-y-2">
          {headings.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`w-12 border ${theme.subBoxBorder} bg-white rounded px-1 py-1 text-xs text-center font-bold focus:outline-none`}
                value={h.letter || ''} onChange={e => updateHeading(i, 'letter', e.target.value)}
                placeholder="i" />
              <input className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm focus:outline-none`}
                placeholder="Nội dung heading..."
                value={h.text || ''} onChange={e => updateHeading(i, 'text', e.target.value)} />
              <button type="button" onClick={() => removeHeading(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {paragraphs.map((q, i) => {
          const [paraKey, paraLabel] = (q.questionText || '|').split('|')
          return (
            <div key={i} className={`${theme.subBoxBg} rounded-xl border ${theme.subBoxBorder} p-3 space-y-2`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${theme.subBoxText} shrink-0`}>Q{q.number}:</span>
                <input className={`w-10 border ${theme.subBoxBorder} bg-white rounded px-1 py-1 text-xs text-center font-bold focus:outline-none`}
                  value={paraKey || ''} onChange={e => updateParagraphKey(i, e.target.value)}
                  placeholder="A" />
                <input className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm focus:outline-none`}
                  placeholder="Mô tả đoạn văn (tùy chọn)..."
                  value={paraLabel || ''} onChange={e => updateParagraphLabel(i, e.target.value)} />
                <button type="button" onClick={() => removeParagraph(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
              <div className="flex items-center gap-2 pl-14">
                <span className="text-xs text-gray-500 shrink-0">Đáp án:</span>
                <select className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm focus:outline-none`}
                  value={q.correctAnswer || ''} onChange={e => updateAnswer(i, e.target.value)}>
                  <option value="">-- Chọn heading --</option>
                  {headings.filter(h => group.canReuse || h.letter === q.correctAnswer || !usedAnswers.has(h.letter)).map(h => (
                    <option key={h.letter} value={h.letter}>{h.letter} — {h.text}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
        <button type="button" onClick={addParagraph}
          className={`w-full border-2 border-dashed ${theme.subBoxBorder} ${theme.subBoxText} bg-white/50 hover:bg-white rounded-xl py-2 text-sm font-semibold transition`}>
          + Thêm đoạn văn (paragraph)
        </button>
      </div>
    </div>
  )
}
