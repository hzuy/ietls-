import AutoGrowTextarea from '../AutoGrowTextarea'
import { inputCls, labelCls } from '../adminConstants'

export default function ShortAnswerEditor({ group, onChange }) {
  const questions = group.questions || []
  const update = (i, field, value) => onChange({ ...group, questions: questions.map((q, n) => n === i ? { ...q, [field]: value } : q) })
  return <div className="space-y-4">
    <p className="text-xs text-zinc-600">Nhập giới hạn từ trong Instruction. Dùng dấu / để phân cách các đáp án được chấp nhận.</p>
    {questions.map((q, i) => <div key={q.id ?? i} className="space-y-2 border-t border-zinc-200 pt-3">
      <label className={labelCls}>Câu {q.number} — Nội dung câu hỏi
        <AutoGrowTextarea className={inputCls} value={q.questionText || ''} onChange={e => update(i, 'questionText', e.target.value)} />
      </label>
      <label className={labelCls}>Đáp án đúng
        <AutoGrowTextarea className={inputCls} value={q.correctAnswer || ''} onChange={e => update(i, 'correctAnswer', e.target.value)} />
      </label>
      <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => onChange({ ...group, questions: questions.filter((_, n) => n !== i) })}>Xóa câu {q.number}</button>
    </div>)}
    <button type="button" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-50" onClick={() => onChange({ ...group, questions: [...questions, { number: questions.length ? Math.max(...questions.map(q => q.number)) + 1 : group.qNumberStart, questionText: '', correctAnswer: '' }] })}>+ Thêm câu hỏi</button>
  </div>
}
