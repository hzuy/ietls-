import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumb from '../components/common/Breadcrumb'
import { FolderArchive } from 'lucide-react'
import ContentCard from '../components/common/ContentCard'
import AcademicCover from '../components/common/AcademicCover'
import Card from '../components/common/Card'
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
          ? { label: 'Chi tiết đề thi' }
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



// Đợt 3 — Việc 4: thay carousel cuộn ngang + kéo chuột (nút mũi tên tròn nổi
// bóng, cảm giác kệ trưng bày) bằng lưới co giãn tự xuống dòng — trang này
// (/full-test) vốn đã là trang liệt kê ĐẦY ĐỦ nên không cần cap/"Xem tất cả":
// ít bộ đề → lưới không tràn; nhiều bộ đề → tự xuống dòng thay vì phải cuộn.
function SeriesSection({ title, count, children }) {
  return (
    <section className="mb-12">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-soft)', margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>{count}</span>
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
            <button className="btn-primary px-8 py-3 font-bold text-sm" onClick={() => window.location.reload()}>Thử lại</button>
          </Card>
        ) : loading ? (
          <div className="flex flex-col gap-12">
            {[1, 2].map(i => (
              <div key={i}>
                <div className="h-7 w-48 bg-zinc-200 animate-pulse rounded-md mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {[1, 2, 3, 4, 5].map(j => (
                    <SkeletonCard key={j} aspect="4/5" />
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
            <SeriesSection
              key={series.name}
              title={series.name}
              count={`${series.books.length} cuốn`}
            >
              {series.books.map(book => (
                <SeriesCard
                  key={`${book.seriesId}-${book.bookNumber}`}
                  item={book}
                  onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                />
              ))}
            </SeriesSection>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Card "sắp có bài" — chỉ làm xám ảnh thumb, không ảnh hưởng title/nút */
        .ft-series-card--soon .cc-thumb img { filter: grayscale(0.5); }
      `}} />
    </div>
  )
}
