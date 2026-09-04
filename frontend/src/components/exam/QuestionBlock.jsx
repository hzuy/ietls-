const MATCHING_TYPES = ['matching','matching_headings','matching_features','matching_paragraph','matching_endings','choose_title','map_diagram']

// Danh sách radio 1-lựa-chọn dùng chung cho mcq / true_false_ng / yes_no_ng.
// 3 loại này render y hệt nhau, chỉ khác tập đáp án → gom về đây, KHÔNG đổi
// className/hành vi. Nội bộ file, không export.
function SingleChoiceList({ options, q, answers, onAnswer, previewMode, showAnswers }) {
  return (
    <div className="space-y-1 pl-8">
      {options.map(opt => {
        const displayAns = previewMode && showAnswers ? q.correctAnswer : answers[q.id]
        const isSelected = displayAns === opt
        return (
          <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
            ${isSelected && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
              : isSelected ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
              : previewMode ? 'border border-transparent text-gray-500 cursor-default'
              : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
            <input type="radio" name={`q${q.id}`} checked={isSelected}
              disabled={previewMode}
              onChange={previewMode ? undefined : () => onAnswer(q.id, opt)}
              className="accent-blue-600" />
            {opt}
          </label>
        )
      })}
    </div>
  )
}

export default function QuestionBlock({ q, globalIdx, answers, onAnswer, maxChoices = 2, previewMode, showAnswers }) {
  const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : []
  const selected = (answers[q.id] || '').split(',').filter(Boolean)

  return (
    <div id={`q-${q.number}`} className="mb-6 scroll-mt-4">
      <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold text-xs shrink-0 mt-0.5">{q.number}</span>
        <span>{q.questionText}</span>
      </p>

      {/* Single MCQ */}
      {q.type === 'mcq' && (
        <SingleChoiceList options={opts} q={q} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
      )}

      {/* Multi MCQ (checkboxes) */}
      {q.type === 'mcq_multi' && (
        <div className="space-y-1 pl-8">
          {opts.map(opt => {
            const correctList = previewMode && showAnswers ? (q.correctAnswer || '').split(',').filter(Boolean) : []
            const checked = previewMode && showAnswers ? correctList.includes(opt) : selected.includes(opt)
            const disabled = previewMode || (!checked && selected.length >= maxChoices)
            return (
              <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${checked && previewMode && showAnswers ? 'bg-green-50 border border-green-400 text-green-700 cursor-default'
                  : checked ? 'bg-blue-50 border border-blue-400 text-blue-700 cursor-pointer'
                  : disabled ? 'border border-transparent text-gray-300 cursor-not-allowed'
                  : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}>
                <input type="checkbox" checked={checked} disabled={disabled} className="accent-blue-600"
                  onChange={previewMode ? undefined : () => {
                    const next = checked ? selected.filter(s => s !== opt) : [...selected, opt]
                    onAnswer(q.id, next.join(','))
                  }} />
                {opt}
              </label>
            )
          })}
        </div>
      )}

      {/* TRUE/FALSE/NOT GIVEN — radio-tick rows (khớp style MCQ single-choice) */}
      {q.type === 'true_false_ng' && (
        <SingleChoiceList options={['TRUE', 'FALSE', 'NOT GIVEN']} q={q} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
      )}

      {/* YES/NO/NOT GIVEN — radio-tick rows (khớp style MCQ single-choice) */}
      {q.type === 'yes_no_ng' && (
        <SingleChoiceList options={['YES', 'NO', 'NOT GIVEN']} q={q} answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
      )}

      {/* Text input: fill_blank, diagram_completion */}
      {['fill_blank', 'diagram_completion'].includes(q.type) && (
        <div className="pl-8">
          {q.imageUrl && <img src={q.imageUrl} alt="diagram" className="w-full max-w-sm rounded-lg mb-2 border" />}
          <input type="text"
            value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
            readOnly={previewMode}
            onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
            placeholder={previewMode ? '' : 'Nhập đáp án...'}
            className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-64 bg-transparent transition`} />
        </div>
      )}

      {/* Matching types — select dropdown */}
      {MATCHING_TYPES.includes(q.type) && (
        <div className="pl-8">
          {q.imageUrl && <img src={q.imageUrl} alt="map/diagram" className="w-full max-w-sm rounded-lg mb-2 border" />}
          {opts.length > 0 ? (
            <select
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              disabled={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              className={`border ${previewMode && showAnswers ? 'border-green-400 text-green-700 font-semibold' : 'border-gray-300'} rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white min-w-48`}>
              <option value="">— Chọn đáp án —</option>
              {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input type="text"
              value={previewMode && showAnswers ? (q.correctAnswer || '') : (answers[q.id] || '')}
              readOnly={previewMode}
              onChange={previewMode ? undefined : e => onAnswer(q.id, e.target.value)}
              placeholder={previewMode ? '' : 'Nhập đáp án...'}
              className={`border-b-2 ${previewMode && showAnswers ? 'border-green-500 text-green-700 font-semibold' : 'border-gray-300 focus:border-blue-500'} outline-none px-2 py-1 text-sm w-48 bg-transparent transition`} />
          )}
        </div>
      )}
    </div>
  )
}
