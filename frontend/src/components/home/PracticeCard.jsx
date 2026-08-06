import { useState } from 'react'
import { BookOpen } from 'lucide-react'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')

function resolveImg(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return BACKEND_URL + url
}

function ThumbPlaceholder() {
  return (
    <div style={{
      width: '100%', height: '160px',
      background: '#F1F5F9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <BookOpen className="w-8 h-8 text-slate-400 stroke-[1.75]" />
    </div>
  )
}

export default function PracticeCard({ item, skill, onAction, actionLabel = 'Làm bài', tag, animClass }) {
  const [hovered, setHovered] = useState(false)
  const img = resolveImg(item.thumbnailUrl || item.coverImageUrl)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${animClass} card-base flex flex-col`}
      style={{
        overflow: 'hidden', cursor: 'pointer',
        borderRadius: 'var(--radius-xl)',
        background: '#ffffff',
        border: hovered ? '1.5px solid #60A5FA' : '1px solid #e2e8f0',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? '0 20px 35px -8px rgba(37, 99, 235, 0.22), 0 10px 20px -6px rgba(37, 99, 235, 0.12)'
          : '0 4px 12px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Thumbnail */}
      <div style={{ width: '100%', height: '160px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
        {img
          ? (
            <img
              src={img}
              alt={item.title || 'Luyện tập'}
              draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hovered ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          )
          : <ThumbPlaceholder />}
        {/* Primary color accent bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
          background: 'var(--primary)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }} />
      </div>

      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tag && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-xs)', fontWeight: 700,
            color: 'var(--primary)', background: 'var(--primary-light)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px', alignSelf: 'flex-start',
            marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{tag}</span>
        )}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700, fontSize: 'var(--fs-sm)',
          color: 'var(--ink)', margin: '0 0 8px 0',
          lineHeight: 1.4, minHeight: '40px',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.title}</p>

        <div style={{
          fontFamily: 'var(--font-mono)',
          display: 'flex', gap: 12,
          fontSize: 12, color: 'var(--muted)',
          marginTop: 'auto', marginBottom: 12,
        }}>
          {item.questionCount != null && <span>{item.questionCount} câu</span>}
        </div>

        <button
          onClick={onAction}
          className="mt-auto"
          style={{
            width: '100%', padding: '8px 0',
            borderRadius: 'var(--radius-md)', border: 'none',
            background: hovered ? 'var(--primary)' : 'var(--primary-light)',
            color: hovered ? '#fff' : 'var(--primary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: 'pointer',
            transition: 'all var(--transition)',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
