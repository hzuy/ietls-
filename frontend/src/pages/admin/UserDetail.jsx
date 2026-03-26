import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../utils/axios'
import AdminLayout from '../../components/AdminLayout'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }

export default function UserDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get(`/admin/users/${id}`)
      .then(r => setData(r.data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không tìm thấy người dùng.</div></AdminLayout>

  const { user, attempts, skillStats, totalAttempts } = data
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <button onClick={() => navigate('/admin/users')} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
          ← Quay lại
        </button>

        {/* User info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1a56db] text-white text-xl font-bold flex items-center justify-center">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">{user.name}</h1>
              <p className="text-sm text-gray-400">{user.email}</p>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">{user.role}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isLocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                  {user.isLocked ? 'Đã khoá' : 'Hoạt động'}
                </span>
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-400">Ngày đăng ký</p>
              <p className="text-sm font-medium text-gray-700">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-2xl font-bold text-[#1a56db]">{totalAttempts}</div>
            <div className="text-xs text-gray-500 mt-0.5">Tổng lượt thi</div>
          </div>
          {Object.entries(skillStats).map(([skill, score]) => (
            <div key={skill} className="bg-gray-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-700">{score != null ? score.toFixed(1) : '—'}</div>
              <div className="text-xs text-gray-500 mt-0.5">Band TB {SKILL_LABEL[skill]}</div>
            </div>
          ))}
        </div>

        {/* Attempt history */}
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Lịch sử bài thi ({totalAttempts})</h2>
          </div>
          {attempts.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Chưa có lượt thi nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">Đề thi</th>
                    <th className="px-4 py-3 text-left font-medium">Kỹ năng</th>
                    <th className="px-4 py-3 text-left font-medium">Band</th>
                    <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{a.exam?.title}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.score != null
                          ? <span className={`font-bold ${a.score >= 7 ? 'text-green-600' : a.score >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(a.createdAt)}</td>
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
