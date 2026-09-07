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
      className="block mb-3 text-zinc-400 hover:text-zinc-100 transition-colors duration-300 text-[14px]"
      style={{ textDecoration: 'none' }}
    >
      {children}
    </GatedLink>
  )
}

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800">
      {/* Thin subtle top accent line */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-60" />

      {/* Main section */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">

          {/* Col 1 — Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 rounded-full bg-zinc-950" />
              </div>
              <span className="font-bold text-[18px] text-white tracking-[-0.01em]">
                IELTS<span className="text-zinc-400 font-medium">Pro</span>
              </span>
            </div>

            <p className="text-zinc-400 text-[14px] leading-relaxed max-w-[280px]">
              Nền tảng luyện thi IELTS chuyên nghiệp với AI phản hồi tức thì, giúp bạn đạt band score mục tiêu nhanh hơn.
            </p>
          </div>

          {/* Cols 3-4 — Nav groups */}
          {NAV_COLUMNS.map(col => (
            <div key={col.heading}>
              <p className="text-zinc-100 text-[13px] font-bold uppercase tracking-wider mb-5">
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
      <div className="border-t border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center">
          <span className="text-zinc-500 text-[13px]">
            © 2026 IELTSPro. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}
