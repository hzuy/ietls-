import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { getMe, updateProfile, changePassword, getUserStats } from '../services/userService'

const TABS = [
  { id: 'info',     label: 'Thông tin cá nhân', icon: '👤' },
  { id: 'results',  label: 'Kết quả luyện thi',  icon: '📊' },
  { id: 'password', label: 'Đổi mật khẩu',        icon: '🔒' },
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
  return (
    <div style={{
      marginTop: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13,
      backgroundColor: isSuccess ? '#f0fdf4' : '#fef2f2',
      color: isSuccess ? '#166534' : '#dc2626',
      border: `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}`,
    }}>
      {msg.text}
    </div>
  )
}

export default function UserProfile() {
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

  // --- Password tab ---
  const [oldPwd, setOldPwd]       = useState('')
  const [newPwd, setNewPwd]       = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg]       = useState(null)

  useEffect(() => {
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
        .catch(() => setStats({}))
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      <Navbar />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* User card */}
          <div style={{
            background: 'white', borderRadius: 16, padding: 24,
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: '#1e3a5f', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 700, margin: '0 auto 12px',
            }}>
              {avatarLetter}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, wordBreak: 'break-all' }}>
              {user?.email}
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20,
              backgroundColor: '#eff6ff', color: '#1e40af', fontSize: 11, fontWeight: 600,
            }}>
              Thành viên
            </span>
          </div>

          {/* Menu */}
          <div style={{
            background: 'white', borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
          }}>
            {TABS.map((tab, idx) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#1e40af' : '#374151',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 14, border: 'none',
                    borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Tab: Thông tin cá nhân */}
          {activeTab === 'info' && (
            <div style={{
              background: 'white', borderRadius: 16, padding: 28,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
            }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', marginBottom: 24, marginTop: 0 }}>
                Thông tin cơ bản
              </h2>
              <form onSubmit={handleSaveInfo}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Họ và tên
                    </label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid #e2e8f0', fontSize: 14, outline: 'none',
                        boxSizing: 'border-box', transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Email
                    </label>
                    <input
                      value={user?.email || ''}
                      disabled
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid #e2e8f0', fontSize: 14,
                        backgroundColor: '#f8fafc', color: '#94a3b8', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Ngày tham gia
                    </label>
                    <input
                      value={joinDate}
                      disabled
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid #e2e8f0', fontSize: 14,
                        backgroundColor: '#f8fafc', color: '#94a3b8', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                <Alert msg={infoMsg} />
                <button
                  type="submit"
                  style={{
                    marginTop: 20, padding: '10px 24px', borderRadius: 10,
                    backgroundColor: '#1a56db', color: 'white',
                    fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
                >
                  Lưu thay đổi
                </button>
              </form>
            </div>
          )}

          {/* Tab: Kết quả luyện thi */}
          {activeTab === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {statsLoading ? (
                <div style={{
                  background: 'white', borderRadius: 16, padding: 48,
                  textAlign: 'center', color: '#94a3b8', fontSize: 14,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
                }}>
                  Đang tải dữ liệu...
                </div>
              ) : (
                <>
                  {/* 3 stat cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[
                      { label: 'Bài đã làm', value: stats?.totalAttempts ?? 0, suffix: ' bài' },
                      { label: 'Band trung bình', value: stats?.avgBand != null ? stats.avgBand.toFixed(1) : '—', suffix: '' },
                      { label: 'Streak', value: stats?.streak ?? 0, suffix: ' 🔥' },
                    ].map(({ label, value, suffix }) => (
                      <div key={label} style={{
                        background: 'white', borderRadius: 16, padding: '20px 16px',
                        textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8f0',
                      }}>
                        <div style={{ fontSize: 30, fontWeight: 700, color: '#1e3a5f', lineHeight: 1.2 }}>
                          {value}{suffix}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Band by skill */}
                  <div style={{
                    background: 'white', borderRadius: 16, padding: 24,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
                  }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', marginBottom: 20, marginTop: 0 }}>
                      Band theo kỹ năng
                    </h3>
                    {SKILLS.map(({ key, label }) => {
                      const band = stats?.bandBySkill?.[key]
                      const pct = band != null ? Math.min((band / 9) * 100, 100) : 0
                      return (
                        <div key={key} style={{ marginBottom: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a56db' }}>
                              {band != null ? band.toFixed(1) : '—'}
                            </span>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              backgroundColor: '#1a56db', borderRadius: 999,
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                    {stats && Object.values(stats.bandBySkill ?? {}).every(v => v == null) && (
                      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
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
            <div style={{
              background: 'white', borderRadius: 16, padding: 28,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
            }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', marginBottom: 24, marginTop: 0 }}>
                Đổi mật khẩu
              </h2>
              <form onSubmit={handleChangePassword}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Mật khẩu hiện tại',     value: oldPwd,     set: setOldPwd },
                    { label: 'Mật khẩu mới',           value: newPwd,     set: setNewPwd },
                    { label: 'Xác nhận mật khẩu mới',  value: confirmPwd, set: setConfirmPwd },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                        {label}
                      </label>
                      <input
                        type="password"
                        value={value}
                        onChange={e => set(e.target.value)}
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10,
                          border: '1px solid #e2e8f0', fontSize: 14, outline: 'none',
                          boxSizing: 'border-box', transition: 'border-color 0.15s',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                      />
                    </div>
                  ))}
                </div>
                <Alert msg={pwdMsg} />
                <button
                  type="submit"
                  style={{
                    marginTop: 20, padding: '10px 24px', borderRadius: 10,
                    backgroundColor: '#1a56db', color: 'white',
                    fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
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
