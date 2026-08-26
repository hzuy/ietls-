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
    <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden flex flex-col h-full">
      <div className="w-full h-40 shrink-0 bg-slate-200 animate-pulse" />
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="h-4 bg-slate-200 animate-pulse rounded mb-1 w-full" />
        <div className="h-3 bg-slate-200 animate-pulse rounded w-[65%] mt-auto" />
        <div className="h-9 bg-slate-200 animate-pulse rounded-lg mt-2" />
      </div>
    </div>
  )
}

function HomeSectionError() {
  return (
    <div className="col-span-full w-full text-center py-10 px-6 bg-slate-50 rounded-[20px] border border-slate-200 flex flex-col items-center">
      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4 text-slate-400">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      </div>
      <p className="text-[15px] font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Lỗi tải dữ liệu</p>
      <p className="text-[13px] text-slate-600 mb-4 max-w-sm" style={{ fontFamily: 'var(--font-body)' }}>Không thể kết nối máy chủ.</p>
      <button className="btn-primary px-6 py-2 text-[13px] font-bold" onClick={() => window.location.reload()}>Thử lại</button>
    </div>
  )
}

function HeroPrimaryBtn({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '13px 30px',
        background: hovered ? '#2563EB' : '#4D8EFF',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        fontWeight: 700,
        fontSize: '15px',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 12px 24px -4px rgba(37, 99, 235, 0.35)' : '0 4px 14px rgba(37, 99, 235, 0.25)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-body)',
      }}
    >
      Bắt đầu ngay
    </button>
  )
}

function SkillCard({ skill, animClass }) {
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(skill.to)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${animClass} card-base h-full flex flex-col`}
      style={{
        overflow: 'hidden', cursor: 'pointer', minHeight: '320px',
        transition: 'all var(--transition)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      }}
    >
      <div style={{
        width: '100%', height: '160px', flexShrink: 0, position: 'relative',
        background: `var(${skill.bgVar})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: 48, transform: hovered ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.3s' }}>{skill.icon}</span>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
          background: `var(${skill.colorVar})`,
          opacity: hovered ? 1 : 0,
          transition: 'opacity var(--transition)',
        }} />
      </div>
      <div className="p-4 flex flex-1 flex-col">
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 700,
          color: `var(${skill.colorVar})`, margin: '0 0 8px',
        }}>{skill.label}</h3>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)',
          color: 'var(--muted)', margin: 0, lineHeight: 1.4,
        }}>{skill.desc}</p>
        <button
          className="mt-auto w-full py-2 rounded-md border-none font-bold text-[13px] cursor-pointer transition-all"
          style={{
            background: hovered ? `var(${skill.colorVar})` : `var(${skill.bgVar})`,
            color: hovered ? '#fff' : `var(${skill.colorVar})`,
            fontFamily: 'var(--font-body)',
          }}
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
      if (!acc[sId]) acc[sId] = { seriesId: sId, seriesName: book.seriesName, books: [] }
      acc[sId].books.push(book)
      return acc
    }, {})

    return Object.values(rows).map(r => ({
      ...r,
      books: r.books.sort((a, b) => b.bookNumber - a.bookNumber)
    }))
  }, [fullTestsData])

  const requireAuth = (path) => {
    if (user) navigate(path)
    else openAuthModal('login')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', paddingBottom: 0 }}>
      <style>{`
        .full-test-banner {
          background: #0B2345;
          width: 100%;
        }
        .full-test-inner {
          max-width: 80rem;
          margin: 0 auto;
          padding: 32px 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .full-test-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7AB3FF;
          margin-bottom: 6px;
        }
        .full-test-title {
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px 0;
          font-family: var(--font-display);
        }
        .full-test-desc {
          font-size: 14px;
          color: #8BA5C8;
          margin: 0;
          font-family: var(--font-body);
        }
        .full-test-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2563EB;
          color: #ffffff;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          white-space: nowrap;
          flex-shrink: 0;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .full-test-btn:hover {
          background: #3B82F6;
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -4px rgba(59, 130, 246, 0.45);
        }
        @media (max-width: 768px) {
          .full-test-inner {
            flex-direction: column;
            align-items: flex-start;
            padding: 24px;
          }
        }
      `}</style>
      <Navbar />

      {/* Hero Section */}
      <div style={{
        background: '#EEF2FF',
        borderBottom: '1px solid #e5e7eb',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 420, height: 420, borderRadius: '50%', background: 'rgba(37,99,235,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(37,99,235,0.04)', pointerEvents: 'none' }} />

        <div className="app-container section-py" style={{ position: 'relative' }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div style={{ flex: 1 }} className="anim-fade-up">
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 5vw, 52px)',
                fontWeight: 800, color: '#111827',
                marginBottom: 20, lineHeight: 1.15,
              }}>
                Luyện thi <span style={{ color: '#4D8EFF' }}>IELTS</span> chuyên nghiệp cùng AI
              </h1>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-lg)', color: '#6b7280',
                maxWidth: 500, lineHeight: 1.6, marginBottom: 8,
              }}>
                Kho đề thi thực tế từ Cambridge, hỗ trợ chấm điểm và nhận xét chi tiết bằng trí tuệ nhân tạo.
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', color: '#9ca3af', marginBottom: 32 }}>
                Nâng band thần tốc ngay hôm nay.
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <HeroPrimaryBtn onClick={() => navigate('/cambridge')} />
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Full Test CTA Banner */}
      <section className="full-test-banner">
        <div className="full-test-inner">
          <div>
            <p className="full-test-label">IELTS FULL TEST</p>
            <h2 className="full-test-title">Luyện thi trọn bộ 4 kỹ năng</h2>
            <p className="full-test-desc">Bộ đề Cambridge chính thức — đánh giá toàn diện Listening, Reading, Writing, Speaking</p>
          </div>
          <button onClick={() => navigate('/full-test')} className="full-test-btn">Xem tất cả bộ đề →</button>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="app-container section-py flex flex-col gap-16">
        
        {/* Full Tests: Cambridge & Practice Plus */}
        {fullTestsData === 'error' ? (
          <section>
            <SectionHeader title="IELTS Full Test" count="Lỗi" to="/cambridge" />
            <div className="grid grid-cols-1 mt-6">
              <HomeSectionError />
            </div>
          </section>
        ) : groupedFullTests.length > 0 && (
          <>
            {groupedFullTests.map(series => (
              <SeriesCarousel
                key={series.seriesId}
                title={series.seriesName}
                count={`${series.books.length} cuốn`}
                to="/full-test"
              >
                {series.books.map((book, i) => (
                  <div key={book.title} className="flex-shrink-0 shrink-0 w-[180px] sm:w-[200px]" style={{ scrollSnapAlign: 'start' }}>
                    <BookCard
                      book={book}
                      animClass={`anim-fade-up delay-${i % 4 + 1}`}
                      onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                    />
                  </div>
                ))}
              </SeriesCarousel>
            ))}
          </>
        )}

        {/* IELTS Reading Practice */}
        <section>
          <SectionHeader title="IELTS Reading Practice" to="/practice/reading" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
              {writingSamples === null ? [0,1,2,3].map(i => <SkeletonCard key={i} />) :
               writingSamples === 'error' ? <HomeSectionError /> :
               writingSamples.slice(0, 4).map((item, i) => (
                 <PracticeCard key={item.id} item={item} skill="writing" animClass={`anim-fade-up delay-${i + 1}`}
                   actionLabel="Xem bài mẫu"
                   onAction={() => navigate(`/samples/writing/${item.id}`)} />
               ))}
            </div>
          </section>
        )}

        {/* IELTS Speaking Samples */}
        {(speakingSamples === 'error' || speakingSamples === null || (speakingSamples && speakingSamples.length > 0)) && (
          <section>
            <SectionHeader title="IELTS Speaking Samples" to="/speaking-samples" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
              {speakingSamples === null ? [0,1,2,3].map(i => <SkeletonCard key={i} />) :
               speakingSamples === 'error' ? <HomeSectionError /> :
               speakingSamples.slice(0, 4).map((item, i) => (
                 <PracticeCard key={item.id} item={item} skill="speaking" animClass={`anim-fade-up delay-${i + 1}`}
                   actionLabel="Xem bài mẫu"
                   onAction={() => navigate(`/samples/speaking/${item.id}`)} />
               ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
