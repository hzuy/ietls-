/**
 * PassagePills — shared pill navigation for Reading (Passage) and Listening (Section).
 *
 * Props:
 *   items        — array of { label: string, answered: number, total: number }
 *   activeIndex  — currently active index
 *   onChange     — (index: number) => void
 */
export default function PassagePills({ items, activeIndex, onChange, fill = false }) {
  return (
    <div className={`seg-scroller gap-2 py-1 ${fill ? 'w-full' : 'flex-1'}`}>
      {items.map((item, i) => {
        const isActive = activeIndex === i
        const isComplete = item.answered === item.total && item.total > 0

        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            aria-label={`${item.label} — đã làm ${item.answered}/${item.total}`}
            className={`exam-bar-btn h-9 ${fill ? 'flex-1 min-w-0 px-2' : 'px-3.5 sm:px-4 shrink-0'} rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-colors cursor-pointer ${
              isActive
                ? 'bg-zinc-900 text-white shadow-xs'
                : isComplete
                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-transparent'
            }`}
          >
            <span className="sm:hidden" aria-hidden="true">
              {item.label.replace(/^Passage\s+/i, 'P').replace(/^Section\s+/i, 'S')}
            </span>
            <span className="hidden sm:inline" aria-hidden="true">{item.label}</span>
            <span
              aria-hidden="true"
              className={`font-mono text-[11px] sm:text-xs ${
                isActive ? 'opacity-80' : 'opacity-60'
              }`}
            >
              {item.answered}/{item.total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
