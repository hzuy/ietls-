import { Link } from 'react-router-dom'

const col2Links = [
  { label: 'Reading', to: '/reading' },
  { label: 'Listening', to: '/listening' },
  { label: 'Writing', to: '/writing' },
  { label: 'Speaking', to: '/speaking' },
  { label: 'Full Test', to: '/full-test' },
]

const col3Links = [
  { label: 'Hướng dẫn sử dụng', to: '/' },
  { label: 'Liên hệ', to: '/' },
  { label: 'Câu hỏi thường gặp', to: '/' },
]

const col4Links = [
  { label: 'Giới thiệu', to: '/about' },
  { label: 'Chính sách bảo mật', to: '/' },
  { label: 'Điều khoản sử dụng', to: '/' },
]

const linkStyle = {
  color: '#94a3b8',
  fontSize: 13,
  textDecoration: 'none',
  display: 'block',
  marginBottom: 8,
  transition: 'color 0.2s',
}

const headingStyle = {
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 16,
}

function FooterLink({ to, children }) {
  return (
    <Link
      to={to}
      style={linkStyle}
      onMouseEnter={e => { e.currentTarget.style.color = '#93c5fd' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
    >
      {children}
    </Link>
  )
}

export default function Footer() {
  return (
    <footer style={{ background: '#1e3a5f', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Main section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
        }}>
          {/* Col 1 — Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)', flexShrink: 0,
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#0066FF' }}></div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '-0.01em' }}>
                IELTS<span style={{ color: '#93c5fd' }}>PRO</span>
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, marginBottom: 20, maxWidth: 240 }}>
              Nền tảng luyện thi IELTS với AI phản hồi tức thì, giúp bạn đạt band score mục tiêu nhanh hơn.
            </p>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Facebook */}
              <a
                href="/"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#94a3b8', textDecoration: 'none',
                  transition: 'background 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8' }}
                aria-label="Facebook"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              {/* YouTube */}
              <a
                href="/"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#94a3b8', textDecoration: 'none',
                  transition: 'background 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8' }}
                aria-label="YouTube"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#1e3a5f" />
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2 — Luyện thi */}
          <div>
            <p style={headingStyle}>Luyện thi</p>
            {col2Links.map(l => <FooterLink key={l.to + l.label} to={l.to}>{l.label}</FooterLink>)}
          </div>

          {/* Col 3 — Hỗ trợ */}
          <div>
            <p style={headingStyle}>Hỗ trợ</p>
            {col3Links.map(l => <FooterLink key={l.label} to={l.to}>{l.label}</FooterLink>)}
          </div>

          {/* Col 4 — Về IELTSPro */}
          <div>
            <p style={headingStyle}>Về IELTSPro</p>
            {col4Links.map(l => <FooterLink key={l.label} to={l.to}>{l.label}</FooterLink>)}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          className="max-w-6xl mx-auto px-6 py-4"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
        >
          <span style={{ color: '#64748b', fontSize: 13 }}>
            © 2026 IELTSPro. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Giới thiệu', to: '/about' },
              { label: 'Chính sách bảo mật', to: '/' },
              { label: 'Điều khoản', to: '/' },
            ].map(l => (
              <Link
                key={l.label}
                to={l.to}
                style={{ color: '#64748b', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#93c5fd' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
