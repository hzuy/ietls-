import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAdminUser, toggleUserLock, deleteAdminUser, resetUserPassword } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { KeyRound } from 'lucide-react'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'
import { formatBand } from '../../utils/ielts'
import Modal from '../../components/common/Modal'

export default function UserDetail() {
  const { showToast } = useToast()
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [togglingLock, setTogglingLock] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [newPassword, setNewPassword] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getAdminUser(id)
      .then(data => setData(data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return <div className="p-8 text-zinc-400">Không tìm thấy người dùng.</div>

  const { user, attempts, skillStats, totalAttempts, shownAttempts } = data
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  // BUG-07: Action handlers
  const handleToggleLock = async () => {
    setTogglingLock(true)
    try {
      const result = await toggleUserLock(user.id)
      setData(d => ({ ...d, user: { ...d.user, isLocked: result.isLocked } }))
    } catch { showToast('Lỗi thao tác', 'error') }
    setTogglingLock(false)
  }

  const handleDelete = async () => {
    try {
      await deleteAdminUser(user.id)
      navigate('/admin/users')
    } catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
  }

  const handleResetPassword = async () => {
    setConfirmReset(false)
    try {
      const result = await resetUserPassword(user.id)
      setNewPassword(result.newPassword)
    } catch { showToast('Lỗi reset mật khẩu', 'error') }
  }

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <button onClick={() => navigate('/admin/users')} className="text-xs text-zinc-500 hover:text-zinc-800 mb-4 flex items-center gap-1 font-medium transition">
          ← Quay lại
        </button>

        {/* User info */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 mb-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-900 text-white text-base font-bold flex items-center justify-center">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">{user.name}</h1>
              <p className="text-xs text-zinc-500 mt-1">{user.email}</p>
              <div className="flex gap-2 mt-1.5">
                {user.role === 'admin' ? (
                  <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Admin</span>
                ) : (
                  <span className="bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 border border-zinc-200 dark:border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">Student</span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isLocked ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-zinc-100 text-zinc-800 border border-zinc-200'}`}>
                  {user.isLocked ? 'Đã khoá' : 'Hoạt động'}
                </span>
              </div>
            </div>
            <div className="ml-auto text-right flex flex-col items-end gap-2">
              <p className="text-[11px] text-zinc-500">Ngày đăng ký</p>
              <p className="text-xs font-medium text-zinc-700">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</p>
              {/* Action buttons */}
              <div className="inline-flex items-center gap-2 mt-1">
                <button onClick={handleToggleLock} disabled={togglingLock}
                  className={`h-9 px-4 text-xs rounded-full border border-zinc-200 dark:border-slate-700 font-medium transition text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 cursor-pointer shadow-2xs`}>
                  {togglingLock ? '...' : user.isLocked ? 'Mở khoá' : 'Khoá'}
                </button>
                <button onClick={() => setConfirmReset(true)}
                  className="h-9 px-4 text-xs rounded-full border border-zinc-200 dark:border-slate-700 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 font-medium transition shadow-2xs flex items-center gap-1 cursor-pointer">
                  <KeyRound size={14} />
                  Reset MK
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  className="h-9 px-4 text-xs rounded-full border border-zinc-200 dark:border-slate-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 font-medium transition shadow-2xs cursor-pointer">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
            <div className="text-2xl font-bold text-zinc-900">{totalAttempts}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Tổng lượt thi</div>
          </div>
          {SKILL_ORDER.map(skill => {
            const score = skillStats[skill]
            return (
              <div key={skill} className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
                <div className="text-2xl font-bold text-zinc-900">{formatBand(score)}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Band TB {SKILL_LABEL[skill]}</div>
              </div>
            )
          })}
        </div>

        {/* Attempt history */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 text-sm">Lịch sử bài thi</h2>
            <span className="text-[11px] text-zinc-500">
              {totalAttempts > (shownAttempts ?? attempts.length)
                ? `Hiển thị ${shownAttempts ?? attempts.length} lượt thi gần nhất / tổng ${totalAttempts} lượt`
                : `Tổng ${totalAttempts} lượt thi`}
            </span>
          </div>
          {attempts.length === 0 ? (
            <p className="text-center text-zinc-400 py-8 text-xs">Chưa có lượt thi nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                    <th className="px-5 py-3 text-left font-medium">Đề thi</th>
                    <th className="px-4 py-3 text-left font-medium">Kỹ năng</th>
                    <th className="px-4 py-3 text-left font-medium">Band</th>
                    <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, idx) => (
                    <tr key={a.id} className={`border-b border-zinc-100 hover:bg-zinc-50 transition ${idx % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                      <td className="px-5 py-3 text-zinc-800 font-medium">{a.exam?.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.score != null
                          ? <span className="font-semibold text-zinc-900">{a.score.toFixed(1)}</span>
                          : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-zinc-500">{fmtDate(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reset password confirm modal */}
      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)} title="Reset mật khẩu" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100 mb-2">Reset mật khẩu</h3>
          <p className="text-xs text-zinc-600 dark:text-slate-400 mb-6">
            Tạo mật khẩu ngẫu nhiên mới cho <strong>{user.name}</strong>? Mật khẩu cũ sẽ không còn hợp lệ.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button onClick={() => setConfirmReset(false)} className="h-9 px-5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs sm:text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer">Huỷ</button>
            <button onClick={handleResetPassword} className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">Reset</button>
          </div>
        </Modal>
      )}

      {/* Reset password result modal */}
      {newPassword && (
        <Modal onClose={() => setNewPassword(null)} title="Mật khẩu mới" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100 mb-2">Mật khẩu mới</h3>
          <p className="text-xs text-zinc-600 dark:text-slate-400 mb-3">Mật khẩu mới của <strong>{user.name}</strong>:</p>
          <code className="block w-full text-center text-sm font-mono font-bold tracking-widest bg-zinc-100 dark:bg-slate-800 rounded-xl px-4 py-3 mb-3 text-zinc-800 dark:text-slate-200 select-all border border-zinc-200 dark:border-slate-700">
            {newPassword}
          </code>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-5">Chỉ hiển thị 1 lần — hãy gửi cho user ngay</p>
          <div className="flex justify-end">
            <button onClick={() => setNewPassword(null)} className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">Đã copy / Đóng</button>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} title="Xác nhận xóa" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100 mb-2">Xác nhận xóa</h3>
          <p className="text-xs text-zinc-600 dark:text-slate-400 mb-6">Xóa người dùng <strong>{user.name}</strong>? Lịch sử thi sẽ được giữ lại (soft delete).</p>
          <div className="flex gap-2.5 justify-end">
            <button onClick={() => setConfirmDelete(false)} className="h-9 px-5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs sm:text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer">Huỷ</button>
            <button onClick={handleDelete} className="h-9 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer">Xóa</button>
          </div>
        </Modal>
      )}
    </>
  )
}
