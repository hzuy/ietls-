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
    <div className="flex-1 flex items-center justify-center" style={{ gap: 8 }}>
      {items.map((item, i) => {
        const isActive   = activeIndex === i
        const isComplete = item.answered === item.total && item.total > 0

        const bgColor     = isActive ? 'var(--ink)' : isComplete ? 'var(--primary-light)' : 'transparent'
        const borderColor = isActive ? 'var(--ink)' : isComplete ? 'var(--border)' : 'transparent'
        const textColor   = isActive ? '#ffffff' : isComplete ? 'var(--primary)' : 'var(--subtle)'

        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            style={{
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'var(--font-body)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: `1.5px solid ${borderColor}`,
              backgroundColor: bgColor,
              color: textColor,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.backgroundColor = 'var(--surface-raised)'
                e.currentTarget.style.color = 'var(--ink)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.backgroundColor = bgColor
                e.currentTarget.style.color = textColor
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <span>{item.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: isActive ? 0.75 : 0.5 }}>
              {item.answered}/{item.total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
