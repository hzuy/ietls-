import { useNavigate } from 'react-router-dom'
import { X, Award, Activity, TrendingUp, AlertCircle, ArrowUpRight, Calendar, Mail } from 'lucide-react'
import Modal from '../common/Modal'
import { formatBand } from '../../utils/ielts'
import { SKILL_LABEL } from '../../utils/adminSkillColors'

const SKILL_CARD_THEMES = {
  reading: {
    bg: 'bg-blue-50/60 dark:bg-blue-950/20',
    border: 'border-blue-200/80 dark:border-blue-800/60',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  listening: {
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    border: 'border-emerald-200/80 dark:border-emerald-800/60',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  writing: {
    bg: 'bg-purple-50/60 dark:bg-purple-950/20',
    border: 'border-purple-200/80 dark:border-purple-800/60',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  speaking: {
    bg: 'bg-amber-50/60 dark:bg-amber-950/20',
    border: 'border-amber-200/80 dark:border-amber-800/60',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDuration(startStr, endStr) {
  if (!startStr || !endStr) return null
  const s = new Date(startStr).getTime()
  const e = new Date(endStr).getTime()
  if (isNaN(s) || isNaN(e) || e <= s) return null
  const mins = Math.round((e - s) / 60000)
  return `${mins} phút`
}

export default function StudentDetailModal({
  isOpen,
  onClose,
  student,
  rank,
  detailData,
  loading = false,
}) {
  const navigate = useNavigate()

  if (!isOpen || !student) return null

  const user = detailData?.user || student
  const skillStats = detailData?.skillStats || {}
  const attempts = detailData?.attempts || []
  const totalAttempts = detailData?.totalAttempts ?? student.attemptCount ?? 0

  // Phân tích kỹ năng thế mạnh & cần cải thiện
  const validSkills = Object.entries(skillStats).filter(([, score]) => score != null)
  validSkills.sort((a, b) => b[1] - a[1])
  const strongest = validSkills.length > 0 ? validSkills[0] : null
  const needsImprovement = validSkills.length > 1 ? validSkills[validSkills.length - 1] : null

  const initialLetter = (user.name || student.name || 'S').trim().charAt(0).toUpperCase()

  return (
    <Modal onClose={onClose} title={`Chi tiết học viên ${user.name}`} size="xl">
      {/* Header */}
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-white font-bold text-lg flex items-center justify-center border border-zinc-700/80 shadow-xs shrink-0">
            {initialLetter}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {user.name}
              </h2>
              {rank && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shrink-0">
                  Hạng #{rank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex-wrap font-mono">
              <span className="flex items-center gap-1 truncate">
                <Mail size={12} className="shrink-0" />
                {user.email || 'student@ielts.vn'}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Calendar size={12} className="shrink-0" />
                {formatDate(user.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black font-mono text-zinc-900 dark:text-zinc-100 leading-none">
              {formatBand(student.avgScore)}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mt-0.5">
              Band TB
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            <span className="text-xs font-medium">Đang tải chi tiết hồ sơ...</span>
          </div>
        ) : (
          <>
            {/* 1. Mini Bento: Điểm 4 kỹ năng */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Điểm trung bình theo kỹ năng
                </h3>
                <span className="text-xs text-zinc-500 font-mono">
                  {totalAttempts} lượt thi hoàn thành
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {['reading', 'listening', 'writing', 'speaking'].map((skill) => {
                  const score = skillStats[skill]
                  const theme = SKILL_CARD_THEMES[skill]
                  return (
                    <div
                      key={skill}
                      className={`p-3 rounded-xl border ${theme.border} ${theme.bg} flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.badge}`}>
                          {SKILL_LABEL[skill]}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                      </div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900">
                        {score != null ? formatBand(score) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. Insights: Điểm mạnh & Cần cải thiện */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                  <TrendingUp size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Kỹ năng thế mạnh
                  </div>
                  <div className="text-xs font-bold text-zinc-900 truncate">
                    {strongest
                      ? `${SKILL_LABEL[strongest[0]]} (Band ${formatBand(strongest[1])})`
                      : 'Đang cập nhật'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                  <AlertCircle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Cần rèn luyện thêm
                  </div>
                  <div className="text-xs font-bold text-zinc-900 truncate">
                    {needsImprovement
                      ? `${SKILL_LABEL[needsImprovement[0]]} (Band ${formatBand(needsImprovement[1])})`
                      : 'Đồng đều 4 kỹ năng'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Lịch sử bài thi gần nhất */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">
                Lịch sử bài thi gần nhất (Mới nhất)
              </h3>
              {attempts.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4 text-center border border-dashed border-zinc-200 rounded-xl">
                  Chưa có bài thi nào được ghi nhận.
                </p>
              ) : (
                <div className="space-y-2">
                  {attempts.slice(0, 5).map((att) => {
                    const skill = att.exam?.skill || 'reading'
                    const theme = SKILL_CARD_THEMES[skill] || SKILL_CARD_THEMES.reading
                    const duration = formatDuration(att.createdAt, att.finishedAt)

                    return (
                      <div
                        key={att.id}
                        className="p-3 rounded-xl border border-zinc-200 bg-white flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 truncate">
                              {att.exam?.title || `Bài thi #${att.examId}`}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                              <span>{formatDate(att.createdAt)}</span>
                              {duration && <span>· {duration}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${theme.badge}`}>
                            {SKILL_LABEL[skill]}
                          </span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-slate-100 bg-zinc-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                            {att.score != null ? `Band ${formatBand(att.score)}` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-900/50">
        <button
          onClick={onClose}
          className="h-9 px-5 rounded-full text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
        >
          Đóng
        </button>

        {user.id && (
          <button
            onClick={() => {
              onClose()
              navigate(`/admin/users/${user.id}`)
            }}
            className="h-9 px-5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition shadow-xs cursor-pointer"
          >
            <span>Xem hồ sơ đầy đủ</span>
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </Modal>
  )
}
