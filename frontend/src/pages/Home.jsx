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
    <div className="min-h-screen">
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200">
        {/* Scattered dot pattern */}
        <div className="bg-dots" aria-hidden="true" />

        <div className="app-container section-py relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16">

            {/* Left — text block */}
            <div className="flex-1 anim-fade-up" style={{ maxWidth: '44ch' }}>
              <h1 className="mb-5 font-extrabold" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-4xl)', color: 'var(--ink)', lineHeight: 1.05 }}>
                Luyện thi <span style={{ color: 'var(--primary)' }}>IELTS</span>{' '}
                chuyên nghiệp cùng AI
              </h1>
              <p className="leading-relaxed mb-2" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-lg)', color: 'var(--muted)' }}>
                Kho đề thi thực tế từ Cambridge, chấm điểm và nhận xét chi tiết bằng trí tuệ nhân tạo.
              </p>
              <p className="mb-8" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', color: 'var(--subtle)' }}>
                Nâng band thần tốc ngay hôm nay.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="btn-primary" onClick={() => navigate('/cambridge')}>Bắt đầu ngay</button>
                <button className="btn-secondary" onClick={() => navigate('/full-test')}>Xem bộ đề</button>
              </div>
            </div>

            {/* Right — AI Neural Network (desktop only) */}
            <div className="hidden md:flex items-center justify-center flex-shrink-0 anim-fade-in delay-2" aria-hidden="true">
              <div className="hero-net-wrap">
                <svg className="hero-net-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <defs>
                    <radialGradient id="net-core-grad" cx="35%" cy="30%" r="70%" fx="35%" fy="30%">
                      <stop offset="0%"   style={{stopColor:'var(--net-grad-0)'}} />
                      <stop offset="50%"  style={{stopColor:'var(--net-grad-50)'}} />
                      <stop offset="100%" style={{stopColor:'var(--net-grad-100)'}} />
                    </radialGradient>
                    {/* Glow blur for core halo */}
                    <filter id="net-glow-f" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="10" />
                    </filter>
                    {/* Bloom for data-flow dots */}
                    <filter id="net-dot-f" x="-200%" y="-200%" width="500%" height="500%">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>

                  {/* ── Orbit group — entire constellation rotates CW 30s ── */}
                  <g className="net-orbit">
                    {/* Spokes: Core(200,200) → each satellite */}
                    <line x1="200" y1="200" x2="281" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    <line x1="200" y1="200" x2="119" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    <line x1="200" y1="200" x2="119" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    <line x1="200" y1="200" x2="281" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    {/* Diamond ring CW: S1(281,119)→S4(281,281)→S3(119,281)→S2(119,119)→S1 */}
                    <line x1="281" y1="119" x2="281" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    <line x1="281" y1="281" x2="119" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    <line x1="119" y1="281" x2="119" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    <line x1="119" y1="119" x2="281" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
                    {/* Diagonal S1→S3 — dimmer, dashed, no data-flow dot */}
                    <line x1="281" y1="119" x2="119" y2="281" stroke="var(--net-line-dim)" strokeWidth="1" strokeDasharray="4 3" />

                    {/* Data-flow dots — outward on spokes (4 dots, staggered) */}
                    <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path="M200,200 L281,119" />
                    </circle>
                    <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="2.2s" begin="-1.65s" repeatCount="indefinite" path="M200,200 L119,119" />
                    </circle>
                    <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="2.2s" begin="-0.55s" repeatCount="indefinite" path="M200,200 L119,281" />
                    </circle>
                    <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="2.2s" begin="-1.1s" repeatCount="indefinite" path="M200,200 L281,281" />
                    </circle>
                    {/* Data-flow dots — CW on diamond ring (4 dots evenly staggered) */}
                    <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="7s" repeatCount="indefinite"
                        path="M281,119 L281,281 L119,281 L119,119 L281,119" />
                    </circle>
                    <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="7s" begin="-1.75s" repeatCount="indefinite"
                        path="M281,119 L281,281 L119,281 L119,119 L281,119" />
                    </circle>
                    <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="7s" begin="-3.5s" repeatCount="indefinite"
                        path="M281,119 L281,281 L119,281 L119,119 L281,119" />
                    </circle>
                    <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
                      <animateMotion dur="7s" begin="-5.25s" repeatCount="indefinite"
                        path="M281,119 L281,281 L119,281 L119,119 L281,119" />
                    </circle>

                    {/* Decorator dots at orbit r=72 */}
                    <circle cx="272" cy="200" r="4.5" fill="var(--net-dec-fill)" />
                    <circle cx="200" cy="128" r="4.5" fill="var(--net-dec-fill)" />
                    <circle cx="128" cy="200" r="4.5" fill="var(--net-dec-fill)" />
                    <circle cx="200" cy="272" r="4.5" fill="var(--net-dec-fill)" />

                    {/* S1 — Listening (top-right 281,119) */}
                    <circle cx="281" cy="119" r="26" fill="var(--net-node-bg)" stroke="var(--net-node-border)" strokeWidth="1.5" />
                    {/* net-icon-counter: bounding box = (269,107,24,24) → center = (281,119) = node center ✓ */}
                    <g className="net-icon-counter">
                      <svg x="269" y="107" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="var(--net-node-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>
                      </svg>
                    </g>

                    {/* S2 — Reading (top-left 119,119) */}
                    <circle cx="119" cy="119" r="26" fill="var(--net-node-bg)" stroke="var(--net-node-border)" strokeWidth="1.5" />
                    {/* bounding box = (107,107,24,24) → center = (119,119) ✓ */}
                    <g className="net-icon-counter">
                      <svg x="107" y="107" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="var(--net-node-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v16"/>
                        <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>
                      </svg>
                    </g>

                    {/* S3 — Writing (bottom-left 119,281) */}
                    <circle cx="119" cy="281" r="26" fill="var(--net-node-bg)" stroke="var(--net-node-border)" strokeWidth="1.5" />
                    {/* bounding box = (107,269,24,24) → center = (119,281) ✓ */}
                    <g className="net-icon-counter">
                      <svg x="107" y="269" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="var(--net-node-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/>
                        <path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/>
                        <path d="m2.3 2.3 7.286 7.286"/>
                        <circle cx="11" cy="11" r="2"/>
                      </svg>
                    </g>

                    {/* S4 — Speaking (bottom-right 281,281) */}
                    <circle cx="281" cy="281" r="26" fill="var(--net-node-bg)" stroke="var(--net-node-border)" strokeWidth="1.5" />
                    {/* bounding box = (269,269,24,24) → center = (281,281) ✓ */}
                    <g className="net-icon-counter">
                      <svg x="269" y="269" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="var(--net-node-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19v3"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <rect x="9" y="2" width="6" height="13" rx="3"/>
                      </svg>
                    </g>
                  </g>

                  {/* ── Core — static, always centered at (200,200) ── */}
                  <g className="net-core-breathe">
                    {/* Glow halo — blurred, animates opacity */}
                    <circle cx="200" cy="200" r="54" fill="var(--net-core-glow)"
                      className="net-glow-halo" filter="url(#net-glow-f)" opacity="0.5" />
                    {/* Sphere */}
                    <circle cx="200" cy="200" r="38"
                      fill="url(#net-core-grad)" stroke="var(--net-core-border)" strokeWidth="1.5" />
                    {/* BrainCircuit icon — 34×34, centered at (200,200); no rotation applied */}
                    <svg x="183" y="183" width="34" height="34" viewBox="0 0 24 24" fill="none"
                      stroke="var(--net-core-icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                      <path d="M9 13a4.5 4.5 0 0 0 3-4"/>
                      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                      <path d="M12 13h4"/>
                      <path d="M12 18h6a2 2 0 0 1 2 2v1"/>
                      <path d="M12 8h8"/>
                      <path d="M16 8V5a2 2 0 0 1 2-2"/>
                      <circle cx="16" cy="13" r=".5" fill="var(--net-core-icon)" stroke="none"/>
                      <circle cx="18" cy="3"  r=".5" fill="var(--net-core-icon)" stroke="none"/>
                      <circle cx="20" cy="21" r=".5" fill="var(--net-core-icon)" stroke="none"/>
                      <circle cx="20" cy="8"  r=".5" fill="var(--net-core-icon)" stroke="none"/>
                    </svg>
                  </g>
                </svg>
              </div>
            </div>

          </div>
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
