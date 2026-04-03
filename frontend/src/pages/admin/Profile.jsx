import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminMe, changeAdminPassword } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'

const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher' }
const ROLE_COLOR = { admin: 'bg-purple-100 text-purple-700', teacher: 'bg-blue-100 text-blue-700' }

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getAdminMe()
      .then(data => setProfile(data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [])

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('Mật khẩu xác nhận không khớp')
      return
    }
    if (pwForm.newPassword.length < 6) {
      setPwError('Mật khẩu mới phải ít nhất 6 ký tự')
      return
    }
    setPwSaving(true)
    try {
      await changeAdminPassword(pwForm.currentPassword, pwForm.newPassword)
      setPwSaved(true)
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      setPwError(err.response?.data?.message || 'Lỗi đổi mật khẩu')
    } finally {
      setPwSaving(false)
    }
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  const inputCls = 'w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] bg-white'
  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5'

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  if (!profile) return (
    <AdminLayout>
      <div className="p-8 text-gray-400">Không thể tải thông tin tài khoản.</div>
    </AdminLayout>
  )

  const initials = profile.name
    ? profile.name.trim().split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase()
    : '?'

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Cài đặt tài khoản</h1>
          <p className="text-sm text-gray-400 mt-1">Thông tin tài khoản đang đăng nhập</p>
        </div>

        {/* ── Profile card ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-[#1a56db] flex items-center justify-center shrink-0">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-800">{profile.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLOR[profile.role] || 'bg-gray-100 text-gray-600'}`}>
                  {ROLE_LABEL[profile.role] || profile.role}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
              <p className="text-xs text-gray-400 mt-1">Tham gia: {fmtDate(profile.createdAt)}</p>
            </div>
          </div>

          {/* Detail rows */}
          <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Họ tên</p>
              <p className="font-medium text-gray-800">{profile.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <p className="font-medium text-gray-800">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Role</p>
              <p className="font-medium text-gray-800">{ROLE_LABEL[profile.role] || profile.role}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Ngày tạo</p>
              <p className="font-medium text-gray-800">{fmtDate(profile.createdAt)}</p>
            </div>
          </div>
        </section>

        {/* ── Đổi mật khẩu ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-800">Đổi mật khẩu</h2>
            <p className="text-xs text-gray-400 mt-0.5">Mật khẩu mới phải ít nhất 6 ký tự</p>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className={labelCls}>Mật khẩu hiện tại</label>
              <input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                className={inputCls}
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Mật khẩu mới</label>
              <input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                className={inputCls}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                className={inputCls}
                autoComplete="new-password"
                required
              />
            </div>
            {pwError && <p className="text-sm text-red-500">{pwError}</p>}
            {pwSaved && <p className="text-sm text-green-600 font-medium">✓ Đổi mật khẩu thành công</p>}
            <div className="pt-1">
              <button
                type="submit"
                disabled={pwSaving}
                className="px-6 py-2.5 rounded-xl bg-[#1a56db] text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {pwSaving ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </section>

      </div>
    </AdminLayout>
  )
}
