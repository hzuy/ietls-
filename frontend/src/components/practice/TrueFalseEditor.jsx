export default function TrueFalseEditor({ group, onChange }) {
  const isTF = group.type === 'true_false_ng'
  const answerOptions = isTF ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']

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

  return (
    <div className="space-y-2">
      {group.questions.map((q, qi) => (
        <div key={qi} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">Câu {q.number}</span>
            <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
          </div>
          <textarea rows={2}
            className="w-full border border-blue-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:border-blue-400"
            placeholder="Nội dung câu phát biểu..."
            value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
          <select className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6] bg-white"
            value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)}>
            <option value="">-- Chọn đáp án --</option>
            {answerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      ))}
      <button type="button" onClick={addQuestion}
        className="w-full border-2 border-dashed border-blue-200 rounded-xl py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
        + Thêm câu phát biểu
      </button>
    </div>
  )
}
