import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getSeriesProgress } from '../services/seriesService'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const API_BASE = BACKEND_URL + '/api'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const SKILL_META = {
  reading:   { label: 'Reading',   icon: '📖', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', path: '/reading',   desc: '3 passages · 40 câu · 60 phút' },
  listening: { label: 'Listening', icon: '🎧', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', path: '/listening', desc: '4 sections · 40 câu · 40 phút' },
  writing:   { label: 'Writing',   icon: '✍️',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', path: '/writing',   desc: 'Task 1 + Task 2 · AI chấm điểm' },
  speaking:  { label: 'Speaking',  icon: '🎤',  color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', path: '/speaking',  desc: 'Part 1+2+3 · AI nhận xét' },
}
const SKILL_ORDER = ['reading', 'listening', 'writing', 'speaking']

export default function FullTestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, openAuthModal } = useAuth()

  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({}) // testNumber → { skill → { done, score } }
  const [modal, setModal] = useState(null) // { testNumber, exams }
  const [leaderboard, setLeaderboard] = useState(null) // null = loading, [] = empty

  useEffect(() => {
    fetch(API_BASE + '/series/' + id, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setSeries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!user) return
    getSeriesProgress(id)
      .then(data => setProgress(data))
      .catch(() => {})
  }, [id, user])

  useEffect(() => {
    fetch(API_BASE + '/series/' + id + '/leaderboard')
      .then(r => r.ok ? r.json() : [])
      .then(data => setLeaderboard(data))
      .catch(() => setLeaderboard([]))
  }, [id])

  const handleStart = (test) => {
    if (!user) { openAuthModal('login'); return }
    setModal(test)
  }

  if (loading) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}><Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: '#9ca3af' }}>Đang tải...</div>
    </div>
  )
  if (!series) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}><Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: '#9ca3af' }}>Không tìm thấy bộ đề.</div>
    </div>
  )

  const totalTests = series.tests?.length ?? 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          <Link to="/" style={{ color: '#64748b', textDecoration: 'none' }} onMouseEnter={e => e.target.style.color='#1a56db'} onMouseLeave={e => e.target.style.color='#64748b'}>Trang chủ</Link>
          <span>/</span>
          <Link to="/full-test" style={{ color: '#64748b', textDecoration: 'none' }} onMouseEnter={e => e.target.style.color='#1a56db'} onMouseLeave={e => e.target.style.color='#64748b'}>Full Test</Link>
          <span>/</span>
          <span style={{ color: '#1e3a5f', fontWeight: 600 }}>{series.name}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24, alignItems: 'start' }}>
          {/* Main content */}
          <div>
            {/* Hero */}
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 80, height: 110, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #1e3a5f, #1a56db)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {resolveImg(series.thumbnailUrl)
                    ? <img src={resolveImg(series.thumbnailUrl)} alt={series.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 32 }}>📚</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f', margin: '0 0 6px' }}>{series.name}</h1>
                  {series.description && <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 14px', lineHeight: 1.6 }}>{series.description}</p>}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a56db' }}>{totalTests}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Bài test</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a56db' }}>4</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Kỹ năng</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a56db' }}>{series.type === 'general' ? 'General' : 'Academic'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Loại</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test list */}
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e3a5f', margin: '0 0 14px' }}>Chọn bài test</h2>
            {!series.tests?.length ? (
              <div style={{ background: 'white', borderRadius: 16, padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px solid #e2e8f0' }}>
                Chưa có bài test nào trong bộ đề này.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {series.tests.map(test => {
                  const prog = progress[test.testNumber] || {}
                  const doneCount = SKILL_ORDER.filter(s => prog[s]?.done).length
                  const availCount = SKILL_ORDER.filter(s => test.exams[s]).length
                  const isComplete = doneCount === 4 && availCount === 4
                  const isStarted = doneCount > 0 && !isComplete

                  let statusLabel = 'Chưa làm'
                  let statusBg = '#eff6ff'
                  let statusColor = '#1a56db'
                  if (isComplete) { statusLabel = 'Đã làm'; statusBg = '#f0fdf4'; statusColor = '#059669' }
                  else if (isStarted) { statusLabel = 'Đang làm'; statusBg = '#fffbeb'; statusColor = '#d97706' }

                  const pct = Math.round((doneCount / 4) * 100)

                  return (
                    <div key={test.testNumber} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>{`Test ${test.testNumber}`}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 8px', background: statusBg, color: statusColor }}>{statusLabel}</span>
                      </div>

                      {/* Skill chips */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        {SKILL_ORDER.map(skill => {
                          const m = SKILL_META[skill]
                          const available = !!test.exams[skill]
                          const done = prog[skill]?.done
                          return (
                            <span key={skill} style={{
                              fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px',
                              background: done ? '#f0fdf4' : available ? m.bg : '#f3f4f6',
                              color: done ? '#059669' : available ? m.color : '#d1d5db',
                              border: `1px solid ${done ? '#bbf7d0' : available ? m.border : '#e5e7eb'}`,
                            }}>
                              {m.icon} {m.label}
                              {done && prog[skill]?.score != null && ` · ${prog[skill].score}`}
                            </span>
                          )
                        })}
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', borderRadius: 4, background: isComplete ? '#059669' : '#1a56db', width: `${pct}%`, transition: 'width 0.3s' }} />
                      </div>
                      <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, margin: '0 0 14px' }}>
                        {isComplete ? 'Hoàn thành ✓' : isStarted ? `Tiến độ: ${pct}%` : 'Chưa bắt đầu'}
                      </p>

                      {/* Action button */}
                      <button
                        onClick={() => handleStart(test)}
                        style={{ width: '100%', padding: '8px 0', borderRadius: 9, border: 'none', background: '#1e3a5f', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1a56db'}
                        onMouseLeave={e => e.currentTarget.style.background = '#1e3a5f'}
                      >
                        {isStarted ? 'Tiếp tục →' : 'Bắt đầu →'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Leaderboard */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                🏆 Top điểm bộ đề này
              </h3>
              {leaderboard === null ? (
                <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, textAlign: 'center', padding: '8px 0' }}>Đang tải...</p>
              ) : leaderboard.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, textAlign: 'center', padding: '8px 0' }}>Chưa có ai luyện thi bộ đề này.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leaderboard.map((entry, idx) => {
                    const medals = ['🥇', '🥈', '🥉']
                    const rankColors = ['#f59e0b', '#94a3b8', '#cd7c3f']
                    const medal = medals[idx] || null
                    const rankColor = rankColors[idx] || '#64748b'
                    return (
                      <div key={entry.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: idx === 0 ? '#fffbeb' : '#f8fafc' }}>
                        <span style={{ fontSize: medal ? 18 : 12, fontWeight: 700, color: rankColor, width: 22, textAlign: 'center', flexShrink: 0 }}>
                          {medal || `#${idx + 1}`}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e3a5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: rankColor, flexShrink: 0 }}>
                          {entry.score}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Other series */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: '0 0 14px' }}>Bộ đề khác</h3>
              {!series.others?.length ? (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, textAlign: 'center', padding: '8px 0' }}>Chưa có bộ đề nào khác.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {series.others.slice(0, 3).map(o => (
                    <div
                      key={o.id}
                      onClick={() => navigate(`/full-test/${o.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 36, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #1e3a5f, #1a56db)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {resolveImg(o.thumbnailUrl)
                          ? <img src={resolveImg(o.thumbnailUrl)} alt={o.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 18 }}>📚</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{o.testCount} bài test</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tip card */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a56db 100%)', borderRadius: 14, padding: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>💡 Mẹo luyện thi</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.6 }}>
                Làm đầy đủ cả 4 kỹ năng trong mỗi bài test để nhận kết quả band score tổng hợp chính xác nhất.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Skill selection modal */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>{`Test ${modal.testNumber}`} — Chọn kỹ năng</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SKILL_ORDER.map(skill => {
                const m = SKILL_META[skill]
                const exam = modal.exams[skill]
                const prog = progress[modal.testNumber]?.[skill]
                return (
                  <div key={skill} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                    borderRadius: 12, border: `1px solid ${exam ? m.border : '#e5e7eb'}`,
                    background: exam ? m.bg : '#f9fafb',
                    opacity: exam ? 1 : 0.6,
                  }}>
                    <span style={{ fontSize: 22 }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: exam ? m.color : '#9ca3af' }}>{m.label}</span>
                        {prog?.done && <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#f0fdf4', borderRadius: 4, padding: '1px 6px' }}>✓ Đã làm{prog.score != null ? ` · ${prog.score}` : ''}</span>}
                      </div>
                      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{m.desc}</p>
                    </div>
                    {exam ? (
                      <button
                        onClick={() => navigate(`${m.path}/${exam.id}`)}
                        style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: m.color, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        Làm bài
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', flexShrink: 0 }}>Chưa có</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
