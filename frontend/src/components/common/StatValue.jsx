// Ô hiển thị số liệu dùng chung (số lớn + nhãn nhỏ) — trước đây StreakWidget và
// BandOverviewWidget tự lặp lại cặp <span> số lớn font-mono + <span> nhãn xám.
// Giữ nguyên cấu trúc/markup hiện có, chỉ gom lại một chỗ.
export default function StatValue({ value, label, size = 'text-3xl', color = 'var(--primary)', as: As = 'div', className = '' }) {
  return (
    <As className={['flex items-baseline gap-1.5', className].filter(Boolean).join(' ')}>
      <span className={`${size} font-bold font-mono`} style={{ color }}>{value}</span>
      {label && <span className="text-xs text-zinc-500">{label}</span>}
    </As>
  )
}
