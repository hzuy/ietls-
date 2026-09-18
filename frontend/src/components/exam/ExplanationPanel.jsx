import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'

// Giải thích do AI sinh 1 lần cho mỗi câu hỏi (backend: Question.explanation /
// PracticeQuestion.explanation, xem backend/scripts/generate-explanations.js),
// cấu trúc cố định 4 phần. Câu chưa có giải thích (explanation == null) không
// render gì — không hiện khu vực trống, không hiện lỗi.
const SECTIONS = [
  { key: 'restatement', label: 'Câu hỏi kiểm tra điều gì' },
  { key: 'evidence', label: 'Đối chiếu với đoạn văn / bài nghe', accent: true },
  { key: 'reasoning', label: 'Các bước suy luận' },
  { key: 'conclusion', label: 'Kết luận' },
]

export default function ExplanationPanel({ explanation }) {
  const [open, setOpen] = useState(false)
  if (!explanation) return null

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 cursor-pointer bg-transparent border-none px-0 py-0.5"
      >
        <Sparkles className="w-3 h-3 text-amber-500" />
        <span>{open ? 'Ẩn giải thích' : 'Xem giải thích'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="mt-2 mb-1 rounded-xl border p-3 flex flex-col gap-2.5 anim-fade-up"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
        >
          {SECTIONS.map(({ key, label, accent }) => {
            const text = explanation[key]
            if (!text) return null
            return (
              <div
                key={key}
                className={accent ? 'rounded-lg px-2.5 py-2' : ''}
                style={accent ? { background: 'var(--info-bg)', border: '1px solid var(--info-border)' } : undefined}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider m-0 mb-1"
                  style={{ color: accent ? 'var(--info-text)' : 'var(--subtle)' }}
                >
                  {label}
                </p>
                <p className="text-xs leading-relaxed m-0" style={{ color: accent ? 'var(--info-text)' : 'var(--muted)' }}>
                  {text}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
