import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { login, register, googleAuth, verifyEmail, resendVerification } from '../services/userService'
import { showAlert } from '../utils/alertUtils'
import { AlertCircle, MailCheck, ArrowLeft } from 'lucide-react'
import PillButton from './common/PillButton'
import PillInput from './common/PillInput'

export default function AuthModal({ tab, onTabChange, onSuccess, onClose }) {
  const navigate = useNavigate()

  // Login state
  const [loginForm, setLoginForm]       = useState({ email: '', password: '' })
  const [loginError, setLoginError]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register state
  const [regForm, setRegForm]       = useState({ name: '', email: '', password: '' })
  const [regError, setRegError]     = useState('')
  const [regLoading, setRegLoading] = useState(false)

  // Google Sign-In state (dùng chung cho cả 2 tab)
  const [googleError, setGoogleError] = useState('')

  const [verifyFor, setVerifyFor]         = useState(null)
  const [verifyCode, setVerifyCode]       = useState('')
  const [verifyError, setVerifyError]     = useState('')
  const [verifyInfo, setVerifyInfo]       = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendIn, setResendIn]           = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const startVerify = (email, mailSent, message) => {
    setVerifyFor(email)
    setVerifyCode('')
    setVerifyError(mailSent ? '' : message)
    setVerifyInfo(mailSent ? message : '')
    setResendIn(mailSent ? 60 : 0)
  }

  const finishLogin = (data) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    if (data.requirePasswordChange) {
      localStorage.setItem('requirePasswordChange', 'true')
      onClose()
      navigate('/change-password')
    } else {
      localStorage.removeItem('requirePasswordChange')
      onSuccess(data.user)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(verifyCode)) {
      setVerifyError('Mã xác thực gồm 6 chữ số')
      return
    }
    setVerifyLoading(true)
    setVerifyError('')
    try {
      finishLogin(await verifyEmail(verifyFor, verifyCode))
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'ALREADY_VERIFIED') {
        setVerifyFor(null)
        setLoginForm(f => ({ ...f, email: verifyFor }))
        onTabChange('login')
        showAlert(data.message, 'info')
        return
      }
      setVerifyError(data?.message || 'Xác thực thất bại')
      if (data?.reason === 'too_many' || data?.reason === 'expired') setVerifyCode('')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleResend = async () => {
    setVerifyError('')
    setVerifyInfo('')
    try {
      const data = await resendVerification(verifyFor)
      setVerifyInfo(data.message)
      setResendIn(data.retryAfter || 60)
    } catch (err) {
      const data = err.response?.data
      setVerifyError(data?.message || 'Không gửi lại được mã')
      if (data?.retryAfter) setResendIn(data.retryAfter)
    }
  }

  // Đo width của modal content để truyền vào GoogleLogin.width (responsive)
  const modalBodyRef = useRef(null)
  const [googleBtnWidth, setGoogleBtnWidth] = useState(360)
  useEffect(() => {
    const el = modalBodyRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setGoogleBtnWidth(Math.min(400, Math.max(200, Math.floor(entry.contentRect.width))))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Xử lý y hệt handleLogin/handleRegister: lưu token/user, theo dõi requirePasswordChange, gọi onSuccess
  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleError('')
    try {
      const data = await googleAuth(credentialResponse.credential)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      if (data.requirePasswordChange) {
        localStorage.setItem('requirePasswordChange', 'true')
        onClose()
        navigate('/change-password')
      } else {
        localStorage.removeItem('requirePasswordChange')
        onSuccess(data.user)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Đăng nhập Google thất bại'
      setGoogleError(msg)
      showAlert(msg, 'error')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      finishLogin(await login(loginForm.email, loginForm.password))
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'EMAIL_NOT_VERIFIED') {
        startVerify(data.email || loginForm.email, data.mailSent, data.message)
        return
      }
      const msg = data?.message || 'Đăng nhập thất bại'
      setLoginError(msg)
      showAlert(msg, 'error')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (regForm.password.length < 8) {
      const msg = 'Mật khẩu phải có ít nhất 8 ký tự'
      setRegError(msg)
      showAlert(msg, 'error')
      return
    }
    setRegLoading(true)
    setRegError('')
    try {
      const data = await register(regForm)
      startVerify(data.email || regForm.email, data.mailSent, data.message)
    } catch (err) {
      const msg = err.response?.data?.message || 'Đăng ký thất bại'
      setRegError(msg)
      showAlert(msg, 'error')
    } finally {
      setRegLoading(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Bo góc pill (bản sắc riêng phía người dùng), kích thước/cỡ chữ theo chuẩn
  // gọn của admin (h-9) — xem CLAUDE.md "Redesign giao diện người dùng".
  // Input/nút dùng PillInput/PillButton dùng chung; label/tiêu đề style riêng
  // vì không có component chung cho chúng.
  const labelCls = 'block text-xs font-semibold mb-1.5'

  // Khối "hoặc" + nút Google — dùng chung cho cả 2 tab, chỉ đổi text nút theo ngữ cảnh.
  // shape="pill" là prop có sẵn của @react-oauth/google (Google tự render pill
  // trong iframe riêng) — không dùng CSS/wrapper để ép hình, vì nội dung iframe
  // nằm ngoài tầm với của CSS trang chủ.
  const googleSection = (
    <>
      {googleError && (
        <div role="alert" className="p-3 rounded-2xl mb-4 mt-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-error shrink-0" />
          <span>{googleError}</span>
        </div>
      )}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>hoặc</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
      {/* width truyền từ googleBtnWidth (đo ResizeObserver trên modal container):
           nút Google sẽ co giãn theo chiều rộng thực của hộp thoại (max 400px)
           thay vì cố định 320px. GoogleLogin render trong iframe sandbox riêng
           nên chỉ có thể đồng bộ chiều rộng qua prop width, không qua CSS. */}
      <div className="flex justify-center overflow-hidden">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setGoogleError('Đăng nhập Google thất bại')}
          text={tab === 'register' ? 'signup_with' : 'signin_with'}
          shape="pill"
          width={String(googleBtnWidth)}
        />
      </div>
    </>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        ref={modalBodyRef}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        {/* Nút X */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          style={{ position: 'absolute', top: 3, right: 4, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--subtle)', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
          className="font-bold hover:text-zinc-600 transition-colors"
        >
          ×
        </button>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(24,24,27,0.2)', flexShrink: 0,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)' }} className="whitespace-nowrap">
            IELTS<span style={{ color: 'var(--primary)', fontWeight: 500 }}>Pro</span>
          </span>
        </div>

        {verifyFor && (
          <div>
            <button
              type="button"
              onClick={() => setVerifyFor(null)}
              className="tap-pad inline-flex items-center gap-1 text-xs font-semibold mb-4"
              style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại
            </button>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                <MailCheck className="w-6 h-6" style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="font-bold m-0 mb-1" style={{ color: 'var(--ink)', fontSize: 18 }}>Xác thực email</h2>
              <p className="text-xs m-0" style={{ color: 'var(--muted)' }}>
                Nhập mã 6 số đã gửi tới <strong style={{ color: 'var(--ink)' }}>{verifyFor}</strong>
              </p>
            </div>

            {verifyError && (
              <div role="alert" className="p-3 rounded-2xl mb-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
            {verifyInfo && !verifyError && (
              <div role="status" className="p-3 rounded-2xl mb-4 text-xs font-medium" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {verifyInfo}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="verify-code" className={labelCls} style={{ color: 'var(--text)' }}>Mã xác thực</label>
                <PillInput
                  id="verify-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="______"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center tracking-[0.5em] font-mono"
                  required
                  autoFocus
                />
              </div>
              <PillButton type="submit" disabled={verifyLoading || verifyCode.length !== 6} fullWidth>
                {verifyLoading ? 'Đang xác thực...' : 'Xác thực'}
              </PillButton>
            </form>

            <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Không nhận được mã? Kiểm tra cả thư mục Spam.{' '}
              {resendIn > 0 ? (
                <span className="tabular-nums">Gửi lại sau {resendIn}s</span>
              ) : (
                <button type="button" onClick={handleResend} className="tap-pad font-bold" style={{ fontSize: 'inherit', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Gửi lại mã
                </button>
              )}
            </p>
          </div>
        )}

        {!verifyFor && (<>
        {/* Tabs */}
        <div className="flex mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className="pb-3 pointer-coarse:pt-2 px-1 mr-6 text-sm font-bold transition-colors"
              style={{
                color: tab === t ? 'var(--primary)' : 'var(--subtle)',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer', paddingBottom: 12, paddingLeft: 4, paddingRight: 4, marginRight: 24,
              }}
            >
              {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>

        {/* LOGIN */}
        {tab === 'login' && (
          <>
            {loginError && (
              <div role="alert" className="p-3 rounded-2xl mb-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className={labelCls} style={{ color: 'var(--text)' }}>Email</label>
                <PillInput
                  id="login-email"
                  type="email"
                  placeholder="example@gmail.com"
                  value={loginForm.email}
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="login-password" className={labelCls} style={{ color: 'var(--text)' }}>Mật khẩu</label>
                <PillInput
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <PillButton type="submit" disabled={loginLoading} fullWidth className="mt-2">
                {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </PillButton>
            </form>

            {googleSection}

            <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Chưa có tài khoản?{' '}
              <button onClick={() => onTabChange('register')} className="tap-pad font-bold" style={{ fontSize: 'inherit', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Đăng ký ngay
              </button>
            </p>
          </>
        )}

        {/* REGISTER */}
        {tab === 'register' && (
          <>
            {regError && (
              <div role="alert" className="p-3 rounded-2xl mb-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className={labelCls} style={{ color: 'var(--text)' }}>Họ và tên</label>
                <PillInput
                  id="reg-name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="reg-email" className={labelCls} style={{ color: 'var(--text)' }}>Email</label>
                <PillInput
                  id="reg-email"
                  type="email"
                  placeholder="example@gmail.com"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="reg-password" className={labelCls} style={{ color: 'var(--text)' }}>Mật khẩu</label>
                <PillInput
                  id="reg-password"
                  type="password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={regForm.password}
                  onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                  required
                />
              </div>
              <PillButton type="submit" disabled={regLoading} fullWidth className="mt-2">
                {regLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
              </PillButton>
            </form>

            {googleSection}

            <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Đã có tài khoản?{' '}
              <button onClick={() => onTabChange('login')} className="tap-pad font-bold" style={{ fontSize: 'inherit', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Đăng nhập
              </button>
            </p>
          </>
        )}
        </>)}
      </div>
    </div>
  )
}
