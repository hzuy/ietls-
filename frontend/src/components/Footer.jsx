import { Link } from 'react-router-dom'

const NAV_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'IELTS Full Test', to: '/full-test' },
      { label: 'Practice Plus', to: '/practice-plus' },
    ],
  },
  {
    heading: 'Skills',
    links: [
      { label: 'Reading', to: '/practice/reading' },
      { label: 'Listening', to: '/practice/listening' },
      { label: 'Bài mẫu Writing', to: '/writing-samples' },
      { label: 'Bài mẫu Speaking', to: '/speaking-samples' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Tài liệu học tập', to: '/' },
      { label: 'Hướng dẫn sử dụng', to: '/' },
      { label: 'Câu hỏi thường gặp', to: '/' },
      { label: 'IELTS Band Calculator', to: '/' },
    ],
  },
]

function FooterLink({ to, children }) {
  return (
    <Link
      to={to}
      className="block mb-3 text-slate-300 hover:text-blue-400 transition-colors duration-300 text-[14px]"
      style={{ fontFamily: 'var(--font-body)', textDecoration: 'none' }}
    >
      {children}
    </Link>
  )
}

export default function Footer() {
  return (
    <footer className="bg-[#0F2247] border-t border-white/5">
      {/* Thin primary top accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />

      {/* Main section */}
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-8 md:gap-12">

          {/* Col 1 — Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 rounded-full bg-[#0F2247]" />
              </div>
              <span className="font-bold text-[18px] text-white tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
                IELTS<span className="text-blue-400">Pro</span>
              </span>
            </div>

            <p className="text-slate-300 text-[14px] leading-relaxed mb-6 max-w-[260px]" style={{ fontFamily: 'var(--font-body)' }}>
              Nền tảng luyện thi IELTS chuyên nghiệp với AI phản hồi tức thì, giúp bạn đạt band score mục tiêu nhanh hơn.
            </p>

            {/* Social icons */}
            <div className="flex gap-3">
              {[
                {
                  label: 'Facebook',
                  svg: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
                },
                {
                  label: 'YouTube',
                  svg: <>
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" />
                  </>,
                },
              ].map(({ label, svg }) => (
                <a
                  key={label}
                  href="/"
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-blue-600/20 hover:border-blue-600/50 hover:text-blue-400 transition-all duration-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">{svg}</svg>
                </a>
              ))}
            </div>
          </div>

          {/* Cols 2-5 — Nav groups */}
          {NAV_COLUMNS.map(col => (
            <div key={col.heading}>
              <p className="text-white text-[13px] font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-body)' }}>
                {col.heading}
              </p>
              {col.links.map(l => (
                <FooterLink key={l.label} to={l.to}>{l.label}</FooterLink>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-slate-400 text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
            © 2026 IELTSPro. All rights reserved.
          </span>
          <div className="flex gap-6">
            <Link to="/" className="text-slate-400 hover:text-blue-400 transition-colors duration-300 text-[13px] no-underline" style={{ fontFamily: 'var(--font-body)' }}>Chính sách bảo mật</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
