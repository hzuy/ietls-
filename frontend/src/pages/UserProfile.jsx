import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Card from '../components/common/Card'
import { getMe, updateProfile, changePassword, getUserStats } from '../services/userService'
import { User, BarChart2, Lock, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatBand } from '../utils/ielts'

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

function Alert({ msg }) {
  if (!msg) return null
  const isSuccess = msg.type === 'success'
  const Icon = isSuccess ? CheckCircle2 : AlertCircle

  return (
    <div
      role="alert"
      className={`mt-4 px-5 py-3 rounded-full font-medium border flex items-center gap-2.5 ${
        isSuccess
          ? 'bg-success-bg text-success-text border-success-border'
          : 'bg-error-bg text-error-text border-error-border'
      }`}
      style={{ fontSize: 'var(--fs-sm)' }}
    >
      <Icon className={`w-4 h-4 shrink-0 stroke-[2] ${isSuccess ? 'text-success' : 'text-error'}`} />
      <span>{msg.text}</span>
    </div>
  )
}

export default function UserProfile() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState('info')

  // --- Info tab ---
  const [name, setName] = useState(user?.name || '')
  const [joinDate, setJoinDate] = useState('—')
  const [infoMsg, setInfoMsg] = useState(null)

  // --- Stats tab ---
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsFetched, setStatsFetched] = useState(false)
  const [statsError, setStatsError] = useState(false)

  // --- Password tab ---
  const [oldPwd, setOldPwd]       = useState('')
  const [newPwd, setNewPwd]       = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg]       = useState(null)

  useEffect(() => {
    document.title = 'Hồ sơ học tập | IELTS Pro'
    getMe().then(data => {
      setJoinDate(new Date(data.createdAt).toLocaleDateString('vi-VN', {
        year: 'numeric', month: 'long', day: 'numeric',
      }))
      setName(data.name)
    }).catch(() => {})
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
    setInfoMsg(null)
    try {
      const data = await updateProfile(name)
      const updated = { ...user, name: data.name }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      setInfoMsg({ type: 'success', text: 'Cập nhật thành công!' })
    } catch (err) {
      setInfoMsg({ type: 'error', text: err.response?.data?.message || 'Có lỗi xảy ra' })
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd.length < 8) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' })
      return
    }
    try {
      await changePassword(oldPwd, newPwd)
      setPwdMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Có lỗi xảy ra' })
    }
  }

  const avatarLetter = (user?.name || 'U').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      <div className="app-container pt-6 pb-16 flex flex-col md:flex-row gap-8 items-start">

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
        <div className="flex-1 min-w-0">

          {/* Tab: Thông tin cá nhân */}
          {activeTab === 'info' && (
            <div className="card-base p-8">
              <h2 className="text-xl font-bold text-zinc-900 m-0 mb-6">
                Thông tin cơ bản
              </h2>
              <form onSubmit={handleSaveInfo}>
                <div className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="up-name" className="block font-bold text-zinc-700 mb-2" style={{ fontSize: 'var(--fs-sm)' }}>
                      Họ và tên
                    </label>
                    <input
                      id="up-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="w-full px-5 py-2.5 rounded-full border border-zinc-200 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="up-email" className="block font-bold text-zinc-700 mb-2" style={{ fontSize: 'var(--fs-sm)' }}>
                      Email
                    </label>
                    <input
                      id="up-email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-5 py-2.5 rounded-full border border-zinc-200 text-zinc-500 bg-zinc-50 cursor-not-allowed text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="up-join" className="block font-bold text-zinc-700 mb-2" style={{ fontSize: 'var(--fs-sm)' }}>
                      Ngày tham gia
                    </label>
                    <input
                      id="up-join"
                      value={joinDate}
                      disabled
                      className="w-full px-5 py-2.5 rounded-full border border-zinc-200 text-zinc-500 bg-zinc-50 cursor-not-allowed text-sm"
                    />
                  </div>
                </div>
                <Alert msg={infoMsg} />
                <button
                  type="submit"
                  className="btn-primary mt-6 px-6 py-2.5 font-bold"
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  Lưu thay đổi
                </button>
              </form>
            </div>
          )}

          {/* Tab: Kết quả luyện thi */}
          {activeTab === 'results' && (
            <div className="flex flex-col gap-6">
              {statsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card-base p-6 flex flex-col items-center justify-center h-[116px]">
                      <div className="w-16 h-8 bg-zinc-200 animate-pulse rounded mb-2" />
                      <div className="w-24 h-4 bg-zinc-200 animate-pulse rounded mt-1" />
                    </div>
                  ))}
                </div>
              ) : statsError ? (
                <Card className="text-center p-12 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-2">Không thể tải dữ liệu</h2>
                  <p className="text-zinc-600 mb-6 max-w-sm" style={{ fontSize: 'var(--fs-sm)' }}>Đã xảy ra sự cố khi kết nối tới máy chủ. Vui lòng thử lại.</p>
                  <button className="btn-primary px-8 py-3 font-bold" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => window.location.reload()}>Thử lại</button>
                </Card>
              ) : stats?.totalAttempts === 0 ? (
                <Card className="text-center p-12 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-2">Bạn chưa có dữ liệu học tập</h2>
                  <p className="text-zinc-600 mb-6 max-w-sm" style={{ fontSize: 'var(--fs-sm)' }}>Hãy bắt đầu luyện tập để xây dựng hồ sơ tiến bộ của mình.</p>
                  <button className="btn-primary px-8 py-3 font-bold" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => navigate('/full-test')}>Bắt đầu luyện tập</button>
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
              <form onSubmit={handleChangePassword}>
                <div className="flex flex-col gap-5">
                  {[
                    { id: 'up-old', label: 'Mật khẩu hiện tại',     value: oldPwd,     set: setOldPwd },
                    { id: 'up-new', label: 'Mật khẩu mới',           value: newPwd,     set: setNewPwd },
                    { id: 'up-confirm', label: 'Xác nhận mật khẩu mới',  value: confirmPwd, set: setConfirmPwd },
                  ].map(({ id, label, value, set }) => (
                    <div key={id}>
                      <label htmlFor={id} className="block font-bold text-zinc-700 mb-2" style={{ fontSize: 'var(--fs-sm)' }}>
                        {label}
                      </label>
                      <input
                        id={id}
                        type="password"
                        value={value}
                        onChange={e => set(e.target.value)}
                        required
                        className="w-full px-5 py-2.5 rounded-full border border-zinc-200 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 bg-white text-sm"
                      />
                    </div>
                  ))}
                </div>
                <Alert msg={pwdMsg} />
                <button
                  type="submit"
                  className="btn-primary mt-6 px-6 py-2.5 font-bold"
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  Đổi mật khẩu
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
