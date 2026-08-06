import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminAnalytics } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'


import { roundIELTS, formatBand } from '../../utils/ielts'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const SKILL_COLOR = { reading: 'bg-blue-500', listening: 'bg-green-500', writing: 'bg-purple-500', speaking: 'bg-orange-500' }

// BUG-19: Shared simple bar chart component (same as Dashboard)
function BarChart({ data, labelKey, valueKey, color = '#1D4ED8' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full rounded-t" style={{ height: `${(d[valueKey] / max) * 100}%`, background: color, minHeight: d[valueKey] > 0 ? 2 : 0 }} />
          {data.length <= 10 && (
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{d[labelKey]}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [chartRange, setChartRange] = useState(30)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getAdminAnalytics(period)
      .then(analytics => setData(analytics))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [period])

  const displayDays = useMemo(
    () => (data?.attemptsByDay || []).slice(-chartRange),
    [data, chartRange]
  )
  const totalSkill = useMemo(
    () => (data?.skillBreakdown || []).reduce((s, d) => s + d.count, 0),
    [data]
  )

  if (loading) return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            height: 120, background: '#f3f4f6',
            borderRadius: 12, marginBottom: 16,
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { overview, skillBreakdown, topUsers } = data
  const maxSkillCount = Math.max(...skillBreakdown.map(s => s.count), 1)

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Thống kê & Phân tích</h1>
          <div className="flex gap-1">
            {[['week','7 ngày'], ['month','30 ngày'], ['all','Tất cả']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === v ? 'bg-[#1D4ED8] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Charts from analytics endpoint */}
        {data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-800 text-sm">Lượt thi theo ngày</h2>
                  <div className="flex gap-1">
                    {[7, 30].map(d => (
                      <button key={d} onClick={() => setChartRange(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${chartRange === d ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {d}N
                      </button>
                    ))}
                  </div>
                </div>
                {displayDays.length > 0
                  ? <BarChart data={displayDays} labelKey="date" valueKey="count" />
                  : <div className="h-28 flex items-center justify-center text-xs text-gray-300">Chưa có dữ liệu</div>}
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-400">{displayDays[0]?.date?.slice(5)}</span>
                  <span className="text-[10px] text-gray-400">{displayDays[displayDays.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm mb-3">Tỷ lệ theo kỹ năng</h2>
                {totalSkill === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-3">
                    {(data.skillBreakdown || []).map(d => (
                      <div key={d.skill}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{SKILL_LABEL[d.skill]}</span>
                          <span className="text-gray-400">{d.count} ({totalSkill > 0 ? Math.round(d.count / totalSkill * 100) : 0}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${SKILL_COLOR[d.skill]}`}
                            style={{ width: `${totalSkill > 0 ? (d.count / totalSkill * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
              <h2 className="font-semibold text-gray-800 text-sm mb-3">Phân bố Band Score (toàn thời gian)</h2>
              {(data.bandDistribution || []).some(d => d.count > 0)
                ? <>
                    <BarChart data={data.bandDistribution} labelKey="range" valueKey="count" color="#7c3aed" />
                    <div className="flex justify-between mt-2">
                      {data.bandDistribution.map(d => (
                        <span key={d.range} className="text-[10px] text-gray-400 flex-1 text-center">{d.range}</span>
                      ))}
                    </div>
                  </>
                : <div className="h-20 flex items-center justify-center text-xs text-gray-300">Chưa có dữ liệu</div>}
            </div>
          </>
        )}

        {/* Overview */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Người dùng mới', value: overview.totalUsers, color: 'text-[#1D4ED8]', bg: 'bg-blue-50' },
            { label: 'Lượt thi', value: overview.totalAttempts, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Band TB', value: formatBand(overview.avgBand), color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-sm text-gray-600 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Skill breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Phân tích theo kỹ năng</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 text-left font-medium">Kỹ năng</th>
                  <th className="px-4 py-2 text-left font-medium">Lượt thi</th>
                  <th className="px-4 py-2 text-left font-medium">Band TB</th>
                  <th className="px-4 py-2 text-left font-medium">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {skillBreakdown.map(s => (
                  <tr key={s.skill} className="border-b border-gray-50">
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{SKILL_LABEL[s.skill]}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">{s.count}</td>
                    <td className="px-4 py-3">
                      {s.avgScore != null
                        ? <span className={`font-bold ${roundIELTS(s.avgScore) >= 7 ? 'text-green-600' : roundIELTS(s.avgScore) >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>{formatBand(s.avgScore)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div className={`h-full rounded-full ${SKILL_COLOR[s.skill]}`}
                            style={{ width: `${maxSkillCount > 0 ? (s.count / maxSkillCount * 100) : 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{maxSkillCount > 0 ? Math.round(s.count / maxSkillCount * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top users */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 lg:col-span-2">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Top 10 Band Score cao nhất</h2>
            {topUsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-white border border-gray-200 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.attemptCount} lượt thi</p>
                    </div>
                    <span className={`font-bold text-sm ${roundIELTS(u.avgScore) >= 7 ? 'text-green-600' : roundIELTS(u.avgScore) >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {formatBand(u.avgScore)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
