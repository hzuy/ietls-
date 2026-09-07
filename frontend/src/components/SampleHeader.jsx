import React from 'react'

export default function SampleHeader({ type, taskLabel, title, examType }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 13,
          fontWeight: 800,
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.05em',
          color: 'var(--primary)',
          textTransform: 'uppercase'
        }}>
          {type === 'writing' ? 'Writing Sample' : 'Speaking Sample'}
        </span>

        {taskLabel && (
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            border: '1px solid var(--border)'
          }}>
            {taskLabel}
          </span>
        )}

        {examType && (
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            background: 'var(--surface-raised)',
            color: 'var(--muted)',
            border: '1px solid var(--border)'
          }}>
            {examType}
          </span>
        )}
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight leading-tight m-0">
        {title}
      </h1>
    </div>
  )
}
