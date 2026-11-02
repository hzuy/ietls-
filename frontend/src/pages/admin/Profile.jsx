import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminMe, changeAdminPassword } from '../../services/adminService'
import { usePasswordChange } from '../../hooks/usePasswordChange'


const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher' }
const ROLE_COLOR = { admin: 'bg-zinc-900 text-white', teacher: 'bg-zinc-100 text-zinc-800 border border-zinc-200' }

function ProfileSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-48 bg-zinc-200 rounded" />
        <div className="h-3.5 w-64 bg-zinc-100 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Profile card skeleton */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-zinc-200 rounded" />
              <div className="h-3.5 w-56 bg-zinc-100 rounded" />
              <div className="h-3 w-32 bg-zinc-100 rounded" />
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-zinc-100 grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-16 bg-zinc-100 rounded" />
                <div className="h-4 w-32 bg-zinc-200 rounded" />
              </div>
            ))}
          </div>
        </div>
        {/* Password section skeleton */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 space-y-4">
          <div className="h-4 w-28 bg-zinc-200 rounded" />
          <div className="h-3.5 w-48 bg-zinc-100 rounded" />
          <div className="h-9 w-full bg-zinc-100 rounded-lg" />
          <div className="h-9 w-full bg-zinc-100 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const passwordChange = usePasswordChange(changeAdminPassword, () => {
    setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
  })

  const { data: profile, isPending } = useQuery({
    queryKey: ['admin', 'profile'],
    queryFn: async () => {
      try {
        return await getAdminMe()
      } catch (err) {
        if (err.response?.status === 403) navigate('/')
        throw err
      }
    },
    staleTime: 1000 * 60 * 30, // Thông tin profile admin rất ít thay đổi, giữ fresh 30 phút
    gcTime: 1000 * 60 * 60,    // Giữ trong RAM 60 phút
    placeholderData: (prev) => prev,
  })

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    await passwordChange.submit(pwForm.currentPassword, pwForm.newPassword, pwForm.confirm)
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  const inputCls = 'w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 placeholder:text-zinc-400 transition shadow-2xs'
  const labelCls = 'block text-xs font-medium text-zinc-700 mb-1.5'

  if (isPending && !profile) return <ProfileSkeleton />

  if (!profile) return (
    <div className="p-8 text-zinc-400">Không thể tải thông tin tài khoản.</div>
  )

  const initials = profile.name
    ? profile.name.trim().split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase()
    : '?'

  return (
    <div className="p-6 max-w-5xl mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Cài đặt tài khoản</h1>
          <p className="text-xs text-zinc-500 mt-1">Thông tin tài khoản đang đăng nhập</p>
        </div>

        {/* Thông tin tài khoản + Đổi mật khẩu cạnh nhau từ lg trở lên (xếp dọc ở màn hình hẹp
            hơn) — trước đây xếp dọc luôn nên tổng chiều cao ~770px, nút "Đổi mật khẩu" bị đẩy
            ra ngoài màn hình đầu tiên ở độ phân giải laptop phổ biến (vd 1280x720). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Profile card ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
              <span className="text-white text-lg font-bold">{initials}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-zinc-900">{profile.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${ROLE_COLOR[profile.role] || 'bg-zinc-100 text-zinc-700 border border-zinc-200'}`}>
                  {ROLE_LABEL[profile.role] || profile.role}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{profile.email}</p>
              <p className="text-[11px] text-zinc-500 mt-1">Tham gia: {fmtDate(profile.createdAt)}</p>
            </div>
          </div>

          {/* Detail rows */}
          <div className="mt-5 pt-5 border-t border-zinc-100 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[11px] text-zinc-500 mb-0.5">Họ tên</p>
              <p className="font-medium text-zinc-900">{profile.name}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-0.5">Email</p>
              <p className="font-medium text-zinc-900">{profile.email}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-0.5">Role</p>
              <p className="font-medium text-zinc-900">{ROLE_LABEL[profile.role] || profile.role}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-0.5">Ngày tạo</p>
              <p className="font-medium text-zinc-900">{fmtDate(profile.createdAt)}</p>
            </div>
          </div>
        </section>

        {/* ── Đổi mật khẩu ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-zinc-900">Đổi mật khẩu</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Mật khẩu mới cần ít nhất 8 ký tự, tối đa 72 byte UTF-8 và khác mật khẩu hiện tại. Sau khi đổi, bạn cần đăng nhập lại trên mọi thiết bị.</p>
          </div>
          {profile.hasPassword === false ? (
            <p className="text-sm text-zinc-600">Tài khoản này đăng nhập bằng Google và chưa có mật khẩu riêng. Vui lòng quản lý mật khẩu trong tài khoản Google của bạn.</p>
          ) : <form onSubmit={handlePasswordChange} className="space-y-4" aria-busy={passwordChange.saving}>
            <div>
              <label htmlFor="admin-current-password" className={labelCls}>Mật khẩu hiện tại</label>
              <input
                id="admin-current-password"
                name="currentPassword"
                disabled={passwordChange.saving}
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                className={inputCls}
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-new-password" className={labelCls}>Mật khẩu mới</label>
              <input
                id="admin-new-password"
                name="newPassword"
                disabled={passwordChange.saving}
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                className={inputCls}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-confirm-password" className={labelCls}>Xác nhận mật khẩu mới</label>
              <input
                id="admin-confirm-password"
                name="confirmPassword"
                disabled={passwordChange.saving}
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                className={inputCls}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={passwordChange.saving}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition disabled:opacity-60 shadow-xs focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
              >
                {passwordChange.saving ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>}
        </section>

        </div>
      </div>
  )
}
