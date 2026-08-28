/**
 * LƯU Ý KIẾN TRÚC: Đây là 1 trong 2 bản implementation song song cho loại câu hỏi này.
 * Bản kia: src/components/practice/MCQGroupEditor.jsx
 * 2 bản đã fork khác nhau (xem chi tiết trong CLAUDE.md — phần "Known Issues").
 * Khi sửa bug hoặc thêm tính năng ở đây, cân nhắc đồng bộ sang bản kia nếu áp dụng được.
 * Kế hoạch dài hạn: hợp nhất thành 1 bản tham số hóa (numberingMode: auto/manual, themeSource)
 * — chưa thực hiện, cần đánh giá riêng.
 */
import { getQuestionGroupTheme } from '../adminConstants'
import { deriveCorrectIndices, correctAnswerFromIndices, reindexAfterRemoval } from '../../../utils/mcqAnswer'

export default function MCQGroupEditor({ group = {}, onChange }) {
  const groupType = group?.type || 'mcq'
  const isMulti = groupType === 'mcq_multi'
  const maxChoices = group.maxChoices || 2
  const theme = getQuestionGroupTheme(groupType)

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

  const patchQ = (qi, patch) =>
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, ...patch }) })

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
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
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
          <div key={qi} className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-lg p-3 space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${theme.subBoxText}`}>
                {isMulti
                  ? `Câu ${group.qNumberStart + qi * maxChoices}–${group.qNumberStart + qi * maxChoices + maxChoices - 1}`
                  : `Câu ${q.number}`}
              </span>
              <button type="button" onClick={() => removeQuestion(qi)}
                className="text-red-500 hover:text-red-600 text-xs font-semibold">✕ Xóa</button>
            </div>
            <textarea rows={2}
              className={`w-full border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm resize-none focus:outline-none`}
              placeholder="Nội dung câu hỏi..."
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />

            {isMulti ? (
              /* Multi: dynamic options with checkboxes for correct answer */
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-medium">Tick ô bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctIdx.has(oi)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{letter}.</span>
                      <input
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none ${dupOptIdx.has(oi) ? 'border-red-400 ring-1 ring-red-200' : isCorrect ? 'border-[#e2e8f0] focus:border-[#3B82F6] bg-[#eff6ff]' : 'border-blue-200 focus:border-blue-400'}`}
                        placeholder={`Lựa chọn ${letter}...`}
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                      />
                      <input
                        type="checkbox"
                        checked={isCorrect}
                        disabled={!opt.trim()}
                        onChange={() => toggleCorrectAt(qi, oi)}
                        title="Đánh dấu đáp án đúng"
                        className="w-4 h-4 accent-[#1D4ED8] shrink-0 cursor-pointer"
                      />
                      {opts.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)}
                          className="text-blue-400 hover:text-red-500 text-xs shrink-0">✕</button>
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
              /* Single MCQ: one radio per option — correctAnswer stores the chosen option's text */
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-medium">Chọn nút tròn bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctIdx.has(oi)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{letter}.</span>
                      <input
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none ${dupOptIdx.has(oi) ? 'border-red-400 ring-1 ring-red-200' : isCorrect ? 'border-[#e2e8f0] focus:border-[#3B82F6] bg-[#eff6ff]' : 'border-blue-200 focus:border-blue-400'}`}
                        placeholder={`Lựa chọn ${letter}...`}
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                      />
                      <input
                        type="radio"
                        name={`mcq-correct-${group.qNumberStart}-${qi}`}
                        checked={isCorrect}
                        disabled={!opt.trim()}
                        onClick={() => setSingleCorrect(qi, oi)}
                        onChange={() => {}}
                        title="Đánh dấu đáp án đúng"
                        className="w-4 h-4 accent-[#1D4ED8] shrink-0 cursor-pointer"
                      />
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
        className="w-full border-2 border-dashed border-blue-200 rounded-lg py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
        + Thêm câu hỏi {isMulti ? 'MCQ Multi' : 'MCQ'}
      </button>
    </div>
  )
}
