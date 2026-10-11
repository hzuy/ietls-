import GatedLink from './common/GatedLink'

// Nhóm liên kết gọn: Luyện thi | Thư viện
const NAV_GROUPS = [
  {
    label: 'Luyện thi',
    links: [
      { label: 'Cambridge Academic', to: '/cambridge' },
      { label: 'Practice Plus', to: '/practice-plus' },
      { label: 'Reading', to: '/practice/reading' },
      { label: 'Listening', to: '/practice/listening' },
    ],
  },
  {
    label: 'Thư viện',
    links: [
      { label: 'Bài mẫu Writing', to: '/writing-samples' },
      { label: 'Bài mẫu Speaking', to: '/speaking-samples' },
    ],
  },
]

function FooterLink({ to, children }) {
  return (
    <GatedLink
      to={to}
      className="footer-link text-[13px]"
      style={{ textDecoration: 'none' }}
    >
      {children}
    </GatedLink>
  )
}

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 pt-4 pb-20 flex flex-wrap items-center justify-center lg:justify-between gap-x-8 gap-y-3">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-zinc-950" />
          </div>
          <span className="font-bold text-[14px] text-white tracking-[-0.01em]">
            IELTS<span className="text-zinc-400 font-medium">Pro</span>
          </span>
        </div>

        {/* Nav groups */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 order-3 lg:order-none w-full lg:w-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="flex items-center gap-x-4 gap-y-1 flex-wrap justify-center">
              <span className="text-[11px] text-zinc-600 font-medium shrink-0">{group.label}:</span>
              {group.links.map(l => (
                <FooterLink key={l.to} to={l.to}>{l.label}</FooterLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Copyright */}
        <span className="text-zinc-500 text-[12px] whitespace-nowrap shrink-0">
          © 2026 IELTSPro
        </span>
      </div>
    </footer>
  )
}
