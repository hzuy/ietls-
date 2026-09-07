import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Flame,
  ArrowRight,
  Clock,
  Headphones,
  FileText,
  Mic,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import AcademicCover from '../components/common/AcademicCover'
import { useAuth } from '../context/AuthContext'
import { useAuthGate } from '../hooks/useAuthGate'
import { getUserStats } from '../services/userService'
import { API_BASE, resolveImg } from '../utils/media'

function HomeSectionError({ onRetry }) {
  return (
    <div className="w-full text-center py-8 px-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
      <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 mb-1">
        Không thể tải dữ liệu đề thi
      </p>
      <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
      </p>
      <button
        onClick={onRetry || (() => window.location.reload())}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
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
      className="group flex-shrink-0 w-[145px] sm:w-[160px] cursor-pointer flex flex-col transition-all duration-200"
    >
      {/* Book Cover */}
      <div className="w-full aspect-[3/4] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/80 shadow-2xs group-hover:shadow-md group-hover:border-zinc-400 dark:group-hover:border-zinc-600 transition-all duration-300 relative flex flex-col justify-between">
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
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
          {book.title}
        </h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {book.testCount} đề Full Test
        </p>
      </div>
    </div>
  )
}

function CompactBookTrack({ books, onBookClick }) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  const scroll = (direction) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: direction * 360, behavior: 'smooth' })
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [books])

  return (
    <div className="relative group/track">
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          aria-label="Cuộn sang trái"
          className="absolute -left-3 top-1/3 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2]" />
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto pb-3 custom-scrollbar scroll-smooth"
      >
        {books.map((book, i) => (
          <CompactBookCard
            key={`${book.seriesId}-${book.bookNumber}-${i}`}
            book={book}
            onClick={() => onBookClick(book)}
          />
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          aria-label="Cuộn sang phải"
          className="absolute -right-3 top-1/3 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 stroke-[2]" />
        </button>
      )}
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

      // Scan localStorage for in-progress draft
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(`ielts_draft_${user.id}_`))
        let best = null
        for (const k of keys) {
          const item = localStorage.getItem(k)
          if (!item) continue
          try {
            const d = JSON.parse(item)
            if (d && d.data && Object.keys(d.data).length > 0) {
              if (!best || Date.parse(d.savedAt) > Date.parse(best.savedAt)) {
                best = d
              }
            }
          } catch (_e) {
            // Ignore parse error
          }
        }
        setLatestDraft(best)
      } catch (_e) {
        // Ignore storage access error
      }
    }
  }, [user])

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

  const allBooks = useMemo(() => {
    return groupedFullTests.flatMap(series => series.books)
  }, [groupedFullTests])

  const handleResumeDraft = () => {
    if (!latestDraft) return
    const skill = latestDraft.skillType
    const path = skill === 'reading'
      ? `/practice/reading/${latestDraft.examId}`
      : skill === 'listening'
      ? `/practice/listening/${latestDraft.examId}`
      : skill === 'writing'
      ? `/writing/${latestDraft.examId}`
      : skill === 'speaking'
      ? `/speaking/${latestDraft.examId}`
      : `/cambridge`
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 flex flex-col">
      <Navbar />

      {/* ── 1. Tinh gọn triệt để khối Hero Section ────────────────────────── */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
        <div className="bg-dots" aria-hidden="true" />
        <div className="app-container py-8 md:py-10 relative">
          <div className="max-w-2xl anim-fade-up">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              Không gian Luyện thi & Khảo thí IELTS
            </h1>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed mt-2">
              Nền tảng kiểm tra trực tuyến mô phỏng kỳ thi trên máy tính, tích hợp AI phân tích 4 kỹ năng.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button
                onClick={() => gate('/cambridge')}
                className="bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium py-2.5 px-4 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Vào phòng thi Cambridge
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('quick-skills-section')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                  else gate('/practice/reading')
                }}
                className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                Luyện tập kỹ năng
              </button>
            </div>
          </div>

          {/* ── 2. Thẻ trạng thái cá nhân (Status Pill / Banner) ────────────────── */}
          <div className="mt-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-2xl">
            {/* Bên trái: Streak icon lửa nhỏ + số ngày liên tục */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {user ? `${userStats?.streak ?? 0} ngày luyện tập liên tục` : 'Mục tiêu: Rèn luyện liên tục mỗi ngày'}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

            {/* Bên phải: Đang làm dở hoặc Mục tiêu hôm nay */}
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 min-w-0">
              {latestDraft ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">
                    Đang làm: <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{latestDraft.skillType ? latestDraft.skillType.toUpperCase() : 'IELTS'}</strong>
                  </span>
                  <button
                    onClick={handleResumeDraft}
                    className="text-xs font-medium text-zinc-900 dark:text-zinc-100 underline cursor-pointer hover:text-black dark:hover:text-white shrink-0 ml-1"
                  >
                    Tiếp tục
                  </button>
                </>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Mục tiêu hôm nay: Hoàn thành 1 bài Test
                </span>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. Nội dung chính: Danh mục đề tinh giản ──────────────────────── */}
      <main className="app-container py-8 flex-1 flex flex-col gap-9">

        {/* Section 1: Bộ đề Cambridge Academic */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Bộ đề Cambridge Academic
              </h2>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                (Đề chuẩn IDP / British Council)
              </span>
            </div>
            <button
              onClick={() => gate('/cambridge')}
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {fullTestsData === 'error' ? (
            <HomeSectionError onRetry={loadData} />
          ) : fullTestsData === null ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-[145px] sm:w-[160px] shrink-0">
                  <div className="w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
                  <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded mt-2.5 w-3/4 animate-pulse" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800/60 rounded mt-1.5 w-1/2 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <CompactBookTrack
              books={allBooks}
              onBookClick={(book) => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
            />
          )}
        </section>

        {/* Section 2: Luyện tập theo Kỹ năng (Quick Skill Access) */}
        <section id="quick-skills-section" className="flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Luyện tập theo Kỹ năng
              </h2>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                (Phân loại dạng bài học thuật)
              </span>
            </div>
          </div>

          {/* 4 Thẻ ngang nhỏ gọn: Reading, Listening, Writing, Speaking kèm số lượng đề */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Reading */}
            <div
              onClick={() => gate('/practice/reading')}
              className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-colors shrink-0">
                  <BookOpen className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">Reading</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                    {Array.isArray(reading) ? `${reading.length} bài luyện tập` : 'T/F/NG, Matching'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>

            {/* Listening */}
            <div
              onClick={() => gate('/practice/listening')}
              className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-colors shrink-0">
                  <Headphones className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">Listening</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                    {Array.isArray(listening) ? `${listening.length} bài luyện tập` : 'Audio & Transcript'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>

            {/* Writing */}
            <div
              onClick={() => navigate('/writing-samples')}
              className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-colors shrink-0">
                  <FileText className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">Writing</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                    {Array.isArray(writingSamples) ? `${writingSamples.length} bài mẫu Band 8+` : 'Task 1 & Task 2'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>

            {/* Speaking */}
            <div
              onClick={() => navigate('/speaking-samples')}
              className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-colors shrink-0">
                  <Mic className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">Speaking</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                    {Array.isArray(speakingSamples) ? `${speakingSamples.length} bài mẫu Band 8+` : 'Part 1, 2, 3'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
