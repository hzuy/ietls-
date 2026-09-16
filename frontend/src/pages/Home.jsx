import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Headphones,
  FileText,
  Mic,
} from 'lucide-react'
import AcademicCover from '../components/common/AcademicCover'
import Card from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import ResumeHeroCard from '../components/home/ResumeHeroCard'
import StreakWidget from '../components/home/StreakWidget'
import BandOverviewWidget from '../components/home/BandOverviewWidget'
import QuickFullTestWidget from '../components/home/QuickFullTestWidget'
import HeroBandOrbit from '../components/home/HeroBandOrbit'
import { getLatestDraft, clearDraft } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useAuthGate } from '../hooks/useAuthGate'
import { getUserStats } from '../services/userService'
import { API_BASE, resolveImg } from '../utils/media'

function HomeSectionError({ onRetry }) {
  return (
    <div className="w-full text-center py-8 px-6 bg-zinc-50 rounded-2xl border border-zinc-200 flex flex-col items-center">
      <p className="font-semibold text-xs text-zinc-900 mb-1">
        Không thể tải dữ liệu đề thi
      </p>
      <p className="mb-3 text-[11px] text-zinc-500">
        Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
      </p>
      <button
        onClick={onRetry || (() => window.location.reload())}
        className="h-9 px-5 text-xs font-medium rounded-full bg-zinc-900 text-white cursor-pointer inline-flex items-center justify-center leading-none"
      >
        Thử lại
      </button>
    </div>
  )
}

function CompactBookCard({ book, onClick }) {
  const [imgError, setImgError] = useState(false)
  const hasImage = book.coverImageUrl && !imgError

  return (
    <div
      onClick={onClick}
      className="group w-full cursor-pointer flex flex-col transition-all duration-200"
    >
      {/* Book Cover */}
      <div className="w-full aspect-[3/4] rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-2xs group-hover:shadow-md group-hover:border-zinc-400 transition-all duration-300 relative flex flex-col justify-between">
        {hasImage ? (
          <img
            src={resolveImg(book.coverImageUrl)}
            alt={book.title}
            onError={() => setImgError(true)}
            className="img-crisp w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          /* Elegant Minimalist Vector Typography Cover */
          <AcademicCover
            title={book.title}
            seriesName={book.seriesName || 'CAMBRIDGE'}
            volume={book.bookNumber}
            subtitle={`${book.testCount || 4} Full Tests`}
            skill="fullTest"
          />
        )}
      </div>

      {/* Book Info */}
      <div className="mt-2 text-left">
        <h3 className="text-xs font-semibold text-zinc-900 truncate group-hover:text-zinc-600 transition-colors">
          {book.title}
        </h3>
        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
          {book.testCount} đề Full Test
        </p>
      </div>
    </div>
  )
}

// Đợt 3 — Việc 4: thay băng chuyền cuộn ngang (nút mũi tên tròn nổi bóng —
// cảm giác kệ trưng bày) bằng lưới co giãn, giới hạn tối đa `cap` cuốn. Link
// "Xem trọn bộ Cambridge/Practice Plus" ở header section đã có sẵn phía trên
// đóng vai trò "Xem tất cả" khi số bộ đề vượt cap — không cần thêm affordance
// cuộn/xem-thêm nào khác ở đây. Ít sách → lưới tự nhiên không tràn, không cần
// cap; nhiều sách → chỉ hiện `cap` cuốn đầu, phần còn lại xem ở /cambridge
// hoặc /practice-plus (SeriesPage, đã dùng cùng dữ liệu, không cap).
function CompactBookGrid({ books, onBookClick, cap = 6 }) {
  const visible = books.slice(0, cap)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {visible.map((book, i) => (
        <CompactBookCard
          key={`${book.seriesId}-${book.bookNumber}-${i}`}
          book={book}
          onClick={() => onBookClick(book)}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const gate = useAuthGate()
  const navigate = useNavigate()

  const [fullTestsData, setFullTestsData] = useState(null)
  const [reading, setReading] = useState(null)
  const [listening, setListening] = useState(null)
  const [writingSamples, setWritingSamples] = useState(null)
  const [speakingSamples, setSpeakingSamples] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [latestDraft, setLatestDraft] = useState(null)

  const loadData = () => {
    fetch(API_BASE + '/home')
      .then(r => { if (!r.ok) throw new Error('API Error'); return r.json() })
      .then(d => {
        setFullTestsData(d.fullTests ?? 'error')
        setReading(d.reading ?? 'error')
        setListening(d.listening ?? 'error')
        setWritingSamples(d.writingSamples ?? 'error')
        setSpeakingSamples(d.speakingSamples ?? 'error')
      })
      .catch(() => {
        setFullTestsData('error')
        setReading('error')
        setListening('error')
        setWritingSamples('error')
        setSpeakingSamples('error')
      })
  }

  useEffect(() => {
    document.title = 'IELTS Platform — Không gian Luyện thi & Khảo thí IELTS'
    loadData()

    if (user) {
      getUserStats()
        .then(data => setUserStats(data))
        .catch(() => setUserStats(null))

      const draft = getLatestDraft(user.id || user._id)
      setLatestDraft(draft)
    } else {
      setLatestDraft(null)
    }
  }, [user])

  const [seriesTab, setSeriesTab] = useState('cambridge')

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

  const cambridgeBooks = useMemo(() => {
    return groupedFullTests
      .filter(s => {
        const name = (s.seriesName || '').toLowerCase()
        return name.includes('cambridge') && !name.includes('practice') && !name.includes('plus')
      })
      .flatMap(s => s.books)
  }, [groupedFullTests])

  const practicePlusBooks = useMemo(() => {
    return groupedFullTests
      .filter(s => {
        const name = (s.seriesName || '').toLowerCase()
        return name.includes('practice') || name.includes('plus')
      })
      .flatMap(s => s.books)
  }, [groupedFullTests])

  const quickTestBooks = useMemo(() => {
    return [...cambridgeBooks, ...practicePlusBooks]
  }, [cambridgeBooks, practicePlusBooks])

  const handleQuickBookSelect = (book) => {
    navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)
  }

  const enrichedDraft = useMemo(() => {
    if (!latestDraft) return null
    if (latestDraft.examTitle) return latestDraft

    let title = null
    const eId = String(latestDraft.examId)

    if (Array.isArray(fullTestsData)) {
      const match = fullTestsData.find(f => String(f.id) === eId)
      if (match) {
        title = `${match.seriesName || 'Cambridge'} ${match.bookNumber ? `· Test ${match.testNumber || match.bookNumber}` : ''}`
      }
    }
    if (!title && Array.isArray(reading)) {
      const match = reading.find(r => String(r.id) === eId)
      if (match?.title) title = match.title
    }
    if (!title && Array.isArray(listening)) {
      const match = listening.find(l => String(l.id) === eId)
      if (match?.title) title = match.title
    }

    return {
      ...latestDraft,
      examTitle: title || latestDraft.examTitle,
    }
  }, [latestDraft, fullTestsData, reading, listening])

  const handleResumeDraft = (draftToResume) => {
    const d = draftToResume || enrichedDraft || latestDraft
    if (!d) return
    const skill = d.skillType
    const path = skill === 'reading'
      ? `/reading/${d.examId}?resume=true`
      : skill === 'listening'
      ? `/listening/${d.examId}?resume=true`
      : skill === 'writing'
      ? `/writing/${d.examId}?resume=true`
      : skill === 'speaking'
      ? `/speaking/${d.examId}?resume=true`
      : skill === 'practice-reading'
      ? `/practice/reading/${d.examId}`
      : skill === 'practice-listening'
      ? `/practice/listening/${d.examId}`
      : `/cambridge`
    navigate(path)
  }

  const handleDiscardDraft = (draftToDiscard) => {
    const d = draftToDiscard || latestDraft
    if (!d || !user) return
    clearDraft(user.id || user._id, d.examId, d.skillType)
    setLatestDraft(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      {/* ── 1. Hero Section — nền tối "Quỹ đạo Band Score" (Đợt 3) ─────────── */}
      <section className="relative overflow-hidden home-hero-dark">
        <div className="bg-dots-light" aria-hidden="true" />
        <div className="home-hero-glow home-hero-glow-pulse" style={{ top: '-8%', right: '2%' }} aria-hidden="true" />
        <div className="app-container py-12 md:py-16 relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-2xl w-full anim-fade-up">
              <PageHeader
                title="Không gian Luyện thi & Khảo thí IELTS"
                subtitle="Nền tảng kiểm tra trực tuyến mô phỏng kỳ thi trên máy tính, tích hợp AI phân tích 4 kỹ năng."
                titleClassName="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                subtitleClassName="text-sm text-zinc-300 max-w-xl leading-relaxed mt-2"
              />

              <div className="flex flex-wrap items-center gap-3 mt-5">
                <button
                  onClick={() => gate('/cambridge')}
                  className="h-9 px-5 text-white text-sm font-medium rounded-full shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #6d28d9, #4c1d95)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed, #5b21b6)'}
                >
                  Vào phòng thi Cambridge
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('quick-skills-section')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                    else gate('/practice/reading')
                  }}
                  className="h-9 px-5 text-white text-sm font-medium rounded-full border transition-colors cursor-pointer inline-flex items-center justify-center leading-none"
                  style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                >
                  Luyện tập kỹ năng
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center flex-shrink-0 anim-fade-in delay-2" aria-hidden="true">
              <HeroBandOrbit />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Nội dung chính: Bố cục 2 cột (nội dung chính + widget rail) ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── Cột chính bên trái ─────────────────────────────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-9 min-w-0">

            {/* Khối Hero: Tiếp tục bài làm dở */}
            <section className="anim-fade-up">
              {enrichedDraft ? (
                <ResumeHeroCard
                  draft={enrichedDraft}
                  onResume={handleResumeDraft}
                  onDiscard={handleDiscardDraft}
                />
              ) : (
                <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      Bắt đầu luyện tập hôm nay
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Chưa có bài làm dở nào. Chọn một đề để bắt đầu phiên luyện thi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => gate('/cambridge')}
                    className="h-9 px-5 text-white text-sm font-medium rounded-full shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none shrink-0"
                    style={{ background: 'var(--primary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                  >
                    Chọn đề luyện tập
                  </button>
                </Card>
              )}
            </section>

            {/* Section 1: Bộ đề Cambridge Academic & IELTS Practice Plus */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      {seriesTab === 'cambridge' ? 'Bộ đề Cambridge Academic' : 'Bộ đề IELTS Practice Test Plus'}
                    </h2>
                    <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {seriesTab === 'cambridge' ? '(Đề chuẩn IDP / British Council)' : '(Dòng sách luyện đề chuyên sâu độ khó cao)'}
                    </p>
                  </div>

                  {/* Segmented Switcher: Cambridge | Practice Plus | Luyện kỹ năng */}
                  <div className="inline-flex p-1 bg-zinc-100 rounded-full border border-zinc-200 shrink-0 sm:ml-2">
                    <button
                      type="button"
                      onClick={() => setSeriesTab('cambridge')}
                      className={`px-4 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
                        seriesTab === 'cambridge'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Cambridge Academic
                    </button>
                    {practicePlusBooks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSeriesTab('practice-plus')}
                        className={`px-4 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
                          seriesTab === 'practice-plus'
                            ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        Practice Plus
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => document.getElementById('quick-skills-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-4 py-1.5 text-xs rounded-full transition-all cursor-pointer text-zinc-500 hover:text-zinc-900"
                    >
                      Luyện kỹ năng
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => gate(seriesTab === 'cambridge' ? '/cambridge' : '/practice-plus')}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {seriesTab === 'cambridge' ? 'Xem trọn bộ Cambridge' : 'Xem trọn bộ Practice Plus'}
                </button>
              </div>

              {fullTestsData === 'error' ? (
                <HomeSectionError onRetry={loadData} />
              ) : fullTestsData === null ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i}>
                      <div className="w-full aspect-[3/4] bg-zinc-100 rounded-xl animate-pulse" />
                      <div className="h-3.5 bg-zinc-100 rounded mt-2.5 w-3/4 animate-pulse" />
                      <div className="h-3 bg-zinc-100 rounded mt-1.5 w-1/2 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <CompactBookGrid
                  books={seriesTab === 'cambridge' ? cambridgeBooks : practicePlusBooks}
                  onBookClick={(book) => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                />
              )}
            </section>

            {/* Section 2: Luyện tập theo Kỹ năng (Interactive Skills Practice) */}
            <section id="quick-skills-section" className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Luyện tập theo Kỹ năng
                  </h2>
                  <span className="text-[11px] font-mono text-zinc-400">
                    (Bài thi tương tác chấm điểm tự động)
                  </span>
                </div>
              </div>

              {/* 2 Thẻ lớn cân đối: Reading & Listening */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reading */}
                <div
                  onClick={() => gate('/practice/reading')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-700 font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-medium">
                        ĐỀ THI TƯƠNG TÁC
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {Array.isArray(reading) ? `${reading.length} bài luyện tập` : 'T/F/NG, Matching'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <BookOpen className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Reading Practice
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          3 passage học thuật · 40 câu hỏi trắc nghiệm & điền từ · Bảng phân tích dạng bài chi tiết
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-900">
                    <span>Luyện tập Reading</span>
                  </div>
                </div>

                {/* Listening */}
                <div
                  onClick={() => gate('/practice/listening')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-700 font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-medium">
                        ĐỀ THI TƯƠNG TÁC
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {Array.isArray(listening) ? `${listening.length} bài luyện tập` : 'Audio & Transcript'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <Headphones className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Listening Practice
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          4 section audio kèm transcript đối chiếu · 40 câu hỏi · Tự động phát & kiểm tra kết quả
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-900">
                    <span>Luyện tập Listening</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Thư viện bài mẫu học thuật (Writing & Speaking Reference Library) */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Thư viện bài mẫu học thuật
                  </h2>
                  <span className="text-[11px] font-mono text-zinc-400">
                    (Tài liệu tham khảo chuyên sâu Band 8.0+)
                  </span>
                </div>
              </div>

              {/* 2 Thẻ thư viện bài mẫu: Writing & Speaking */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Writing Samples */}
                <div
                  onClick={() => navigate('/writing-samples')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-600 font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-medium">
                        THƯ VIỆN THAM KHẢO
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {Array.isArray(writingSamples) ? `${writingSamples.length} bài mẫu Band 8+` : 'Task 1 & Task 2'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <FileText className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Writing Samples
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          Kho bài viết mẫu Task 1 & Task 2 đạt Band 8.0+ kèm phân tích cấu trúc luận điểm và từ vựng học thuật
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-600 group-hover:text-zinc-900">
                    <span>Khám phá bài mẫu Writing</span>
                  </div>
                </div>

                {/* Speaking Samples */}
                <div
                  onClick={() => navigate('/speaking-samples')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-600 font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-medium">
                        THƯ VIỆN THAM KHẢO
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {Array.isArray(speakingSamples) ? `${speakingSamples.length} bài mẫu Band 8+` : 'Part 1, 2, 3'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <Mic className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Speaking Samples
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          Gợi ý câu trả lời mẫu Part 1, 2, 3 kèm audio phát âm chuẩn bản xứ và cấu trúc câu ăn điểm Lexical Resource
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-600 group-hover:text-zinc-900">
                    <span>Khám phá bài mẫu Speaking</span>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* ── Cột Widget Kỷ luật & Thống kê (bên phải, sticky) ────────────── */}
          <aside className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-20">
            <StreakWidget streak={userStats?.streak ?? 0} isAuthenticated={!!user} />
            <BandOverviewWidget stats={userStats} isAuthenticated={!!user} />
            <QuickFullTestWidget books={quickTestBooks} onSelect={handleQuickBookSelect} />
          </aside>

        </div>
      </main>
    </div>
  )
}
