import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const PART_OPTIONS = [
  { value: 'task1', label: 'Part 1' },
  { value: 'task2', label: 'Part 2' },
  { value: 'task3', label: 'Part 3' },
]

const PART_LABELS = { task1: 'Part 1', task2: 'Part 2', task3: 'Part 3' }
const PART_COLORS = {
  task1: { bg: '#eff6ff', color: '#1a56db' },
  task2: { bg: '#f0fdf4', color: '#15803d' },
  task3: { bg: '#fdf4ff', color: '#7c3aed' },
}

function ThumbPlaceholder() {
  return (
    <div style={{ width: '100%', aspectRatio: '16/9', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 32 }}>🎤</span>
    </div>
  )
}

function SampleCard({ item, onClick }) {
  const [hovered, setHovered] = useState(false)
  const img = resolveImg(item.thumbnailUrl)
  const partStyle = PART_COLORS[item.level] || null
  const partLabel = PART_LABELS[item.level] || null

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: `1px solid ${hovered ? '#6ee7b7' : '#e2e8f0'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(16,185,129,0.10)' : '0 2px 6px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {img
        ? <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
            <img src={img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        : <ThumbPlaceholder />
      }
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f', margin: 0, lineHeight: 1.5 }}>{item.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {partLabel && partStyle && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: partStyle.bg, color: partStyle.color }}>
              {partLabel}
            </span>
          )}
          {item.examType && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
              {item.examType}
            </span>
          )}
          {(item.tags || []).map((tag, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 700 : 500,
        background: active ? '#f0fdf4' : 'transparent',
        color: active ? '#15803d' : '#374151',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >{children}</button>
  )
}

export default function SpeakingSamplesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)

  const selectedPart = searchParams.get('part') || ''
  const selectedType = searchParams.get('type') || ''

  useEffect(() => {
    fetch(API_BASE + '/samples/speaking?limit=0')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSamples(data); setLoading(false) })
      .catch(() => { setSamples([]); setLoading(false) })
  }, [])

  // Dynamic examTypes from data
  const examTypes = useMemo(() => {
    const set = new Set(samples.map(s => s.examType).filter(Boolean))
    return [...set].sort()
  }, [samples])

  // Filtered results
  const filtered = useMemo(() => {
    return samples.filter(s => {
      if (selectedPart && s.level !== selectedPart) return false
      if (selectedType && s.examType !== selectedType) return false
      return true
    })
  }, [samples, selectedPart, selectedType])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fff 0%, #f0fdf4 50%, #fff 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎤</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>Speaking Sample Answers</h1>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, marginTop: 2 }}>Bài mẫu Speaking Part 1, 2 & 3 chuẩn IELTS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-8" style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <aside style={{ width: 200, flexShrink: 0, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 12px', position: 'sticky', top: 80 }}>

          {/* Part filter */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px 4px' }}>Part</p>
            <FilterBtn active={!selectedPart} onClick={() => setFilter('part', '')}>Tất cả</FilterBtn>
            {PART_OPTIONS.map(opt => (
              <FilterBtn key={opt.value} active={selectedPart === opt.value} onClick={() => setFilter('part', selectedPart === opt.value ? '' : opt.value)}>
                {opt.label}
              </FilterBtn>
            ))}
          </div>

          {/* Dạng bài filter */}
          {examTypes.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px 4px' }}>Dạng bài</p>
              <FilterBtn active={!selectedType} onClick={() => setFilter('type', '')}>Tất cả</FilterBtn>
              {examTypes.map(t => (
                <FilterBtn key={t} active={selectedType === t} onClick={() => setFilter('type', selectedType === t ? '' : t)}>
                  {t}
                </FilterBtn>
              ))}
            </div>
          )}
        </aside>

        {/* Grid */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Active filters & count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: '#64748b' }}>
              {loading ? 'Đang tải...' : `${filtered.length} bài mẫu`}
            </span>
            {selectedPart && (
              <span
                style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'pointer' }}
                onClick={() => setFilter('part', '')}
              >{PART_LABELS[selectedPart]} ×</span>
            )}
            {selectedType && (
              <span
                style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                onClick={() => setFilter('type', '')}
              >{selectedType} ×</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#f1f5f9' }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, marginBottom: 10 }} />
                    <div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ fontWeight: 700, color: '#374151' }}>Không tìm thấy bài mẫu</p>
              <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>Thử chọn bộ lọc khác</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(item => (
                <SampleCard key={item.id} item={item} onClick={() => navigate(`/samples/speaking/${item.id}`)} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
