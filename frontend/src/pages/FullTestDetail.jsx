import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'

import { useAuth } from '../context/AuthContext'
import { checkDraft } from '../services/draftService'
import { Headphones, BookOpen, PenTool, Mic } from 'lucide-react'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const SKILL_META = {
  reading:   { label: 'Reading',   Icon: BookOpen,   colorVar: '--skill-r-color', bgVar: '--skill-r-bg', borderVar: '--skill-r-border', path: '/reading',   desc: '3 passages · 40 câu · 60 phút' },
  listening: { label: 'Listening', Icon: Headphones, colorVar: '--skill-l-color', bgVar: '--skill-l-bg', borderVar: '--skill-l-border', path: '/listening', desc: '4 sections · 40 câu · 40 phút' },
  writing:   { label: 'Writing',   Icon: PenTool,    colorVar: '--skill-w-color', bgVar: '--skill-w-bg', borderVar: '--skill-w-border', path: '/writing',   desc: 'Task 1 + Task 2 · AI chấm điểm' },
  speaking:  { label: 'Speaking',  Icon: Mic,        colorVar: '--skill-s-color', bgVar: '--skill-s-bg', borderVar: '--skill-s-border', path: '/speaking',  desc: 'Part 1+2+3 · AI nhận xét' },
}
const SKILL_ORDER = ['reading', 'listening', 'writing', 'speaking']

export default function FullTestDetail() {
  const { id: seriesId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, openAuthModal } = useAuth()

  const bookNumber = new URLSearchParams(location.search).get("book")

  const [allBooks, setAllBooks] = useState([])
  const [bookData, setBookData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [modal, setModal] = useState(null)
  const [draftInfo, setDraftInfo] = useState({}) // { [testNumber-skill]: checkDraft result }

  useEffect(() => {
    if (!bookNumber) return

    fetch(`${BACKEND_URL}/api/admin/full-tests`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const booksMap = data.reduce((acc, item) => {
          const key = `${item.seriesId}-${item.bookNumber}`
          if (!acc[key]) {
            acc[key] = {
              seriesId: item.seriesId,
              seriesName: item.seriesName,
              bookNumber: item.bookNumber,
              coverImageUrl: item.coverImageUrl
            }
          }
          return acc
        }, {})
        const uniqueBooks = Object.values(booksMap)
        setAllBooks(uniqueBooks)

        const filtered = data.filter(item =>
          String(item.seriesId) === String(seriesId) &&
          String(item.bookNumber) === String(bookNumber)
        )

        if (filtered.length === 0) {
          setBookData({ empty: true })
          setLoading(false)
          return
        }

        const testMap = filtered.reduce((acc, item) => {
          const tn = item.testNumber
          if (!acc[tn]) acc[tn] = { testNumber: tn, exams: {} }
          Object.assign(acc[tn].exams, item.exams)
          return acc
        }, {})

        const sortedTests = Object.values(testMap).sort((a, b) => a.testNumber - b.testNumber)
        const first = filtered[0]

        setBookData({
          seriesId: first.seriesId,
          seriesName: first.seriesName,
          bookNumber: first.bookNumber,
          coverImageUrl: first.coverImageUrl,
          tests: sortedTests
        })
        setLoading(false)
      })
      .catch(() => {
        setFetchError(true)
        setLoading(false)
      })
  }, [seriesId, bookNumber])

  const suggestions = useMemo(() => {
    if (!allBooks.length || !bookData) return []
    const filtered = allBooks.filter(b =>
      !(String(b.seriesId) === String(seriesId) && String(b.bookNumber) === String(bookNumber))
    )
    return [...filtered].sort(() => 0.5 - Math.random()).slice(0, 4)
  }, [allBooks, seriesId, bookNumber, bookData])

  // Load draft info for all skills in all tests (runs after bookData + user are ready)
  useEffect(() => {
    if (!user || !bookData?.tests) return
    const userId = user.id || user._id
    const info = {}
    for (const test of bookData.tests) {
      for (const skill of SKILL_ORDER) {
        const examId = test.exams[skill]?.id
        if (!examId) continue
        const key = `${test.testNumber}-${skill}`
        info[key] = checkDraft(userId, examId, skill)
      }
    }
    setDraftInfo(info)
  }, [user, bookData])

  const handleStart = (test) => {
    // Trang này public — gate ở nút. redirectTo = URL hiện tại để sau khi login quay lại đúng đề.
    if (!user) { openAuthModal('login', location.pathname + location.search); return }
    setModal(test)
  }

  if (!bookNumber) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}><Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Vui lòng chọn một cuốn sách cụ thể.</div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}><Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Đang tải...</div>
    </div>
  )

  if (fetchError) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}><Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ fontFamily: 'var(--font-body)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16 }}>Không thể tải dữ liệu</p>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Vui lòng kiểm tra kết nối và thử lại.</p>
      </div>
    </div>
  )

  if (!bookData || bookData.empty) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}><Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Chưa có bài test nào trong cuốn sách này.</div>
    </div>
  )

  const title = `${bookData.seriesName} ${bookData.bookNumber}`

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 20, fontFamily: 'var(--font-body)' }}>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Trang chủ</Link>
          <span>/</span>
          <Link to="/full-test" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Full Test</Link>
          <span>/</span>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{title}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24, alignItems: 'start' }}>
          <div>
            {/* Hero */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 80, height: 110, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, var(--ink), var(--ink-soft))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {resolveImg(bookData.coverImageUrl)
                    ? <img src={resolveImg(bookData.coverImageUrl)} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 32 }}>📚</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>{title}</h1>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.6 }}>Luyện tập trọn bộ 4 kỹ năng trong cuốn sách {title}.</p>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{bookData.tests.length}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Bài test</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>4</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Kỹ năng</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test list */}
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Chọn bài test</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {bookData.tests.map(test => {
                // TODO: hiển thị tiến độ hoàn thành từng kỹ năng — chờ redesign API progress sau khi bỏ model Series
                const availCount = SKILL_ORDER.filter(s => test.exams[s]).length
                const hasDraft = SKILL_ORDER.some(s => draftInfo[`${test.testNumber}-${s}`]?.hasDraft)

                return (
                  <div key={test.testNumber} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow-xs)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{`Test ${test.testNumber}`}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)', padding: '2px 8px', background: 'var(--skill-r-bg)', color: 'var(--skill-r-color)' }}>
                        {`${availCount} kỹ năng`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {SKILL_ORDER.map(skill => {
                        const m = SKILL_META[skill]
                        const exam = test.exams[skill]
                        const SkillIcon = m.Icon
                        return (
                          <span key={skill} style={{
                            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)', padding: '3px 8px',
                            background: exam ? `var(${m.bgVar})` : 'var(--surface-raised)',
                            color: exam ? `var(${m.colorVar})` : 'var(--subtle)',
                            border: `1px solid ${exam ? `var(${m.borderVar})` : 'var(--border-soft)'}`,
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <SkillIcon className="w-3.5 h-3.5 stroke-[1.75]" />
                            {m.label}
                          </span>
                        )
                      })}
                    </div>
                    {/* Draft indicator badges */}
                    {hasDraft && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                        {SKILL_ORDER.map(s => {
                          const dk = `${test.testNumber}-${s}`
                          if (!draftInfo[dk]?.hasDraft) return null
                          return (
                            <span key={s} style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '2px 8px' }}>
                              ● {SKILL_META[s].label} đang làm dở
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <button onClick={() => handleStart(test)} className="btn-hover-default" style={{ width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background var(--transition), transform .2s, box-shadow .2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                    >
                      Bắt đầu →
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* TODO: leaderboard bộ đề đã gỡ cùng model Series — chờ redesign trên API mới */}

            {/* Suggestions */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow-xs)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Gợi ý cho bạn</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map(book => (
                  <div
                    key={`${book.seriesId}-${book.bookNumber}`}
                    onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <div style={{ width: 36, height: 48, borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', flexShrink: 0, overflow: 'hidden' }}>
                      {book.coverImageUrl ? <img src={resolveImg(book.coverImageUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📚'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.seriesName} {book.bookNumber}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--muted)', margin: 0 }}>Luyện tập ngay</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Skill Selection */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 28, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>{`Test ${modal.testNumber}`} — Chọn kỹ năng</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SKILL_ORDER.map(skill => {
                const m = SKILL_META[skill]
                const exam = modal.exams[skill]
                const hasDraft = draftInfo[`${modal.testNumber}-${skill}`]?.hasDraft
                return (
                  <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${exam ? `var(${m.borderVar})` : 'var(--border)'}`, background: exam ? `var(${m.bgVar})` : 'var(--surface-raised)', opacity: exam ? 1 : 0.6 }}>
                    <span style={{ fontSize: 22 }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: exam ? `var(${m.colorVar})` : 'var(--subtle)' }}>{m.label}</span>
                        {hasDraft && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>● Đang làm dở</span>
                        )}
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', margin: 0 }}>{m.desc}</p>
                    </div>
                    {exam && (
                      hasDraft ? (
                        <button
                          onClick={() => navigate(`${m.path}/${exam.id}?resume=true`)}
                          className="btn-hover-default"
                          style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: '#f59e0b', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'transform .2s, box-shadow .2s' }}
                        >Tiếp tục →</button>
                      ) : (
                        <button
                          onClick={() => navigate(`${m.path}/${exam.id}`)}
                          style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'background var(--transition)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                        >Làm bài</button>
                      )
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
