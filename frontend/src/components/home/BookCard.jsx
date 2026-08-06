import { useState } from 'react'

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
      background: 'var(--primary-light)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 32 }}>📚</span>
    </div>
  )
}

export default function BookCard({ book, onClick, animClass }) {
  const [hovered, setHovered] = useState(false)
  const img = resolveImg(book.coverImageUrl)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${animClass} card-base flex flex-col`}
      style={{
        overflow: 'hidden', cursor: 'pointer',
        width: '180px', flexShrink: 0, minHeight: '260px',
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
      {/* Cover image */}
      <div style={{ width: '100%', height: '160px', overflow: 'hidden', flexShrink: 0 }}>
        {img
          ? (
            <img
              src={img}
              alt={book.title}
              draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                display: 'block',
                transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hovered ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          )
          : <ThumbPlaceholder />
        }
      </div>

      {/* Info */}
      <div style={{ padding: '14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700, fontSize: 'var(--fs-sm)',
          color: hovered ? '#2563EB' : 'var(--ink)', margin: '0 0 4px',
          lineHeight: 1.4, minHeight: '36px',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          transition: 'color 0.3s ease',
        }}>{book.title}</p>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11, color: hovered ? '#2563EB' : 'var(--muted)', margin: 0,
          transition: 'color 0.3s ease',
        }}>{book.testCount} bài test</p>
      </div>
    </div>
  )
}
