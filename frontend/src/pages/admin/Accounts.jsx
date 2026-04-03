import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'

const emptyForm = { name: '', email: '', password: '', role: 'teacher' }

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const fetchAccounts = () => {
    setLoading(true)
    getAdminAccounts()
      .then(data => setAccounts(data))
      .catch(err => { if (err.response?.status === 403) navigate('/admin') })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAccounts() }, [])

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowForm(true) }
  const openEdit = (acc) => { setForm({ name: acc.name, email: acc.email, password: '', role: acc.role }); setEditingId(acc.id); setError(''); setShowForm(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      if (editingId) {
        await updateAdminAccount(editingId, { name: form.name, role: form.role })
      } else {
        if (!form.password) { setError('Vui lòng nhập mật khẩu'); setSubmitting(false); return }
        await createAdminAccount(form)
      }
      setShowForm(false); fetchAccounts()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi thao tác')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteAdminAccount(confirmDelete.id)
      setConfirmDelete(null); fetchAccounts()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Quản lý nhân sự</h1>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-[#1a56db] text-white text-sm font-medium hover:bg-blue-700 transition">
            + Tạo tài khoản
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold text-gray-800 mb-4">{editingId ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Họ tên</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editingId}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] disabled:bg-gray-50" />
                </div>
                {!editingId && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Mật khẩu</label>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Role</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]">
                    <option value="teacher">Teacher (Quản lý đề thi)</option>
                    <option value="admin">Admin (Quản lý hệ thống)</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#1a56db] text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
                  {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo tài khoản'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Chưa có tài khoản nội bộ nào</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left font-medium">Tên / Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
                  <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                  <th className="px-4 py-3 text-left font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => {
                  const isSelf = acc.email === currentUser.email
                  return (
                  <tr key={acc.id} className={`border-b border-gray-50 ${isSelf ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-gray-800">{acc.name}</p>
                          <p className="text-xs text-gray-400">{acc.email}</p>
                        </div>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-600 border border-blue-200">Bạn</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {acc.role === 'admin' ? 'Admin' : 'Teacher'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(acc.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.isLocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {acc.isLocked ? 'Khoá' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(acc)} className="px-2.5 py-1 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">Sửa</button>
                        <button
                          onClick={() => !isSelf && setConfirmDelete({ id: acc.id, name: acc.name })}
                          disabled={isSelf}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition ${isSelf ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 mb-6">Xóa tài khoản <strong>{confirmDelete.name}</strong>?</p>
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
