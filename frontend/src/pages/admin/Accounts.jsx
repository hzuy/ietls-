import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Pencil, Lock, Unlock, Trash2 } from 'lucide-react'
import { getAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount, toggleUserLock } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'


const AVATAR_COLORS = [
  'bg-[#1D4ED8]', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-600',
]
function avatarInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
function avatarColorIdx(id) {
  return Math.abs(typeof id === 'number' ? id : String(id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % AVATAR_COLORS.length
}

const emptyForm = { name: '', email: '', password: '', role: 'teacher' }

export default function Accounts() {
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState(null)
  const [confirmLock, setConfirmLock] = useState(null)
  const [confirmUnlock, setConfirmUnlock] = useState(null)
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

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowPassword(false)
    setError('')
    setShowForm(true)
  }

  const openEdit = (acc) => {
    setForm({ name: acc.name, email: acc.email, password: '', role: acc.role })
    setEditingId(acc.id)
    setShowPassword(false)
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      if (editingId) {
        const payload = { name: form.name, role: form.role }
        if (form.password && form.password.trim()) {
          payload.password = form.password.trim()
        }
        await updateAdminAccount(editingId, payload)
      } else {
        if (!form.password) { setError('Vui lòng nhập mật khẩu'); setSubmitting(false); return }
        await createAdminAccount(form)
      }
      setShowForm(false); fetchAccounts()
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Lỗi thao tác'
      setError(msg)
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteAdminAccount(confirmDelete.id)
      setConfirmDelete(null); fetchAccounts()
    } catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
  }

  const executeLock = async (accId, wasLocked) => {
    setConfirmLock(null)
    setConfirmUnlock(null)
    setTogglingId(accId)
    try {
      const result = await toggleUserLock(accId)
      setAccounts(prev => prev.map(a => a.id === accId ? { ...a, isLocked: result.isLocked } : a))
    } catch { showToast('Lỗi thao tác', 'error') }
    finally { setTogglingId(null) }
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Quản lý nhân sự</h1>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-medium hover:bg-blue-700 transition">
            + Tạo tài khoản
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold text-gray-800 mb-4">{editingId ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Họ tên</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editingId}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8] disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {editingId ? 'Mật khẩu mới (Tùy chọn)' : 'Mật khẩu'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder={editingId ? 'Mật khẩu mới' : 'Mật khẩu'}
                      className="w-full pl-3 pr-10 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {/* BUG-21: Only admin can change roles — hide for teachers */}
                {currentUser.role !== 'teacher' && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Role</label>
                    <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8]">
                      <option value="teacher">Teacher (Quản lý đề thi)</option>
                      <option value="admin">Admin (Quản lý hệ thống)</option>
                    </select>
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-70 flex items-center gap-2">
                  {submitting && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
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
              <div className="w-7 h-7 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Chưa có tài khoản nội bộ nào</p>
          ) : (
            <div className="overflow-x-auto">
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
                  {accounts.map((acc, idx) => {
                    const isSelf = acc.email === currentUser.email
                    return (
                    <tr key={acc.id} className={`border-b border-gray-50 ${isSelf ? 'bg-blue-50 hover:bg-blue-100' : `${idx % 2 === 1 ? 'bg-gray-50/50' : ''} hover:bg-gray-50`}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[avatarColorIdx(acc.id)]} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                            {avatarInitials(acc.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-800">{acc.name}</p>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-600 border border-blue-200">Bạn</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{acc.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {acc.role === 'admin' ? 'Admin' : 'Teacher'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(acc.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.isLocked ? 'bg-red-50 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {acc.isLocked ? 'Khoá' : 'Hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(acc)} title="Sửa tài khoản"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition">
                            <Pencil size={15} />
                          </button>
                          {!isSelf && (
                            acc.isLocked ? (
                              <button
                                onClick={() => setConfirmUnlock({ id: acc.id, name: acc.name })}
                                disabled={togglingId === acc.id}
                                title="Mở khoá"
                                className="p-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition">
                                <Unlock size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmLock({ id: acc.id, name: acc.name })}
                                disabled={togglingId === acc.id}
                                title="Khoá tài khoản"
                                className="p-1.5 rounded-lg border border-orange-200 text-orange-500 hover:bg-orange-50 transition">
                                <Lock size={15} />
                              </button>
                            )
                          )}
                          <button
                            onClick={() => !isSelf && setConfirmDelete({ id: acc.id, name: acc.name })}
                            disabled={isSelf}
                            title="Xóa tài khoản"
                            className={`p-1.5 rounded-lg border transition ${isSelf ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                            <Trash2 size={15} />
                          </button>
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
      </div>

      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 mb-6">Xóa tài khoản <strong>{confirmDelete.name}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors" style={{ background: '#dc2626' }} onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'} onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {confirmLock && (
        <div onClick={() => setConfirmLock(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Khoá tài khoản</h3>
            <p className="text-sm text-gray-600 mb-6">
              Khoá tài khoản <strong>{confirmLock.name}</strong>? Nhân sự sẽ không thể đăng nhập cho đến khi được mở khoá.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmLock(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button onClick={() => executeLock(confirmLock.id, false)} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition">Khoá</button>
            </div>
          </div>
        </div>
      )}

      {confirmUnlock && (
        <div onClick={() => setConfirmUnlock(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Mở khoá tài khoản</h3>
            <p className="text-sm text-gray-600 mb-6">
              Mở khoá tài khoản <strong>{confirmUnlock.name}</strong>? Nhân sự sẽ có thể đăng nhập trở lại.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmUnlock(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button onClick={() => executeLock(confirmUnlock.id, true)} className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition">Mở khoá</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
