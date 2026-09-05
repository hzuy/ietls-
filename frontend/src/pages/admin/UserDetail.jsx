import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAdminUser, toggleUserLock, deleteAdminUser, resetUserPassword } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { KeyRound } from 'lucide-react'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'
import { formatBand } from '../../utils/ielts'

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
      <div className="w-8 h-8 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return <div className="p-8 text-slate-400">Không tìm thấy người dùng.</div>

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
      <div className="p-6 max-w-5xl mx-auto">
        <button onClick={() => navigate('/admin/users')} className="text-sm text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1">
          ← Quay lại
        </button>

        {/* User info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1D4ED8] text-white text-xl font-bold flex items-center justify-center">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">{user.name}</h1>
              <p className="text-sm text-slate-400">{user.email}</p>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium capitalize">{user.role}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isLocked ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-700'}`}>
                  {user.isLocked ? 'Đã khoá' : 'Hoạt động'}
                </span>
              </div>
            </div>
            <div className="ml-auto text-right flex flex-col items-end gap-2">
              <p className="text-xs text-slate-400">Ngày đăng ký</p>
              <p className="text-sm font-medium text-slate-700">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</p>
              {/* BUG-07: Action buttons */}
              <div className="flex gap-2 mt-1">
                <button onClick={handleToggleLock} disabled={togglingLock}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition ${user.isLocked ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-orange-200 text-orange-500 hover:bg-orange-50'}`}>
                  {togglingLock ? '...' : user.isLocked ? 'Mở khoá' : 'Khoá'}
                </button>
                <button onClick={() => setConfirmReset(true)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-orange-200 text-orange-500 hover:bg-orange-50 font-medium transition flex items-center gap-1">
                  <KeyRound size={14} />
                  Reset MK
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-2xl font-bold text-[#1D4ED8]">{totalAttempts}</div>
            <div className="text-xs text-slate-500 mt-0.5">Tổng lượt thi</div>
          </div>
          {SKILL_ORDER.map(skill => {
            const score = skillStats[skill]
            const colors = ADMIN_SKILL_COLORS[skill]
            return (
              <div key={skill} className="rounded-xl p-4" style={{ backgroundColor: colors.bg }}>
                <div className="text-2xl font-bold" style={{ color: colors.text }}>{formatBand(score)}</div>
                <div className="text-xs text-slate-500 mt-0.5">Band TB {SKILL_LABEL[skill]}</div>
              </div>
            )
          })}
        </div>

        {/* Attempt history */}
        <div className="bg-white rounded-2xl border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 text-sm">Lịch sử bài thi</h2>
            {/* BUG-06: Show displayed vs total count */}
            <span className="text-xs text-slate-400">
              {totalAttempts > (shownAttempts ?? attempts.length)
                ? `Hiển thị ${shownAttempts ?? attempts.length} lượt thi gần nhất / tổng ${totalAttempts} lượt`
                : `Tổng ${totalAttempts} lượt thi`}
            </span>
          </div>
          {attempts.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">Chưa có lượt thi nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-3 text-left font-medium">Đề thi</th>
                    <th className="px-4 py-3 text-left font-medium">Kỹ năng</th>
                    <th className="px-4 py-3 text-left font-medium">Band</th>
                    <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, idx) => (
                    <tr key={a.id} className={`border-b border-slate-50 hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-5 py-3 text-slate-700">{a.exam?.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: ADMIN_SKILL_COLORS[a.exam?.skill]?.bg,
                            color: ADMIN_SKILL_COLORS[a.exam?.skill]?.text
                          }}>
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.score != null
                          ? <span className={`font-bold ${a.score >= 7 ? 'text-emerald-600' : a.score >= 5 ? 'text-amber-600' : 'text-rose-500'}`}>{a.score.toFixed(1)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(a.createdAt)}</td>
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
        <div onClick={() => setConfirmReset(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-2">Reset mật khẩu</h3>
            <p className="text-sm text-slate-600 mb-6">
              Tạo mật khẩu ngẫu nhiên mới cho <strong>{user.name}</strong>? Mật khẩu cũ sẽ không còn hợp lệ.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmReset(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
              <button onClick={handleResetPassword} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password result modal */}
      {newPassword && (
        <div onClick={() => setNewPassword(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-2">Mật khẩu mới</h3>
            <p className="text-sm text-slate-600 mb-3">Mật khẩu mới của <strong>{user.name}</strong>:</p>
            <code className="block w-full text-center text-lg font-mono font-bold tracking-widest bg-slate-100 rounded-xl px-4 py-3 mb-3 text-slate-800 select-all">
              {newPassword}
            </code>
            <p className="text-xs text-orange-600 mb-5">Chỉ hiển thị 1 lần — hãy gửi cho user ngay</p>
            <div className="flex justify-end">
              <button onClick={() => setNewPassword(null)} className="px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-medium hover:bg-blue-700 transition">Đã copy / Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* BUG-07: Delete confirmation modal */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 mb-6">Xóa người dùng <strong>{user.name}</strong>? Lịch sử thi sẽ được giữ lại (soft delete).</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
