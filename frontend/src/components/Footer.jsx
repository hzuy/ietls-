import GatedLink from './common/GatedLink'

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
]

function FooterLink({ to, children }) {
  return (
    <GatedLink
      to={to}
      className="block mb-3 text-slate-300 hover:text-blue-400 transition-colors duration-300 text-[14px]"
      style={{ fontFamily: 'var(--font-body)', textDecoration: 'none' }}
    >
      {children}
    </GatedLink>
  )
}

export default function Footer() {
  return (
    <footer className="bg-[#0F2247] border-t border-white/5">
      {/* Thin primary top accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />

      {/* Main section */}
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">

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

            <p className="text-slate-300 text-[14px] leading-relaxed max-w-[260px]" style={{ fontFamily: 'var(--font-body)' }}>
              Nền tảng luyện thi IELTS chuyên nghiệp với AI phản hồi tức thì, giúp bạn đạt band score mục tiêu nhanh hơn.
            </p>
          </div>

          {/* Cols 3-4 — Nav groups */}
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
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-center">
          <span className="text-slate-400 text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
            © 2026 IELTSPro. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}
