import { getQuestionGroupTheme } from '../../utils/practiceConfig'

export default function MCQGroupEditor({ group, onChange }) {
  const isMulti = group.type === 'mcq_multi'
  const maxChoices = group.maxChoices || 2
  const theme = getQuestionGroupTheme(group.type)

  const defaultOpts = ['', '', '', '']

  const addQuestion = () => {
    const nextNum = group.questions.length > 0
      ? (isMulti ? group.qNumberEnd + 1 : Math.max(...group.questions.map(q => q.number)) + 1)
      : group.qNumberStart
    const newQ = { number: nextNum, questionText: '', options: ['', '', '', ''], correctAnswer: '' }
    const newQuestions = [...group.questions, newQ]
    const newEnd = isMulti
      ? group.qNumberStart + (newQuestions.length * maxChoices) - 1
      : Math.max(group.qNumberStart, nextNum)
    onChange({ ...group, qNumberEnd: newEnd, questions: newQuestions })
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    const newEnd = isMulti
      ? Math.max(group.qNumberStart, group.qNumberStart + (newQs.length * maxChoices) - 1)
      : (newQs.length > 0 ? Math.max(...newQs.map(q => q.number)) : group.qNumberStart)
    onChange({ ...group, questions: newQs, qNumberEnd: newEnd })
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  const updateOption = (qi, oi, val) => {
    const q = group.questions[qi]
    const opts = [...(q.options || defaultOpts)]
    opts[oi] = val
    onChange({ ...group, questions: group.questions.map((item, i) => i !== qi ? item : { ...item, options: opts }) })
  }

  const addOption = (qi) => {
    const q = group.questions[qi]
    const opts = [...(q.options || defaultOpts), '']
    onChange({ ...group, questions: group.questions.map((item, i) => i !== qi ? item : { ...item, options: opts }) })
  }

  const removeOption = (qi, oi) => {
    const q = group.questions[qi]
    const opts = (q.options || defaultOpts).filter((_, i) => i !== oi)
    onChange({ ...group, questions: group.questions.map((item, i) => i !== qi ? item : { ...item, options: opts }) })
  }

  const toggleCorrect = (qi, optVal) => {
    const q = group.questions[qi]
    const current = (q.correctAnswer || '').split(',').filter(Boolean)
    const next = current.includes(optVal) ? current.filter(x => x !== optVal) : [...current, optVal]
    onChange({ ...group, questions: group.questions.map((item, i) => i !== qi ? item : { ...item, correctAnswer: next.join(',') }) })
  }

  return (
    <div className="space-y-3">
      {isMulti && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Số lượng đáp án cần chọn (maxChoices):</label>
          <input type="number" min={2} max={5} className="w-16 border rounded px-2 py-1 text-sm font-bold text-center"
            value={maxChoices}
            onChange={e => {
              const newMax = parseInt(e.target.value) || 2
              const newEnd = group.qNumberStart + (group.questions.length * newMax) - 1
              onChange({ ...group, maxChoices: newMax, qNumberEnd: Math.max(group.qNumberStart, newEnd) })
            }} />
          <span className="text-xs text-sky-600 font-medium">(mặc định 2 — "Choose TWO")</span>
        </div>
      )}
      {group.questions.map((q, qi) => {
        const opts = q.options || defaultOpts
        const correctList = (q.correctAnswer || '').split(',').filter(Boolean)
        return (
          <div key={qi} className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-3 space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${theme.subBoxText}`}>
                {isMulti ? `Câu ${group.qNumberStart + qi * maxChoices}–${group.qNumberStart + qi * maxChoices + maxChoices - 1}` : `Câu ${q.number}`}
              </span>
              <button type="button" onClick={() => removeQuestion(qi)} className="text-red-500 hover:text-red-600 text-xs font-semibold">✕ Xóa</button>
            </div>
            <textarea rows={2}
              className={`w-full border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm resize-none focus:outline-none`}
              placeholder="Nội dung câu hỏi..."
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
            {isMulti ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 font-medium">Tick ô bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctList.includes(opt)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? `${theme.subBoxBg} border ${theme.subBoxBorder}` : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-gray-500 w-5 shrink-0">{letter}.</span>
                      <input className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none ${isCorrect ? `${theme.subBoxBorder} bg-white font-semibold` : 'border-gray-200 bg-white'}`}
                        placeholder={`Lựa chọn ${letter}...`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                      <input type="checkbox" checked={isCorrect} disabled={!opt.trim()} onChange={() => toggleCorrect(qi, opt)}
                        title="Đánh dấu đáp án đúng" className={`w-4 h-4 ${theme.accentColor} shrink-0 cursor-pointer`} />
                      {opts.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addOption(qi)} className={`text-xs ${theme.subBoxText} font-semibold hover:underline mt-1`}>+ Thêm lựa chọn</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {opts.map((opt, oi) => (
                    <input key={oi}
                      className="border border-blue-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                      placeholder={`${String.fromCharCode(65 + oi)}. ...`}
                      value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                  ))}
                </div>
                <input className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3B82F6]"
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
