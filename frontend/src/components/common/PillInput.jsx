// Ô nhập pill dùng chung cho khu vực người dùng — chiều cao theo chuẩn gọn
// admin (h-9), bo góc pill (khác admin, vốn dùng rounded-md — bản sắc riêng
// phía người dùng). Cỡ chữ CỐ TÌNH giữ ~16px (var(--fs-base), mặc định của
// input/textarea/select/button trong index.css) thay vì thu nhỏ theo admin:
// input <16px khiến iOS Safari tự động zoom khi focus — admin không bị ảnh
// hưởng vì admin desktop-only, phía người dùng thì có traffic mobile thật.
export default function PillInput({ className = '', ...props }) {
  return (
    <input
      className={[
        'w-full h-9 px-4 rounded-full border border-zinc-200 bg-white text-zinc-900',
        'outline-none transition-all placeholder:text-zinc-400',
        'focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10',
        'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
