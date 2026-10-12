import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Breadcrumb from '../components/common/Breadcrumb'
import BookCard from '../components/common/BookCard'
import Card from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import PillButton from '../components/common/PillButton'
import { UserCardGridSkeleton } from '../components/skeletons'
import { AlertCircle, RefreshCw, FolderArchive } from 'lucide-react'
import { BACKEND_URL } from '../utils/media'
import { toSeriesSlug } from '../utils/slug'

export default function SeriesPage({ filterPattern, title = 'Bộ đề thi' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug, id } = useParams()
  const param = slug || id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [books, setBooks] = useState([])
  const [resolvedTitle, setResolvedTitle] = useState(title)

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
        // Gom nhóm các bài test theo bộ sách (seriesId - bookNumber)
        const booksMap = (data || []).reduce((acc, item) => {
          const bKey = `${item.seriesId}-${item.bookNumber}`
          if (!acc[bKey]) {
            acc[bKey] = {
              seriesId: item.seriesId,
              seriesName: item.seriesName,
              bookNumber: item.bookNumber,
              coverImageUrl: item.coverImageUrl,
              testNumbers: new Set(),
              skills: new Set(),
              skillTestCount: 0,
              attemptCount: 0
            }
          }
          acc[bKey].testNumbers.add(item.testNumber)
          if (item.exams) {
            Object.keys(item.exams).forEach(skill => acc[bKey].skills.add(skill))
            acc[bKey].skillTestCount += Object.keys(item.exams).length
            Object.values(item.exams).forEach(e => {
              acc[bKey].attemptCount += (e.attemptCount || 0)
            })
          }
          if (item.attemptCount && !item.exams) {
            acc[bKey].attemptCount += item.attemptCount
          }
          return acc
        }, {})

        const normalized = Object.values(booksMap).map(b => ({
          ...b,
          testCount: b.skillTestCount > 0 ? b.skillTestCount : b.testNumbers.size,
          attemptCount: b.attemptCount || 0,
          title: `${b.seriesName} ${b.bookNumber}`
        }))

        // Gom nhóm theo từng series trong database
        const seriesMap = {}
        normalized.forEach(b => {
          if (!seriesMap[b.seriesId]) {
            seriesMap[b.seriesId] = {
              seriesId: b.seriesId,
              seriesName: b.seriesName,
              books: []
            }
          }
          seriesMap[b.seriesId].books.push(b)
        })
        const seriesList = Object.values(seriesMap)

        const pattern = (filterPattern || '').toLowerCase()
        let targetSeries = null

        if (param) {
          // Route xem series theo slug hoặc ID động: /series/:slug hoặc /series/:id
          targetSeries =
            seriesList.find(s => toSeriesSlug(s.seriesName) === param) ||
            seriesList.find(s => String(s.seriesId) === String(param)) ||
            seriesList.find(s => (s.seriesName || '').toLowerCase().includes(param)) ||
            null
        } else if (pattern === 'cambridge') {
          // Route bộ đề chính (/cambridge): lấy seriesId === 1 hoặc series đầu tiên trong database
          targetSeries =
            seriesList.find(s => s.seriesId === 1) ||
            seriesList[0] ||
            null
        } else if (pattern === 'practice') {
          // Route bộ đề thứ 2 (/practice-plus): lấy seriesId === 4 hoặc series thứ 2 trong database
          targetSeries =
            seriesList.find(s => s.seriesId === 4) ||
            seriesList[1] ||
            null
        } else if (pattern) {
          targetSeries = seriesList.find(s => (s.seriesName || '').toLowerCase().includes(pattern)) || null
        }

        let filteredBooks = []
        let currentTitle = title

        if (targetSeries) {
          filteredBooks = [...targetSeries.books].sort((a, b) => b.bookNumber - a.bookNumber)
          currentTitle = targetSeries.seriesName || title
          // Tự động đồng bộ URL trên thanh địa chỉ nếu đang ở route alias cũ (/cambridge hoặc /practice-plus)
          if (location.pathname === '/cambridge' || location.pathname === '/practice-plus') {
            const seriesSlug = toSeriesSlug(targetSeries.seriesName)
            if (seriesSlug && typeof window !== 'undefined' && window.history?.replaceState) {
              window.history.replaceState(null, '', `/series/${seriesSlug}`)
            }
          }
        } else {
          filteredBooks = normalized.filter(b => {
            const sName = (b.seriesName || '').toLowerCase()
            return sName.includes(pattern)
          }).sort((a, b) => b.bookNumber - a.bookNumber)
        }

        setBooks(filteredBooks)
        setResolvedTitle(currentTitle)
        if (currentTitle) {
          document.title = `${currentTitle} — IELTS Platform`
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Không thể tải danh sách bộ đề.')
        setLoading(false)
      })
  }, [param, filterPattern, title, location.pathname])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  const displayTitle = resolvedTitle || title

  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-zinc-950 flex flex-col">

      <div className="app-container pt-5 pb-1 anim-fade-up">
        <Breadcrumb
          className="mb-0"
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Phòng thi chuẩn hóa', to: '/full-test' },
            { label: displayTitle }
          ]}
        />
        <PageHeader title={displayTitle} titleClassName="text-2xl font-bold mt-3 text-zinc-900" />
      </div>

      <div className="app-container py-6 flex-1">
        {loading ? (
          <UserCardGridSkeleton aspect="3/2" count={5} />
        ) : error ? (
          <Card className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-error-bg border border-error-border flex items-center justify-center mb-4 text-error shadow-xs">
              <AlertCircle className="w-7 h-7 stroke-[2]" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Không thể tải danh sách bộ đề</h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-md leading-relaxed">
              Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại.
            </p>
            <PillButton onClick={fetchBooks}>
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </PillButton>
          </Card>
        ) : books.length === 0 ? (
          <Card className="text-center py-20 flex flex-col items-center">
            <FolderArchive className="w-12 h-12 text-zinc-300 stroke-[1.5] mb-4" />
            <h3 className="font-bold text-zinc-900 text-base">Không tìm thấy bộ đề nào</h3>
            <p className="text-zinc-500 text-sm mt-1">Hiện chưa có bộ đề nào trong danh mục này</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {books.map((book, idx) => (
              <div key={`${book.seriesId}-${book.bookNumber}`} className="w-full max-w-[252px]">
                <BookCard
                  book={book}
                  className={`anim-fade-up delay-${Math.min(idx + 1, 8)}`}
                  onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
