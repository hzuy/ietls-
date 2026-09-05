import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ContentCard from '../components/common/ContentCard'
import { SkeletonCard } from '../components/skeletons'
import { Headphones, BookOpen, PenTool, Mic, AlertCircle, RefreshCw } from 'lucide-react'
import { BACKEND_URL, resolveImg } from '../utils/media'

const SKILL_ICONS = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenTool,
  speaking: Mic,
}

export default function SeriesPage({ filterPattern, title, description }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')

  const fetchBooks = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`${BACKEND_URL}/api/admin/full-tests`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        // Normalize
        const booksMap = (data || []).reduce((acc, item) => {
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
      .catch(err => {
        setError(err.message || 'Không thể tải danh sách bộ đề.')
        setLoading(false)
      })
  }, [filterPattern])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

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
              <SkeletonCard key={i} aspect="4/5" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 px-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-500 shadow-sm">
              <AlertCircle className="w-7 h-7 stroke-[2]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Không thể tải danh sách bộ đề</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-md leading-relaxed">
              Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại.
            </p>
            <button
              onClick={fetchBooks}
              className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍃</div>
            <h3 style={{ fontWeight: 800, color: '#1e3a5f' }}>Không tìm thấy bộ đề nào</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>Thử tìm kiếm với từ khóa khác</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {filteredBooks.map(book => {
              const hasTests = book.testCount > 0
              const skills = Array.from(book.skills || [])
              return (
                <ContentCard
                  key={`${book.seriesId}-${book.bookNumber}`}
                  image={book.coverImageUrl ? resolveImg(book.coverImageUrl) : null}
                  imageAlt={book.title}
                  placeholder={{
                    bg: '#f8fafc',
                    icon: <BookOpen className="w-10 h-10 text-slate-400 stroke-[1.75]" />
                  }}
                  thumbAspect="4/5"
                  thumbOverlay={
                    <>
                      {!hasTests && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                          <span style={{ background: 'white', color: '#1e3a5f', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Sắp có bài</span>
                        </div>
                      )}
                      {skills.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 6, flexWrap: 'wrap', zIndex: 10 }}>
                          {skills.map(s => {
                            const skillKey = String(s).toLowerCase()
                            const IconComp = SKILL_ICONS[skillKey] || BookOpen
                            return (
                              <span
                                key={s}
                                title={String(s).toUpperCase()}
                                className="w-6 h-6 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200/90 shadow-sm flex items-center justify-center text-slate-600"
                              >
                                <IconComp className="w-3.5 h-3.5 text-slate-600 stroke-[1.75]" />
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </>
                  }
                  title={book.title}
                  meta={
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', fontWeight: 500 }}>
                      {hasTests ? `${book.testCount} bài test hoàn chỉnh` : 'Đang cập nhật đề thi'}
                    </p>
                  }
                  action={{
                    label: 'Làm bài ngay',
                    disabled: !hasTests,
                    disabledLabel: 'Đang cập nhật',
                    decorative: true,
                  }}
                  hoverStyle="showcase"
                  onClick={hasTests ? () => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
