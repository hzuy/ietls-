// Nút pill dùng chung cho khu vực người dùng (khác admin — xem CLAUDE.md
// "Redesign giao diện người dùng"). Chiều cao/padding/cỡ chữ lấy theo chuẩn gọn
// của admin (h-9, text-xs sm:text-sm), bo góc luôn pill — bản sắc riêng phía
// người dùng. KHÔNG dùng cho 4 màn hình làm bài thi (ReadingExam/ListeningExam/
// WritingExam/SpeakingExam) — các màn đó dùng .btn-primary/.btn-secondary/...
// trong index.css (min-height 44px, dùng chung với PracticeExamPage).
//
// fontSize đặt bằng inline style thay vì class `text-xs`/`text-sm`: index.css
// có rule không-layer `input, textarea, select, button { font-size: var(--fs-base) }`
// luôn thắng utility Tailwind trên thẻ <button> — xem project_index_css_unlayered_overrides.
const VARIANTS = {
  primary:   'text-white bg-primary hover:bg-primary-hover shadow-xs',
  secondary: 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400',
  ghost:     'bg-transparent text-zinc-600 hover:bg-zinc-100',
  danger:    'text-white bg-error hover:opacity-90 shadow-xs',
}

export default function PillButton({
  as: As = 'button',
  variant = 'primary',
  fullWidth = false,
  className = '',
  style,
  children,
  ...props
}) {
  const variantCls = VARIANTS[variant] || VARIANTS.primary
  const base = 'h-9 px-5 rounded-full font-medium inline-flex items-center justify-center gap-2 leading-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  return (
    <As
      className={[base, variantCls, fullWidth ? 'w-full' : '', className].filter(Boolean).join(' ')}
      style={{ fontSize: 'var(--fs-sm)', ...style }}
      {...props}
    >
      {children}
    </As>
  )
}
