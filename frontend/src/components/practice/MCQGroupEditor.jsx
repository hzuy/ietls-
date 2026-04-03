export default function MCQGroupEditor({ group, onChange }) {
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
      onChange({ ...group, qNumberEnd: nextNum, questions: [...group.questions, { number: nextNum, questionText: '', options: [...defaultOpts], correctAnswer: '' }] })
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
    updateQ(qi, 'options', newOpts)
  }

  const addOption = (qi) => {
    const opts = [...(group.questions[qi].options || defaultOpts), '']
    updateQ(qi, 'options', opts)
  }

  const removeOption = (qi, oi) => {
    const opts = (group.questions[qi].options || defaultOpts).filter((_, i) => i !== oi)
    const removedText = (group.questions[qi].options || defaultOpts)[oi]
    const correct = (group.questions[qi].correctAnswer || '').split(',').filter(c => c && c !== removedText)
    const q = { ...group.questions[qi], options: opts, correctAnswer: correct.join(',') }
    onChange({ ...group, questions: group.questions.map((orig, i) => i !== qi ? orig : q) })
  }

  const toggleCorrect = (qi, optText) => {
    if (!optText.trim()) return
    const current = (group.questions[qi].correctAnswer || '').split(',').filter(Boolean)
    const next = current.includes(optText) ? current.filter(c => c !== optText) : [...current, optText]
    updateQ(qi, 'correctAnswer', next.join(','))
  }

  return (
    <div className="space-y-3">
      {isMulti && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-indigo-700 shrink-0">Số đáp án cần chọn:</span>
          <input type="number" min={1} max={10}
            className="w-16 border border-indigo-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-indigo-400"
            value={maxChoices}
            onChange={e => {
              const newMax = parseInt(e.target.value) || 2
              const newEnd = group.qNumberStart + (group.questions.length * newMax) - 1
              onChange({ ...group, maxChoices: newMax, qNumberEnd: Math.max(group.qNumberStart, newEnd) })
            }} />
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
                {isMulti ? `Câu ${group.qNumberStart + qi * maxChoices}–${group.qNumberStart + qi * maxChoices + maxChoices - 1}` : `Câu ${q.number}`}
              </span>
              <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
            </div>
            <textarea rows={2}
              className="w-full border border-blue-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:border-blue-400"
              placeholder="Nội dung câu hỏi..."
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
            {isMulti ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-medium">Tick ô bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctList.includes(opt)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{letter}.</span>
                      <input className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none ${isCorrect ? 'border-[#e2e8f0] focus:border-[#3b82f6] bg-[#eff6ff]' : 'border-blue-200 focus:border-blue-400'}`}
                        placeholder={`Lựa chọn ${letter}...`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                      <input type="checkbox" checked={isCorrect} disabled={!opt.trim()} onChange={() => toggleCorrect(qi, opt)}
                        title="Đánh dấu đáp án đúng" className="w-4 h-4 accent-[#1a56db] shrink-0 cursor-pointer" />
                      {opts.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)} className="text-red-300 hover:text-red-500 text-xs shrink-0">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addOption(qi)} className="text-xs text-blue-400 hover:text-blue-600 font-medium mt-1">+ Thêm lựa chọn</button>
                {warn && (
                  <p className={`text-xs font-semibold mt-1 ${correctCount < maxChoices ? 'text-amber-600' : 'text-red-500'}`}>
                    ⚠ Đang chọn {correctCount}/{maxChoices} đáp án đúng
                    {correctCount < maxChoices ? ` — cần chọn thêm ${maxChoices - correctCount}` : ` — chọn thừa ${correctCount - maxChoices}`}
                  </p>
                )}
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
                <input className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
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
