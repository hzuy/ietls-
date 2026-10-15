import GatedLink from './common/GatedLink'

const NAV_GROUPS = [
  {
    label: 'Phòng thi chuẩn hóa',
    links: [
      { label: 'Cambridge Academic', to: '/cambridge' },
      { label: 'Practice Plus', to: '/practice-plus' },
    ],
  },
  {
    label: 'Luyện tập kỹ năng',
    links: [
      { label: 'Reading', to: '/practice/reading' },
      { label: 'Listening', to: '/practice/listening' },
    ],
  },
  {
    label: 'Thư viện bài mẫu',
    links: [
      { label: 'Bài mẫu Writing', to: '/writing-samples' },
      { label: 'Bài mẫu Speaking', to: '/speaking-samples' },
    ],
  },
]

function FooterLink({ to, children }) {
  return (
    <GatedLink to={to} className="footer-link text-[13px]" style={{ textDecoration: 'none' }}>
      {children}
    </GatedLink>
  )
}

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-x-8 gap-y-8">
          <div className="col-span-2 md:col-span-1 max-w-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-950" />
              </div>
              <span className="font-bold text-base text-white tracking-[-0.01em]">
                IELTS<span className="text-zinc-400 font-medium">Pro</span>
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
              Phòng thi IELTS mô phỏng trên máy tính, chấm điểm và giải thích đáp án chi tiết cho cả 4 kỹ năng.
            </p>
          </div>

          {NAV_GROUPS.map(group => (
            <nav key={group.label} aria-label={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{group.label}</p>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {group.links.map(l => (
                  <li key={l.to}>
                    <FooterLink to={l.to}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 sm:pr-20">
          <span className="text-zinc-500 text-xs">© 2026 IELTSPro. All rights reserved.</span>
          <span className="text-zinc-600 text-xs">Luyện thi IELTS Academic</span>
        </div>
      </div>
    </footer>
  )
}
