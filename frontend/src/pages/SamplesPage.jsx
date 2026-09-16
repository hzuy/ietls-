import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Breadcrumb from '../components/common/Breadcrumb'
import ContentCard from '../components/common/ContentCard'
import AcademicCover from '../components/common/AcademicCover'
import Card from '../components/common/Card'
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

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left px-3.5 py-2 rounded-full border-none cursor-pointer text-[13px] font-medium transition-all duration-200 ${
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

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const selectedLevel = searchParams.get(meta.paramKey) || ''
  const selectedType = searchParams.get('type') || ''

  useEffect(() => {
    document.title = meta.title
    setSamples([])
    setLoading(true)
    setError(false)
    fetch(API_BASE + `/samples/${skill}?limit=0`)
      .then(r => {
        if (!r.ok) throw new Error('API Error')
        return r.json()
      })
      .then(data => { setSamples(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [skill, meta.title])

  const examTypes = useMemo(() => {
    const set = new Set(samples.map(s => s.examType).filter(Boolean))
    return [...set].sort()
  }, [samples])

  const filtered = useMemo(() => {
    return samples.filter(s => {
      if (selectedLevel && s.level !== selectedLevel) return false
      if (selectedType && s.examType !== selectedType) return false
      return true
    })
  }, [samples, selectedLevel, selectedType])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: meta.breadcrumbLabel }]} />
      </div>

      {/* Body */}
      <div className="app-container pt-4 pb-16 flex gap-8 items-start">
        {/* Sidebar */}
        <Card as="aside" className="w-56 shrink-0 p-5 sticky top-24">
          {/* Level filter (Task/Part) */}
          <div className="mb-6">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-3">{meta.groupLabel}</p>
            <div className="flex flex-col gap-1">
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
              <div className="flex flex-col gap-1">
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
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-[14px] text-zinc-600 mr-2 flex items-center">
              {loading ? <div className="h-4 w-20 bg-zinc-200 animate-pulse rounded" /> : `${filtered.length} bài mẫu`}
            </span>
            {selectedLevel && (
              <span
                className="text-[12px] font-semibold px-3 py-1 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 cursor-pointer hover:bg-zinc-200 transition-colors"
                onClick={() => setFilter(meta.paramKey, '')}
              >{cfg.levelLabels[selectedLevel] || cfg.levelFallback} ×</span>
            )}
            {selectedType && (
              <span
                className="text-[12px] font-semibold px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 cursor-pointer hover:bg-zinc-200 transition-colors"
                onClick={() => setFilter('type', '')}
              >{selectedType} ×</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="card-base flex flex-col h-full overflow-hidden">
                  <div className="w-full aspect-video shrink-0 bg-zinc-200 animate-pulse" />
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div className="h-4 bg-zinc-200 animate-pulse rounded w-[80%]" />
                    <div className="h-4 bg-zinc-200 animate-pulse rounded w-[50%]" />
                    <div className="mt-auto flex gap-2 pt-2">
                      <div className="h-5 w-16 bg-zinc-200 animate-pulse rounded-full" />
                      <div className="h-5 w-20 bg-zinc-200 animate-pulse rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <Card className="text-center py-16 px-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <p className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</p>
              <p className="text-sm text-zinc-500 mb-6 max-w-sm">Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
              <button className="btn-primary px-8 py-3 text-sm font-bold" onClick={() => window.location.reload()}>Thử lại</button>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-16 px-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <p className="text-lg font-bold text-zinc-900 mb-2">Không tìm thấy bài mẫu phù hợp</p>
              <p className="text-sm text-zinc-500 mb-6 max-w-sm">Hãy thử thay đổi từ khóa hoặc lựa chọn dạng bài khác.</p>
              <button className="btn-secondary px-6 py-2.5 text-sm font-bold" onClick={() => setSearchParams(new URLSearchParams())}>Xóa bộ lọc</button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item, i) => (
                <div key={item.id} className={`anim-fade-up delay-${Math.min(i + 1, 8)}`}>
                  <ContentCard
                    className="h-full"
                    image={resolveImg(item.thumbnailUrl)}
                    imageAlt={item.title}
                    academicCover={
                      <AcademicCover
                        title={item.title}
                        subtitle={cfg.levelLabels[item.level] || cfg.levelFallback}
                        skill={skill}
                      />
                    }
                    thumbAspect="16/9"
                    title={item.title}
                    meta={{ type: 'chips', chips: buildSampleChips(skill, item) }}
                    hoverStyle="subtle"
                    onClick={() => navigate(`/samples/${skill}/${item.id}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
