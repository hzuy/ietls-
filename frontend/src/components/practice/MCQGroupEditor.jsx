/**
 * LƯU Ý KIẾN TRÚC: Đây là 1 trong 2 bản implementation song song cho loại câu hỏi này.
 * Bản kia: src/components/admin/editors/MCQGroupEditor.jsx
 * 2 bản đã fork khác nhau (xem chi tiết trong CLAUDE.md — phần "Known Issues").
 * Khi sửa bug hoặc thêm tính năng ở đây, cân nhắc đồng bộ sang bản kia nếu áp dụng được.
 * Kế hoạch dài hạn: hợp nhất thành 1 bản tham số hóa (numberingMode: auto/manual, themeSource)
 * — chưa thực hiện, cần đánh giá riêng.
 */
import { getQuestionGroupTheme } from '../../utils/practiceConfig'
import { deriveCorrectIndices, correctAnswerFromIndices, reindexAfterRemoval } from '../../utils/mcqAnswer'

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

  const patchQ = (qi, patch) =>
    onChange({ ...group, questions: group.questions.map((item, i) => i !== qi ? item : { ...item, ...patch }) })

  const updateOption = (qi, oi, val) => {
    const q = group.questions[qi]
    const oldOpts = q.options || defaultOpts
    const opts = [...oldOpts]
    opts[oi] = val
    // Keep correctAnswer pinned to the same option position(s) after a text
    // edit — renaming the correct option follows it. If nothing currently
    // matches (blank, or legacy mismatched data), leave correctAnswer alone so
    // the "not matching any option" warning keeps showing the stored value.
    const cur = deriveCorrectIndices(q.correctAnswer, oldOpts)
    if (cur.length === 0) return patchQ(qi, { options: opts })
    patchQ(qi, { options: opts, correctAnswer: correctAnswerFromIndices(cur, opts) })
  }

  const addOption = (qi) => {
    const q = group.questions[qi]
    patchQ(qi, { options: [...(q.options || defaultOpts), ''] })
  }

  const removeOption = (qi, oi) => {
    const q = group.questions[qi]
    const oldOpts = q.options || defaultOpts
    const opts = oldOpts.filter((_, i) => i !== oi)
    // Shift correct indices to their new positions, then re-serialize — never
    // filter correctAnswer by text (two options could share it).
    const nextIdx = reindexAfterRemoval(deriveCorrectIndices(q.correctAnswer, oldOpts), oi)
    patchQ(qi, { options: opts, correctAnswer: correctAnswerFromIndices(nextIdx, opts) })
  }

  // Multi MCQ: toggle a single option BY INDEX — independent of whether its
  // text matches any other option.
  const toggleCorrectAt = (qi, oi) => {
    const q = group.questions[qi]
    const opts = q.options || defaultOpts
    const cur = deriveCorrectIndices(q.correctAnswer, opts)
    const next = cur.includes(oi) ? cur.filter(x => x !== oi) : [...cur, oi]
    patchQ(qi, { correctAnswer: correctAnswerFromIndices(next, opts) })
  }

  // Single MCQ: pick exactly one option by index (click the selected radio to
  // clear). correctAnswer is written as the verbatim option text — same stored
  // format as before, no migration.
  const setSingleCorrect = (qi, oi) => {
    const q = group.questions[qi]
    const opts = q.options || defaultOpts
    const already = deriveCorrectIndices(q.correctAnswer, opts).includes(oi)
    patchQ(qi, { correctAnswer: already ? '' : correctAnswerFromIndices([oi], opts) })
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
        // Which options are marked correct — tracked as an index Set, derived
        // from the stored text once per render, never re-matched per option.
        const correctIdx = new Set(deriveCorrectIndices(q.correctAnswer, opts))
        const correctCount = correctIdx.size
        const warn = isMulti && correctCount !== maxChoices
        // Single MCQ: a stored answer that matches no option (e.g. legacy typo)
        const answerUnmatched = !isMulti && String(q.correctAnswer || '').trim() !== '' && correctCount === 0
        // Flag options whose trimmed text duplicates another option in this question.
        // correctAnswer matches options by text, so identical texts are ambiguous —
        // block save (backend also refuses, see adminExamValidator).
        const trimmedOpts = opts.map(o => (o || '').trim())
        const dupOptIdx = new Set()
        trimmedOpts.forEach((t, i) => {
          if (t && trimmedOpts.some((u, j) => j !== i && u === t)) dupOptIdx.add(i)
        })
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
                  const isCorrect = correctIdx.has(oi)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? `${theme.subBoxBg} border ${theme.subBoxBorder}` : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-gray-500 w-5 shrink-0">{letter}.</span>
                      <input className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none bg-white ${dupOptIdx.has(oi) ? 'border-red-400 ring-1 ring-red-200' : isCorrect ? `${theme.subBoxBorder} font-semibold` : 'border-gray-200'}`}
                        placeholder={`Lựa chọn ${letter}...`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                      <input type="checkbox" checked={isCorrect} disabled={!opt.trim()} onChange={() => toggleCorrectAt(qi, oi)}
                        title="Đánh dấu đáp án đúng" className={`w-4 h-4 ${theme.accentColor} shrink-0 cursor-pointer`} />
                      {opts.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addOption(qi)} className={`text-xs ${theme.subBoxText} font-semibold hover:underline mt-1`}>+ Thêm lựa chọn</button>
                {warn && (
                  <p className={`text-xs font-semibold mt-1 ${correctCount < maxChoices ? 'text-amber-600' : 'text-red-500'}`}>
                    ⚠ Đang chọn {correctCount}/{maxChoices} đáp án đúng
                    {correctCount < maxChoices ? ` — cần chọn thêm ${maxChoices - correctCount}` : ` — chọn thừa ${correctCount - maxChoices}`}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 font-medium">Chọn nút tròn bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctIdx.has(oi)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? `${theme.subBoxBg} border ${theme.subBoxBorder}` : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-gray-500 w-5 shrink-0">{letter}.</span>
                      <input className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none bg-white ${dupOptIdx.has(oi) ? 'border-red-400 ring-1 ring-red-200' : isCorrect ? `${theme.subBoxBorder} font-semibold` : 'border-gray-200'}`}
                        placeholder={`Lựa chọn ${letter}...`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                      <input type="radio" name={`mcq-correct-${group.qNumberStart}-${qi}`} checked={isCorrect} disabled={!opt.trim()}
                        onClick={() => setSingleCorrect(qi, oi)} onChange={() => {}}
                        title="Đánh dấu đáp án đúng" className={`w-4 h-4 ${theme.accentColor} shrink-0 cursor-pointer`} />
                    </div>
                  )
                })}
                {answerUnmatched && (
                  <p className="text-xs font-semibold text-amber-600 mt-1">
                    Đáp án đã lưu (“{q.correctAnswer}”) không khớp với option nào — vui lòng chọn lại
                  </p>
                )}
              </div>
            )}
            {dupOptIdx.size > 0 && (
              <p className="text-xs font-semibold text-red-500 mt-1">Các lựa chọn không được trùng nội dung</p>
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
