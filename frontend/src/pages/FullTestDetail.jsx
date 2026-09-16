import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import Breadcrumb from '../components/common/Breadcrumb'

import { useAuth } from '../context/AuthContext'
import { checkDraft } from '../services/draftService'
import { Headphones, BookOpen, PenTool, Mic, AlertCircle, RefreshCw, FolderArchive } from 'lucide-react'
import { BACKEND_URL, resolveImg, handleImgError } from '../utils/media'
import Modal from '../components/common/Modal'
import AcademicCover from '../components/common/AcademicCover'
import Card from '../components/common/Card'
import { SkeletonCard } from '../components/skeletons'

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

  const fetchBookData = useCallback(() => {
    if (!bookNumber) return

    setLoading(true)
    setFetchError(false)

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

  useEffect(() => {
    fetchBookData()
  }, [fetchBookData])

  const suggestions = useMemo(() => {
    if (!allBooks.length || !bookData) return []
    const filtered = allBooks.filter(b =>
      !(String(b.seriesId) === String(seriesId) && String(b.bookNumber) === String(bookNumber))
    )
    // Có chủ đích, ổn định giữa các lần tải (trước đây random mỗi lần tải — kiểu UX
    // trang bán hàng, không phù hợp học tập): ưu tiên cùng bộ sách với cuốn đang xem,
    // rồi trong mỗi nhóm sắp theo số thứ tự cuốn gần nhất (cuốn liền kề trước).
    // API danh sách full-test chỉ trả seriesId/seriesName/bookNumber/coverImageUrl,
    // không có trạng thái "đã làm/chưa làm" nên không dùng được tiêu chí đó ở đây.
    const currentBookNumber = Number(bookNumber)
    return [...filtered]
      .sort((a, b) => {
        const aSameSeries = String(a.seriesId) === String(seriesId) ? 0 : 1
        const bSameSeries = String(b.seriesId) === String(seriesId) ? 0 : 1
        if (aSameSeries !== bSameSeries) return aSameSeries - bSameSeries

        const aDist = Math.abs(Number(a.bookNumber) - currentBookNumber)
        const bDist = Math.abs(Number(b.bookNumber) - currentBookNumber)
        if (aDist !== bDist) return aDist - bDist

        if (a.seriesName !== b.seriesName) return a.seriesName.localeCompare(b.seriesName)
        return Number(a.bookNumber) - Number(b.bookNumber)
      })
      .slice(0, 4)
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: 'var(--muted)' }}>Vui lòng chọn một cuốn sách cụ thể.</div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div className="app-container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
          <div>
            <div className="h-[158px] bg-white rounded-2xl border border-zinc-200 shadow-xs animate-pulse mb-5" />
            <div className="h-6 w-32 bg-zinc-200 rounded-md animate-pulse mb-3.5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} aspect="4/5" />)}
            </div>
          </div>
          <div className="h-40 bg-white rounded-2xl border border-zinc-200 shadow-xs animate-pulse" />
        </div>
      </div>
    </div>
  )

  if (fetchError) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Card className="max-w-md mx-auto mt-16 text-center py-12 px-6 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-zinc-400 mb-3 stroke-[1.75]" />
        <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16 }}>Không thể tải dữ liệu</p>
        <p className="mb-5" style={{ color: 'var(--muted)', fontSize: 14 }}>Vui lòng kiểm tra kết nối và thử lại.</p>
        <button
          onClick={fetchBookData}
          className="btn-primary flex items-center justify-center gap-2 px-6 h-9 rounded-full font-semibold text-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </button>
      </Card>
    </div>
  )

  if (!bookData || bookData.empty) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Card variant="flat" className="max-w-md mx-auto mt-16 text-center py-12 px-6 flex flex-col items-center">
        <FolderArchive className="w-12 h-12 text-zinc-300 stroke-[1.5] mb-4" />
        <h3 className="font-bold text-zinc-900 text-base">Chưa có bài test nào</h3>
        <p className="text-zinc-500 text-sm mt-1">Cuốn sách này hiện chưa có bài test nào được thêm vào</p>
      </Card>
    </div>
  )

  const title = `${bookData.seriesName} ${bookData.bookNumber}`

  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-zinc-950 flex flex-col">
      <div className="app-container pt-4 pb-0">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Phòng thi chuẩn hóa', to: '/full-test' },
            { label: title }
          ]}
        />
      </div>

      <div className="app-container py-6 flex-1">

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
          <div>
            {/* Hero */}
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 80, height: 110, borderRadius: '0.75rem', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, var(--ink), var(--ink-soft))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {resolveImg(bookData.coverImageUrl)
                    ? <img src={resolveImg(bookData.coverImageUrl)} alt={title} loading="lazy" decoding="async" onError={handleImgError} className="img-crisp" style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} />
                    : <AcademicCover title={title} compact={true} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-1.5">{title}</h1>
                  <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.6 }}>Luyện tập trọn bộ 4 kỹ năng trong cuốn sách {title}.</p>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{bookData.tests.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Bài test</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>4</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Kỹ năng</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test list */}
            <h2 className="text-lg font-semibold text-zinc-900 mb-3.5">Chọn bài test</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {bookData.tests.map(test => {
                const availCount = SKILL_ORDER.filter(s => test.exams[s]).length
                const hasDraft = SKILL_ORDER.some(s => draftInfo[`${test.testNumber}-${s}`]?.hasDraft)

                return (
                  <div key={test.testNumber} style={{ background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow-xs)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{`Test ${test.testNumber}`}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: '9999px', padding: '2.5px 10px', background: 'var(--skill-r-bg)', color: 'var(--skill-r-color)' }}>
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
                            fontSize: 11, fontWeight: 700, borderRadius: '9999px', padding: '3px 10px',
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
                            <span key={s} style={{ fontSize: 11, color: 'var(--warning-text)', fontWeight: 600, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 9999, padding: '2px 10px' }}>
                              ● {SKILL_META[s].label} đang làm dở
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => handleStart(test)}
                      className="btn-hover-default mt-2 w-full h-9 px-5 rounded-full text-white text-sm font-medium tracking-normal shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none select-none"
                      style={{ background: 'var(--primary)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                    >
                      Bắt đầu
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Suggestions */}
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow-xs)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Đề thi liên quan</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map(book => (
                  <div
                    key={`${book.seriesId}-${book.bookNumber}`}
                    onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <div style={{ width: 36, height: 48, borderRadius: '0.75rem', background: 'var(--surface-raised)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {book.coverImageUrl ? (
                        <img src={resolveImg(book.coverImageUrl)} alt="" loading="lazy" decoding="async" onError={handleImgError} className="img-crisp" style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} />
                      ) : (
                        <AcademicCover title={`${book.seriesName} ${book.bookNumber}`} compact={true} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.seriesName} {book.bookNumber}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>Chi tiết bộ đề</p>
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
        <Modal
          onClose={() => setModal(null)}
          title={`Test ${modal.testNumber} — Chọn kỹ năng`}
          size="md"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{`Test ${modal.testNumber}`} — Chọn kỹ năng</h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Đóng"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors font-bold cursor-pointer border-none bg-transparent"
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SKILL_ORDER.map(skill => {
                const m = SKILL_META[skill]
                const exam = modal.exams[skill]
                const hasDraft = draftInfo[`${modal.testNumber}-${skill}`]?.hasDraft
                return (
                  <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: '1rem', border: `1px solid ${exam ? `var(${m.borderVar})` : 'var(--border)'}`, background: exam ? `var(${m.bgVar})` : 'var(--surface-raised)', opacity: exam ? 1 : 0.6 }}>
                    <span className="shrink-0 flex items-center justify-center" style={{ color: exam ? `var(${m.colorVar})` : 'var(--subtle)' }}>
                      <m.Icon className="w-5 h-5" />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: exam ? `var(${m.colorVar})` : 'var(--subtle)' }}>{m.label}</span>
                        {hasDraft && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)' }}>● Đang làm dở</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{m.desc}</p>
                    </div>
                    {exam && (
                      hasDraft ? (
                        <button
                          onClick={() => navigate(`${m.path}/${exam.id}?resume=true`)}
                          className="min-w-[88px] h-8 px-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium inline-flex items-center justify-center leading-none select-none shrink-0 whitespace-nowrap transition-colors shadow-xs cursor-pointer"
                        >Tiếp tục</button>
                      ) : (
                        <button
                          onClick={() => navigate(`${m.path}/${exam.id}`)}
                          className="min-w-[88px] h-8 px-4 rounded-full text-white text-xs font-medium inline-flex items-center justify-center leading-none select-none shrink-0 whitespace-nowrap transition-colors shadow-xs cursor-pointer"
                          style={{ background: 'var(--primary)' }}
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
        </Modal>
      )}
    </div>
  )
}
