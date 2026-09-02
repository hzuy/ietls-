import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Breadcrumb from '../components/common/Breadcrumb'
import ContentCard from '../components/common/ContentCard'
import { CONTENT_CARD_CONFIG, buildSampleChips } from '../components/common/contentCardConfig'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const PART_OPTIONS = [
  { value: 'task1', label: 'Part 1' },
  { value: 'task2', label: 'Part 2' },
  { value: 'task3', label: 'Part 3' },
]

const PART_LABELS = { task1: 'Part 1', task2: 'Part 2', task3: 'Part 3' }

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left px-3 py-2 rounded-xl border-none cursor-pointer text-[13px] font-medium transition-all duration-300 ${
        active 
          ? 'bg-blue-50 text-blue-700 font-bold' 
          : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {children}
    </button>
  )
}

export default function SpeakingSamplesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const selectedPart = searchParams.get('part') || ''
  const selectedType = searchParams.get('type') || ''

  useEffect(() => {
    document.title = 'Bài mẫu Speaking | IELTS Pro'
    fetch(API_BASE + '/samples/speaking?limit=0')
      .then(r => {
        if (!r.ok) throw new Error('API Error')
        return r.json()
      })
      .then(data => { setSamples(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const examTypes = useMemo(() => {
    const set = new Set(samples.map(s => s.examType).filter(Boolean))
    return [...set].sort()
  }, [samples])

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
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Speaking Samples' }]} />
      </div>

      {/* Body */}
      <div className="app-container pt-4 pb-16 flex gap-8 items-start">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-white rounded-2xl border border-slate-200 p-5 sticky top-24 shadow-sm">
          {/* Part filter */}
          <div className="mb-6">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-3" style={{ fontFamily: 'var(--font-body)' }}>Part</p>
            <div className="flex flex-col gap-1">
              <FilterBtn active={!selectedPart} onClick={() => setFilter('part', '')}>Tất cả</FilterBtn>
              {PART_OPTIONS.map(opt => (
                <FilterBtn key={opt.value} active={selectedPart === opt.value} onClick={() => setFilter('part', selectedPart === opt.value ? '' : opt.value)}>
                  {opt.label}
                </FilterBtn>
              ))}
            </div>
          </div>

          {/* Dạng bài filter */}
          {examTypes.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-3" style={{ fontFamily: 'var(--font-body)' }}>Dạng bài</p>
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
        </aside>

        {/* Grid */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-[14px] text-slate-600 mr-2 flex items-center" style={{ fontFamily: 'var(--font-body)' }}>
              {loading ? <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /> : `${filtered.length} bài mẫu`}
            </span>
            {selectedPart && (
              <span
                className="text-[12px] font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
                onClick={() => setFilter('part', '')}
              >{PART_LABELS[selectedPart]} ×</span>
            )}
            {selectedType && (
              <span
                className="text-[12px] font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
                onClick={() => setFilter('type', '')}
              >{selectedType} ×</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="card-base flex flex-col h-full overflow-hidden">
                  <div className="w-full aspect-video shrink-0 bg-slate-200 animate-pulse" />
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div className="h-4 bg-slate-200 animate-pulse rounded w-[80%]" />
                    <div className="h-4 bg-slate-200 animate-pulse rounded w-[50%]" />
                    <div className="mt-auto flex gap-2 pt-2">
                      <div className="h-5 w-16 bg-slate-200 animate-pulse rounded-full" />
                      <div className="h-5 w-20 bg-slate-200 animate-pulse rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <p className="text-[18px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Không thể tải dữ liệu</p>
              <p className="text-[14px] text-slate-600 mb-6 max-w-sm" style={{ fontFamily: 'var(--font-body)' }}>Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
              <button className="btn-primary px-8 py-3 text-[14px] font-bold" onClick={() => window.location.reload()}>Thử lại</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <p className="text-[18px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Không tìm thấy bài mẫu phù hợp</p>
              <p className="text-[14px] text-slate-600 mb-6 max-w-sm" style={{ fontFamily: 'var(--font-body)' }}>Hãy thử thay đổi từ khóa hoặc lựa chọn dạng bài khác.</p>
              <button className="btn-secondary px-6 py-2.5 text-[14px] font-bold" onClick={() => setSearchParams(new URLSearchParams())}>Xóa bộ lọc</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item, i) => (
                <div key={item.id} className={`anim-fade-up delay-${Math.min(i + 1, 8)}`}>
                  <ContentCard
                    className="h-full"
                    image={resolveImg(item.thumbnailUrl)}
                    imageAlt={item.title}
                    placeholder={CONTENT_CARD_CONFIG.speaking.placeholder}
                    thumbAspect="16/9"
                    title={item.title}
                    meta={{ type: 'chips', chips: buildSampleChips('speaking', item) }}
                    hoverStyle="subtle"
                    onClick={() => navigate(`/samples/speaking/${item.id}`)}
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
