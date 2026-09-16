import { Flame } from 'lucide-react'
import StatValue from '../common/StatValue'

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export default function StreakWidget({ streak = 0, isAuthenticated }) {
  const activeCount = isAuthenticated ? Math.max(0, Math.min(streak, 7)) : 0

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          Chuỗi ngày luyện tập
        </h3>
        <Flame className="w-4 h-4" style={{ color: 'var(--primary)' }} />
      </div>

      <StatValue as="p" size="text-2xl" value={isAuthenticated ? streak : 0} label="ngày luyện tập liên tục" />

      <div className="flex items-stretch gap-1.5 mt-3.5">
        {DAY_LABELS.map((label, i) => {
          const filled = i >= 7 - activeCount
          return (
            <div key={label} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-full aspect-square rounded-full ${filled ? '' : 'border border-zinc-200'}`}
                style={filled ? { background: 'var(--primary)' } : undefined}
              />
              <span className="text-[9px] font-mono text-zinc-400">{label}</span>
            </div>
          )
        })}
      </div>

      {!isAuthenticated && (
        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          Đăng nhập để theo dõi chuỗi ngày luyện tập của bạn.
        </p>
      )}
    </div>
  )
}
