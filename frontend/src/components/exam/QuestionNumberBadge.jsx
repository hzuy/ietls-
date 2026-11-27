import { Flag } from 'lucide-react'

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-7 h-7 text-[13px]',
  pill: 'h-7 px-2.5 text-[13px]',
}

export default function QuestionNumberBadge({
  number,
  label,
  flagged = false,
  onToggleFlag,
  previewMode = false,
  size = 'md',
  className = '',
}) {
  const display = label ?? number
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const baseClass = `inline-flex items-center justify-center rounded-full border font-bold shrink-0 ${sizeClass}`

  if (onToggleFlag && !previewMode && number != null) {
    const title = flagged
      ? `Bỏ đánh dấu câu ${display}`
      : `Đánh dấu câu ${display} để xem lại`
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFlag(number)
        }}
        title={title}
        aria-label={title}
        aria-pressed={flagged}
        className={`relative ${baseClass} transition-colors cursor-pointer ${
          flagged
            ? 'bg-amber-50 border-amber-500 text-amber-800'
            : 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:border-amber-400 hover:bg-amber-50/50'
        } ${className}`}
      >
        {display}
        {flagged && (
          <Flag
            className="w-2.5 h-2.5 text-amber-600 fill-amber-500 absolute -top-1 -right-1"
            aria-hidden="true"
          />
        )}
      </button>
    )
  }

  return (
    <span className={`${baseClass} bg-zinc-100 border-zinc-200 text-zinc-800 ${className}`}>
      {display}
    </span>
  )
}
