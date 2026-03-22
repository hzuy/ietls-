import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/axios'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-2/5 p-12"
        style={{ background: 'linear-gradient(145deg, #1a56db 0%, #991b1b 100%)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm">I</div>
            <span className="text-white font-bold text-xl">IELTSPro</span>
          </div>
          <h2 className="text-white text-3xl font-extrabold leading-tight mb-4">
            Bắt đầu hành trình<br />chinh phục IELTS
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Tạo tài khoản miễn phí và trải nghiệm nền tảng luyện thi IELTS thông minh nhất.
          </p>
        </div>
        <div className="space-y-3">
          {[
            'Luyện đủ 4 kỹ năng Listening, Reading, Writing, Speaking',
            'AI chấm điểm Writing và nhận xét Speaking tức thì',
            'Theo dõi tiến độ và cải thiện band score hiệu quả',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-blue-100 text-sm">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{ backgroundColor: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
        >
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#1a56db' }}>I</div>
            <span className="font-bold text-lg" style={{ color: '#1e3a5f' }}>IELTS<span style={{ color: '#1a56db' }}>Pro</span></span>
          </div>

          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Tạo tài khoản</h1>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>Miễn phí, không cần thẻ tín dụng</p>

          {error && (
            <div
              className="p-3 rounded-xl mb-4 text-sm font-semibold"
              style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #fecaca' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Họ và tên</label>
              <input
                type="text"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
                placeholder="Nguyễn Văn A"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Email</label>
              <input
                type="email"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
                placeholder="example@gmail.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Mật khẩu</label>
              <input
                type="password"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
                placeholder="Tối thiểu 8 ký tự"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2"
              style={{ backgroundColor: loading ? '#f87171' : '#1a56db' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1a56db' }}
            >
              {loading ? 'Đang tạo tài khoản...' : 'Đăng ký miễn phí'}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: '#64748b' }}>
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-bold" style={{ color: '#1a56db' }}>
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
