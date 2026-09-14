import { formatBand } from '../../utils/ielts'

function SkillBar({ label, band }) {
  const pct = band != null ? Math.min((band / 9) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{formatBand(band)}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function BandOverviewWidget({ stats, isAuthenticated }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        Band điểm hiện tại
      </h3>

      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
          {isAuthenticated ? formatBand(stats?.avgBand) : '—'}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Overall ước tính</span>
      </div>

      <div className="flex flex-col gap-3">
        <SkillBar label="Reading" band={isAuthenticated ? stats?.bandBySkill?.reading : null} />
        <SkillBar label="Listening" band={isAuthenticated ? stats?.bandBySkill?.listening : null} />
      </div>

      {!isAuthenticated && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
          Đăng nhập và hoàn thành bài thi để xem band điểm ước tính.
        </p>
      )}
    </div>
  )
}
