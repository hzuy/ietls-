import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const TYPE_LABELS = {
  academic: 'IELTS Academic',
  general: 'IELTS General Training',
}

function getTypeLabel(type) {
  return TYPE_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Khác')
}

function ThumbPlaceholder() {
  return (
    <div style={{ width: '100%', aspectRatio: '4/5', background: 'linear-gradient(145deg, #1e3a5f 0%, #1a56db 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 36 }}>📚</span>
    </div>
  )
}

function SeriesCard({ item, onClick }) {
  const [hovered, setHovered] = useState(false)
  const img = resolveImg(item.thumbnailUrl)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: `1px solid ${hovered ? '#93c5fd' : '#e2e8f0'}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(26,86,219,0.13)' : '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {img
        ? <div style={{ width: '100%', aspectRatio: '4/5', overflow: 'hidden' }}>
            <img src={img} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        : <ThumbPlaceholder />
      }
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f', margin: 0, lineHeight: 1.4 }}>{item.name}</p>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#94a3b8' }}>
          <span>{item.testCount} bài test</span>
          {item.attemptCount > 0 && <span>{item.attemptCount.toLocaleString()} lượt</span>}
        </div>
        <button
          style={{ marginTop: 4, padding: '6px 0', borderRadius: 8, border: 'none', background: hovered ? '#1d4ed8' : '#1a56db', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
        >
          Xem bài test →
        </button>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ width: '100%', aspectRatio: '4/5', background: '#f1f5f9' }} />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, width: '60%' }} />
      </div>
    </div>
  )
}

export default function FullTest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(true)
  const sectionRefs = useRef({})

  useEffect(() => {
    fetch(API_BASE + '/series', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSeries(data); setLoading(false) })
      .catch(() => { setSeries([]); setLoading(false) })
  }, [])

  // Scroll to highlighted series from query param
  useEffect(() => {
    const sid = searchParams.get('series')
    if (!sid || !series) return
    const el = sectionRefs.current[sid]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [series, searchParams])

  // Group series by type, preserving insertion order
  const grouped = series ? series.reduce((acc, s) => {
    const key = s.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {}) : {}

  const groupKeys = Object.keys(grouped)
  const totalTests = series ? series.reduce((n, s) => n + s.testCount, 0) : 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fff 0%, #eff6ff 50%, #fff 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📚</div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>IELTS Full Test</h1>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, marginTop: 2 }}>Luyện đầy đủ 4 kỹ năng theo từng bộ đề Cambridge IELTS</p>
            </div>
          </div>
          {!loading && series && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 14px', fontSize: 13, fontWeight: 700, color: '#1a56db' }}>
                {series.length} bộ đề
              </div>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 14px', fontSize: 13, fontWeight: 700, color: '#1a56db' }}>
                {totalTests} full tests
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {loading ? (
          <>
            <div>
              <div style={{ height: 24, width: 200, background: '#e2e8f0', borderRadius: 6, marginBottom: 20 }} />
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {[0,1,2,3,4].map(i => <SkeletonCard key={i} />)}
              </div>
            </div>
          </>
        ) : series?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Chưa có bộ đề nào</p>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Admin cần tạo bộ đề trong trang quản trị</p>
          </div>
        ) : (
          groupKeys.map(typeKey => (
            <section key={typeKey}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>
                    {getTypeLabel(typeKey)}
                  </h2>
                  <span style={{ fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#1a56db', padding: '2px 8px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
                    {grouped[typeKey].length} bộ
                  </span>
                </div>
              </div>

              {/* Series cards row */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {grouped[typeKey].map(item => {
                  const isHighlighted = searchParams.get('series') === String(item.id)
                  return (
                    <div
                      key={item.id}
                      ref={el => { if (isHighlighted && el) sectionRefs.current[item.id] = el }}
                      style={{
                        outline: isHighlighted ? '2px solid #1a56db' : 'none',
                        borderRadius: 13,
                        transition: 'outline 0.3s',
                      }}
                    >
                      <SeriesCard item={item} onClick={() => navigate(`/full-test/${item.id}`)} />
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
