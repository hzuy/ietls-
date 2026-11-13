import AutoGrowTextarea from '../admin/AutoGrowTextarea'
import { ROMAN_KEYS, getQuestionGroupTheme } from '../../utils/practiceConfig'
import Select from '../admin/Select'
import { readingParagraphs } from '../../utils/readingParagraphs'

const headingKey = index => ROMAN_KEYS[index] || String(index + 1)
const paragraphKey = question => (question.questionText || '').split('|')[0].trim()

export default function MatchingHeadingsEditor({ group, onChange, passage = '', letteredParagraphs = false, sourceMode = 'paragraphs' }) {
  const manual = sourceMode === 'manual'
  const original = group.matchingOptions || []
  const headings = original.map((h, i) => ({ ...h, letter: headingKey(i) }))
  const questions = (group.questions || []).map((q, index) => ({ ...q,
    ...(manual && !String(q.questionText || '').includes('|') && !/^[A-Z]$/.test(q.questionText || '') ? { questionText: `${String.fromCharCode(65 + index)}|${q.questionText || ''}` } : {}),
    correctAnswer: headings[original.findIndex(h => h.letter === q.correctAnswer)]?.letter || q.correctAnswer,
  }))
  const source = readingParagraphs(passage)
  const theme = getQuestionGroupTheme(group.type)
  const update = patch => onChange({ ...group, matchingOptions: headings, questions, ...patch })
  const setQuestions = next => {
    const explanations = group.explanations && Object.fromEntries(next.flatMap((question, index) =>
      Object.hasOwn(group.explanations, question.number) ? [[group.qNumberStart + index, group.explanations[question.number]]] : []))
    update({ questions: next.map((q, i) => ({ ...q, number: group.qNumberStart + i })), qNumberEnd: group.qNumberStart + Math.max(0, next.length - 1), ...(explanations ? { explanations } : {}) })
  }
  const selectHeading = (key, answer) => {
    const existing = questions.find(q => paragraphKey(q) === key)
    const next = questions.filter(q => paragraphKey(q) !== key)
    if (answer) next.push({ ...existing, questionText: `${key}|`, correctAnswer: answer })
    next.sort((a, b) => paragraphKey(a).localeCompare(paragraphKey(b)))
    setQuestions(next)
  }
  const removeHeading = index => {
    const remaining = headings.filter((_, i) => i !== index)
    update({ matchingOptions: remaining.map((h, i) => ({ ...h, letter: headingKey(i) })), questions: questions.map(q => ({ ...q,
      correctAnswer: remaining.some(h => h.letter === q.correctAnswer) ? headingKey(remaining.findIndex(h => h.letter === q.correctAnswer)) : '',
    })) })
  }
  const used = new Set(questions.map(q => q.correctAnswer).filter(Boolean))
  const missing = questions.filter(q => !/^[A-Z]$/.test(paragraphKey(q)) || !source[paragraphKey(q).charCodeAt(0) - 65])
  return <div className="space-y-4">
    <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-lg p-3.5 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-zinc-700">Danh sách heading</p>
        <button type="button" onClick={() => update({ matchingOptions: [...headings, { letter: headingKey(headings.length), text: '' }] })} className="text-xs font-semibold hover:underline">+ Thêm heading</button>
      </div>
      {headings.map((h, i) => <div key={i} className="flex items-start gap-2">
        <span className="w-12 shrink-0 py-2 text-center text-sm font-bold text-zinc-700" aria-label={`Ký hiệu heading ${h.letter}`}>{h.letter}</span>
        <AutoGrowTextarea aria-label={`Nội dung heading ${h.letter}`} className="min-w-0 flex-1 border border-zinc-200 bg-white rounded-lg px-2 py-1 text-sm" placeholder="Nội dung heading..." value={h.text || ''}
          onChange={e => update({ matchingOptions: headings.map((item, idx) => idx === i ? { ...item, text: e.target.value } : item) })} />
        <button type="button" aria-label={`Xóa heading ${h.letter}`} onClick={() => removeHeading(i)} className="p-2 text-zinc-500 hover:text-red-600">×</button>
      </div>)}
    </div>
    {manual && <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-600">Nhập các đoạn hoặc đối tượng hiển thị trong câu hỏi và chọn heading đúng cho từng mục.</p>
      {questions.map((question, index) => {
        const key = paragraphKey(question)
        const label = String(question.questionText || '').split('|').slice(1).join('|')
        return <div key={question.id ?? index} className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-start gap-x-3 gap-y-2">
          <span className="pt-2 text-xs font-semibold text-zinc-700">Q{question.number}<span className="block font-normal">Mục {key}</span></span>
          <AutoGrowTextarea aria-label={`Nội dung mục ${key}`} value={label} placeholder="Nội dung đoạn hoặc đối tượng cần ghép..." className="min-w-0 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-zinc-700"
            onChange={event => update({ questions: questions.map((q, i) => i === index ? { ...q, questionText: `${key}|${event.target.value}` } : q) })} />
          <Select multiline className="col-start-2 row-start-2 w-full" ariaLabel={`Heading đúng cho mục ${key}`} value={question.correctAnswer || ''}
            onChange={answer => update({ questions: questions.map((q, i) => i === index ? { ...q, correctAnswer: answer } : q) })}
            options={[{ value: '', label: '-- Chọn heading --' }, ...headings.filter(h => group.canReuse || h.letter === question.correctAnswer || !used.has(h.letter)).map(h => ({ value: h.letter, label: `${h.letter} — ${h.text}` }))]} />
          <button type="button" aria-label={`Xóa mục ${key}`} onClick={() => setQuestions(questions.filter((_, i) => i !== index))} className="col-start-3 row-start-1 row-span-2 h-10 w-10 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-zinc-700">×</button>
        </div>
      })}
      <button type="button" onClick={() => {
        let index = 0
        while (questions.some(question => paragraphKey(question) === String.fromCharCode(65 + index))) index++
        setQuestions([...questions, { questionText: `${String.fromCharCode(65 + index)}|`, correctAnswer: '' }])
      }} className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-zinc-700">+ Thêm đoạn hoặc đối tượng</button>
    </div>}
    {!manual && letteredParagraphs && <div className="space-y-2">
      {!source.length && <p className="text-sm text-zinc-500">Nhập bài đọc phía trên để nối heading với đoạn văn.</p>}
      {source.map((_, i) => {
        const key = String.fromCharCode(65 + i)
        const question = questions.find(q => paragraphKey(q) === key)
        return <div key={key} className="flex items-start gap-3">
          <span className="w-24 pt-2 shrink-0 text-xs text-zinc-600"><strong>Đoạn {key}</strong>{question && <span className="ml-2 text-zinc-400">Q{question.number}</span>}</span>
          <Select multiline className="min-w-0 flex-1" ariaLabel={`Heading đúng cho đoạn ${key}`} value={question?.correctAnswer || ''}
            onChange={value => selectHeading(key, value)}
            options={[{ value: '', label: '-- Không hỏi đoạn này --' }, ...headings.filter(h => group.canReuse || h.letter === question?.correctAnswer || !used.has(h.letter)).map(h => ({ value: h.letter, label: `${h.letter} — ${h.text}` }))]} />
        </div>
      })}
      {missing.map((q, i) => <div key={i} className="border border-zinc-200 rounded-lg p-3 text-sm text-zinc-600">
        Đoạn {paragraphKey(q) || '?'} không còn trong bài đọc.
        <button type="button" className="ml-2 underline" onClick={() => setQuestions(questions.filter(item => item !== q))}>Bỏ câu {q.number}</button>
      </div>)}
    </div>}
  </div>
}
