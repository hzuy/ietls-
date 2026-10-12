import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Headphones,
  FileText,
  Mic,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import AcademicCover from '../components/common/AcademicCover'
import BookCard from '../components/common/BookCard'
import PageHeader from '../components/common/PageHeader'
import ResumeHeroCard from '../components/home/ResumeHeroCard'
import StreakWidget from '../components/home/StreakWidget'
import BandOverviewWidget from '../components/home/BandOverviewWidget'
import HeroBandOrbit from '../components/home/HeroBandOrbit'
import { UserCardGridSkeleton } from '../components/skeletons'
import { getLatestDraft, clearDraft } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useAuthGate } from '../hooks/useAuthGate'
import { getUserStats } from '../services/userService'
import { API_BASE, resolveImg } from '../utils/media'
import { toSeriesSlug } from '../utils/slug'

function HomeSectionError({ onRetry }) {
  return (
    <div className="w-full text-center py-8 px-6 bg-zinc-50 rounded-2xl border border-zinc-200 flex flex-col items-center">
      <p className="font-semibold text-xs text-zinc-900 mb-1">
        Không thể tải dữ liệu đề thi
      </p>
      <p className="mb-3 text-[11px] text-zinc-500">
        Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
      </p>
      <PillButton onClick={onRetry || (() => window.location.reload())}>
        Thử lại
      </PillButton>
    </div>
  )
}

function CompactBookScrollList({ books, onBookClick }) {
  const scrollRef = useRef(null)

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 420
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="relative group/scroll">
      {/* Nút bấm trượt nhanh trái */}
      <button
        type="button"
        onClick={() => scroll('left')}
        aria-label="Cuộn sang trái"
        className="hidden sm:flex absolute -left-3.5 top-[40%] -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-zinc-200 shadow-md text-zinc-700 hover:text-zinc-950 hover:bg-white hover:scale-105 items-center justify-center transition-all z-10 cursor-pointer opacity-0 group-hover/scroll:opacity-100"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Thanh trượt ngang 1 hàng */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent snap-x snap-mandatory"
        style={{ scrollbarWidth: 'thin' }}
      >
        {books.map((book, i) => (
          <div
            key={`${book.seriesId}-${book.bookNumber}-${i}`}
            className="w-[252px] shrink-0 snap-start"
          >
            <BookCard
              book={book}
              onClick={() => onBookClick(book)}
            />
          </div>
        ))}
      </div>

      {/* Nút bấm trượt nhanh phải */}
      <button
        type="button"
        onClick={() => scroll('right')}
        aria-label="Cuộn sang phải"
        className="hidden sm:flex absolute -right-3.5 top-[40%] -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-zinc-200 shadow-md text-zinc-700 hover:text-zinc-950 hover:bg-white hover:scale-105 items-center justify-center transition-all z-10 cursor-pointer opacity-0 group-hover/scroll:opacity-100"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
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

  const [selectedSeriesId, setSelectedSeriesId] = useState(null)

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
          testNumbers: new Set(),
          skillTestCount: 0,
          attemptCount: 0
        }
      }
      acc[bKey].testNumbers.add(item.testNumber)
      if (item.exams) {
        acc[bKey].skillTestCount += Object.keys(item.exams).length
        Object.values(item.exams).forEach(e => {
          acc[bKey].attemptCount += (e.attemptCount || 0)
        })
      }
      if (item.attemptCount && !item.exams) {
        acc[bKey].attemptCount += item.attemptCount
      }
      return acc
    }, {})
    const normalizedBooks = Object.values(booksMap).map(b => ({
      ...b,
      testCount: b.skillTestCount > 0 ? b.skillTestCount : b.testNumbers.size,
      attemptCount: b.attemptCount || 0,
      title: `${b.seriesName} ${b.bookNumber}`
    }))
    const rows = normalizedBooks.reduce((acc, book) => {
      const sId = book.seriesId
      if (!acc[sId]) acc[sId] = { seriesId: sId, seriesName: book.seriesName, books: [] }
      acc[sId].books.push(book)
      return acc
    }, {})
    return Object.values(rows).map(r => ({ ...r, books: r.books.sort((a, b) => b.bookNumber - a.bookNumber) }))
  }, [fullTestsData])

  const currentSeries = useMemo(() => {
    if (!groupedFullTests.length) return null
    if (selectedSeriesId !== null) {
      const found = groupedFullTests.find(s => String(s.seriesId) === String(selectedSeriesId))
      if (found) return found
    }
    return groupedFullTests[0]
  }, [groupedFullTests, selectedSeriesId])

  const quickTestBooks = useMemo(() => {
    return groupedFullTests.flatMap(s => s.books)
  }, [groupedFullTests])

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
      : `/full-test`
    navigate(path)
  }

  const handleDiscardDraft = (draftToDiscard) => {
    const d = draftToDiscard || latestDraft
    if (!d || !user) return
    clearDraft(user.id || user._id, d.examId, d.skillType)
    setLatestDraft(null)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── 1. Hero Section — nền sáng "Quỹ đạo Band Score" (redesign, thay bản
           nền tối trước đây) ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden home-hero-light">
        <div className="bg-dots" aria-hidden="true" />
        <div className="home-hero-blob home-hero-blob-primary home-hero-blob-pulse" style={{ top: '-10%', right: '4%' }} aria-hidden="true" />
        <div className="home-hero-blob home-hero-blob-accent home-hero-blob-pulse" style={{ bottom: '-12%', left: '2%' }} aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12 relative w-full">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12">
            <div className="max-w-xl lg:max-w-2xl flex-1 w-full anim-fade-up">
              <PageHeader
                title={user ? `Chào ${user.name || user.displayName || user.email?.split('@')[0] || 'bạn'}, hôm nay luyện gì nào?` : 'Không gian luyện thi & khảo thí IELTS'}
                subtitle="Mô phỏng kỳ thi trên máy tính, tích hợp AI phân tích 4 kỹ năng."
                titleClassName="text-3xl sm:text-4xl lg:text-[40px] font-bold text-zinc-900 tracking-tight leading-[1.2]"
                subtitleClassName="text-base sm:text-lg text-zinc-500 leading-relaxed mt-2.5 sm:mt-3"
              />

              <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 mt-6 sm:mt-7">
                <button
                  onClick={() => {
                    const firstSeries = groupedFullTests[0]
                    const slug = firstSeries ? toSeriesSlug(firstSeries.seriesName) : ''
                    gate(slug ? `/series/${slug}` : '/cambridge')
                  }}
                  className="h-11 pointer-coarse:h-12 px-6 sm:px-7 text-white text-sm sm:text-base font-medium rounded-full shadow-xs transition-all cursor-pointer inline-flex items-center justify-center leading-none hover:shadow-md hover:scale-[1.01]"
                  style={{ background: 'var(--primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                >
                  {groupedFullTests[0]?.seriesName
                    ? `Vào phòng thi ${groupedFullTests[0].seriesName}`
                    : 'Vào phòng thi Cambridge'}
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('quick-skills-section')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                    else gate('/practice/reading')
                  }}
                  className="h-11 pointer-coarse:h-12 px-6 sm:px-7 text-zinc-700 text-sm sm:text-base font-medium rounded-full border border-zinc-300 bg-white transition-all cursor-pointer inline-flex items-center justify-center leading-none hover:bg-zinc-50 hover:border-zinc-400 hover:scale-[1.01]"
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

      {/* ── 2. Nội dung chính ─────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="flex flex-col gap-9">

          {/* Dải "Tiến độ của bạn": khối resume bài dở (nếu có) + Streak & Band điểm cùng hàng */}
          <section className="anim-fade-up flex flex-col gap-4">
            {enrichedDraft && (
              <ResumeHeroCard
                draft={enrichedDraft}
                onResume={handleResumeDraft}
                onDiscard={handleDiscardDraft}
              />
            )}

            {/* Chuỗi ngày luyện tập (trái) & Band điểm hiện tại (phải) trên cùng 1 hàng */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full">
                <StreakWidget
                  streak={userStats?.streak ?? 0}
                  activityMap={userStats?.activityMap}
                  isAuthenticated={!!user}
                  className="flex-1"
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full">
                <BandOverviewWidget
                  stats={userStats}
                  isAuthenticated={!!user}
                  className="flex-1"
                />
              </div>
            </div>
          </section>

          {/* Section 1: Bộ đề thi chuẩn hóa (Thanh trượt ngang 1 hàng) */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      {currentSeries?.seriesName === 'IELTS Cambridge Academic'
                        ? 'Bộ đề Cambridge Academic'
                        : currentSeries?.seriesName === 'IELTS Practice Test Plus'
                        ? 'Bộ đề IELTS Practice Test Plus'
                        : `Bộ đề ${currentSeries?.seriesName || 'luyện thi'}`}
                    </h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {currentSeries?.seriesName?.toLowerCase().includes('practice')
                        ? 'Dòng sách luyện đề chuyên sâu độ khó cao'
                        : 'Tuyển tập đề thi chuẩn format quốc tế'}
                    </p>
                  </div>

                  {/* Segmented Switcher: Render động theo các series trong DB */}
                  <div className="seg-scroller p-1 bg-zinc-100 rounded-full border border-zinc-200 sm:ml-2">
                    {groupedFullTests.map(s => {
                      const isActive = currentSeries?.seriesId === s.seriesId
                      let tabLabel = s.seriesName
                      if (s.seriesName === 'IELTS Cambridge Academic') tabLabel = 'Cambridge Academic'
                      else if (s.seriesName === 'IELTS Practice Test Plus') tabLabel = 'Practice Plus'

                      return (
                        <button
                          key={s.seriesId}
                          type="button"
                          onClick={() => setSelectedSeriesId(s.seriesId)}
                          className={`px-4 py-1.5 pointer-coarse:min-h-11 text-xs rounded-full transition-all cursor-pointer ${
                            isActive
                              ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                              : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                        >
                          {tabLabel}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => document.getElementById('quick-skills-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-4 py-1.5 pointer-coarse:min-h-11 text-xs rounded-full transition-all cursor-pointer text-zinc-500 hover:text-zinc-900"
                    >
                      Luyện kỹ năng
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const slug = toSeriesSlug(currentSeries?.seriesName)
                    if (slug) {
                      gate(`/series/${slug}`)
                    } else if (currentSeries?.seriesId) {
                      gate(`/series/${currentSeries.seriesId}`)
                    } else {
                      gate('/full-test')
                    }
                  }}
                  className="tap-pad text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
                >
                  Xem tất cả →
                </button>
              </div>

              {fullTestsData === 'error' ? (
                <HomeSectionError onRetry={loadData} />
              ) : fullTestsData === null ? (
                <div className="flex gap-4 overflow-hidden py-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[252px] shrink-0 aspect-[3/2] rounded-xl bg-[#E3E7ED] animate-pulse" />
                  ))}
                </div>
              ) : (
                <CompactBookScrollList
                  books={currentSeries?.books || []}
                  onBookClick={(book) => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                />
              )}
            </section>

            {/* Section 2 (Đợt 3 — Việc 5): gộp "Luyện tập theo Kỹ năng" +
                "Thư viện bài mẫu học thuật" thành 1 lưới 4 ô "Khám phá thêm" —
                giảm chiều cao trang, hạ độ ưu tiên thị giác so với dải tiến độ
                và bộ đề Cambridge/Practice Plus ở trên. */}
            <section id="quick-skills-section" className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <h2 className="text-base font-semibold text-zinc-900">
                  Khám phá thêm
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Reading */}
                <div
                  onClick={() => gate('/practice/reading')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-700 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                        Tương tác
                      </span>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {Array.isArray(reading) ? `${reading.length} bài luyện tập` : 'T/F/NG, Matching'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <BookOpen className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Reading
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          3 passage học thuật · 40 câu hỏi trắc nghiệm & điền từ
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-900 group-hover:text-zinc-600 transition-colors">
                    Luyện tập Reading →
                  </div>
                </div>

                {/* Listening */}
                <div
                  onClick={() => gate('/practice/listening')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-700 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                        Tương tác
                      </span>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {Array.isArray(listening) ? `${listening.length} bài luyện tập` : 'Audio & Transcript'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <Headphones className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Listening
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          4 section audio kèm transcript · 40 câu hỏi
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-900 group-hover:text-zinc-600 transition-colors">
                    Luyện tập Listening →
                  </div>
                </div>

                {/* Writing Samples */}
                <div
                  onClick={() => navigate('/writing-samples')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-600 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                        Bài mẫu
                      </span>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {Array.isArray(writingSamples) ? `${writingSamples.length} bài mẫu Band 8+` : 'Task 1 & Task 2'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <FileText className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Writing mẫu
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          Bài mẫu Task 1 & Task 2 Band 8.0+ kèm phân tích cấu trúc
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-600 group-hover:text-zinc-900 transition-colors">
                    Khám phá bài mẫu Writing →
                  </div>
                </div>

                {/* Speaking Samples */}
                <div
                  onClick={() => navigate('/speaking-samples')}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-zinc-100 text-zinc-600 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                        Bài mẫu
                      </span>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {Array.isArray(speakingSamples) ? `${speakingSamples.length} bài mẫu Band 8+` : 'Part 1, 2, 3'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                        <Mic className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-black transition-colors">
                          Speaking mẫu
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          Câu trả lời mẫu Part 1, 2, 3 kèm audio phát âm chuẩn
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs font-medium text-zinc-600 group-hover:text-zinc-900 transition-colors">
                    Khám phá bài mẫu Speaking →
                  </div>
                </div>
              </div>
            </section>

        </div>
      </main>
    </div>
  )
}
