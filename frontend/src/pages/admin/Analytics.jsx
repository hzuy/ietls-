import { useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminAnalytics, getAdminUser } from '../../services/adminService'
import { Users2, BarChart2, Trophy, Award, ChevronRight } from 'lucide-react'
import StudentDetailModal from '../../components/admin/StudentDetailModal'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

import { formatBand } from '../../utils/ielts'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'

// ─── Constants ───────────────────────────────────────────────────────────────
// Dải màu phân cấp hiệu suất học thuật (Performance Palette) cho 6 mốc Band Score
const BAND_COLORS = [
  '#f43f5e', // <4.0: Rose / Đỏ dịu (Yếu)
  '#f97316', // 4.0–4.9: Orange / Cam (Trung bình yếu)
  '#eab308', // 5.0–5.9: Yellow / Amber (Trung bình)
  '#3b82f6', // 6.0–6.9: Blue / Xanh dương (Khá)
  '#10b981', // 7.0–7.9: Emerald / Xanh lá (Tốt)
  '#8b5cf6', // 8.0–9.0: Purple/Violet / Tím cao cấp (Xuất sắc)
]

// Theme màu đồng bộ 4 kỹ năng giữa Doughnut Chart và Bảng phân tích chi tiết
const SKILL_THEMES = {
  reading: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    bar: 'bg-blue-500',
  },
  listening: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    bar: 'bg-emerald-500',
  },
  writing: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    bar: 'bg-purple-500',
  },
  speaking: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    bar: 'bg-amber-500',
  },
}

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e4e4e7',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,.06)',
  fontSize: 12,
  padding: '8px 12px',
}

// Date labels: monthly data (period=all) keeps YYYY-MM; daily data strips year
function formatDateLabel(date, period) {
  if (!date) return ''
  return period === 'all' ? date.slice(0, 7) : date.slice(5) // MM-DD
}

// ─── Tooltips ────────────────────────────────────────────────────────────────
function AttemptTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5">{label}</p>
      <p className="text-zinc-600 font-medium">{payload[0].value} lượt thi</p>
    </div>
  )
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const { skill, count } = payload[0].payload
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5">{SKILL_LABEL[skill]}</p>
      <p className="text-zinc-600">{count} lượt · {pct}%</p>
    </div>
  )
}

function BandTooltip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const color = payload[0].payload?.fill || payload[0].color || '#3b82f6'
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
        Band {label}
      </p>
      <p className="text-zinc-600">{count} lượt · {pct}% tổng</p>
    </div>
  )
}

// ─── Skeleton for period-dependent sections ───────────────────────────────────
function ChartSkeleton({ height = 180 }) {
  return (
    <div className="animate-pulse rounded-xl bg-zinc-100" style={{ height }} />
  )
}

// ─── Analytics page ───────────────────────────────────────────────────────────
export default function Analytics() {
  const [period, setPeriod]           = useState('month')
  const navigate  = useNavigate()

  const {
    data = null,
    isLoading: initialLoading,
    isFetching: chartLoading,
  } = useQuery({
    queryKey: ['admin', 'analytics', period],
    queryFn: async () => {
      try {
        return await getAdminAnalytics(period)
      } catch (err) {
        if (err.response?.status === 403) navigate('/')
        throw err
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  // Student Detail Modal state
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetail, setStudentDetail] = useState(null)
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false)
  const [selectedRank, setSelectedRank] = useState(null)

  const handleOpenStudentDetail = useCallback(async (student, rank) => {
    setSelectedStudent(student)
    setSelectedRank(rank)
    setStudentDetail(null)
    setLoadingStudentDetail(true)

    try {
      const detail = await getAdminUser(student.id)
      setStudentDetail(detail)
    } catch (err) {
      console.error('Không thể tải chi tiết học viên:', err)
      // Fallback: sử dụng dữ liệu đã có sẵn từ card topUsers
      setStudentDetail({
        user: student,
        attempts: [],
        skillStats: {},
        totalAttempts: student.attemptCount,
      })
    } finally {
      setLoadingStudentDetail(false)
    }
  }, [])

  const handleCloseStudentDetail = useCallback(() => {
    setSelectedStudent(null)
    setStudentDetail(null)
    setSelectedRank(null)
  }, [])

  const handlePeriodChange = useCallback((p) => {
    setPeriod(p)
  }, [])

  // ─── Derived data ───────────────────────────────────────────────────────────
  // period is the single source of truth — show all data returned for current period
  const displayDays = useMemo(
    () => (data?.attemptsByDay || []).map(d => ({ ...d, label: formatDateLabel(d.date, period) })),
    [data, period]
  )

  const bandTotal = useMemo(
    () => (data?.bandDistribution || []).reduce((s, d) => s + d.count, 0),
    [data]
  )

  const totalSkill = useMemo(
    () => (data?.skillBreakdown || []).reduce((s, d) => s + d.count, 0),
    [data]
  )

  const skillBreakdown = useMemo(() => {
    if (!data?.skillBreakdown) return []
    return SKILL_ORDER.map(sk => data.skillBreakdown.find(s => s.skill === sk)).filter(Boolean)
  }, [data])

  // Exclude zero-count slices from pie (recharts renders tiny artefact lines at 0)
  const pieData = useMemo(
    () => skillBreakdown.filter(d => d.count > 0),
    [skillBreakdown]
  )

  // ─── Initial skeleton (very first load) ─────────────────────────────────────
  if (initialLoading) return (
    <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse h-28 bg-zinc-100 rounded-2xl mb-4" />
      ))}
    </div>
  )

  if (!data) return (
    <div className="p-8 text-zinc-400">Không thể tải dữ liệu.</div>
  )

  const { overview, topUsers } = data
  const maxSkillCount = Math.max(...skillBreakdown.map(s => s.count), 1)

  return (
    <div className="p-6 max-w-6xl mx-auto">

        {/* ── Header + period toggle ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Thống kê & Phân tích</h1>
          <div className="flex gap-1.5 flex-wrap">
            {[['week', '7 ngày'], ['month', '30 ngày'], ['all', 'Tất cả']].map(([v, l]) => (
              <button key={v} onClick={() => handlePeriodChange(v)}
                disabled={chartLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-2xs
                  ${period === v ? 'bg-zinc-900 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}
                  ${chartLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Card 1 — tổng user toàn hệ thống, KHÔNG phụ thuộc period */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
              <Users2 size={20} className="text-zinc-900" strokeWidth={2} />
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums text-zinc-900 leading-tight">{overview.totalUsersAll}</div>
              <div className="text-xs text-zinc-500 mt-0.5 font-medium">Tổng người dùng</div>
            </div>
          </div>

          {/* Cards 2-3 — phụ thuộc period, mờ khi đang tải */}
          {[
            { label: 'Lượt thi',        value: overview.totalAttempts,       Icon: BarChart2 },
            { label: 'Band trung bình', value: formatBand(overview.avgBand), Icon: Trophy },
          ].map(c => (
            <div key={c.label}
              className={`bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4 transition-opacity ${chartLoading ? 'opacity-50' : 'opacity-100'}`}>
              <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                <c.Icon size={20} className="text-zinc-900" strokeWidth={2} />
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums text-zinc-900 leading-tight">{c.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5 font-medium">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Area chart — lượt thi theo ngày */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
            <h2 className="font-semibold text-zinc-900 text-sm mb-4">Lượt thi</h2>

            {chartLoading ? <ChartSkeleton height={180} /> : (
              displayDays.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={displayDays} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#18181b" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AttemptTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#18181b"
                      strokeWidth={2}
                      fill="url(#primaryGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#18181b' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-zinc-300">Chưa có dữ liệu</div>
              )
            )}
          </div>

          {/* Donut chart — tỷ lệ theo kỹ năng */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
            <h2 className="font-semibold text-zinc-900 text-sm mb-4">Tỷ lệ theo kỹ năng</h2>
            {chartLoading ? (
              <div className="flex items-center gap-4">
                <ChartSkeleton height={140} />
                <div className="flex-1 space-y-3">
                  {[1,2,3,4].map(i => <ChartSkeleton key={i} height={18} />)}
                </div>
              </div>
            ) : totalSkill === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">Chưa có dữ liệu</p>
            ) : (
              <div className="flex items-center gap-5">
                {/* Donut */}
                <div className="shrink-0">
                  <PieChart width={140} height={140}>
                    <Pie
                      data={pieData}
                      cx={70}
                      cy={70}
                      innerRadius={38}
                      outerRadius={58}
                      dataKey="count"
                      stroke="none"
                      paddingAngle={pieData.length > 1 ? 2 : 0}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.skill} fill={ADMIN_SKILL_COLORS[entry.skill].base} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip total={totalSkill} />} />
                  </PieChart>
                </div>

                {/* Total + legend */}
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-bold tabular-nums text-zinc-900 leading-tight">{totalSkill}</div>
                  <div className="text-xs text-zinc-500 mb-4 font-medium">tổng lượt thi</div>
                  <div className="space-y-2.5">
                    {skillBreakdown.map(d => (
                      <div key={d.skill} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-zinc-700">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: ADMIN_SKILL_COLORS[d.skill].base }} />
                          {SKILL_LABEL[d.skill]}
                        </span>
                        <span className="tabular-nums text-zinc-500 font-medium">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Band Score distribution — toàn thời gian, không phụ thuộc period → không skeleton khi đổi period */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs mb-6">
          <h2 className="font-semibold text-zinc-900 text-sm mb-4">
            Phân bố Band Score <span className="font-normal text-zinc-400 text-xs">(toàn thời gian)</span>
          </h2>
          {(data.bandDistribution || []).some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.bandDistribution} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}
                barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<BandTooltip total={bandTotal} />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(data.bandDistribution || []).map((_, i) => (
                    <Cell key={i} fill={BAND_COLORS[i] ?? '#8b5cf6'} />
                  ))}
                  <LabelList dataKey="count" position="top"
                    style={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-zinc-300">Chưa có dữ liệu</div>
          )}
        </div>

        {/* Skill breakdown table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5 mb-4">
          <h2 className="font-semibold text-zinc-900 text-sm mb-4">Phân tích theo kỹ năng</h2>
          {chartLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <ChartSkeleton key={i} height={44} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] text-zinc-500 border-b border-zinc-200 font-medium">
                    <th className="py-2 text-left">Kỹ năng</th>
                    <th className="px-4 py-2 text-right">Lượt thi</th>
                    <th className="px-4 py-2 text-right">Band TB</th>
                    <th className="px-4 py-2 text-left">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {skillBreakdown.map((s, idx) => {
                    const theme = SKILL_THEMES[s.skill] || {
                      badge: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
                      bar: 'bg-zinc-900',
                    }
                    return (
                      <tr key={s.skill}
                        className={`border-b border-zinc-100 ${idx % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                        <td className="py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${theme.badge}`}>
                            {SKILL_LABEL[s.skill]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-800 tabular-nums">{s.count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {s.avgScore != null
                            ? <span className="font-semibold text-zinc-900">
                                {formatBand(s.avgScore)}
                              </span>
                            : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden max-w-[100px]">
                              <div className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                                style={{
                                  width: `${maxSkillCount > 0 ? (s.count / maxSkillCount * 100) : 0}%`,
                                }} />
                            </div>
                            <span className="text-[11px] text-zinc-500 tabular-nums w-8">
                              {maxSkillCount > 0 ? Math.round(s.count / maxSkillCount * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top 10 users — period-sensitive */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
            <h2 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              <span>Top 10 Band Score cao nhất</span>
            </h2>
            <span className="text-[11px] text-zinc-400 font-medium">Bấm vào thí sinh để xem chi tiết bài thi</span>
          </div>

          {chartLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => <ChartSkeleton key={i} height={52} />)}
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => <ChartSkeleton key={i} height={52} />)}
              </div>
            </div>
          ) : topUsers.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột trái: Hạng 1 -> Hạng 5 (Top Tier) */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Trophy size={13} className="text-amber-500" />
                    <span>Top Tier (Hạng 1 – 5)</span>
                  </span>
                  <span>Điểm TB</span>
                </div>
                <div className="space-y-2">
                  {topUsers.slice(0, 5).map((u, i) => {
                    const rank = i + 1
                    let rankBadgeStyle = 'bg-zinc-100 text-zinc-600'
                    if (rank === 1) rankBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                    else if (rank === 2) rankBadgeStyle = 'bg-zinc-200 text-zinc-800 border-zinc-300 font-bold'
                    else if (rank === 3) rankBadgeStyle = 'bg-amber-50 text-amber-900 border-amber-200 font-bold'

                    return (
                      <div
                        key={u.id || rank}
                        onClick={() => handleOpenStudentDetail(u, rank)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenStudentDetail(u, rank) }}
                        className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0 border ${rankBadgeStyle}`}
                          >
                            {rank}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {u.attemptCount} lượt thi
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-lg shadow-2xs">
                            Band {formatBand(u.avgScore)}
                          </span>
                          <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cột phải: Hạng 6 -> Hạng 10 */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Award size={13} className="text-zinc-400" />
                    <span>Hạng 6 – 10</span>
                  </span>
                  <span>Điểm TB</span>
                </div>
                {topUsers.length > 5 ? (
                  <div className="space-y-2">
                    {topUsers.slice(5, 10).map((u, i) => {
                      const rank = i + 6
                      const rankBadgeStyle = 'bg-zinc-100 text-zinc-600'

                      return (
                        <div
                          key={u.id || rank}
                          onClick={() => handleOpenStudentDetail(u, rank)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenStudentDetail(u, rank) }}
                          className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0 border ${rankBadgeStyle}`}
                            >
                              {rank}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                                {u.name}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                {u.attemptCount} lượt thi
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-lg shadow-2xs">
                              Band {formatBand(u.avgScore)}
                            </span>
                            <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-zinc-400 italic border border-dashed border-zinc-200 rounded-xl">
                    Chưa có thêm học viên trong nhóm này
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Student Detail Modal */}
        <StudentDetailModal
          isOpen={Boolean(selectedStudent)}
          onClose={handleCloseStudentDetail}
          student={selectedStudent}
          rank={selectedRank}
          detailData={studentDetail}
          loading={loadingStudentDetail}
        />

      </div>
  )
}
