import { useState } from 'react'
import { X, Zap, BookOpen, Headphones } from 'lucide-react'
import Modal from '../common/Modal'
import { useNavigate } from 'react-router-dom'

// Xác định gợi ý kỹ năng dựa trên bandBySkill
function suggestSkill(stats) {
  if (!stats?.bandBySkill) return null
  const { reading, listening, writing, speaking } = stats.bandBySkill

  // Kỹ năng chưa làm lần nào
  const unattempted = []
  if (reading === null) unattempted.push('reading')
  if (listening === null) unattempted.push('listening')
  if (writing === null) unattempted.push('writing')
  if (speaking === null) unattempted.push('speaking')

  if (unattempted.length > 0) return unattempted[0]

  // Kỹ năng có band thấp nhất
  const scored = Object.entries({ reading, listening, writing, speaking })
    .filter(([, v]) => v !== null)
    .sort(([, a], [, b]) => a - b)
  return scored.length > 0 ? scored[0][0] : null
}

const SKILL_ROUTES = {
  reading: '/practice/reading',
  listening: '/practice/listening',
  writing: '/cambridge',
  speaking: '/speaking',
}

const SKILL_LABELS = {
  reading: 'Luyện Reading',
  listening: 'Luyện Listening',
  writing: 'Luyện Writing',
  speaking: 'Luyện Speaking',
}

const SKILL_DESCS = {
  reading: 'Band Reading cần cải thiện nhất. Thử một bài đọc ngay!',
  listening: 'Luyện tai nghe với đề Listening thực chiến.',
  writing: 'Cải thiện Writing bằng đề Full Test.',
  speaking: 'Nói nhiều hơn — điểm Speaking sẽ tăng dần!',
  null: 'Bắt đầu Full Test để ước tính band của bạn.',
}

export default function QuickFullTestWidget({ books, onSelect, stats }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const suggested = suggestSkill(stats)
  const suggestionLabel = suggested ? SKILL_LABELS[suggested] : 'Vào Full Test'
  const suggestionDesc = SKILL_DESCS[suggested] ?? SKILL_DESCS[null]
  const suggestionRoute = suggested ? SKILL_ROUTES[suggested] : null

  const handleMainCTA = () => {
    if (suggestionRoute) {
      navigate(suggestionRoute)
    } else {
      setOpen(true)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-0.5">
          Gợi ý hôm nay
        </h3>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {suggestionDesc}
        </p>
      </div>

      {/* Nút chính */}
      <button
        type="button"
        onClick={handleMainCTA}
        className="w-full h-9 pointer-coarse:h-11 px-4 text-white text-sm font-medium rounded-full shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none gap-1.5"
        style={{ background: 'var(--primary)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
      >
        <Zap className="w-3.5 h-3.5" />
        {suggestionLabel}
      </button>

      {/* Nút phụ */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 h-8 px-3 text-xs font-medium text-zinc-700 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
        >
          <BookOpen className="w-3 h-3" />
          Full Test
        </button>
        <button
          type="button"
          onClick={() => navigate('/speaking')}
          className="flex-1 h-8 px-3 text-xs font-medium text-zinc-700 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
        >
          <Headphones className="w-3 h-3" />
          Speaking nhanh
        </button>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} title="Chọn đề Full Test" size="md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
            <h4 className="text-sm font-semibold text-zinc-900">
              Chọn cuốn đề Full Test
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
            {books.length === 0 ? (
              <p className="col-span-full text-xs text-zinc-500 text-center py-6">
                Chưa có dữ liệu đề thi.
              </p>
            ) : (
              books.map((book, i) => (
                <button
                  key={`${book.seriesId}-${book.bookNumber}-${i}`}
                  type="button"
                  onClick={() => {
                    onSelect(book)
                    setOpen(false)
                  }}
                  className="text-left p-3 rounded-xl border border-zinc-200 hover:border-zinc-400 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold text-zinc-900 truncate">
                    {book.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    {book.testCount} đề
                  </p>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
