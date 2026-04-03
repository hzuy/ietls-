import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const SKILL_META = {
  reading: {
    icon: '📖',
    label: 'Reading Practice',
    sub: '3 đoạn văn · 40 câu hỏi · 60 phút',
    accentBg: '#eff6ff',
    accentBorder: '#bfdbfe',
    accentColor: '#1a56db',
    headerGradient: 'linear-gradient(135deg, #fff 0%, #eff6ff 50%, #fff 100%)',
    buttonColor: '#1a56db',
    buttonHover: '#1d4ed8',
    cardBorderHover: '#93c5fd',
    cardShadowHover: 'rgba(26,86,219,0.10)',
    path: '/practice/reading',
  },
  listening: {
    icon: '🎧',
    label: 'Listening Practice',
    sub: '4 phần · 40 câu hỏi · 30 phút',
    accentBg: '#f0fdf4',
    accentBorder: '#bbf7d0',
    accentColor: '#15803d',
    headerGradient: 'linear-gradient(135deg, #fff 0%, #f0fdf4 50%, #fff 100%)',
    buttonColor: '#15803d',
    buttonHover: '#166534',
    cardBorderHover: '#6ee7b7',
    cardShadowHover: 'rgba(16,185,129,0.10)',
    path: '/practice/listening',
  },
}

function ThumbPlaceholder({ skill }) {
  const meta = SKILL_META[skill]
  return (
    <div style={{ width: '100%', aspectRatio: '16/9', background: meta.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 32 }}>{meta.icon}</span>
    </div>
  )
}

function PracticeCard({ item, skill, onClick }) {
  const [hovered, setHovered] = useState(false)
  const meta = SKILL_META[skill]
  const img = resolveImg(item.thumbnailUrl)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: `1px solid ${hovered ? meta.cardBorderHover : '#e2e8f0'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 8px 24px ${meta.cardShadowHover}` : '0 2px 6px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {img
        ? <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
            <img src={img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        : <ThumbPlaceholder skill={skill} />
      }
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f', margin: 0, lineHeight: 1.4 }}>{item.title}</p>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#94a3b8' }}>
          {item.questionCount > 0 && <span>{item.questionCount} câu hỏi</span>}
        </div>
        <button
          style={{
            marginTop: 4, padding: '7px 0', borderRadius: 8, border: 'none',
            background: hovered ? meta.buttonHover : meta.buttonColor,
            color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          Làm bài →
        </button>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ width: '100%', aspectRatio: '16/9', background: '#f1f5f9' }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, width: '55%', marginBottom: 12 }} />
        <div style={{ height: 32, background: '#f1f5f9', borderRadius: 8 }} />
      </div>
    </div>
  )
}

export default function PracticeList({ skill }) {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const meta = SKILL_META[skill]

  useEffect(() => {
    fetch(API_BASE + `/practice/${skill}?limit=0`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setExams(data); setLoading(false) })
      .catch(() => { setExams([]); setLoading(false) })
  }, [skill])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: meta.headerGradient, borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: meta.accentBg, border: `1px solid ${meta.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              {meta.icon}
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>{meta.label}</h1>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, marginTop: 2 }}>{meta.sub}</p>
            </div>
          </div>
          {!loading && (
            <div style={{ display: 'inline-flex', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 14px', fontSize: 13, fontWeight: 700, color: meta.accentColor, marginTop: 4 }}>
              {exams.length} bài luyện tập
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {[0,1,2,3,4,5,6,7].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Chưa có bài luyện tập nào</p>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Admin cần thêm bài trong trang quản trị</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {exams.map(item => (
              <PracticeCard
                key={item.id}
                item={item}
                skill={skill}
                onClick={() => navigate(`/practice/${skill}/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
