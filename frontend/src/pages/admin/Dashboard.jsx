import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/axios'
import AdminLayout from '../../components/AdminLayout'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const SKILL_COLOR = { reading: 'bg-blue-500', listening: 'bg-green-500', writing: 'bg-purple-500', speaking: 'bg-orange-500' }

function BarChart({ data, labelKey, valueKey, color = '#1a56db' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-1 h-32">
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

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartRange, setChartRange] = useState(30)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(r => setData(r.data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { stats, attemptsByDay, bandDistribution, skillDistribution, recentAttempts } = data
  const displayDays = attemptsByDay.slice(-chartRange)
  const totalSkill = skillDistribution.reduce((s, d) => s + d.count, 0)

  const statCards = [
    {
      label: 'Tổng người dùng',
      value: stats.totalUsers,
      sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Chưa có tháng này',
      color: 'text-[#1a56db]', bg: 'bg-blue-50'
    },
    {
      label: 'Lượt thi hôm nay',
      value: stats.attemptsToday,
      sub: 'Hôm nay',
      color: 'text-green-600', bg: 'bg-green-50'
    },
    {
      label: 'Band TB hệ thống',
      value: stats.avgBand ? stats.avgBand.toFixed(1) : '—',
      sub: 'Toàn bộ lượt thi',
      color: 'text-purple-600', bg: 'bg-purple-50'
    },
    {
      label: 'Tổng đề thi',
      value: stats.totalExams,
      sub: 'Đề đang có',
      color: 'text-orange-600', bg: 'bg-orange-50'
    },
  ]

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-sm font-semibold text-gray-700 mt-1">{c.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Attempts over time */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 text-sm">Lượt thi theo ngày</h2>
              <div className="flex gap-1">
                {[7, 30].map(d => (
                  <button key={d} onClick={() => setChartRange(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${chartRange === d ? 'bg-[#1a56db] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {d}N
                  </button>
                ))}
              </div>
            </div>
            <BarChart data={displayDays} labelKey="date" valueKey="count" />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400">{displayDays[0]?.date?.slice(5)}</span>
              <span className="text-[10px] text-gray-400">{displayDays[displayDays.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>

          {/* Skill distribution */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Tỷ lệ theo kỹ năng</h2>
            {totalSkill === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-3">
                {skillDistribution.map(d => (
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

        {/* Band distribution */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Phân bố Band Score</h2>
          <BarChart data={bandDistribution} labelKey="range" valueKey="count" color="#7c3aed" />
          <div className="flex justify-between mt-2">
            {bandDistribution.map(d => (
              <span key={d.range} className="text-[10px] text-gray-400 flex-1 text-center">{d.range}</span>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Hoạt động gần đây</h2>
            <button onClick={() => navigate('/admin/attempts')}
              className="text-xs text-[#1a56db] font-medium hover:underline">
              Xem tất cả →
            </button>
          </div>
          {recentAttempts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có lượt thi nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">Người dùng</th>
                    <th className="px-4 py-3 text-left font-medium">Kỹ năng</th>
                    <th className="px-4 py-3 text-left font-medium">Đề thi</th>
                    <th className="px-4 py-3 text-left font-medium">Band</th>
                    <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttempts.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{a.user?.name}</p>
                        <p className="text-xs text-gray-400">{a.user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{a.exam?.title}</td>
                      <td className="px-4 py-3">
                        {a.score != null ? (
                          <span className={`font-bold ${a.score >= 7 ? 'text-green-600' : a.score >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {a.score.toFixed(1)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
