import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumb from '../components/common/Breadcrumb'
import { FolderArchive } from 'lucide-react'
import BookCard from '../components/common/BookCard'
import Card from '../components/common/Card'
import PillButton from '../components/common/PillButton'
import { UserCardGridSkeleton } from '../components/skeletons'
import { BACKEND_URL } from '../utils/media'
import { queryClient } from '../lib/queryClient'
import { fullTestsQueryOptions } from '../hooks/useCatalog'



// Đợt 3 — Việc 4: thay carousel cuộn ngang + kéo chuột (nút mũi tên tròn nổi
// bóng, cảm giác kệ trưng bày) bằng lưới co giãn tự xuống dòng — trang này
// (/full-test) vốn đã là trang liệt kê ĐẦY ĐỦ nên không cần cap/"Xem tất cả":
// ít bộ đề → lưới không tràn; nhiều bộ đề → tự xuống dòng thay vì phải cuộn.
function SeriesSection({ title, count, children }) {
  return (
    <section className="mb-12">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-soft)', margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', whiteSpace: 'nowrap', flexShrink: 0 }}>{count}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {children}
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
    queryClient.fetchQuery(fullTestsQueryOptions)
      .then(data => {
        const booksMap = data.reduce((acc, item) => {
          const bKey = `${item.seriesId}-${item.bookNumber}`
          if (!acc[bKey]) {
            acc[bKey] = {
              seriesId: item.seriesId,
              seriesName: item.seriesName,
              bookNumber: item.bookNumber,
              coverImageUrl: item.coverImageUrl,
              testNumbers: new Set(),
              skillTestCount: 0,
              attemptCount: 0
            }
          }
          acc[bKey].testNumbers.add(item.testNumber)
          if (item.exams) {
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

        const normalizedBooks = Object.values(booksMap).map(b => ({
          ...b,
          testCount: b.skillTestCount > 0 ? b.skillTestCount : b.testNumbers.size,
          attemptCount: b.attemptCount || 0,
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

      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Phòng thi chuẩn hóa' }]} />
      </div>

      <div className="app-container pt-4 pb-16 relative">
        {fetchError ? (
          <Card className="text-center py-20 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</p>
            <p className="text-zinc-500 mb-6 max-w-sm text-sm">Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
            <PillButton onClick={() => window.location.reload()}>Thử lại</PillButton>
          </Card>
        ) : loading ? (
          <div className="flex flex-col gap-12">
            {[1, 2].map(i => (
              <div key={i}>
                <div className="h-7 w-48 bg-zinc-200/90 animate-pulse rounded-md mb-6" />
                <UserCardGridSkeleton aspect="3/2" count={5} />
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
            <SeriesSection
              key={series.name}
              title={series.name}
              count={`${series.books.length} cuốn`}
            >
              {series.books.map(book => (
                <div key={`${book.seriesId}-${book.bookNumber}`} className="w-full max-w-[252px]">
                  <BookCard
                    book={book}
                    onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                  />
                </div>
              ))}
            </SeriesSection>
          ))
        )}
      </div>
    </div>
  )
}
