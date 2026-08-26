import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import BookCard from '../components/home/BookCard'
import PracticeCard from '../components/home/PracticeCard'
import SectionHeader from '../components/home/SectionHeader'
import SeriesCarousel from '../components/home/SeriesCarousel'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'

const SKILL_CARDS = [
  {
    key: 'reading',
    icon: '📖',
    label: 'Reading',
    desc: '3 passages · 40 câu · 60 phút',
    colorVar: '--skill-r-color',
    bgVar: '--skill-r-bg',
    borderVar: '--skill-r-border',
    to: '/practice/reading',
  },
  {
    key: 'listening',
    icon: '🎧',
    label: 'Listening',
    desc: '4 sections · 40 câu · 40 phút',
    colorVar: '--skill-l-color',
    bgVar: '--skill-l-bg',
    borderVar: '--skill-l-border',
    to: '/practice/listening',
  },
  {
    key: 'writing',
    icon: '✍️',
    label: 'Writing',
    desc: 'Task 1 + Task 2 · AI chấm điểm',
    colorVar: '--skill-w-color',
    bgVar: '--skill-w-bg',
    borderVar: '--skill-w-border',
    to: '/writing-samples',
  },
  {
    key: 'speaking',
    icon: '🎤',
    label: 'Speaking',
    desc: 'Part 1+2+3 · AI nhận xét',
    colorVar: '--skill-s-color',
    bgVar: '--skill-s-bg',
    borderVar: '--skill-s-border',
    to: '/speaking-samples',
  },
]

function SkeletonCard() {
  return (
    <div className="card-flat overflow-hidden flex flex-col h-full">
      <div className="w-full h-40 shrink-0 skeleton" />
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="h-4 skeleton rounded mb-1 w-full" />
        <div className="h-3 skeleton rounded w-[65%] mt-auto" />
        <div className="h-9 skeleton rounded-lg mt-2" />
      </div>
    </div>
  )
}

function HomeSectionError() {
  return (
    <div className="col-span-full w-full text-center py-10 px-6 bg-slate-50 rounded-[var(--radius-lg)] border border-slate-200 flex flex-col items-center">
      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4 text-slate-400">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <p className="font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-base)' }}>Lỗi tải dữ liệu</p>
      <p className="mb-4 max-w-sm" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>Không thể kết nối máy chủ.</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>Thử lại</button>
    </div>
  )
}

/* SkillCard — hover effects via CSS (.skill-card / .skill-card-* classes),
   no JS state required. Skill colors passed as CSS custom props. */
function SkillCard({ skill, animClass }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(skill.to)}
      className={`${animClass} skill-card card-interactive h-full flex flex-col overflow-hidden`}
      style={{ '--_skill-bg': `var(${skill.bgVar})`, '--_skill-color': `var(${skill.colorVar})` }}
    >
      <div
        className="w-full h-40 shrink-0 relative flex items-center justify-center"
        style={{ background: `var(${skill.bgVar})` }}
      >
        <span className="skill-card-icon text-5xl">{skill.icon}</span>
        <div
          className="skill-card-bar absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: `var(${skill.colorVar})` }}
        />
      </div>
      <div className="p-4 flex flex-1 flex-col">
        <h3 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 700, color: `var(${skill.colorVar})` }}>
          {skill.label}
        </h3>
        <p className="leading-snug" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
          {skill.desc}
        </p>
        <button className="skill-card-action mt-auto w-full py-2.5 rounded-lg border-none font-bold cursor-pointer"
          style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', minHeight: 44 }}
        >
          Luyện tập ngay
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const [fullTestsData, setFullTestsData] = useState(null)
  const [reading, setReading] = useState(null)
  const [listening, setListening] = useState(null)
  const [writingSamples, setWritingSamples] = useState(null)
  const [speakingSamples, setSpeakingSamples] = useState(null)

  useEffect(() => {
    document.title = 'IELTS Pro — Hệ sinh thái luyện thi thông minh'
    const get = (path) => fetch(API_BASE + path).then(r => {
      if (!r.ok) throw new Error('API Error')
      return r.json()
    }).catch(() => 'error')

    fetch(`${BACKEND_URL}/api/admin/full-tests`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => {
      if (!r.ok) throw new Error('API Error')
      return r.json()
    }).then(setFullTestsData).catch(() => setFullTestsData('error'))

    get('/practice/reading').then(setReading)
    get('/practice/listening').then(setListening)
    get('/samples/writing?limit=4').then(setWritingSamples)
    get('/samples/speaking?limit=4').then(setSpeakingSamples)
  }, [])

  const groupedFullTests = useMemo(() => {
    if (!fullTestsData || fullTestsData === 'error') return []
    const booksMap = fullTestsData.reduce((acc, item) => {
      const bKey = `${item.seriesId}-${item.bookNumber}`
      if (!acc[bKey]) {
        acc[bKey] = { seriesId: item.seriesId, seriesName: item.seriesName, bookNumber: item.bookNumber, coverImageUrl: item.coverImageUrl, testNumbers: new Set() }
      }
      acc[bKey].testNumbers.add(item.testNumber)
      return acc
    }, {})
    const normalizedBooks = Object.values(booksMap).map(b => ({ ...b, testCount: b.testNumbers.size, title: `${b.seriesName} ${b.bookNumber}` }))
    const rows = normalizedBooks.reduce((acc, book) => {
      const sId = book.seriesId
      if (!acc[sId]) acc[sId] = { seriesId: sId, seriesName: book.seriesName, books: [] }
      acc[sId].books.push(book)
      return acc
    }, {})
    return Object.values(rows).map(r => ({ ...r, books: r.books.sort((a, b) => b.bookNumber - a.bookNumber) }))
  }, [fullTestsData])

  const requireAuth = (path) => { if (user) navigate(path); else openAuthModal('login') }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200" style={{ background: '#EEF2FF' }}>
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-96 h-96 rounded-full" style={{ background: 'rgba(37,99,235,0.06)' }} aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full" style={{ background: 'rgba(37,99,235,0.04)' }} aria-hidden="true" />

        <div className="app-container section-py relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex-1 anim-fade-up">
              <h1 className="mb-5 leading-tight font-extrabold" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-4xl)', color: '#111827' }}>
                Luyện thi <span style={{ color: 'var(--primary)' }}>IELTS</span> chuyên nghiệp cùng AI
              </h1>
              <p className="max-w-lg leading-relaxed mb-2" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-lg)', color: 'var(--muted)' }}>
                Kho đề thi thực tế từ Cambridge, hỗ trợ chấm điểm và nhận xét chi tiết bằng trí tuệ nhân tạo.
              </p>
              <p className="mb-8" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', color: 'var(--subtle)' }}>
                Nâng band thần tốc ngay hôm nay.
              </p>
              <button className="btn-primary" onClick={() => navigate('/cambridge')}>Bắt đầu ngay</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Full Test CTA Banner ─────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ink)' }}>
        <div className="app-container flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ paddingBlock: 'clamp(1.5rem, 4vw, 2rem)' }}>
          <div>
            <p className="mb-1.5 font-semibold tracking-widest uppercase" style={{ fontSize: 'var(--fs-xs)', color: '#7AB3FF', letterSpacing: '0.08em' }}>
              IELTS FULL TEST
            </p>
            <h2 className="font-bold text-white mb-1.5" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', margin: 0 }}>
              Luyện thi trọn bộ 4 kỹ năng
            </h2>
            <p style={{ fontSize: 'var(--fs-sm)', color: '#8BA5C8', fontFamily: 'var(--font-body)', margin: 0 }}>
              Bộ đề Cambridge chính thức — đánh giá toàn diện Listening, Reading, Writing, Speaking
            </p>
          </div>
          <button onClick={() => navigate('/full-test')} className="btn-primary shrink-0">
            Xem tất cả bộ đề →
          </button>
        </div>
      </section>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="app-container section-py flex flex-col gap-16">

        {/* Full Tests: Cambridge & Practice Plus */}
        {fullTestsData === 'error' ? (
          <section>
            <SectionHeader title="IELTS Full Test" count="Lỗi" to="/cambridge" />
            <div className="grid grid-cols-1 mt-6"><HomeSectionError /></div>
          </section>
        ) : groupedFullTests.length > 0 && (
          <>
            {groupedFullTests.map(series => (
              <SeriesCarousel key={series.seriesId} title={series.seriesName} count={`${series.books.length} cuốn`} to="/full-test">
                {series.books.map((book, i) => (
                  <div key={book.title} className="flex-shrink-0 shrink-0 w-[180px] sm:w-[200px]" style={{ scrollSnapAlign: 'start' }}>
                    <BookCard book={book} animClass={`anim-fade-up delay-${i % 4 + 1}`} onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)} />
                  </div>
                ))}
              </SeriesCarousel>
            ))}
          </>
        )}

        {/* IELTS Reading Practice */}
        <section>
          <SectionHeader title="IELTS Reading Practice" to="/practice/reading" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6">
            {reading === null ? [0,1,2,3].map(i => <SkeletonCard key={i} />) :
             reading === 'error' ? <HomeSectionError /> :
             reading.slice(0, 4).map((item, i) => (
               <PracticeCard key={item.id} item={item} skill="reading" animClass={`anim-fade-up delay-${i + 1}`}
                 onAction={() => requireAuth(`/practice/reading/${item.id}`)} />
             ))}
          </div>
        </section>

        {/* IELTS Listening Practice */}
        <section>
          <SectionHeader title="IELTS Listening Practice" to="/practice/listening" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6">
            {listening === null ? [0,1,2,3].map(i => <SkeletonCard key={i} />) :
             listening === 'error' ? <HomeSectionError /> :
             listening.slice(0, 4).map((item, i) => (
               <PracticeCard key={item.id} item={item} skill="listening" animClass={`anim-fade-up delay-${i + 1}`}
                 onAction={() => requireAuth(`/practice/listening/${item.id}`)} />
             ))}
          </div>
        </section>

        {/* IELTS Writing Samples */}
        {(writingSamples === 'error' || writingSamples === null || (writingSamples && writingSamples.length > 0)) && (
          <section>
            <SectionHeader title="IELTS Writing Samples" to="/writing-samples" />
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6">
              {writingSamples === null ? [0,1,2,3].map(i => <SkeletonCard key={i} />) :
               writingSamples === 'error' ? <HomeSectionError /> :
               writingSamples.slice(0, 4).map((item, i) => (
                 <PracticeCard key={item.id} item={item} skill="writing" animClass={`anim-fade-up delay-${i + 1}`}
                   actionLabel="Xem bài mẫu" onAction={() => navigate(`/samples/writing/${item.id}`)} />
               ))}
            </div>
          </section>
        )}

        {/* IELTS Speaking Samples */}
        {(speakingSamples === 'error' || speakingSamples === null || (speakingSamples && speakingSamples.length > 0)) && (
          <section>
            <SectionHeader title="IELTS Speaking Samples" to="/speaking-samples" />
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6">
              {speakingSamples === null ? [0,1,2,3].map(i => <SkeletonCard key={i} />) :
               speakingSamples === 'error' ? <HomeSectionError /> :
               speakingSamples.slice(0, 4).map((item, i) => (
                 <PracticeCard key={item.id} item={item} skill="speaking" animClass={`anim-fade-up delay-${i + 1}`}
                   actionLabel="Xem bài mẫu" onAction={() => navigate(`/samples/speaking/${item.id}`)} />
               ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
