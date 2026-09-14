import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Lock, Unlock, Trash2 } from 'lucide-react'
import { getAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount, toggleUserLock } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { showAlert } from '../../utils/alertUtils'
import { SkeletonTable } from '../../components/skeletons'
import { AdminListHeader } from '../../components/admin/contentPageUI'
import Modal from '../../components/common/Modal'


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

        {/* Form Modal */}
        {showForm && (
          <Modal onClose={() => setShowForm(false)} title={editingId ? 'Sửa tài khoản' : 'Tạo tài khoản mới'} size="lg" className="p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">{editingId ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Họ tên</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 placeholder:text-zinc-400 transition shadow-2xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editingId}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 transition shadow-2xs text-zinc-900 placeholder:text-zinc-400" />
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
                      className="w-full pl-3 pr-10 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 placeholder:text-zinc-400 transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
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
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 transition shadow-2xs">
                      <option value="teacher">Teacher (Quản lý đề thi)</option>
                      <option value="admin">Admin (Quản lý hệ thống)</option>
                    </select>
                  </div>
                )}
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2.5 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer">Huỷ</button>
                <button type="submit" disabled={submitting}
                  className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-70 inline-flex items-center gap-2 shadow-xs cursor-pointer">
                  {submitting && (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* List */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
          {isPending && accounts.length === 0 ? (
            <SkeletonTable rows={6} cols={5} />
          ) : accounts.length === 0 ? (
            <p className="text-center text-zinc-400 py-12 text-xs">Chưa có tài khoản nội bộ nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                    <th className="px-5 py-3 text-left">Tên / Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Ngày tạo</th>
                    <th className="px-4 py-3 text-left">Trạng thái</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc, idx) => {
                    const isSelf = acc.email === currentUser.email
                    return (
                    <tr key={acc.id} className={`border-b border-zinc-100 transition-colors ${isSelf ? 'bg-zinc-100/70 hover:bg-zinc-100' : `${idx % 2 === 1 ? 'bg-zinc-50/40' : ''} hover:bg-zinc-50`}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {avatarInitials(acc.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-zinc-900">{acc.name}</p>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">Bạn</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">{acc.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {acc.role === 'admin' ? (
                          <span className="bg-purple-500/10 text-purple-600 border border-purple-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Admin</span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Teacher</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-zinc-600">{fmtDate(acc.createdAt)}</td>
                      <td className="px-4 py-3">
                        {acc.isLocked ? (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20">Khoá</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Hoạt động</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openEdit(acc)} title="Sửa tài khoản"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer">
                            <Pencil size={15} />
                          </button>
                          {!isSelf && (
                            acc.isLocked ? (
                              <button
                                onClick={() => setConfirmUnlock({ id: acc.id, name: acc.name })}
                                disabled={togglingId === acc.id}
                                title="Mở khoá"
                                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer">
                                <Unlock size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmLock({ id: acc.id, name: acc.name })}
                                disabled={togglingId === acc.id}
                                title="Khoá tài khoản"
                                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer">
                                <Lock size={15} />
                              </button>
                            )
                          )}
                          <button
                            onClick={() => !isSelf && setConfirmDelete({ id: acc.id, name: acc.name })}
                            disabled={isSelf}
                            title="Xóa tài khoản"
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelf ? 'text-zinc-400 opacity-30 cursor-not-allowed' : 'text-zinc-500 hover:text-red-600 hover:bg-red-50 cursor-pointer'}`}>
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
        <Modal onClose={() => setConfirmDelete(null)} title="Xác nhận xóa" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Xác nhận xóa</h3>
          <p className="text-xs text-zinc-600 mb-6">Xóa tài khoản <strong>{confirmDelete.name}</strong>? Hành động này không thể hoàn tác.</p>
          <div className="flex gap-2.5 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer">Huỷ</button>
            <button onClick={handleDelete} className="h-9 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">Xóa</button>
          </div>
        </Modal>
      )}

      {confirmLock && (
        <Modal onClose={() => setConfirmLock(null)} title="Khoá tài khoản" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Khoá tài khoản</h3>
          <p className="text-xs text-zinc-600 mb-6">
            Khoá tài khoản <strong>{confirmLock.name}</strong>? Nhân sự sẽ không thể đăng nhập cho đến khi được mở khoá.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button onClick={() => setConfirmLock(null)} className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer">Huỷ</button>
            <button onClick={() => executeLock(confirmLock.id, false)} className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">Khoá</button>
          </div>
        </Modal>
      )}

      {confirmUnlock && (
        <Modal onClose={() => setConfirmUnlock(null)} title="Mở khoá tài khoản" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Mở khoá tài khoản</h3>
          <p className="text-xs text-zinc-600 mb-6">
            Mở khoá tài khoản <strong>{confirmUnlock.name}</strong>? Nhân sự sẽ có thể đăng nhập trở lại.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button onClick={() => setConfirmUnlock(null)} className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer">Huỷ</button>
            <button onClick={() => executeLock(confirmUnlock.id, true)} className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">Mở khoá</button>
          </div>
        </Modal>
      )}
    </>
  )
}
