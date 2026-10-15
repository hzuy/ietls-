import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function pageItems(page, pages, siblings = 1) {
  const slots = siblings * 2 + 5
  if (pages <= slots) return Array.from({ length: pages }, (_, i) => i + 1)
  const edge = slots - 2
  if (page <= edge - siblings) return [...Array.from({ length: edge }, (_, i) => i + 1), 'gap-end', pages]
  if (page >= pages - edge + 1 + siblings) return [1, 'gap-start', ...Array.from({ length: edge }, (_, i) => pages - edge + 1 + i)]
  const middle = Array.from({ length: siblings * 2 + 1 }, (_, i) => page - siblings + i)
  return [1, 'gap-start', ...middle, 'gap-end', pages]
}

const btnBase = 'h-8 min-w-8 px-2 rounded-full text-xs font-medium tabular-nums inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export default function Pagination({ page, pages, onChange, summary, disabled = false, className = '' }) {
  const [jump, setJump] = useState('')
  const go = p => {
    const next = Math.min(pages, Math.max(1, p))
    if (next !== page) onChange(next)
  }
  const submitJump = e => {
    e.preventDefault()
    const n = parseInt(jump, 10)
    if (Number.isFinite(n)) go(n)
    setJump('')
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-zinc-200 bg-zinc-50/50 ${className}`}>
      <span className="text-xs font-medium text-zinc-500 tabular-nums">{summary ?? `Trang ${page} / ${pages}`}</span>
      {pages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-1 flex-wrap justify-center">
          <button
            type="button"
            aria-label="Trang trước"
            disabled={disabled || page <= 1}
            onClick={() => go(page - 1)}
            className={`${btnBase} border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageItems(page, pages).map(item => typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              aria-label={`Trang ${item}`}
              aria-current={item === page ? 'page' : undefined}
              disabled={disabled}
              onClick={() => go(item)}
              className={`${btnBase} ${item === page ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="w-6 text-center text-xs text-zinc-400 select-none">…</span>
          ))}
          <button
            type="button"
            aria-label="Trang sau"
            disabled={disabled || page >= pages}
            onClick={() => go(page + 1)}
            className={`${btnBase} border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {pages > 7 && (
            <form onSubmit={submitJump} className="hidden md:flex items-center gap-1.5 ml-2 pl-3 border-l border-zinc-200">
              <label htmlFor="pagination-jump" className="text-xs text-zinc-500 whitespace-nowrap">Đến trang</label>
              <input
                id="pagination-jump"
                type="number"
                min="1"
                max={pages}
                value={jump}
                onChange={e => setJump(e.target.value)}
                placeholder={String(page)}
                disabled={disabled}
                className="w-14 h-8 px-2 text-xs text-center rounded-full border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </form>
          )}
        </nav>
      )}
    </div>
  )
}
