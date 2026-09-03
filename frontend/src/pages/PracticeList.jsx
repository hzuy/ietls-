import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Breadcrumb from '../components/common/Breadcrumb'
import ContentCard from '../components/common/ContentCard'
import { CONTENT_CARD_CONFIG } from '../components/common/contentCardConfig'
import { getTypesBySkill } from '../utils/questionTypes'
import { API_BASE, resolveImg } from '../utils/media'

const SKILL_META = {
  reading: {
    icon: '📖',
    label: 'Reading Practice',
    sub: '3 đoạn văn · 40 câu hỏi · 60 phút',
    colorVar: '--skill-r-color',
    bgVar: '--skill-r-bg',
    borderVar: '--skill-r-border',
    path: '/practice/reading',
  },
  listening: {
    icon: '🎧',
    label: 'Listening Practice',
    sub: '4 phần · 40 câu hỏi · 30 phút',
    colorVar: '--skill-l-color',
    bgVar: '--skill-l-bg',
    borderVar: '--skill-l-border',
    path: '/practice/listening',
  },
}

function SkeletonCard() {
  return (
    <div className="card-base flex flex-col h-full overflow-hidden">
      <div className="w-full h-40 shrink-0 bg-slate-200 animate-pulse" />
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="h-[44px] bg-slate-200 animate-pulse rounded w-full" />
        <div className="h-5 bg-slate-200 animate-pulse rounded w-[55%] mt-auto" />
        <div className="h-9 bg-slate-200 animate-pulse rounded-xl mt-2" />
      </div>
    </div>
  )
}

export default function PracticeList({ skill: skillKey }) {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const skill = SKILL_META[skillKey] ? skillKey : 'reading'
  const meta = SKILL_META[skill]
  const availableTypes = getTypesBySkill(skill)

  useEffect(() => {
    setLoading(true)
    setError(false)
    document.title = 'Luyện tập Kỹ năng | IELTS Pro'
    fetch(`${API_BASE}/practice/${skill}?limit=0`)
      .then(r => {
        if (!r.ok) throw new Error('API Error')
        return r.json()
      })
      .then(data => { setExams(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [skill])

  const groupedExams = availableTypes.map(type => ({
    ...type,
    items: exams.filter(e => e.type === type.key)
  })).filter(group => group.items.length > 0)

  const otherExams = exams.filter(e => !availableTypes.some(t => t.key === e.type))

  const renderCard = (item, idx) => (
    <div key={item.id} className={`anim-fade-up delay-${Math.min(idx + 1, 8)}`}>
      <ContentCard
        className="h-full"
        image={resolveImg(item.thumbnailUrl)}
        imageAlt={item.title}
        placeholder={CONTENT_CARD_CONFIG[skill].placeholder}
        thumbAspect="160px"
        title={item.title}
        titleClamp={2}
        meta={item.questionCount > 0 ? { type: 'count', text: `${item.questionCount} câu hỏi` } : undefined}
        action={{ label: 'Làm bài →', decorative: true }}
        hoverStyle="subtle"
        onClick={() => navigate(`/practice/${skill}/${item.id}`)}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Breadcrumb */}
      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Practice' }, { label: meta?.label || 'Reading' }]} />
      </div>

      {/* Content */}
      <div className="app-container pt-4 pb-16 flex flex-col gap-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[0,1,2,3,4,5,6,7].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-20 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-[18px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Không thể tải dữ liệu</p>
            <p className="text-slate-600 mb-6 max-w-sm" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)' }}>Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
            <button className="btn-primary px-8 py-3 font-bold" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => window.location.reload()}>Thử lại</button>
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-20 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <p className="text-[18px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Không tìm thấy bài luyện tập</p>
            <p className="text-slate-600 mb-6 max-w-sm" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)' }}>Hãy thử lựa chọn cấp độ hoặc kỹ năng khác.</p>
            <button className="btn-primary px-6 py-2.5 font-bold" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => navigate('/')}>Về trang chủ</button>
          </div>
        ) : (
          <>
            {groupedExams.map((group) => (
              <section key={group.key}>
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-[20px] font-bold text-slate-900 m-0" style={{ fontFamily: 'var(--font-display)' }}>{group.label}</h2>
                  <span className="font-mono font-bold bg-white text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full shadow-sm" style={{ fontSize: 'var(--fs-xs)' }}>
                    {group.items.length} bài
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                  {group.items.map((item, idx) => renderCard(item, idx))}
                </div>
              </section>
            ))}

            {otherExams.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-[20px] font-bold text-slate-900 m-0" style={{ fontFamily: 'var(--font-display)' }}>Dạng bài khác</h2>
                  <span className="font-mono font-bold bg-white text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full shadow-sm" style={{ fontSize: 'var(--fs-xs)' }}>
                    {otherExams.length} bài
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                  {otherExams.map((item, idx) => renderCard(item, idx))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
