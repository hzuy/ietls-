import AutoGrowTextarea from '../admin/AutoGrowTextarea'
import { ROMAN_KEYS, getQuestionGroupTheme } from '../../utils/practiceConfig'
import Select from '../admin/Select'
import { readingParagraphs } from '../../utils/readingParagraphs'

const headingKey = index => ROMAN_KEYS[index] || String(index + 1)
const paragraphKey = question => (question.questionText || '').split('|')[0].trim()

export default function MatchingHeadingsEditor({ group, onChange, passage = '', letteredParagraphs = false }) {
  const original = group.matchingOptions || []
  const headings = original.map((h, i) => ({ ...h, letter: headingKey(i) }))
  const questions = (group.questions || []).map(q => ({ ...q,
    correctAnswer: headings[original.findIndex(h => h.letter === q.correctAnswer)]?.letter || q.correctAnswer,
  }))
  const source = readingParagraphs(passage)
  const theme = getQuestionGroupTheme(group.type)
  const update = patch => onChange({ ...group, matchingOptions: headings, questions, ...patch })
  const setQuestions = next => update({ questions: next.map((q, i) => ({ ...q, number: group.qNumberStart + i })), qNumberEnd: group.qNumberStart + Math.max(0, next.length - 1) })
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
    {letteredParagraphs && <div className="space-y-2">
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
