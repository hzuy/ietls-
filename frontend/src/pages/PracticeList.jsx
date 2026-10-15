import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Breadcrumb from '../components/common/Breadcrumb'
import ContentCard from '../components/common/ContentCard'
import Card from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import PillButton from '../components/common/PillButton'
import AcademicCover from '../components/common/AcademicCover'
import { UserCardGridSkeleton } from '../components/skeletons'
import { CONTENT_CARD_CONFIG } from '../components/common/contentCardConfig'
import { getTypesBySkill } from '../utils/questionTypes'
import { API_BASE, resolveImg } from '../utils/media'
import { History, ArrowRight, Feather, Headphones, PauseCircle, RotateCcw } from 'lucide-react'
import { handleImgError } from '../utils/media'
import { useAuth } from '../context/AuthContext'
import { getPracticeAttempts } from '../services/practiceService'
import { checkDraft, clearDraft } from '../services/draftService'
import ExamAttemptListModal from '../components/exam/ExamAttemptListModal'

const SKILL_META = {
  reading: {
    icon: '📖',
    label: 'Reading Practice',
    sub: '3 đoạn văn · 40 câu hỏi · 60 phút',
    colorVar: '--skill-r-color',
    bgVar: '--skill-r-bg',
    borderVar: '--skill-r-border',
    path: '/practice/reading',
  },
  listening: {
    icon: '🎧',
    label: 'Listening Practice',
    sub: '4 phần · 40 câu hỏi · 30 phút',
    colorVar: '--skill-l-color',
    bgVar: '--skill-l-bg',
    borderVar: '--skill-l-border',
    path: '/practice/listening',
  },
}

const NO_EXAMS = []

export default function PracticeList({ skill: skillKey }) {
  const navigate = useNavigate()
  const skill = SKILL_META[skillKey] ? skillKey : 'reading'
  const meta = SKILL_META[skill]
  const availableTypes = getTypesBySkill(skill)
  const { user } = useAuth()
  const [draftInfo, setDraftInfo] = useState({})
  const [historyFor, setHistoryFor] = useState(null)
  const isLearner = user?.role === 'user'

  const examsQuery = useQuery({
    queryKey: ['practiceList', skill],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/practice/${skill}?limit=0`)
      if (!r.ok) throw new Error('API Error')
      return r.json()
    },
    staleTime: 1000 * 60 * 5,
  })
  const attemptsQuery = useQuery({
    queryKey: ['practiceAttempts', skill, user?.id],
    queryFn: () => getPracticeAttempts(skill),
    enabled: isLearner,
    staleTime: 1000 * 30,
  })
  const exams = examsQuery.data ?? NO_EXAMS
  const attemptsByExam = (isLearner && attemptsQuery.data) || {}
  const loading = examsQuery.isPending || (isLearner && attemptsQuery.isPending && !attemptsQuery.isError)
  const error = examsQuery.isError

  useEffect(() => {
    const updateDrafts = () => {
      if (!user || user.role !== 'user' || !exams.length) {
        setDraftInfo({})
        return
      }
      const userId = user.id || user._id
      const skillType = skill === 'reading' ? 'practice-reading' : 'practice-listening'
      const info = {}
      for (const exam of exams) {
        info[exam.id] = checkDraft(userId, exam.id, skillType)
      }
      setDraftInfo(info)
    }

    updateDrafts()
    window.addEventListener('focus', updateDrafts)
    return () => window.removeEventListener('focus', updateDrafts)
  }, [skill, user, exams])

  useEffect(() => {
    document.title = 'Luyện tập Kỹ năng | IELTS Pro'
  }, [])

  const groupedExams = availableTypes.map(type => ({
    ...type,
    items: exams.filter(e => e.type === type.key)
  })).filter(group => group.items.length > 0)

  const otherExams = exams.filter(e => !availableTypes.some(t => t.key === e.type))

  const handleRetakePractice = (item) => {
    const skillType = skill === 'reading' ? 'practice-reading' : 'practice-listening'
    if (user) {
      const userId = user.id || user._id
      clearDraft(userId, item.id, skillType)
      setDraftInfo(prev => ({
        ...prev,
        [item.id]: { hasDraft: false }
      }))
    }
    navigate(`/practice/${skill}/${item.id}`)
  }

  const renderCard = (item, idx) => {
    const attempts = attemptsByExam[item.id] || []
    const latest = attempts[0]
    const hasImage = Boolean(item.thumbnailUrl)
    const hasDraft = Boolean(draftInfo[item.id]?.hasDraft)

    return (
      <div
        key={item.id}
        onClick={() => navigate(`/practice/${skill}/${item.id}`)}
        className={`anim-fade-up delay-${Math.min(idx + 1, 8)} group rounded-2xl border ${hasDraft ? 'border-blue-200/90 hover:border-blue-300' : 'border-zinc-200 hover:border-zinc-300'} bg-white overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full cursor-pointer`}
      >
        {/* Top Thumbnail / Illustration */}
        <div className="w-full aspect-[16/10] overflow-hidden relative flex items-center justify-center bg-zinc-100">
          {hasImage ? (
            <img
              src={resolveImg(item.thumbnailUrl)}
              alt={item.title}
              onError={handleImgError}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          ) : skill === 'reading' ? (
            <div className="w-full h-full bg-[#84b74e] flex items-center justify-center">
              <Feather className="w-12 h-12 text-[#3b5e19]" strokeWidth={2} />
            </div>
          ) : (
            <div className="w-full h-full bg-[#7c69c9] flex items-center justify-center">
              <Headphones className="w-12 h-12 text-[#2f2066]" strokeWidth={2} />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-zinc-900 line-clamp-2 leading-snug group-hover:text-zinc-950 transition-colors">
              {item.title}
            </h3>

            {/* Question count & Status badge */}
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-xs text-zinc-500 font-medium">
                {item.questionCount || 0} câu hỏi
              </span>

              {latest ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200/60 font-mono">
                  Gần nhất {latest.correct}/{latest.total}
                </span>
              ) : hasDraft ? null : (
                <span className="text-xs text-zinc-400 font-medium">
                  Chưa làm
                </span>
              )}
            </div>
          </div>

          {/* Action buttons at bottom-right */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-1">
            {latest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setHistoryFor(item)
                }}
                title="Lịch sử làm bài"
                aria-label="Lịch sử làm bài"
                className="w-9 h-9 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 hover:border-zinc-300 text-zinc-700 flex items-center justify-center transition shadow-2xs cursor-pointer hover:scale-105"
              >
                <History className="w-4 h-4" />
              </button>
            )}

            {hasDraft && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRetakePractice(item)
                }}
                title="Làm lại từ đầu"
                aria-label="Làm lại từ đầu"
                className="w-9 h-9 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 hover:border-zinc-300 text-zinc-700 flex items-center justify-center transition shadow-2xs cursor-pointer hover:scale-105"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {hasDraft ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/practice/${skill}/${item.id}`)
                }}
                title="Làm tiếp"
                aria-label="Làm tiếp"
                className="w-9 h-9 rounded-full border border-blue-200 bg-blue-50/90 hover:bg-blue-100 hover:border-blue-300 text-blue-600 flex items-center justify-center transition shadow-2xs cursor-pointer hover:scale-105"
              >
                <PauseCircle className="w-4 h-4 text-blue-600" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/practice/${skill}/${item.id}`)
                }}
                title={latest ? "Làm lại" : "Làm bài"}
                aria-label={latest ? "Làm lại" : "Làm bài"}
                className="w-9 h-9 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 hover:border-zinc-300 text-zinc-700 flex items-center justify-center transition shadow-2xs cursor-pointer hover:scale-105"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      {/* Breadcrumb */}
      <div className="app-container pt-4 pb-0">
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: meta?.label || 'Reading Practice' }]} />
        <PageHeader title={meta?.label || 'Reading Practice'} titleClassName="text-2xl font-bold mt-3 text-zinc-900" />
      </div>

      {/* Content */}
      <div className="app-container pt-4 pb-16 flex flex-col gap-12">
        {loading ? (
          <UserCardGridSkeleton aspect="160px" count={8} />
        ) : error ? (
          <Card className="text-center py-20 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</p>
            <p className="text-zinc-500 mb-6 max-w-sm text-sm">Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
            <PillButton onClick={() => window.location.reload()}>Thử lại</PillButton>
          </Card>
        ) : exams.length === 0 ? (
          <Card className="text-center py-20 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <p className="text-lg font-bold text-zinc-900 mb-2">Không tìm thấy bài luyện tập</p>
            <p className="text-zinc-500 mb-6 max-w-sm text-sm">Hãy thử lựa chọn cấp độ hoặc kỹ năng khác.</p>
            <PillButton onClick={() => navigate('/')}>Về trang chủ</PillButton>
          </Card>
        ) : (
          <>
            {groupedExams.length > 0 ? (
              <>
                {groupedExams.map((group) => (
                  <section key={group.key}>
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-lg font-semibold text-zinc-900 m-0">{group.label}</h2>
                      <span className="font-mono font-semibold bg-white text-zinc-600 border border-zinc-200 px-2.5 py-0.5 rounded-full shadow-xs text-xs">
                        {group.items.length} bài
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                      {group.items.map((item, idx) => renderCard(item, idx))}
                    </div>
                  </section>
                ))}

                {otherExams.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                    {otherExams.map((item, idx) => renderCard(item, idx))}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                {exams.map((item, idx) => renderCard(item, idx))}
              </div>
            )}
          </>
        )}
      </div>
      <ExamAttemptListModal
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        skill={skill}
        skillLabel={historyFor?.title || ''}
        attempts={historyFor ? attemptsByExam[historyFor.id] || [] : []}
        onReview={a => navigate(`/practice/${skill}/${a.examId}?attemptId=${a.attemptId}`)}
      />
    </div>
  )
}
