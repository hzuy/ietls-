import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Inbox, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Eye, RotateCcw } from 'lucide-react'
import { getMyHistory } from '../services/historyService'
import Card from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import StatValue from '../components/common/StatValue'

import { UserHistorySkeleton } from '../components/skeletons'

const SKILL_META = {
  reading:   { label: 'Reading',   colorVar: '--skill-r-color', bgVar: '--skill-r-bg', borderVar: '--skill-r-border' },
  listening: { label: 'Listening', colorVar: '--skill-l-color', bgVar: '--skill-l-bg', borderVar: '--skill-l-border' },
}

const PAGE_SIZE = 20

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function SkillBadge({ skill }) {
  const meta = SKILL_META[skill]
  if (!meta) return null
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: `var(${meta.bgVar})`, color: `var(${meta.colorVar})`, border: `1px solid var(${meta.borderVar})` }}
    >
      {meta.label}
    </span>
  )
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [skill, setSkill] = useState('')
  const [examId, setExamId] = useState('')

  const { data = {}, isLoading, isError, refetch } = useQuery({
    queryKey: ['history', 'attempts', { page, limit: PAGE_SIZE, skill, examId }],
    queryFn: () => getMyHistory({ page, limit: PAGE_SIZE, skill: skill || undefined, examId: examId || undefined }),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  })

  // Danh sách đề cho bộ lọc "Đề thi" — lấy riêng (không phân trang, tối đa 100 lượt gần nhất
  // theo skill đang chọn) để tránh chỉ hiện các đề nằm trong đúng trang hiện tại.
  const { data: optionsData = {} } = useQuery({
    queryKey: ['history', 'examOptions', { skill }],
    queryFn: () => getMyHistory({ page: 1, limit: 100, skill: skill || undefined }),
    staleTime: 1000 * 60 * 5,
  })

  const examOptions = useMemo(() => {
    const seen = new Map()
    for (const h of optionsData.history || []) {
      if (!seen.has(h.examId)) seen.set(h.examId, h.examTitle)
    }
    return Array.from(seen, ([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title))
  }, [optionsData])

  const history = data.history || []
  const total = data.total || 0
  const pages = data.pages || 1

  const handleSkillChange = (e) => { setSkill(e.target.value); setExamId(''); setPage(1) }
  const handleExamChange = (e) => { setExamId(e.target.value); setPage(1) }
  const resetFilters = () => { setSkill(''); setExamId(''); setPage(1) }

  const handleReview = (h) => {
    const params = new URLSearchParams({ attemptId: h.attemptId })
    if (h.finishedAt) params.set('finishedAt', h.finishedAt)
    navigate(`/${h.skill}/${h.examId}/result?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="app-container pt-8 pb-16">
        <PageHeader
          title="Lịch sử làm bài"
          subtitle="Xem lại các lượt Reading và Listening bạn đã hoàn thành"
          className="mb-6"
        />

        {/* Bộ lọc */}
        <Card className="p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Kỹ năng</label>
              <select
                value={skill}
                onChange={handleSkillChange}
                className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-lg text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-[var(--primary)] transition cursor-pointer"
              >
                <option value="">Tất cả kỹ năng</option>
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Đề thi</label>
              <select
                value={examId}
                onChange={handleExamChange}
                className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-lg text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-[var(--primary)] transition cursor-pointer"
              >
                <option value="">Tất cả đề thi</option>
                {examOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
            <div>
              <button
                type="button"
                onClick={resetFilters}
                className="w-full h-9 justify-center border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-300 px-3.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Danh sách */}
        {isLoading ? (
          <UserHistorySkeleton count={5} />
        ) : isError ? (
          <Card className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600">
              <AlertCircle className="w-6 h-6 stroke-[2]" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Không thể tải lịch sử làm bài</h2>
            <p className="text-zinc-500 mb-6 max-w-sm text-sm">Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
            <button onClick={() => refetch()} className="btn-primary px-6 h-9 rounded-full text-sm font-medium inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </Card>
        ) : history.length === 0 ? (
          <Card variant="flat" className="text-center py-16 px-6 flex flex-col items-center">
            <Inbox className="w-12 h-12 text-zinc-300 stroke-[1.5] mb-4" />
            <h3 className="font-bold text-zinc-900 text-base mb-1">
              {skill || examId ? 'Không có lượt làm bài nào khớp bộ lọc' : 'Bạn chưa hoàn thành bài Reading/Listening nào'}
            </h3>
            <p className="text-zinc-500 text-sm">
              {skill || examId ? 'Hãy thử bỏ bớt bộ lọc.' : 'Hoàn thành một bài luyện tập để xem lại kết quả tại đây.'}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {history.map(h => (
                <div key={h.attemptId} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4 hover:bg-zinc-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <SkillBadge skill={h.skill} />
                      <p className="font-semibold text-zinc-900 text-sm truncate">{h.examTitle}</p>
                    </div>
                    {(h.seriesName || h.bookNumber) && (
                      <p className="text-xs text-zinc-500">
                        {[h.seriesName, h.bookNumber ? `Cuốn ${h.bookNumber}` : null, h.testNumber ? `Test ${h.testNumber}` : null].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-5 sm:gap-6 shrink-0">
                    <StatValue value={`${h.correct}/${h.total}`} label="câu đúng" size="text-base" color="var(--ink)" />
                    <StatValue value={h.bandScore != null ? h.bandScore.toFixed(1) : '—'} label="band" size="text-base" color="var(--primary)" />
                    <span className="text-xs text-zinc-500 font-mono whitespace-nowrap hidden md:inline">{fmtDateTime(h.finishedAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleReview(h)}
                      className="h-8 px-3.5 rounded-full text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                      style={{ background: 'var(--primary)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Xem lại
                    </button>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono md:hidden">{fmtDateTime(h.finishedAt)}</span>
                </div>
              ))}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/50">
                <span className="text-xs font-medium text-zinc-500">Trang {page} / {pages} · {total} lượt</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition cursor-pointer flex items-center justify-center"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition cursor-pointer flex items-center justify-center"
                    aria-label="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
