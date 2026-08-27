import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminAnalytics } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'
import { Users2, BarChart2, Trophy } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

import { roundIELTS, formatBand } from '../../utils/ielts'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'

// ─── Constants ───────────────────────────────────────────────────────────────
const BAND_COLORS = ['#dc2626', '#d97706', '#eab308', '#16a34a', '#2563EB', '#1D4ED8']

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  boxShadow: '0 4px 12px rgba(0,0,0,.08)',
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
      <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
      <p style={{ color: '#2563EB' }}>{payload[0].value} lượt thi</p>
    </div>
  )
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const { skill, count } = payload[0].payload
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-gray-700 mb-0.5">{SKILL_LABEL[skill]}</p>
      <p className="text-gray-600">{count} lượt · {pct}%</p>
    </div>
  )
}

function BandTooltip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-gray-700 mb-0.5">Band {label}</p>
      <p className="text-gray-600">{count} lượt · {pct}% tổng</p>
    </div>
  )
}

// ─── Skeleton for period-dependent sections ───────────────────────────────────
function ChartSkeleton({ height = 180 }) {
  return (
    <div className="animate-pulse rounded-xl bg-gray-100" style={{ height }} />
  )
}

// ─── Analytics page ───────────────────────────────────────────────────────────
export default function Analytics() {
  const [data, setData]               = useState(null)
  // initialLoading: only true on first mount before any data arrives
  const [initialLoading, setInitialLoading] = useState(true)
  // chartLoading: true while fetching a new period (data already shown for prev period)
  const [chartLoading, setChartLoading]     = useState(false)
  const [period, setPeriod]           = useState('month')
  const navigate  = useNavigate()

  // Per-period cache: avoids re-fetching when user toggles back and forth
  const cache = useRef({})

  const loadPeriod = useCallback((p) => {
    if (cache.current[p]) {
      setData(cache.current[p])
      setChartLoading(false)
      setInitialLoading(false)
      return
    }
    setChartLoading(true)
    getAdminAnalytics(p)
      .then(analytics => {
        cache.current[p] = analytics
        setData(analytics)
      })
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => {
        setChartLoading(false)
        setInitialLoading(false)
      })
  }, [navigate])

  // Initial fetch
  useEffect(() => { loadPeriod('month') }, [loadPeriod])

  const handlePeriodChange = useCallback((p) => {
    setPeriod(p)
    loadPeriod(p)
  }, [loadPeriod])

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
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-28 bg-gray-100 rounded-2xl mb-4" />
        ))}
      </div>
    </AdminLayout>
  )

  if (!data) return (
    <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>
  )

  const { overview, topUsers } = data
  const maxSkillCount = Math.max(...skillBreakdown.map(s => s.count), 1)

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* ── Header + period toggle ── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Thống kê & Phân tích</h1>
          <div className="flex gap-1">
            {[['week', '7 ngày'], ['month', '30 ngày'], ['all', 'Tất cả']].map(([v, l]) => (
              <button key={v} onClick={() => handlePeriodChange(v)}
                disabled={chartLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                  ${period === v ? 'bg-[#1D4ED8] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}
                  ${chartLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Card 1 — tổng user toàn hệ thống, KHÔNG phụ thuộc period */}
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#EFF6FF' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: '#2563EB20' }}>
              <Users2 size={20} style={{ color: '#2563EB' }} strokeWidth={2} />
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums leading-tight" style={{ color: '#2563EB' }}>{overview.totalUsersAll}</div>
              <div className="text-xs text-gray-500 mt-0.5">Tổng người dùng</div>
            </div>
          </div>

          {/* Cards 2-3 — phụ thuộc period, mờ khi đang tải */}
          {[
            { label: 'Lượt thi',        value: overview.totalAttempts,       color: '#16a34a', bg: '#f0fdf4', Icon: BarChart2 },
            { label: 'Band trung bình', value: formatBand(overview.avgBand), color: '#7C3AED', bg: '#f5f3ff', Icon: Trophy },
          ].map(c => (
            <div key={c.label}
              className={`rounded-2xl p-5 flex items-center gap-4 transition-opacity ${chartLoading ? 'opacity-50' : 'opacity-100'}`}
              style={{ background: c.bg }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: c.color + '20' }}>
                <c.Icon size={20} style={{ color: c.color }} strokeWidth={2} />
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums leading-tight" style={{ color: c.color }}>{c.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Area chart — lượt thi theo ngày */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Lượt thi</h2>

            {chartLoading ? <ChartSkeleton height={180} /> : (
              displayDays.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={displayDays} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AttemptTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fill="url(#primaryGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#2563EB' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-gray-300">Chưa có dữ liệu</div>
              )
            )}
          </div>

          {/* Donut chart — tỷ lệ theo kỹ năng */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Tỷ lệ theo kỹ năng</h2>
            {chartLoading ? (
              <div className="flex items-center gap-4">
                <ChartSkeleton height={140} />
                <div className="flex-1 space-y-3">
                  {[1,2,3,4].map(i => <ChartSkeleton key={i} height={18} />)}
                </div>
              </div>
            ) : totalSkill === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
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
                  <div className="text-3xl font-bold tabular-nums text-gray-800 leading-tight">{totalSkill}</div>
                  <div className="text-xs text-gray-400 mb-4">tổng lượt thi</div>
                  <div className="space-y-2.5">
                    {skillBreakdown.map(d => (
                      <div key={d.skill} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: ADMIN_SKILL_COLORS[d.skill].base }} />
                          {SKILL_LABEL[d.skill]}
                        </span>
                        <span className="tabular-nums text-gray-500 font-medium">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Band Score distribution — toàn thời gian, không phụ thuộc period → không skeleton khi đổi period */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">
            Phân bố Band Score <span className="font-normal text-gray-400">(toàn thời gian)</span>
          </h2>
          {(data.bandDistribution || []).some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.bandDistribution} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}
                barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<BandTooltip total={bandTotal} />} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {(data.bandDistribution || []).map((_, i) => (
                    <Cell key={i} fill={BAND_COLORS[i] ?? '#2563EB'} />
                  ))}
                  <LabelList dataKey="count" position="top"
                    style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-gray-300">Chưa có dữ liệu</div>
          )}
        </div>

        {/* Skill breakdown table */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Phân tích theo kỹ năng</h2>
          {chartLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <ChartSkeleton key={i} height={44} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="py-2 text-left font-medium">Kỹ năng</th>
                    <th className="px-4 py-2 text-right font-medium">Lượt thi</th>
                    <th className="px-4 py-2 text-right font-medium">Band TB</th>
                    <th className="px-4 py-2 text-left font-medium">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {skillBreakdown.map((s, idx) => {
                    const c = ADMIN_SKILL_COLORS[s.skill]
                    return (
                      <tr key={s.skill}
                        className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: c.bg, color: c.text }}>
                            {SKILL_LABEL[s.skill]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">{s.count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {s.avgScore != null
                            ? <span className={`font-bold ${roundIELTS(s.avgScore) >= 7 ? 'text-green-600' : roundIELTS(s.avgScore) >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {formatBand(s.avgScore)}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${maxSkillCount > 0 ? (s.count / maxSkillCount * 100) : 0}%`,
                                  background: c.base,
                                }} />
                            </div>
                            <span className="text-xs text-gray-400 tabular-nums w-8">
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
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Top 10 Band Score cao nhất</h2>
          {chartLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <ChartSkeleton key={i} height={52} />)}
            </div>
          ) : topUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topUsers.map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0
                    ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-white border border-gray-200 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.attemptCount} lượt thi</p>
                  </div>
                  <span className={`font-bold text-sm tabular-nums
                    ${roundIELTS(u.avgScore) >= 7 ? 'text-green-600' : roundIELTS(u.avgScore) >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {formatBand(u.avgScore)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  )
}
