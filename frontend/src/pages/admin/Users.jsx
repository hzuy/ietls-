import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/axios'
import AdminLayout from '../../components/AdminLayout'

export default function Users() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const navigate = useNavigate()

  const fetchUsers = useCallback(() => {
    setLoading(true)
    api.get('/admin/users', { params: { search, page, limit: 20 } })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); setPages(r.data.pages) })
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [search, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleToggleLock = async (userId) => {
    setTogglingId(userId)
    try {
      const r = await api.put(`/admin/users/${userId}/toggle-lock`)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isLocked: r.data.isLocked } : u))
    } catch { alert('Lỗi thao tác') }
    finally { setTogglingId(null) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/admin/users/${confirmDelete.id}`)
      setConfirmDelete(null)
      fetchUsers()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  const avatar = (name) => name?.charAt(0)?.toUpperCase() || '?'
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Người dùng <span className="text-base font-normal text-gray-400">({total})</span></h1>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <input
            type="text" placeholder="Tìm theo tên hoặc email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Không có người dùng nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">Người dùng</th>
                    <th className="px-4 py-3 text-left font-medium">Ngày đăng ký</th>
                    <th className="px-4 py-3 text-left font-medium">Lượt thi</th>
                    <th className="px-4 py-3 text-left font-medium">Band TB</th>
                    <th className="px-4 py-3 text-left font-medium">Thi gần nhất</th>
                    <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1a56db] text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {avatar(u.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{u._count?.attempts ?? 0}</td>
                      <td className="px-4 py-3">
                        {u.avgScore != null
                          ? <span className={`font-bold ${u.avgScore >= 7 ? 'text-green-600' : u.avgScore >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>{u.avgScore.toFixed(1)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(u.lastAttemptAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleLock(u.id)}
                          disabled={togglingId === u.id}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                            u.isLocked
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {togglingId === u.id ? '...' : u.isLocked ? 'Đã khoá' : 'Hoạt động'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => navigate(`/admin/users/${u.id}`)}
                            className="px-2.5 py-1 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                          >Chi tiết</button>
                          <button
                            onClick={() => setConfirmDelete({ id: u.id, name: u.name })}
                            className="px-2.5 py-1 rounded-lg text-xs border border-red-200 text-red-500 hover:bg-red-50 transition"
                          >Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Trang {page} / {pages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 mb-6">Xóa người dùng <strong>{confirmDelete.name}</strong>? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#dc2626' }}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
