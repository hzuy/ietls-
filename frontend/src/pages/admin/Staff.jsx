import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminStaff, makeAdmin, makeTeacher, removeStaff } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { SkeletonTable } from '../../components/skeletons'
import Modal from '../../components/common/Modal'


function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function Staff() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [actionLoading, setActionLoading] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const navigate = useNavigate()

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const {
    data: staff = [],
    isPending,
  } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => {
      try {
        return await getAdminStaff()
      } catch (err) {
        if (err.response?.status === 403) navigate('/admin')
        throw err
      }
    },
    staleTime: 1000 * 60 * 5, // Fresh 5 phút
    gcTime: 1000 * 60 * 30,    // Cache trong RAM 30 phút
    placeholderData: (prev) => prev,
  })

  const makeAdminMutation = useMutation({
    mutationFn: (userId) => makeAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      showToast('Đã nâng quyền Admin', 'success')
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Lỗi', 'error')
    },
    onSettled: () => setActionLoading(null),
  })

  const makeTeacherMutation = useMutation({
    mutationFn: (userId) => makeTeacher(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      showToast('Đã chuyển thành Teacher', 'success')
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Lỗi', 'error')
    },
    onSettled: () => setActionLoading(null),
  })

  const removeStaffMutation = useMutation({
    mutationFn: (userId) => removeStaff(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      setConfirmRemove(null)
      showToast('Đã thu hồi quyền nhân sự', 'success')
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Lỗi', 'error')
    },
  })

  const handleMakeAdmin = (userId) => {
    setActionLoading(userId + '_admin')
    makeAdminMutation.mutate(userId)
  }

  const handleMakeTeacher = (userId) => {
    setActionLoading(userId + '_teacher')
    makeTeacherMutation.mutate(userId)
  }

  const handleRemoveStaff = () => {
    if (!confirmRemove) return
    removeStaffMutation.mutate(confirmRemove.id)
  }

  const adminCount = staff.filter(s => s.role === 'admin').length
  const teacherCount = staff.filter(s => s.role === 'teacher').length

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Quản lý nhân sự</h1>
            <p className="text-xs text-zinc-500 mt-1">Danh sách admin và giảng viên trong hệ thống</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-zinc-900">{adminCount}</div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">Admin</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-zinc-900">{teacherCount}</div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">Teacher</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          {isPending && staff.length === 0 ? (
            <SkeletonTable rows={4} cols={4} />
          ) : staff.length === 0 ? (
            <p className="text-center text-zinc-400 py-12 text-xs">Chưa có nhân sự nào</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                  <th className="px-5 py-3 text-left font-medium">Tên / Email</th>
                  <th className="px-4 py-3 text-left font-medium">Vai trò</th>
                  <th className="px-4 py-3 text-left font-medium">Ngày tham gia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-zinc-900 text-xs">{s.name}</p>
                          <p className="text-[11px] text-zinc-500">{s.email}</p>
                        </div>
                        {s.id === currentUser.id && (
                          <span className="text-[11px] text-zinc-400 font-medium">(bạn)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.role === 'admin' ? (
                        <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Admin</span>
                      ) : (
                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Teacher</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-500">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        {s.role === 'teacher' && (
                          <button
                            onClick={() => handleMakeAdmin(s.id)}
                            disabled={actionLoading === s.id + '_admin'}
                            className="h-8 px-3.5 rounded-full text-xs border border-zinc-200 dark:border-slate-700 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition disabled:opacity-50 font-medium shadow-2xs cursor-pointer">
                            {actionLoading === s.id + '_admin' ? '...' : 'Nâng Admin'}
                          </button>
                        )}
                        {s.role === 'admin' && s.id !== currentUser.id && (
                          <button
                            onClick={() => handleMakeTeacher(s.id)}
                            disabled={actionLoading === s.id + '_teacher'}
                            className="h-8 px-3.5 rounded-full text-xs border border-zinc-200 dark:border-slate-700 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition disabled:opacity-50 font-medium shadow-2xs cursor-pointer">
                            {actionLoading === s.id + '_teacher' ? '...' : 'Hạ Teacher'}
                          </button>
                        )}
                        {s.id !== currentUser.id && (
                          <button
                            onClick={() => setConfirmRemove({ id: s.id, name: s.name })}
                            className="h-8 px-3.5 rounded-full text-xs border border-zinc-200 dark:border-slate-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 transition font-medium shadow-2xs cursor-pointer">
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
        <Modal onClose={() => setConfirmRemove(null)} title="Xác nhận xóa khỏi staff" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100 mb-2">Xác nhận xóa khỏi staff</h3>
          <p className="text-xs text-zinc-600 dark:text-slate-400 mb-6">
            Xóa quyền staff của <strong>{confirmRemove.name}</strong>? Tài khoản sẽ trở về role <strong>User</strong>.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button
              onClick={() => setConfirmRemove(null)}
              className="h-9 px-5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs sm:text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer">
              Huỷ
            </button>
            <button
              onClick={handleRemoveStaff}
              className="h-9 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">
              Xóa
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
