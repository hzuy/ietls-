import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Breadcrumb from '../components/common/Breadcrumb'
import ContentCard from '../components/common/ContentCard'
import AcademicCover from '../components/common/AcademicCover'
import { SkeletonCard } from '../components/skeletons'
import { Headphones, BookOpen, PenTool, Mic, AlertCircle, RefreshCw, FolderArchive } from 'lucide-react'
import { BACKEND_URL, resolveImg } from '../utils/media'

const SKILL_ICONS = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenTool,
  speaking: Mic,
}

export default function SeriesPage({ filterPattern, title }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [books, setBooks] = useState([])

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

        // Filter strictly by series name pattern
        const filtered = normalized.filter(b => {
          const sName = (b.seriesName || '').toLowerCase()
          const pattern = (filterPattern || '').toLowerCase()
          if (pattern === 'cambridge') {
            return sName.includes('cambridge') && !sName.includes('practice') && !sName.includes('plus')
          }
          if (pattern === 'practice') {
            return sName.includes('practice') || sName.includes('plus')
          }
          return sName.includes(pattern)
        }).sort((a, b) => b.bookNumber - a.bookNumber)

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


  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-zinc-950 flex flex-col">
      <Navbar />

      <div className="app-container pt-5 pb-1">
        <Breadcrumb
          className="mb-0"
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Phòng thi chuẩn hóa', to: '/full-test' },
            { label: title }
          ]}
        />
        <h1 className="text-2xl font-bold mt-3" style={{ color: 'var(--ink)' }}>{title}</h1>
      </div>

      <div className="app-container py-6 flex-1">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {[1,2,3,4,5].map(i => (
              <SkeletonCard key={i} aspect="3/4" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 px-6 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-error-bg border border-error-border flex items-center justify-center mb-4 text-error shadow-xs">
              <AlertCircle className="w-7 h-7 stroke-[2]" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Không thể tải danh sách bộ đề</h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-md leading-relaxed">
              Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại.
            </p>
            <button
              onClick={fetchBooks}
              className="btn-primary flex items-center justify-center gap-2 px-6 h-9 rounded-full font-semibold text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-zinc-200 flex flex-col items-center">
            <FolderArchive className="w-12 h-12 text-zinc-300 stroke-[1.5] mb-4" />
            <h3 className="font-bold text-zinc-900 text-base">Không tìm thấy bộ đề nào</h3>
            <p className="text-zinc-500 text-sm mt-1">Hiện chưa có bộ đề nào trong danh mục này</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {books.map(book => {
              const hasTests = book.testCount > 0
              const skills = Array.from(book.skills || [])
              return (
                <ContentCard
                  key={`${book.seriesId}-${book.bookNumber}`}
                  image={book.coverImageUrl ? resolveImg(book.coverImageUrl) : null}
                  imageAlt={book.title}
                  academicCover={
                    <AcademicCover
                      title={book.title}
                      seriesName={book.seriesName}
                      volume={book.bookNumber}
                      subtitle={`${book.testCount} Full Tests`}
                      skill="fullTest"
                    />
                  }
                  thumbAspect="3/4"
                  thumbOverlay={
                    <>
                      {!hasTests && (
                        <>
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(253,251,245,0.55)', zIndex: 5 }} />
                          <span
                            style={{
                              position: 'absolute', top: 10, left: 10, zIndex: 6,
                              background: 'var(--surface)', color: 'var(--muted)',
                              padding: '4px 10px', borderRadius: 9999,
                              fontSize: 11, fontWeight: 600,
                              border: '1px solid var(--border)',
                            }}
                          >
                            Đang cập nhật
                          </span>
                        </>
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
                                className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm border border-zinc-200 shadow-xs flex items-center justify-center text-zinc-700"
                              >
                                <IconComp className="w-3.5 h-3.5 text-zinc-700 stroke-[1.75]" />
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </>
                  }
                  title={book.title}
                  meta={
                    <p className="text-xs text-zinc-500 font-medium mb-3">
                      {hasTests ? `${book.testCount} bài test hoàn chỉnh` : 'Đang cập nhật đề thi'}
                    </p>
                  }
                  action={{
                    label: 'Chi tiết bộ đề',
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
