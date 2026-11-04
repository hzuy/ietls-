import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import Breadcrumb from '../components/common/Breadcrumb'
import ContentCard from '../components/common/ContentCard'
import AcademicCover from '../components/common/AcademicCover'
import Card from '../components/common/Card'
import PillButton from '../components/common/PillButton'
import { UserCardGridSkeleton } from '../components/skeletons'
import { CONTENT_CARD_CONFIG, buildSampleChips } from '../components/common/contentCardConfig'
import { API_BASE, resolveImg } from '../utils/media'

// Việc 2 (Đợt 3): WritingSamplesPage.jsx và SpeakingSamplesPage.jsx trước đây
// là 2 file gần như copy-paste nhau (~88% giống hệt) — gộp lại đây, tham số
// hoá phần khác biệt qua `skill`. Options/label theo level (Task 1/Part 1...)
// lấy chung từ CONTENT_CARD_CONFIG (contentCardConfig.js) thay vì khai riêng
// từng trang — nhân tiện thống nhất luôn cách suy ra subtitle AcademicCover
// bằng lookup map an toàn (Writing trước đây dùng ternary cứng chỉ đúng với
// 2 giá trị level, khác Speaking đã dùng map).
const PAGE_META = {
  writing: {
    title: 'Bài mẫu Writing | IELTS Pro',
    breadcrumbLabel: 'Writing Samples',
    paramKey: 'task',
    groupLabel: 'Task',
  },
  speaking: {
    title: 'Bài mẫu Speaking | IELTS Pro',
    breadcrumbLabel: 'Speaking Samples',
    paramKey: 'part',
    groupLabel: 'Part',
  },
}

const PAGE_SIZE = 12

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ fontSize: 13 }}
      className={`inline-flex items-center shrink-0 whitespace-nowrap max-md:min-h-11 md:block md:w-full md:shrink md:whitespace-normal text-left px-3.5 py-2 rounded-full border-none cursor-pointer font-medium transition-all duration-200 ${
        active
          ? 'bg-zinc-100 text-zinc-900 font-semibold'
          : 'bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {children}
    </button>
  )
}

export default function SamplesPage({ skill }) {
  const meta = PAGE_META[skill]
  const cfg = CONTENT_CARD_CONFIG[skill]
  const levelOptions = useMemo(
    () => Object.entries(cfg.levelLabels).map(([value, label]) => ({ value, label })),
    [cfg]
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const [samples, setSamples] = useState([])
  const [examTypes, setExamTypes] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const selectedLevel = searchParams.get(meta.paramKey) || ''
  const selectedType = searchParams.get('type') || ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const searchQuery = searchParams.get('q') || ''
  const [searchValue, setSearchValue] = useState(searchQuery)

  useEffect(() => setSearchValue(searchQuery), [searchQuery])

  useEffect(() => {
    if (searchValue === searchQuery) return undefined
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (searchValue.trim()) next.set('q', searchValue.trim())
      else next.delete('q')
      next.delete('page')
      setSearchParams(next)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchValue, searchQuery, searchParams, setSearchParams])

  useEffect(() => {
    document.title = meta.title
    setSamples([])
    setLoading(true)
    setError(false)
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (searchQuery) query.set('search', searchQuery)
    if (selectedLevel) query.set('level', selectedLevel)
    if (selectedType) query.set('type', selectedType)
    fetch(`${API_BASE}/samples/${skill}?${query}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error('API Error')
        return r.json()
      })
      .then(data => { setSamples(data.items || []); setExamTypes(data.examTypes || []); setPagination(data.pagination || { page: 1, total: data.length, totalPages: 1 }); setLoading(false) })
      .catch(err => { if (err.name !== 'AbortError') { setError(true); setLoading(false) } })
    return () => controller.abort()
  }, [skill, meta.title, page, searchQuery, selectedLevel, selectedType])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  const setPage = value => {
    const next = new URLSearchParams(searchParams)
    if (value > 1) next.set('page', String(value))
    else next.delete('page')
    setSearchParams(next)
  }

  const clearFilters = () => {
    setSearchValue('')
    setSearchParams(new URLSearchParams())
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: meta.breadcrumbLabel }]} />
      </div>

      {/* Body */}
      <div className="app-container pt-4 pb-16 flex flex-col md:flex-row gap-4 md:gap-8 md:items-start">
        {/* Sidebar */}
        <Card as="aside" className="w-full p-4 md:w-56 md:shrink-0 md:p-5 md:sticky md:top-24">
          {/* Level filter (Task/Part) */}
          <div className="mb-4 md:mb-6">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-3">{meta.groupLabel}</p>
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:flex-col md:overflow-visible">
              <FilterBtn active={!selectedLevel} onClick={() => setFilter(meta.paramKey, '')}>Tất cả</FilterBtn>
              {levelOptions.map(opt => (
                <FilterBtn key={opt.value} active={selectedLevel === opt.value} onClick={() => setFilter(meta.paramKey, selectedLevel === opt.value ? '' : opt.value)}>
                  {opt.label}
                </FilterBtn>
              ))}
            </div>
          </div>

          {/* Dạng bài filter */}
          {examTypes.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-3">Dạng bài</p>
              <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:flex-col md:overflow-visible">
                <FilterBtn active={!selectedType} onClick={() => setFilter('type', '')}>Tất cả</FilterBtn>
                {examTypes.map(t => (
                  <FilterBtn key={t} active={selectedType === t} onClick={() => setFilter('type', selectedType === t ? '' : t)}>
                    {t}
                  </FilterBtn>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Grid */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <label className="relative flex-1">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="search"
                name="sample-search"
                autoComplete="off"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder={`Tìm bài mẫu ${skill === 'writing' ? 'Writing' : 'Speaking'}…`}
                aria-label="Tìm bài mẫu theo tiêu đề"
                className="w-full min-h-11 rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>

          <div className="mb-5">
            <span className="text-[14px] text-zinc-600 flex items-center" aria-live="polite">
              {loading ? <div className="h-4 w-20 bg-zinc-200 animate-pulse rounded" /> : `${pagination.total} bài mẫu`}
            </span>
          </div>

          {loading ? (
            <UserCardGridSkeleton aspect="16/9" count={6} hasPills={true} />
          ) : error ? (
            <Card className="text-center py-16 px-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <p className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</p>
              <p className="text-sm text-zinc-500 mb-6 max-w-sm">Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
              <PillButton onClick={() => window.location.reload()}>Thử lại</PillButton>
            </Card>
          ) : samples.length === 0 ? (
            <Card className="text-center py-16 px-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <p className="text-lg font-bold text-zinc-900 mb-2">Không tìm thấy bài mẫu phù hợp</p>
              <p className="text-sm text-zinc-500 mb-6 max-w-sm">Thử từ khóa khác hoặc bỏ bớt bộ lọc để xem thêm bài mẫu.</p>
              <PillButton variant="secondary" onClick={clearFilters}>Xóa bộ lọc</PillButton>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {samples.map((item, i) => (
                <div key={item.id} className={`anim-fade-up delay-${Math.min(i + 1, 8)}`}>
                  <ContentCard
                    className="h-full"
                    to={`/samples/${skill}/${item.id}`}
                    image={resolveImg(item.thumbnailUrl)}
                    imageAlt={item.title}
                    academicCover={
                      <AcademicCover
                        title={item.title}
                        subtitle={cfg.levelLabels[item.level] || cfg.levelFallback}
                        skill={skill}
                      />
                    }
                    thumbAspect="4/3"
                    title={item.title}
                    meta={{ type: 'chips', chips: buildSampleChips(skill, item) }}
                    hoverStyle="subtle"
                  />
                </div>
              ))}
            </div>
          )}

          {!loading && !error && pagination.totalPages > 1 && (
            <nav aria-label="Phân trang bài mẫu" className="mt-8 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <span className="text-sm text-zinc-600" aria-live="polite">Trang {page} / {pagination.totalPages}</span>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40">
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </main>
      </div>
    </div>
  )
}
