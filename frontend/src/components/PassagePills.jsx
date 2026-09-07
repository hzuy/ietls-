/**
 * PassagePills — shared pill navigation for Reading (Passage) and Listening (Section).
 *
 * Props:
 *   items        — array of { label: string, answered: number, total: number }
 *   activeIndex  — currently active index
 *   onChange     — (index: number) => void
 */
export default function PassagePills({ items, activeIndex, onChange }) {
  return (
    <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto py-1">
      {items.map((item, i) => {
        const isActive = activeIndex === i
        const isComplete = item.answered === item.total && item.total > 0

        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`h-9 px-3.5 sm:px-4 rounded-md text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-colors cursor-pointer shrink-0 ${
              isActive
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : isComplete
                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-400 border border-transparent'
            }`}
          >
            <span>{item.label}</span>
            <span
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
