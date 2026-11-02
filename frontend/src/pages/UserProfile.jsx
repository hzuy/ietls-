import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Card from '../components/common/Card'
import PillButton from '../components/common/PillButton'
import PillInput from '../components/common/PillInput'
import PasswordInput from '../components/common/PasswordInput'
import { UserProfileSkeleton } from '../components/skeletons'
import { getMe, updateProfile, changePassword, getUserStats } from '../services/userService'
import { User, BarChart2, Lock } from 'lucide-react'
import { formatBand } from '../utils/ielts'
import { showAlert } from '../utils/alertUtils'
import { usePasswordChange } from '../hooks/usePasswordChange'
import { readPasswordForm } from '../utils/passwordUtils'

const TABS = [
  { id: 'info',     label: 'Thông tin cá nhân', Icon: User },
  { id: 'results',  label: 'Kết quả luyện thi',  Icon: BarChart2 },
  { id: 'password', label: 'Đổi mật khẩu',        Icon: Lock },
]

const SKILLS = [
  { key: 'reading',   label: 'Reading' },
  { key: 'listening', label: 'Listening' },
  { key: 'writing',   label: 'Writing' },
  { key: 'speaking',  label: 'Speaking' },
]

export default function UserProfile() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState('info')

  // --- Info tab ---
  const [name, setName] = useState(user?.name || '')
  const [joinDate, setJoinDate] = useState('—')
  const [hasPassword, setHasPassword] = useState(null)
  const [profileError, setProfileError] = useState(false)

  // --- Stats tab ---
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsFetched, setStatsFetched] = useState(false)
  const [statsError, setStatsError] = useState(false)

  // --- Password tab ---
  const [oldPwd, setOldPwd]       = useState('')
  const [newPwd, setNewPwd]       = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const passwordChange = usePasswordChange(changePassword, () => {
    setOldPwd(''); setNewPwd(''); setConfirmPwd('')
  })

  useEffect(() => {
    document.title = 'Hồ sơ học tập | IELTS Pro'
    getMe().then(data => {
      setJoinDate(new Date(data.createdAt).toLocaleDateString('vi-VN', {
        year: 'numeric', month: 'long', day: 'numeric',
      }))
      setName(data.name)
      setHasPassword(data.hasPassword !== false)
    }).catch(() => setProfileError(true))
  }, [])

  useEffect(() => {
    if (activeTab === 'results' && !statsFetched) {
      setStatsLoading(true)
      setStatsFetched(true)
      getUserStats()
        .then(data => setStats(data))
        .catch(() => setStatsError(true))
        .finally(() => setStatsLoading(false))
    }
  }, [activeTab, statsFetched])

  async function handleSaveInfo(e) {
    e.preventDefault()
    try {
      const data = await updateProfile(name)
      const updated = { ...user, name: data.name }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      showAlert.success('Cập nhật thành công!')
    } catch (err) {
      showAlert.error(err.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  function syncPasswordValues(values) {
    setOldPwd(values.currentPassword)
    setNewPwd(values.newPassword)
    setConfirmPwd(values.confirmation)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (hasPassword !== true) return
    await passwordChange.submitForm(e.currentTarget, syncPasswordValues)
  }

  const avatarLetter = (user?.name || 'U').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      <div className="app-container pt-6 pb-16 flex flex-col md:flex-row gap-8 items-start anim-fade-up">

        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-4">

          {/* User card */}
          <div className="card-base p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              {avatarLetter}
            </div>
            <div className="font-bold text-zinc-900 mb-1" style={{ fontSize: 'var(--fs-base)' }}>
              {user?.name}
            </div>
            <div className="text-zinc-500 mb-3 break-all" style={{ fontSize: 'var(--fs-sm)' }}>
              {user?.email}
            </div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-semibold tracking-wide uppercase">
              Thành viên
            </span>
          </div>

          {/* Menu */}
          <div className="card-base overflow-hidden flex flex-col">
            {TABS.map((tab, idx) => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.Icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-5 py-3.5 flex items-center gap-3 font-medium transition-colors border-none cursor-pointer ${
                    isActive ? 'bg-zinc-100 text-zinc-900 font-semibold' : 'bg-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  } ${idx > 0 ? 'border-t border-zinc-100' : ''}`}
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  <TabIcon className="w-4 h-4 text-zinc-500 stroke-[1.75]" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="w-full flex-1 min-w-0">

          {/* Tab: Thông tin cá nhân */}
          {activeTab === 'info' && (
            <div className="card-base p-8">
              <h2 className="text-xl font-bold text-zinc-900 m-0 mb-6">
                Thông tin cơ bản
              </h2>
              <form onSubmit={handleSaveInfo}>
                <div className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="up-name" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Họ và tên
                    </label>
                    <PillInput
                      id="up-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="up-email" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Email
                    </label>
                    <PillInput
                      id="up-email"
                      value={user?.email || ''}
                      disabled
                    />
                  </div>
                  <div>
                    <label htmlFor="up-join" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Ngày tham gia
                    </label>
                    <PillInput
                      id="up-join"
                      value={joinDate}
                      disabled
                    />
                  </div>
                </div>
                <PillButton type="submit" className="mt-6">
                  Lưu thay đổi
                </PillButton>
              </form>
            </div>
          )}

          {/* Tab: Kết quả luyện thi */}
          {activeTab === 'results' && (
            <div className="flex flex-col gap-6">
              {statsLoading ? (
                <UserProfileSkeleton variant="results" />
              ) : statsError ? (
                <Card className="text-center p-12 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</h2>
                  <p className="text-zinc-600 mb-6 max-w-sm" style={{ fontSize: 'var(--fs-sm)' }}>Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
                  <PillButton onClick={() => window.location.reload()}>Thử lại</PillButton>
                </Card>
              ) : stats?.totalAttempts === 0 ? (
                <Card className="text-center p-12 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-2">Bạn chưa có dữ liệu học tập</h2>
                  <p className="text-zinc-600 mb-6 max-w-sm" style={{ fontSize: 'var(--fs-sm)' }}>Hãy bắt đầu luyện tập để xây dựng hồ sơ tiến bộ của mình.</p>
                  <PillButton onClick={() => navigate('/full-test')}>Bắt đầu luyện tập</PillButton>
                </Card>
              ) : (
                <>
                  {/* 3 stat cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Bài đã làm', value: stats?.totalAttempts ?? 0, suffix: ' bài', accent: false },
                      { label: 'Band trung bình', value: stats?.avgBand ? formatBand(stats.avgBand) : '0.0', suffix: '', accent: true },
                      { label: 'Streak', value: stats?.streak ?? 0, suffix: ' ngày', accent: true },
                    ].map(({ label, value, suffix, accent }) => (
                      <div key={label} className="card-base p-6 text-center">
                        <div
                          className="text-3xl font-bold leading-tight"
                          style={{ fontFamily: 'var(--font-mono)', color: accent ? 'var(--primary)' : 'var(--ink)' }}
                        >
                          {value}{suffix}
                        </div>
                        <div className="font-medium text-zinc-500 mt-1" style={{ fontSize: 'var(--fs-sm)' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Band by skill */}
                  <div className="card-base p-8">
                    <h3 className="text-xl font-bold text-zinc-900 m-0 mb-6">
                      Band trung bình theo kỹ năng
                    </h3>
                    {SKILLS.map(({ key, label }) => {
                      const band = stats?.bandBySkill?.[key]
                      const roundedBand = band ? formatBand(band) : '0.0'
                      const pct = band != null ? Math.min((band / 9) * 100, 100) : 0
                      return (
                        <div key={key} className="mb-6 last:mb-0">
                          <div className="flex justify-between items-end mb-2">
                            <span className="font-bold text-zinc-700" style={{ fontSize: 'var(--fs-sm)' }}>{label}</span>
                            <span className="font-bold text-zinc-900 font-mono text-base">
                              {roundedBand}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${pct}%`, background: 'var(--primary)' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {stats && Object.values(stats.bandBySkill ?? {}).every(v => v == null) && (
                      <p className="text-zinc-500 mt-4 m-0" style={{ fontSize: 'var(--fs-sm)' }}>
                        Chưa có dữ liệu luyện thi. Hãy hoàn thành bài thi đầu tiên!
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Đổi mật khẩu */}
          {activeTab === 'password' && (
            <div className="card-base p-8">
              <h2 className="text-xl font-bold text-zinc-900 m-0 mb-6">
                Đổi mật khẩu
              </h2>
              {hasPassword === false ? (
                <p className="text-sm text-zinc-600">Tài khoản này đăng nhập bằng Google và chưa có mật khẩu riêng. Vui lòng quản lý mật khẩu trong tài khoản Google của bạn.</p>
              ) : <form onSubmit={handleChangePassword} aria-busy={passwordChange.saving}>
                <div className="flex flex-col gap-5">
                  {[
                    { id: 'up-old', label: 'Mật khẩu hiện tại', value: oldPwd },
                    { id: 'up-new', label: 'Mật khẩu mới', value: newPwd },
                    { id: 'up-confirm', label: 'Xác nhận mật khẩu mới', value: confirmPwd },
                  ].map(({ id, label, value }) => (
                    <div key={id}>
                      <label htmlFor={id} className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        {label}
                      </label>
                      <PasswordInput
                        id={id}
                        name={id === 'up-old' ? 'currentPassword' : id === 'up-new' ? 'newPassword' : 'confirmPassword'}
                        visibilityLabel={id === 'up-old' ? 'mật khẩu hiện tại' : id === 'up-new' ? 'mật khẩu mới' : 'mật khẩu xác nhận'}
                        autoComplete={id === 'up-old' ? 'current-password' : 'new-password'}
                        disabled={passwordChange.saving}
                        value={value}
                        onChange={event => syncPasswordValues(readPasswordForm(event.currentTarget.form))}
                        required
                      />
                    </div>
                  ))}
                </div>
                {profileError && <p role="alert" className="text-sm text-zinc-500 mt-4">Không thể tải thông tin tài khoản. Vui lòng tải lại trang để thử lại.</p>}
                <PillButton type="submit" className="mt-6 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2" disabled={passwordChange.saving || hasPassword !== true}>
                  {passwordChange.saving ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
                </PillButton>
              </form>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
