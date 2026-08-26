/**
 * StatusBadge — semantic status/skill badge using design tokens from index.css
 *
 * variant:
 *   done        → success-bg / success
 *   todo        → surface-raised / muted
 *   inprogress  → primary-light / primary
 *   correct     → success-bg / success
 *   wrong       → error-bg / error
 *   missed      → slate-100 / slate-400
 *   score       → ink / white, bold (use `score` prop for the number)
 *   reading|listening|writing|speaking → skill-* vars
 */

const VARIANT_STYLES = {
  done: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
  },
  todo: {
    background: 'var(--surface-raised)',
    color: 'var(--muted)',
  },
  inprogress: {
    background: 'var(--primary-light)',
    color: 'var(--primary)',
  },
  correct: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
  },
  wrong: {
    background: 'var(--error-bg)',
    color: 'var(--error)',
  },
  missed: {
    background: '#f1f5f9',
    color: '#94a3b8',
  },
  score: {
    background: 'var(--ink)',
    color: '#fff',
    fontWeight: 700,
  },
  reading: {
    background: 'var(--skill-r-bg)',
    color: 'var(--skill-r-color)',
    border: '1px solid var(--skill-r-border)',
  },
  listening: {
    background: 'var(--skill-l-bg)',
    color: 'var(--skill-l-color)',
    border: '1px solid var(--skill-l-border)',
  },
  writing: {
    background: 'var(--skill-w-bg)',
    color: 'var(--skill-w-color)',
    border: '1px solid var(--skill-w-border)',
  },
  speaking: {
    background: 'var(--skill-s-bg)',
    color: 'var(--skill-s-color)',
    border: '1px solid var(--skill-s-border)',
  },
}

export default function StatusBadge({ variant = 'todo', children, score }) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.todo

  const content = variant === 'score' && score !== undefined ? score : children

  return (
    <span
      className="badge"
      style={{
        ...variantStyle,
        fontSize: 'var(--fs-xs)',
      }}
    >
      {content}
    </span>
  )
}
