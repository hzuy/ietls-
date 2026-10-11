import { Flame } from 'lucide-react'
import StatValue from '../common/StatValue'

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

// Tính chỉ số ngày hôm nay trong tuần (0=T2...6=CN)
function getTodayIndex() {
  const day = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
  return day === 0 ? 6 : day - 1  // Chuyển về T2=0...CN=6
}

export default function StreakWidget({ streak = 0, isAuthenticated }) {
  const activeCount = isAuthenticated ? Math.max(0, Math.min(streak, 7)) : 0
  const todayIndex = getTodayIndex()
  const isHotStreak = isAuthenticated && streak >= 3

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          Chuỗi ngày luyện tập
        </h3>
        <Flame
          className={`w-5 h-5 transition-colors ${isHotStreak ? 'text-orange-500' : ''}`}
          style={!isHotStreak ? { color: 'var(--primary)' } : undefined}
        />
      </div>

      <StatValue as="p" value={isAuthenticated ? streak : 0} label="ngày liên tiếp" />

      <div className="flex items-stretch gap-1.5 mt-3.5">
        {DAY_LABELS.map((label, i) => {
          const filled = i >= 7 - activeCount
          const isToday = i === todayIndex
          return (
            <div key={label} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-full aspect-square rounded-full transition-all ${
                  filled
                    ? ''
                    : isToday
                    ? 'border-2 border-zinc-400'
                    : 'border border-zinc-200'
                }`}
                style={filled ? { background: isHotStreak ? '#f97316' : 'var(--primary)' } : undefined}
              />
              <span className={`text-[9px] font-mono ${isToday ? 'text-zinc-700 font-semibold' : 'text-zinc-400'}`}>
                {label}
              </span>
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
