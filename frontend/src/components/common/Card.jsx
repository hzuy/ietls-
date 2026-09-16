// Thẻ nền trắng dùng chung — trước đây mỗi trang tự lặp lại
// `bg-white rounded-2xl border border-zinc-200 shadow-xs` (hoặc biến thể không
// đổ bóng) bằng tay. Không đổi giá trị Tailwind hiện có, chỉ gom lại một chỗ.
const VARIANTS = {
  // Mặc định — mẫu lặp lại nhiều nhất: nền trắng, viền, bo góc, đổ bóng nhẹ, không hover.
  static: 'bg-white rounded-2xl border border-zinc-200 shadow-xs',
  // Không đổ bóng — dùng cho các thẻ/panel lồng bên trong một thẻ khác.
  flat: 'bg-white rounded-2xl border border-zinc-200',
}

export default function Card({ as: As = 'div', variant = 'static', className = '', children, ...props }) {
  const base = VARIANTS[variant] || VARIANTS.static
  return (
    <As className={[base, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </As>
  )
}
