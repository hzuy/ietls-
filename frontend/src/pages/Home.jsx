import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import api from '../utils/axios'

const skills = [
  {
    name: 'Reading', sub: 'Đọc hiểu', desc: '3 đoạn văn · 40 câu hỏi · 60 phút',
    path: '/reading',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 20h9" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
  },
  {
    name: 'Listening', sub: 'Nghe hiểu', desc: '4 phần · 40 câu hỏi · 30 phút',
    path: '/listening',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M9 18V5l12-2v13" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="18" r="3" stroke="#1a56db" strokeWidth="2"/>
        <circle cx="18" cy="16" r="3" stroke="#1a56db" strokeWidth="2"/>
      </svg>
    ),
    color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
  },
  {
    name: 'Writing', sub: 'Viết luận', desc: 'Task 1 + Task 2 · AI chấm điểm',
    path: '/writing',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
  },
  {
    name: 'Speaking', sub: 'Nói', desc: '3 phần · AI nhận xét phát âm',
    path: '/speaking',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="19" x2="12" y2="23" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="23" x2="16" y2="23" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
  },
]

const stats = [
  { label: 'Đề thi', value: '50+' },
  { label: 'Học viên', value: '1,200+' },
  { label: 'Band Score TB', value: '6.5' },
  { label: 'AI Feedback', value: '24/7' },
]

// ── Thumbnail placeholder ────────────────────────────────────────────────────
function ThumbPlaceholder() {
  return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      background: '#f1f5f9', borderRadius: '8px 8px 0 0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#cbd5e1" strokeWidth="1.5"/>
        <circle cx="8.5" cy="8.5" r="1.5" stroke="#cbd5e1" strokeWidth="1.5"/>
        <path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function Thumbnail({ src }) {
  if (!src) return <ThumbPlaceholder />
  return (
    <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

// ── Practice card ─────────────────────────────────────────────────────────────
function PracticeCard({ item, onAction, actionLabel = 'Làm bài', tag }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
        overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.10)' : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <Thumbnail src={item.coverImageUrl} />
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tag && (
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            color: '#1a56db', background: '#eff6ff', borderRadius: 4,
            padding: '2px 7px', alignSelf: 'flex-start',
          }}>{tag}</span>
        )}
        <p style={{
          fontWeight: 500, fontSize: 14, color: '#1e3a5f', margin: 0,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>{item.title}</p>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginTop: 'auto' }}>
          {item.questionCount != null && <span>{item.questionCount} câu</span>}
          {item.attemptCount != null && <span>{item.attemptCount.toLocaleString()} lượt</span>}
        </div>
        <button
          onClick={onAction}
          style={{
            marginTop: 8, padding: '6px 0', borderRadius: 7, border: 'none',
            background: '#eff6ff', color: '#1a56db', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff' }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// ── Full Test card ────────────────────────────────────────────────────────────
function FullTestCard({ item, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
        overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.10)' : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <Thumbnail src={item.coverImageUrl} />
      <div style={{ padding: '12px 14px' }}>
        <p style={{
          fontWeight: 500, fontSize: 14, color: '#1e3a5f', margin: 0,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>{item.name}</p>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
          {item.testCount != null && item.testCount > 0 ? <span>{item.testCount} bài test</span> : item.bookCount > 0 ? <span>{item.bookCount} quyển</span> : null}
          {item.attemptCount > 0 && <span>{item.attemptCount.toLocaleString()} lượt</span>}
        </div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, to }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>{title}</h2>
      <Link
        to={to}
        style={{ fontSize: 13, fontWeight: 600, color: '#1a56db', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#1d4ed8' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#1a56db' }}
      >
        Xem thêm
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ width: '100%', aspectRatio: '16/9', background: '#f1f5f9' }} />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, width: '70%' }} />
      </div>
    </div>
  )
}

// VITE_API_URL = 'http://localhost:3001/api' → strip /api to get base origin
const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'

function resolveImg(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return BACKEND_URL + url
}

export default function Home() {
  const { user, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const [fullTests, setFullTests] = useState(null)
  const [reading, setReading] = useState(null)
  const [listening, setListening] = useState(null)
  const [writing, setWriting] = useState(null)
  const [speaking, setSpeaking] = useState(null)

  useEffect(() => {
    const get = (path) => fetch(API_BASE + path).then(r => r.ok ? r.json() : []).catch(() => [])
    get('/series').then(setFullTests)
    get('/practice/reading').then(setReading)
    get('/practice/listening').then(setListening)
    get('/samples/writing').then(setWriting)
    get('/samples/speaking').then(setSpeaking)
  }, [])

  const requireAuth = (path) => {
    if (user) navigate(path)
    else openAuthModal('login')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #fff 0%, #eff6ff 50%, #fff 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-4"
                style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe' }}>
                <span className="w-2 h-2 rounded-full bg-current inline-block"></span>
                Nền tảng luyện thi IELTS
              </div>
              {user?.name ? (
                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight" style={{ color: '#1e3a5f' }}>
                  Xin chào, <span style={{ color: '#1a56db' }}>{user.name}</span>!
                </h1>
              ) : (
                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight" style={{ color: '#1e3a5f' }}>
                  Luyện thi <span style={{ color: '#1a56db' }}>IELTS</span> Thông minh &amp; Hiệu quả
                </h1>
              )}
              <p className="text-base mb-6" style={{ color: '#64748b', maxWidth: 420 }}>
                Luyện tập đầy đủ 4 kỹ năng IELTS với AI phản hồi thông minh. Chinh phục band score mục tiêu của bạn.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/reading')}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-sm"
                  style={{ backgroundColor: '#1a56db' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
                >
                  Bắt đầu luyện tập
                </button>
                <button
                  onClick={() => navigate('/about')}
                  className="px-6 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ color: '#1a56db', border: '1px solid #bfdbfe', backgroundColor: 'white' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                >
                  Tìm hiểu thêm
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              {stats.map(s => (
                <div key={s.label} className="rounded-2xl p-5 text-center min-w-[110px]"
                  style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div className="text-2xl font-extrabold" style={{ color: '#1a56db' }}>{s.value}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Test Banner ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <button onClick={() => navigate('/full-test')} className="w-full text-left rounded-2xl p-6 flex items-center justify-between transition-all group"
          style={{ backgroundColor: 'white', border: '1px solid #fecaca', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,37,37,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#eff6ff' }}>📚</div>
            <div>
              <p className="font-extrabold text-base" style={{ color: '#1e3a5f' }}>Luyện đề Cambridge Full Test</p>
              <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>Luyện đầy đủ 4 kỹ năng theo đúng bộ đề Cambridge IELTS</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold shrink-0" style={{ color: '#1a56db' }}>
            Xem ngay
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>

      {/* ── IELTS Full Test section ───────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <SectionHeader title="IELTS Full Test" to="/full-test" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {fullTests === null
            ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
            : fullTests.length === 0
              ? (
                <div style={{ gridColumn: '1/-1', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
                  <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Chưa có bộ đề nào.{' '}
                    <span style={{ color: '#1a56db', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/full-test')}>Xem tất cả →</span>
                  </p>
                </div>
              )
              : fullTests.map(item => (
                  <FullTestCard key={item.id} item={{ ...item, coverImageUrl: resolveImg(item.thumbnailUrl) }}
                    onClick={() => navigate(`/full-test/${item.id}`)} />
                ))
          }
        </div>
      </div>

      {/* ── IELTS Reading Practice ───────────────────────────────────────── */}
      {(reading === null || reading?.length > 0) && (
        <div className="max-w-6xl mx-auto px-6 pb-10">
          <SectionHeader title="IELTS Reading Practice" to="/reading" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {reading === null
              ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
              : reading.map(item => (
                  <PracticeCard key={item.id}
                    item={{ ...item, coverImageUrl: resolveImg(item.thumbnailUrl || item.coverImageUrl) }}
                    onAction={() => requireAuth(`/practice/reading/${item.id}`)}
                    actionLabel="Làm bài"
                  />
                ))
            }
          </div>
        </div>
      )}

      {/* ── IELTS Listening Practice ──────────────────────────────────────── */}
      {(listening === null || listening?.length > 0) && (
        <div className="max-w-6xl mx-auto px-6 pb-10">
          <SectionHeader title="IELTS Listening Practice" to="/listening" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {listening === null
              ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
              : listening.map(item => (
                  <PracticeCard key={item.id}
                    item={{ ...item, coverImageUrl: resolveImg(item.thumbnailUrl || item.coverImageUrl) }}
                    onAction={() => requireAuth(`/practice/listening/${item.id}`)}
                    actionLabel="Làm bài"
                  />
                ))
            }
          </div>
        </div>
      )}

      {/* ── IELTS Writing Samples ────────────────────────────────────────── */}
      {(writing === null || writing?.length > 0) && (
        <div className="max-w-6xl mx-auto px-6 pb-10">
          <SectionHeader title="IELTS Writing Samples" to="/writing" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {writing === null
              ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
              : writing.map(item => (
                  <PracticeCard key={item.id}
                    item={{ ...item, coverImageUrl: resolveImg(item.thumbnailUrl || item.coverImageUrl) }}
                    tag={(item.tags || [])[0]}
                    onAction={() => navigate(`/samples/writing/${item.id}`)}
                    actionLabel="Xem bài mẫu"
                  />
                ))
            }
          </div>
        </div>
      )}

      {/* ── IELTS Speaking Samples ────────────────────────────────────────── */}
      {(speaking === null || speaking?.length > 0) && (
        <div className="max-w-6xl mx-auto px-6 pb-10">
          <SectionHeader title="IELTS Speaking Samples" to="/speaking" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {speaking === null
              ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
              : speaking.map(item => (
                  <PracticeCard key={item.id}
                    item={{ ...item, coverImageUrl: resolveImg(item.thumbnailUrl || item.coverImageUrl) }}
                    tag={(item.tags || [])[0]}
                    onAction={() => navigate(`/samples/speaking/${item.id}`)}
                    actionLabel="Xem bài mẫu"
                  />
                ))
            }
          </div>
        </div>
      )}

      {/* ── Lộ trình 3 bước ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 className="font-extrabold text-base mb-4" style={{ color: '#1e3a5f' }}>Lộ trình luyện thi hiệu quả</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Làm bài thử', desc: 'Chọn đề và làm bài trong điều kiện thi thật với đồng hồ đếm ngược' },
              { step: '02', title: 'Nhận phản hồi AI', desc: 'AI phân tích điểm mạnh/yếu, chấm Writing & nhận xét Speaking' },
              { step: '03', title: 'Cải thiện band score', desc: 'Ôn lại lỗi sai, theo dõi tiến độ và chinh phục mục tiêu' },
            ].map(item => (
              <div key={item.step} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0"
                  style={{ backgroundColor: '#eff6ff', color: '#1a56db' }}>
                  {item.step}
                </div>
                <div>
                  <div className="font-bold text-sm mb-1" style={{ color: '#1e3a5f' }}>{item.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tại sao chọn IELTSPro ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: '#1e3a5f' }}>Tại sao chọn IELTSPro?</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>Nền tảng được thiết kế dành riêng cho người học IELTS nghiêm túc</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              title: 'Đề thi Cambridge thật',
              desc: 'Kho đề từ Cambridge IELTS, chuẩn format thi thật 100%',
            },
            {
              icon: (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" stroke="#1a56db" strokeWidth="2"/>
                  <path d="M12 6v6l4 2" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              title: 'AI chấm điểm tức thì',
              desc: 'Writing được chấm theo 4 tiêu chí, Speaking được nhận xét chi tiết trong vài giây',
            },
            {
              icon: (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <path d="M3 3v18h18" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 16l4-4 4 4 4-6" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              title: 'Lộ trình cá nhân hoá',
              desc: 'Hệ thống phân tích điểm yếu và gợi ý đề luyện phù hợp với từng người',
            },
          ].map(card => (
            <div key={card.title} className="rounded-2xl p-6"
              style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#eff6ff' }}>
                {card.icon}
              </div>
              <h3 className="font-extrabold text-base mb-2" style={{ color: '#1e3a5f' }}>{card.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
