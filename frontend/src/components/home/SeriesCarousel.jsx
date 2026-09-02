import { useRef, useState, useEffect } from 'react'

/**
 * SeriesCarousel — dùng chung cho trang chủ và /full-test
 * Drag-to-scroll, arrow navigation, scroll-snap — y hệt SeriesRow trong FullTest.jsx
 */
export default function SeriesCarousel({ children, count, title, to }) {
  const scrollRef = useRef(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(true)

  // Drag-to-scroll refs & state
  const isDown = useRef(false)
  const startX = useRef(0)
  const scrollLeftStart = useRef(0)
  const dragged = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeft(scrollLeft > 10)
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  const scroll = (dir) => {
    if (!scrollRef.current) return
    const offset = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({ left: dir * offset, behavior: 'smooth' })
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [children])

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (e.clientY - rect.top > el.clientHeight) return

    isDown.current = true
    setIsDragging(true)
    dragged.current = false
    startX.current = e.pageX - el.offsetLeft
    scrollLeftStart.current = el.scrollLeft
  }

  const handleMouseLeave = () => {
    isDown.current = false
    setIsDragging(false)
  }

  const handleMouseUp = () => {
    isDown.current = false
    setIsDragging(false)
  }

  const handleMouseMove = (e) => {
    if (!isDown.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX.current) * 1.5
    if (Math.abs(walk) > 5) dragged.current = true
    scrollRef.current.scrollLeft = scrollLeftStart.current - walk
  }

  const handleClickCapture = (e) => {
    if (dragged.current) {
      e.preventDefault()
      e.stopPropagation()
      dragged.current = false
    }
  }

  return (
    <section className="mb-12">
      {/* Optional header */}
      {(title || to) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {title && (
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--fs-2xl)', fontWeight: 700,
                color: 'var(--ink-soft)', margin: 0, letterSpacing: '-0.01em',
              }}>{title}</h2>
            )}
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
          {to && (
            <a
              href={to}
              className="hover:opacity-70 transition-opacity duration-300"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-sm)', fontWeight: 600,
                color: 'var(--primary)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Xem tất cả →
            </a>
          )}
        </div>
      )}

      {/* Carousel track */}
      <div className="relative group/row">
        {/* Arrow trái */}
        <button
          aria-label="Cuộn trái"
          onClick={() => scroll(-1)}
          style={{
            position: 'absolute', left: -20, top: '50%',
            transform: 'translateY(-50%)', zIndex: 10,
            width: 40, height: 40, borderRadius: '50%',
            display: showLeft ? 'flex' : 'none',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid var(--border)',
            color: 'var(--text)', cursor: 'pointer',
            opacity: 0, transition: 'all 0.2s var(--ease-out-quart)',
          }}
          className="group-hover/row:opacity-100 hover:text-slate-900 hover:border-slate-300"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        {/* Scrollable track — y hệt FullTest.jsx */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onClickCapture={handleClickCapture}
          className={`flex flex-nowrap overflow-x-auto gap-6 pb-4 custom-scrollbar select-none ${
            isDragging ? 'scroll-auto cursor-grabbing' : 'scroll-smooth cursor-grab'
          }`}
          style={{ scrollSnapType: isDragging ? 'none' : 'x proximity' }}
        >
          {children}
          {/* Spacer to avoid last card clipping */}
          <div className="flex-shrink-0 w-8" style={{ scrollSnapAlign: 'none' }} />
        </div>

        {/* Arrow phải */}
        <button
          aria-label="Cuộn phải"
          onClick={() => scroll(1)}
          style={{
            position: 'absolute', right: -20, top: '50%',
            transform: 'translateY(-50%)', zIndex: 10,
            width: 40, height: 40, borderRadius: '50%',
            display: showRight ? 'flex' : 'none',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid var(--border)',
            color: 'var(--text)', cursor: 'pointer',
            opacity: 0, transition: 'all 0.2s var(--ease-out-quart)',
          }}
          className="group-hover/row:opacity-100 hover:text-slate-900 hover:border-slate-300"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </section>
  )
}
