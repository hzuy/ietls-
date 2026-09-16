import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Breadcrumb from '../components/common/Breadcrumb'
import { FolderArchive } from 'lucide-react'
import ContentCard from '../components/common/ContentCard'
import AcademicCover from '../components/common/AcademicCover'
import { SkeletonCard } from '../components/skeletons'
import { CONTENT_CARD_CONFIG } from '../components/common/contentCardConfig'
import { BACKEND_URL, resolveImg } from '../utils/media'

// Wrapper mỏng quanh <ContentCard>: phần thân (thumb / title / meta / action) do
// ContentCard lo; wrapper tự xử lý trạng thái "sắp có bài" khi !hasTests —
// overlay badge, ảnh grayscale (qua .ft-series-card--soon .cc-thumb img), khoá click.
function SeriesCard({ item, onClick }) {
  const hasTests = item.testCount > 0

  return (
    <div
      className={hasTests ? '' : 'ft-series-card--soon opacity-80 pointer-events-none'}
      style={{ position: 'relative' }}
    >
      <ContentCard
        hoverStyle="subtle"
        image={resolveImg(item.coverImageUrl)}
        imageAlt={item.title}
        academicCover={
          <AcademicCover
            title={item.title}
            seriesName={item.seriesName}
            volume={item.bookNumber}
            subtitle={hasTests ? `${item.testCount} bài test` : 'Đang cập nhật'}
            skill="fullTest"
          />
        }
        thumbAspect="4/5"
        title={item.title}
        titleClamp={2}
        meta={{ type: 'count', text: hasTests ? `${item.testCount} bài test` : 'Đang cập nhật' }}
        action={hasTests
          ? { label: 'Chi tiết đề thi', decorative: true }
          : { label: 'Chi tiết đề thi', disabled: true, disabledLabel: 'Đang cập nhật' }}
        onClick={hasTests ? onClick : undefined}
      />

      {!hasTests && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, aspectRatio: '4 / 5',
            borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem', overflow: 'hidden',
            background: 'rgba(253,251,245,0.55)',
          }}
        >
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'var(--surface)', color: 'var(--muted)',
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 9999,
            border: '1px solid var(--border)',
          }}>Đang cập nhật</span>
        </div>
      )}
    </div>
  )
}



function SeriesRow({ title, count, children }) {
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
    if (e.button !== 0) return // Only left-click
    
    // Ignore drag starting if clicked directly on the horizontal scrollbar area
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const clickYRelative = e.clientY - rect.top
    if (clickYRelative > el.clientHeight) {
      return
    }

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
    const walk = (x - startX.current) * 1.5 // drag speed multiplier
    if (Math.abs(walk) > 5) {
      dragged.current = true
    }
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-soft)', margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>{count}</span>
      </div>

      <div className="relative group/row">
        <button
          aria-label="Cuộn trái"
          onClick={() => scroll(-1)}
          style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 40, height: 40, borderRadius: '50%', display: showLeft ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', opacity: 0, transition: 'all 0.2s var(--ease-out-quart)' }}
          className="group-hover/row:opacity-100 hover:text-zinc-900 hover:border-zinc-300"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
        </button>

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

        <button
          aria-label="Cuộn phải"
          onClick={() => scroll(1)}
          style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 40, height: 40, borderRadius: '50%', display: showRight ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', opacity: 0, transition: 'all 0.2s var(--ease-out-quart)' }}
          className="group-hover/row:opacity-100 hover:text-zinc-900 hover:border-zinc-300"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </section>
  )
}

export default function FullTest() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [groupedData, setGroupedData] = useState({})

  useEffect(() => {
    document.title = 'Đề thi Full Test | IELTS Pro'
    fetch(`${BACKEND_URL}/api/admin/full-tests`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const booksMap = data.reduce((acc, item) => {
          const bKey = `${item.seriesId}-${item.bookNumber}`
          if (!acc[bKey]) {
            acc[bKey] = {
              seriesId: item.seriesId,
              seriesName: item.seriesName,
              bookNumber: item.bookNumber,
              coverImageUrl: item.coverImageUrl,
              testNumbers: new Set()
            }
          }
          acc[bKey].testNumbers.add(item.testNumber)
          return acc
        }, {})

        const normalizedBooks = Object.values(booksMap).map(b => ({
          ...b,
          testCount: b.testNumbers.size,
          title: `${b.seriesName} ${b.bookNumber}`
        }))

        const rows = normalizedBooks.reduce((acc, book) => {
          const sId = book.seriesId
          if (!acc[sId]) {
            acc[sId] = {
              name: book.seriesName,
              books: []
            }
          }
          acc[sId].books.push(book)
          return acc
        }, {})

        Object.values(rows).forEach(row => {
          row.books.sort((a, b) => b.bookNumber - a.bookNumber)
        })

        setGroupedData(rows)
        setLoading(false)
      })
      .catch(() => {
        setFetchError(true)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Phòng thi chuẩn hóa' }]} />
      </div>

      <div className="app-container pt-4 pb-16 relative">
        {fetchError ? (
          <div className="text-center py-20 px-6 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</p>
            <p className="text-zinc-500 mb-6 max-w-sm text-sm">Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
            <button className="btn-primary px-8 py-3 font-bold text-sm" onClick={() => window.location.reload()}>Thử lại</button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-12">
            {[1, 2].map(i => (
              <div key={i}>
                <div className="h-7 w-48 bg-zinc-200 animate-pulse rounded-md mb-6" />
                <div className="flex gap-6 overflow-hidden">
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <SkeletonCard key={j} className="w-[180px] sm:w-[200px] shrink-0" aspect="4/5" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <FolderArchive className="w-12 h-12 text-zinc-400 mx-auto mb-3 stroke-[1.5]" />
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-soft)', margin: '0 0 8px' }}>Chưa có bộ đề nào</h3>
            <p style={{ color: 'var(--text)', fontSize: 14 }}>Dữ liệu đang được cập nhật, vui lòng quay lại sau.</p>
          </div>
        ) : (
          Object.values(groupedData).map((series) => (
            <SeriesRow
              key={series.name}
              title={series.name}
              count={`${series.books.length} cuốn`}
            >
              {series.books.map(book => (
                <div key={`${book.seriesId}-${book.bookNumber}`} className="flex-shrink-0 shrink-0 w-[180px] sm:w-[200px]" style={{ scrollSnapAlign: 'start' }}>
                  <SeriesCard
                    item={book}
                    onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                  />
                </div>
              ))}
            </SeriesRow>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Custom premium scrollbar for the horizontal list */
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text);
        }

        /* Card "sắp có bài" — chỉ làm xám ảnh thumb, không ảnh hưởng title/nút */
        .ft-series-card--soon .cc-thumb img { filter: grayscale(0.5); }
      `}} />
    </div>
  )
}
