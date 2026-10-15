import { useNavigate } from 'react-router-dom'
import { formatBand } from '../../utils/ielts'
import StatValue from '../common/StatValue'
import { SKILL_THEME } from '../../utils/skillTheme'
import { BookOpen, Headphones, PenTool, Mic, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const SKILLS = [
  { key: 'reading',   label: 'Reading',   icon: BookOpen,   ...SKILL_THEME.reading },
  { key: 'listening', label: 'Listening', icon: Headphones, ...SKILL_THEME.listening },
  { key: 'writing',   label: 'Writing',   icon: PenTool,    ...SKILL_THEME.writing },
  { key: 'speaking',  label: 'Speaking',  icon: Mic,        ...SKILL_THEME.speaking },
]

function SkillRow({ skill, band, loading }) {
  const Icon = skill.icon
  const hasScore = band != null && band > 0
  const pct = hasScore ? Math.min((band / 9) * 100, 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${skill.bg}`}>
            <Icon className={`w-3 h-3 ${skill.text}`} />
          </span>
          <span className="text-zinc-700 font-medium">{skill.label}</span>
        </div>
        {loading ? (
          <span className="w-7 h-3.5 rounded bg-zinc-100 animate-pulse" aria-hidden="true" />
        ) : (
          <span className="font-mono font-semibold text-zinc-900">
            {hasScore ? formatBand(band) : '—'}
          </span>
        )}
      </div>
      <div className={`h-1 w-full bg-zinc-100 rounded-full overflow-hidden ${loading ? 'animate-pulse' : ''}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: hasScore ? `var(${skill.colorVar}, var(--primary))` : undefined,
          }}
        />
      </div>
    </div>
  )
}

export default function BandOverviewWidget({ stats, isAuthenticated, loading = false, className = '' }) {
  const navigate = useNavigate()
  const bandBySkill = isAuthenticated ? (stats?.bandBySkill ?? null) : null
  const hasAnyScore = bandBySkill && Object.values(bandBySkill).some(v => v != null && v > 0)
  const hasOverall = hasAnyScore && stats?.avgBand != null && stats?.avgBand > 0

  return (
    <div aria-busy={loading || undefined} className={`rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs h-full flex flex-col justify-between min-h-[220px] ${className}`}>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            Band điểm hiện tại
          </h3>
          {loading ? (
            <span className="w-8 h-4 rounded bg-zinc-100 animate-pulse" aria-hidden="true" />
          ) : (
            <span className="font-mono text-xs font-semibold text-zinc-900">
              {hasOverall ? formatBand(stats?.avgBand) : '—'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 my-auto">
          {SKILLS.map(skill => (
            <SkillRow
              key={skill.key}
              skill={skill}
              band={bandBySkill?.[skill.key] ?? null}
              loading={loading}
            />
          ))}
        </div>
      </div>

      <div className="pt-3.5 mt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
        {loading ? (
          <span className="w-40 h-3 rounded bg-zinc-100 animate-pulse" aria-hidden="true" />
        ) : hasAnyScore ? (
          <>
            <p className="text-[11px] text-zinc-400">
              Trung bình {stats?.recentCount ?? 3} bài gần nhất mỗi kỹ năng
            </p>
            <span className="text-[11px] font-mono font-medium text-zinc-500">
              {stats?.totalAttempts ? `${stats.totalAttempts} bài đã nộp` : 'IELTS Scale'}
            </span>
          </>
        ) : (
          <>
            <p className="text-[11px] text-zinc-400">
              Chưa có bài thi nào hoàn thành.
            </p>
            <button
              type="button"
              onClick={() => navigate('/cambridge')}
              className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-900 cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              Làm bài ngay →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
