import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/axios'
import AdminLayout from '../../components/AdminLayout'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const SKILL_COLOR = { reading: 'bg-blue-500', listening: 'bg-green-500', writing: 'bg-purple-500', speaking: 'bg-orange-500' }

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    api.get('/admin/analytics', { params: { period } })
      .then(r => setData(r.data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { overview, skillBreakdown, topUsers, topWrongQuestions } = data
  const maxSkillCount = Math.max(...skillBreakdown.map(s => s.count), 1)

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Thống kê & Phân tích</h1>
          <div className="flex gap-1">
            {[['week','7 ngày'], ['month','30 ngày'], ['quarter','3 tháng']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === v ? 'bg-[#1a56db] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Overview */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Người dùng mới', value: overview.totalUsers, color: 'text-[#1a56db]', bg: 'bg-blue-50' },
            { label: 'Lượt thi', value: overview.totalAttempts, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Band TB', value: overview.avgBand ? overview.avgBand.toFixed(1) : '—', color: 'text-purple-600', bg: 'bg-purple-50' },
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
                        ? <span className={`font-bold ${s.avgScore >= 7 ? 'text-green-600' : s.avgScore >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>{s.avgScore.toFixed(1)}</span>
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
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Top 10 Band Score cao nhất</h2>
            {topUsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.attemptCount} lượt thi</p>
                    </div>
                    <span className={`font-bold text-sm ${u.avgScore >= 7 ? 'text-green-600' : u.avgScore >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {u.avgScore?.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top wrong questions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Top 10 câu sai nhiều nhất</h2>
            {topWrongQuestions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {topWrongQuestions.map((q, i) => (
                  <div key={q.id || i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 line-clamp-2">{q.questionText || 'Không có text'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{q.type}</p>
                    </div>
                    <span className="text-xs font-bold text-red-500 shrink-0">{q.wrongCount} lần</span>
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
