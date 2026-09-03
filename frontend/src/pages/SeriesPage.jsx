import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Headphones, BookOpen, PenTool, Mic } from 'lucide-react'
import { BACKEND_URL, resolveImg } from '../utils/media'

const SKILL_ICONS = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenTool,
  speaking: Mic,
}

function BookCard({ book, onClick }) {
  const [hovered, setHovered] = useState(false)
  const hasTests = book.testCount > 0
  const skills = Array.from(book.skills || [])

  return (
    <div
      onClick={hasTests ? onClick : null}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: `1px solid ${hovered ? (hasTests ? '#93c5fd' : '#e2e8f0') : '#e2e8f0'}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: hasTests ? 'pointer' : 'default',
        transform: (hovered && hasTests) ? 'translateY(-5px)' : 'none',
        boxShadow: (hovered && hasTests) ? '0 15px 35px rgba(26,86,219,0.12)' : '0 2px 10px rgba(0,0,0,0.04)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
        height: '100%'
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', overflow: 'hidden', background: '#f8fafc' }}>
        {book.coverImageUrl ? (
          <img 
            src={resolveImg(book.coverImageUrl)} 
            alt={book.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: hasTests ? 'none' : 'grayscale(0.4) opacity(0.7)' }} 
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen className="w-10 h-10 text-slate-400 stroke-[1.75]" />
          </div>
        )}
        
        {!hasTests && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ background: 'white', color: '#1e3a5f', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Sắp có bài</span>
          </div>
        )}

        {/* Skill Badges */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 6, flexWrap: 'wrap', zIndex: 10 }}>
          {skills.map(s => {
            const skillKey = String(s).toLowerCase()
            const IconComp = SKILL_ICONS[skillKey] || BookOpen
            return (
              <span
                key={s}
                title={s.toUpperCase()}
                className="w-6 h-6 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200/90 shadow-sm flex items-center justify-center text-slate-600"
              >
                <IconComp className="w-3.5 h-3.5 text-slate-600 stroke-[1.75]" />
              </span>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f', margin: '0 0 4px', lineHeight: 1.4 }}>{book.title}</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px', fontWeight: 500 }}>
          {hasTests ? `${book.testCount} bài test hoàn chỉnh` : 'Đang cập nhật đề thi'}
        </p>
        
        <button
          disabled={!hasTests}
          style={{ 
            marginTop: 'auto', width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', 
            background: hasTests ? (hovered ? '#1D4ED8' : '#1D4ED8') : '#f1f5f9', 
            color: hasTests ? 'white' : '#94a3b8', 
            fontSize: 13, fontWeight: 700, 
            cursor: hasTests ? 'pointer' : 'not-allowed', 
            transition: 'background 0.2s' 
          }}
        >
          {hasTests ? 'Làm bài ngay' : 'Đang cập nhật'}
        </button>
      </div>
    </div>
  )
}

export default function SeriesPage({ filterPattern, title, description }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/full-tests`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        // Normalize
        const booksMap = data.reduce((acc, item) => {
          const bKey = `${item.seriesId}-${item.bookNumber}`
          if (!acc[bKey]) {
            acc[bKey] = {
              seriesId: item.seriesId,
              seriesName: item.seriesName,
              bookNumber: item.bookNumber,
              coverImageUrl: item.coverImageUrl,
              testNumbers: new Set(),
              skills: new Set()
            }
          }
          acc[bKey].testNumbers.add(item.testNumber)
          if (item.exams) {
            Object.keys(item.exams).forEach(skill => acc[bKey].skills.add(skill))
          }
          return acc
        }, {})

        const normalized = Object.values(booksMap).map(b => ({
          ...b,
          testCount: b.testNumbers.size,
          title: `${b.seriesName} ${b.bookNumber}`
        }))

        // Filter by series name pattern
        const filtered = normalized.filter(b => 
          b.seriesName.toLowerCase().includes(filterPattern.toLowerCase())
        ).sort((a, b) => b.bookNumber - a.bookNumber)

        setBooks(filtered)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filterPattern])

  const filteredBooks = useMemo(() => {
    if (!search.trim()) return books
    const words = search.trim().toLowerCase().split(/\s+/)
    return books.filter(b => {
      const haystack = b.title.toLowerCase()
      return words.every(w => haystack.includes(w))
    })
  }, [books, search])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar />

      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1e3a5f', margin: 0, tracking: '-0.02em' }}>{title}</h1>
          <p style={{ fontSize: 15, color: '#64748b', marginTop: 6, fontWeight: 500 }}>{description}</p>
          
          <div style={{ marginTop: 24, maxWidth: 400, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
            <input 
              type="text"
              placeholder="Tìm theo tên bộ đề (vd: Cambridge 19)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ 
                width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, border: '1px solid #e2e8f0',
                fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                backgroundColor: '#f1f5f9'
              }}
              onFocus={e => e.target.style.borderColor = '#1D4ED8'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 350, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', animate: 'pulse' }}>
                <div style={{ height: '70%', background: '#f1f5f9' }} />
                <div style={{ padding: 16 }}>
                  <div style={{ height: 15, background: '#f1f5f9', borderRadius: 4, width: '80%', marginBottom: 10 }} />
                  <div style={{ height: 15, background: '#f1f5f9', borderRadius: 4, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍃</div>
            <h3 style={{ fontWeight: 800, color: '#1e3a5f' }}>Không tìm thấy bộ đề nào</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>Thử tìm kiếm với từ khóa khác</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {filteredBooks.map(book => (
              <BookCard 
                key={`${book.seriesId}-${book.bookNumber}`}
                book={book}
                onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
