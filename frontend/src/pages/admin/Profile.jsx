import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminMe, changeAdminPassword } from '../../services/adminService'


const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher' }
const ROLE_COLOR = { admin: 'bg-zinc-900 text-white', teacher: 'bg-zinc-100 text-zinc-800 border border-zinc-200' }

function ProfileSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto animate-pulse">
      <div className="mb-8 space-y-2">
        <div className="h-6 w-48 bg-zinc-200 rounded" />
        <div className="h-3.5 w-64 bg-zinc-100 rounded" />
      </div>
      {/* Profile card skeleton */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 mb-5">
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
  )
}

export default function Profile() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwError, setPwError]   = useState('')
  const [pwSaved, setPwSaved]   = useState(false)

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

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      changeAdminPassword(currentPassword, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'profile'] })
      setPwSaved(true)
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
      setTimeout(() => setPwSaved(false), 3000)
    },
    onError: (err) => {
      setPwError(err.response?.data?.message || 'Lỗi đổi mật khẩu')
    },
  })

  const pwSaving = changePasswordMutation.isPending

  const handlePasswordChange = (e) => {
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
    changePasswordMutation.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    })
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
    <div className="p-6 max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Cài đặt tài khoản</h1>
          <p className="text-xs text-zinc-500 mt-1">Thông tin tài khoản đang đăng nhập</p>
        </div>

        {/* ── Profile card ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 mb-5">
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
            <p className="text-xs text-zinc-500 mt-0.5">Mật khẩu mới phải ít nhất 6 ký tự</p>
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
            {pwError && <p className="text-xs text-red-500">{pwError}</p>}
            {pwSaved && <p className="text-xs text-green-600 font-medium">✓ Đổi mật khẩu thành công</p>}
            <div className="pt-1">
              <button
                type="submit"
                disabled={pwSaving}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition disabled:opacity-60 shadow-xs"
              >
                {pwSaving ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </section>

      </div>
  )
}
