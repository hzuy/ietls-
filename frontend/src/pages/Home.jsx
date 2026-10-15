import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import PillButton from '../components/common/PillButton'
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
import { useHomeData } from '../hooks/useCatalog'

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

function ItemCoverCard({
  title,
  subtitle,
  actionText = 'Xem bài test',
  coverImageUrl,
  fallbackSkill,
  onClick,
}) {
  const [imgError, setImgError] = useState(false)
  const hasImage = coverImageUrl && !imgError

  return (
    <div
      onClick={onClick}
      className="group w-full max-w-[252px] flex flex-col transition-all duration-200 cursor-pointer"
    >
      {/* Cover — chuẩn tỷ lệ 3:2 kích thước 252x168 px, nền #E3E7ED */}
      <div className="w-full aspect-[3/2] rounded-xl overflow-hidden border border-zinc-200/90 bg-[#E3E7ED] dark:bg-zinc-800 shadow-2xs group-hover:shadow-md group-hover:border-zinc-400 transition-all duration-300 relative flex items-center justify-center">
        {hasImage ? (
          <img
            src={resolveImg(coverImageUrl)}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <AcademicCover
            title={title}
            seriesName={
              fallbackSkill === 'reading' || fallbackSkill === 'listening'
                ? 'PRACTICE'
                : 'BAND 8.0+'
            }
            subtitle={
              fallbackSkill === 'reading'
                ? 'Reading Test'
                : fallbackSkill === 'listening'
                ? 'Listening Test'
                : fallbackSkill === 'writing'
                ? 'Writing Sample'
                : 'Speaking Sample'
            }
            skill={fallbackSkill}
          />
        )}
      </div>

      {/* Info — tên bài, thông tin tóm tắt và link hành động đồng bộ BookCard */}
      <div className="mt-2.5 text-left flex flex-col">
        <h3
          className="text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 transition-colors line-clamp-1"
          title={title}
        >
          {title}
        </h3>
        <p className="text-[13px] sm:text-[13.5px] font-medium text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
          {subtitle}
        </p>
        <div className="mt-1.5 text-[13px] sm:text-[13.5px] font-semibold text-rose-600 dark:text-rose-400 group-hover:text-rose-700 flex items-center gap-1">
          <span>{actionText}</span>
          <span className="transition-transform duration-200 group-hover:translate-x-0.5 font-bold">›</span>
        </div>
      </div>
    </div>
  )
}

function CompactItemScrollList({ items, renderItem, emptyText = 'Chưa có nội dung' }) {
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

  if (!items || items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-zinc-400 bg-zinc-50 rounded-xl border border-zinc-100">
        {emptyText}
      </div>
    )
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
        {items.map((item, i) => (
          <div
            key={item.id ?? i}
            className="w-[252px] shrink-0 snap-start"
          >
            {renderItem(item, i)}
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

  const [latestDraft, setLatestDraft] = useState(null)
  const [practiceSkillTab, setPracticeSkillTab] = useState('reading')
  const [referenceTab, setReferenceTab] = useState('writing')
  const userId = user?.id || user?._id

  const homeQuery = useHomeData()

  const statsQuery = useQuery({
    queryKey: ['userStats', userId],
    queryFn: getUserStats,
    enabled: !!userId,
    staleTime: 1000 * 30,
  })
  const userStats = statsQuery.data ?? null
  const pageLoading = homeQuery.isPending || (!!userId && statsQuery.isPending)

  const homeSection = key => {
    if (homeQuery.isError) return 'error'
    if (pageLoading || !homeQuery.data) return null
    return homeQuery.data[key] ?? 'error'
  }
  const fullTestsData = homeSection('fullTests')
  const reading = homeSection('reading')
  const listening = homeSection('listening')
  const writingSamples = homeSection('writingSamples')
  const speakingSamples = homeSection('speakingSamples')
  const loadData = () => homeQuery.refetch()
  const statsLoading = pageLoading

  useEffect(() => {
    document.title = 'IELTS Platform — Không gian Luyện thi & Khảo thí IELTS'
  }, [])

  useEffect(() => {
    setLatestDraft(userId ? getLatestDraft(userId) : null)
  }, [userId])

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

    let title = latestDraft.examTitle
    const isGeneric = !title || /·\s*Đề\s*#\d+/i.test(title)

    if (isGeneric) {
      const eId = String(latestDraft.examId)

      if (Array.isArray(fullTestsData)) {
        for (const f of fullTestsData) {
          if (f.exams) {
            for (const [skillKey, skillExam] of Object.entries(f.exams)) {
              if (String(skillExam?.id) === eId) {
                const sName = f.seriesName || 'IELTS'
                const bNum = f.bookNumber ? ` ${f.bookNumber}` : ''
                const tNum = f.testNumber ? ` · Test ${f.testNumber}` : ''
                const skillLabel = skillKey === 'reading' ? 'Reading' : skillKey === 'listening' ? 'Listening' : skillKey === 'writing' ? 'Writing' : skillKey === 'speaking' ? 'Speaking' : ''
                title = skillExam.title || `${sName}${bNum}${tNum} ${skillLabel}`.trim()
                break
              }
            }
          }
          if (title && !/·\s*Đề\s*#\d+/i.test(title)) break
        }
      }
      if ((!title || isGeneric) && Array.isArray(reading)) {
        const match = reading.find(r => String(r.id) === eId)
        if (match?.title) title = match.title
      }
      if ((!title || isGeneric) && Array.isArray(listening)) {
        const match = listening.find(l => String(l.id) === eId)
        if (match?.title) title = match.title
      }
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
            {enrichedDraft && (pageLoading ? (
              <div aria-hidden="true" className="h-[214px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs flex flex-col gap-3">
                <div className="h-5 w-40 rounded-full bg-zinc-100 animate-pulse" />
                <div className="h-7 w-2/3 rounded-lg bg-zinc-100 animate-pulse" />
                <div className="h-2 w-full rounded-full bg-zinc-100 animate-pulse mt-2" />
                <div className="h-10 w-28 rounded-full bg-zinc-100 animate-pulse mt-auto" />
              </div>
            ) : (
              <ResumeHeroCard
                draft={enrichedDraft}
                onResume={handleResumeDraft}
              />
            ))}

            {/* Chuỗi ngày luyện tập (trái) & Band điểm hiện tại (phải) trên cùng 1 hàng */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full">
                <StreakWidget
                  streak={userStats?.streak ?? 0}
                  activityMap={userStats?.activityMap}
                  isAuthenticated={!!user}
                  loading={statsLoading}
                  className="flex-1"
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full">
                <BandOverviewWidget
                  stats={userStats}
                  isAuthenticated={!!user}
                  loading={statsLoading}
                  className="flex-1"
                />
              </div>
            </div>
          </section>

          {/* Section 1: Bộ đề thi chuẩn hóa (Thanh trượt ngang 1 hàng) */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Bộ đề IELTS
                  </h2>

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

            {/* Section 2: Luyện đề (Reading & Listening) — giao diện đồng bộ BookCard & CompactBookScrollList */}
            <section id="quick-skills-section" className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Luyện đề
                  </h2>

                  {/* Segmented Switcher */}
                  <div className="seg-scroller p-1 bg-zinc-100 rounded-full border border-zinc-200 sm:ml-2">
                    <button
                      type="button"
                      onClick={() => setPracticeSkillTab('reading')}
                      className={`px-4 py-1.5 pointer-coarse:min-h-11 text-xs rounded-full transition-all cursor-pointer ${
                        practiceSkillTab === 'reading'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Reading
                    </button>
                    <button
                      type="button"
                      onClick={() => setPracticeSkillTab('listening')}
                      className={`px-4 py-1.5 pointer-coarse:min-h-11 text-xs rounded-full transition-all cursor-pointer ${
                        practiceSkillTab === 'listening'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Listening
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (practiceSkillTab === 'reading') {
                      gate('/practice/reading')
                    } else {
                      gate('/practice/listening')
                    }
                  }}
                  className="tap-pad text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
                >
                  Xem tất cả →
                </button>
              </div>

              {(practiceSkillTab === 'reading' ? reading : listening) === 'error' ? (
                <HomeSectionError onRetry={loadData} />
              ) : (practiceSkillTab === 'reading' ? reading : listening) === null ? (
                <div className="flex gap-4 overflow-hidden py-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[252px] shrink-0 aspect-[3/2] rounded-xl bg-[#E3E7ED] animate-pulse" />
                  ))}
                </div>
              ) : (
                <CompactItemScrollList
                  items={practiceSkillTab === 'reading' ? reading : listening}
                  renderItem={(item) => (
                    <ItemCoverCard
                      title={item.title}
                      subtitle={
                        <>
                          <span>{item.questionCount ? `${item.questionCount} câu hỏi` : 'Luyện tập'}</span>
                          <span className="text-zinc-300 dark:text-zinc-600">·</span>
                          <span>{item.level || (practiceSkillTab === 'reading' ? 'Reading' : 'Listening')}</span>
                        </>
                      }
                      actionText="Xem bài test"
                      coverImageUrl={item.thumbnailUrl}
                      fallbackSkill={practiceSkillTab}
                      onClick={() => gate(`/practice/${practiceSkillTab}/${item.id}`)}
                    />
                  )}
                  emptyText={`Chưa có bài luyện tập ${practiceSkillTab === 'reading' ? 'Reading' : 'Listening'}`}
                />
              )}
            </section>

            {/* Section 3: Tham khảo (Writing & Speaking) — giao diện đồng bộ BookCard & CompactBookScrollList */}
            <section id="reference-samples-section" className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Tham khảo
                  </h2>

                  {/* Segmented Switcher */}
                  <div className="seg-scroller p-1 bg-zinc-100 rounded-full border border-zinc-200 sm:ml-2">
                    <button
                      type="button"
                      onClick={() => setReferenceTab('writing')}
                      className={`px-4 py-1.5 pointer-coarse:min-h-11 text-xs rounded-full transition-all cursor-pointer ${
                        referenceTab === 'writing'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Writing
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceTab('speaking')}
                      className={`px-4 py-1.5 pointer-coarse:min-h-11 text-xs rounded-full transition-all cursor-pointer ${
                        referenceTab === 'speaking'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Speaking
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (referenceTab === 'writing') {
                      navigate('/writing-samples')
                    } else {
                      navigate('/speaking-samples')
                    }
                  }}
                  className="tap-pad text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
                >
                  Xem tất cả →
                </button>
              </div>

              {(referenceTab === 'writing' ? writingSamples : speakingSamples) === 'error' ? (
                <HomeSectionError onRetry={loadData} />
              ) : (referenceTab === 'writing' ? writingSamples : speakingSamples) === null ? (
                <div className="flex gap-4 overflow-hidden py-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[252px] shrink-0 aspect-[3/2] rounded-xl bg-[#E3E7ED] animate-pulse" />
                  ))}
                </div>
              ) : (
                <CompactItemScrollList
                  items={referenceTab === 'writing' ? writingSamples : speakingSamples}
                  renderItem={(item) => (
                    <ItemCoverCard
                      title={item.title}
                      subtitle={
                        referenceTab === 'writing' ? (
                          <>
                            <span>
                              {item.level
                                ? item.level.toLowerCase() === 'task1'
                                  ? 'Task 1'
                                  : item.level.toLowerCase() === 'task2'
                                  ? 'Task 2'
                                  : item.level
                                : 'Writing'}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span>{item.examType || 'Band 8.0+'}</span>
                          </>
                        ) : (
                          <>
                            <span>{item.examType || 'Part 1, 2, 3'}</span>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span>Band 8.0+</span>
                          </>
                        )
                      }
                      actionText="Xem bài mẫu"
                      coverImageUrl={item.thumbnailUrl}
                      fallbackSkill={referenceTab}
                      onClick={() => navigate(`/samples/${referenceTab}/${item.id}`)}
                    />
                  )}
                  emptyText={`Chưa có bài mẫu ${referenceTab === 'writing' ? 'Writing' : 'Speaking'}`}
                />
              )}
            </section>

        </div>
      </main>
    </div>
  )
}
