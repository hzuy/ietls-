import { Link } from 'react-router-dom'

export default function SectionHeader({ title, to, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-2xl)', fontWeight: 700,
          color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
        }}>{title}</h2>
        {count && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)', fontWeight: 600,
            color: 'var(--muted)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 20, padding: '2px 10px',
          }}>{count}</span>
        )}
      </div>
      <Link
        to={to}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-sm)', fontWeight: 600,
          color: 'var(--primary)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4,
          transition: 'opacity var(--transition)',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        Xem tất cả →
      </Link>
    </div>
  )
}
