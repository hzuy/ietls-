import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Lock, Unlock, Trash2 } from 'lucide-react'
import { getAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount, toggleUserLock } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { showAlert } from '../../utils/alertUtils'
import { SkeletonTable } from '../../components/skeletons'
import { AdminListHeader } from '../../components/admin/contentPageUI'


function avatarInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const emptyForm = { name: '', email: '', password: '', role: 'teacher' }

export default function Accounts() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
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

  const {
    data: accounts = [],
    isPending,
  } = useQuery({
    queryKey: ['admin', 'accounts'],
    queryFn: async () => {
      try {
        return await getAdminAccounts()
      } catch (err) {
        if (err.response?.status === 403) navigate('/admin')
        throw err
      }
    },
    staleTime: 1000 * 60 * 5, // Fresh 5 phút
    gcTime: 1000 * 60 * 30,    // Cache trong RAM 30 phút
    placeholderData: (prev) => prev,
  })

  const saveAccountMutation = useMutation({
    mutationFn: ({ id, payload }) => {
      if (id) return updateAdminAccount(id, payload)
      return createAdminAccount(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
      setShowForm(false)
      showToast(editingId ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản', 'success')
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Lỗi thao tác'
      setError(msg)
      showAlert(msg, 'error')
    },
    onSettled: () => {
      setSubmitting(false)
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: (id) => deleteAdminAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
      setConfirmDelete(null)
      showToast('Đã xóa tài khoản', 'success')
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Lỗi xóa', 'error')
    },
  })

  const lockMutation = useMutation({
    mutationFn: (accId) => toggleUserLock(accId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
    },
    onError: () => {
      showToast('Lỗi thao tác', 'error')
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

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
    if (editingId) {
      const payload = { name: form.name, role: form.role }
      if (form.password && form.password.trim()) {
        payload.password = form.password.trim()
      }
      saveAccountMutation.mutate({ id: editingId, payload })
    } else {
      if (!form.password) {
        const msg = 'Vui lòng nhập mật khẩu'
        setError(msg)
        showAlert(msg, 'error')
        setSubmitting(false)
        return
      }
      saveAccountMutation.mutate({ id: null, payload: form })
    }
  }

  const handleDelete = () => {
    if (!confirmDelete) return
    deleteAccountMutation.mutate(confirmDelete.id)
  }

  const executeLock = (accId) => {
    setConfirmLock(null)
    setConfirmUnlock(null)
    setTogglingId(accId)
    lockMutation.mutate(accId)
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <AdminListHeader
          title="Quản lý nhân sự"
          subtitle="Danh sách tài khoản giáo viên và quản trị viên"
          onAdd={openCreate}
          addLabel="+ Tạo tài khoản"
        />

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 mb-4 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">{editingId ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Họ tên</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 placeholder:text-zinc-400 transition shadow-2xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editingId}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 transition shadow-2xs text-zinc-900 placeholder:text-zinc-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                    {editingId ? 'Mật khẩu mới (Tùy chọn)' : 'Mật khẩu'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder={editingId ? 'Mật khẩu mới' : 'Mật khẩu'}
                      className="w-full pl-3 pr-10 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 placeholder:text-zinc-400 transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {/* Only admin can change roles — hide for teachers */}
                {currentUser.role !== 'teacher' && (
                  <div>
                    <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Role</label>
                    <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 transition shadow-2xs">
                      <option value="teacher">Teacher (Quản lý đề thi)</option>
                      <option value="admin">Admin (Quản lý hệ thống)</option>
                    </select>
                  </div>
                )}
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition disabled:opacity-70 flex items-center gap-2 shadow-xs">
                  {submitting && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo tài khoản'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 font-medium transition">Huỷ</button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          {isPending && accounts.length === 0 ? (
            <SkeletonTable rows={6} cols={5} />
          ) : accounts.length === 0 ? (
            <p className="text-center text-zinc-400 py-12 text-xs">Chưa có tài khoản nội bộ nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200">
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
                    <tr key={acc.id} className={`border-b border-zinc-100 transition ${isSelf ? 'bg-zinc-100/70 hover:bg-zinc-100' : `${idx % 2 === 1 ? 'bg-zinc-50/40' : ''} hover:bg-zinc-50`}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {avatarInitials(acc.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-zinc-900 text-xs">{acc.name}</p>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200 text-zinc-800 border border-zinc-300">Bạn</span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500">{acc.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {acc.role === 'admin' ? 'Admin' : 'Teacher'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-zinc-500">{fmtDate(acc.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${acc.isLocked ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-zinc-100 text-zinc-800 border border-zinc-200'}`}>
                          {acc.isLocked ? 'Khoá' : 'Hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(acc)} title="Sửa tài khoản"
                            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition shadow-2xs">
                            <Pencil size={15} />
                          </button>
                          {!isSelf && (
                            acc.isLocked ? (
                              <button
                                onClick={() => setConfirmUnlock({ id: acc.id, name: acc.name })}
                                disabled={togglingId === acc.id}
                                title="Mở khoá"
                                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition shadow-2xs">
                                <Unlock size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmLock({ id: acc.id, name: acc.name })}
                                disabled={togglingId === acc.id}
                                title="Khoá tài khoản"
                                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition shadow-2xs">
                                <Lock size={15} />
                              </button>
                            )
                          )}
                          <button
                            onClick={() => !isSelf && setConfirmDelete({ id: acc.id, name: acc.name })}
                            disabled={isSelf}
                            title="Xóa tài khoản"
                            className={`p-1.5 rounded-lg border transition shadow-2xs ${isSelf ? 'border-zinc-200 text-zinc-300 cursor-not-allowed' : 'border-zinc-200 text-red-500 hover:bg-red-50 hover:border-red-200'}`}>
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
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Xác nhận xóa</h3>
            <p className="text-xs text-zinc-600 mb-6">Xóa tài khoản <strong>{confirmDelete.name}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 font-medium transition">Huỷ</button>
              <button onClick={handleDelete} className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {confirmLock && (
        <div onClick={() => setConfirmLock(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Khoá tài khoản</h3>
            <p className="text-xs text-zinc-600 mb-6">
              Khoá tài khoản <strong>{confirmLock.name}</strong>? Nhân sự sẽ không thể đăng nhập cho đến khi được mở khoá.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmLock(null)} className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 font-medium transition">Huỷ</button>
              <button onClick={() => executeLock(confirmLock.id, false)} className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition">Khoá</button>
            </div>
          </div>
        </div>
      )}

      {confirmUnlock && (
        <div onClick={() => setConfirmUnlock(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Mở khoá tài khoản</h3>
            <p className="text-xs text-zinc-600 mb-6">
              Mở khoá tài khoản <strong>{confirmUnlock.name}</strong>? Nhân sự sẽ có thể đăng nhập trở lại.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmUnlock(null)} className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 font-medium transition">Huỷ</button>
              <button onClick={() => executeLock(confirmUnlock.id, true)} className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition">Mở khoá</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
