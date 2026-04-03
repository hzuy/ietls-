import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminStaff, makeAdmin, makeTeacher, removeStaff } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const navigate = useNavigate()

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const fetchStaff = () => {
    setLoading(true)
    getAdminStaff()
      .then(data => setStaff(data))
      .catch(err => { if (err.response?.status === 403) navigate('/admin') })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStaff() }, [])

  const handleMakeAdmin = async (userId) => {
    setActionLoading(userId + '_admin')
    try {
      await makeAdmin(userId)
      fetchStaff()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi') }
    finally { setActionLoading(null) }
  }

  const handleMakeTeacher = async (userId) => {
    setActionLoading(userId + '_teacher')
    try {
      await makeTeacher(userId)
      fetchStaff()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi') }
    finally { setActionLoading(null) }
  }

  const handleRemoveStaff = async () => {
    if (!confirmRemove) return
    try {
      await removeStaff(confirmRemove.id)
      setConfirmRemove(null)
      fetchStaff()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi') }
  }

  const adminCount = staff.filter(s => s.role === 'admin').length
  const teacherCount = staff.filter(s => s.role === 'teacher').length

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Quản lý nhân sự</h1>
            <p className="text-sm text-gray-400 mt-0.5">Danh sách admin và giảng viên trong hệ thống</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
            <div className="text-2xl font-bold text-purple-600">{adminCount}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">Admin</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="text-2xl font-bold text-[#1a56db]">{teacherCount}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">Teacher</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : staff.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Chưa có nhân sự nào</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left font-medium">Tên / Email</th>
                  <th className="px-4 py-3 text-left font-medium">Vai trò</th>
                  <th className="px-4 py-3 text-left font-medium">Ngày tham gia</th>
                  <th className="px-4 py-3 text-left font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                        {s.id === currentUser.id && (
                          <span className="text-xs text-gray-300 font-medium">(bạn)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        s.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {s.role === 'admin' ? 'Admin' : 'Teacher'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {s.role === 'teacher' && (
                          <button
                            onClick={() => handleMakeAdmin(s.id)}
                            disabled={actionLoading === s.id + '_admin'}
                            className="px-2.5 py-1 rounded-lg text-xs border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-50">
                            {actionLoading === s.id + '_admin' ? '...' : 'Nâng Admin'}
                          </button>
                        )}
                        {s.role === 'admin' && s.id !== currentUser.id && (
                          <button
                            onClick={() => handleMakeTeacher(s.id)}
                            disabled={actionLoading === s.id + '_teacher'}
                            className="px-2.5 py-1 rounded-lg text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 transition disabled:opacity-50">
                            {actionLoading === s.id + '_teacher' ? '...' : 'Hạ Teacher'}
                          </button>
                        )}
                        {s.id !== currentUser.id && (
                          <button
                            onClick={() => setConfirmRemove({ id: s.id, name: s.name })}
                            className="px-2.5 py-1 rounded-lg text-xs border border-red-200 text-red-500 hover:bg-red-50 transition">
                            Xóa khỏi staff
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmRemove && (
        <div
          onClick={() => setConfirmRemove(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Xác nhận xóa khỏi staff</h3>
            <p className="text-sm text-gray-600 mb-6">
              Xóa quyền staff của <strong>{confirmRemove.name}</strong>? Tài khoản sẽ trở về role <strong>User</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Huỷ
              </button>
              <button
                onClick={handleRemoveStaff}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
