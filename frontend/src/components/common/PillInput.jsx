// Ô nhập pill dùng chung cho khu vực người dùng.
// Chiều cao theo chuẩn gọn (h-9), bo góc pill.
// fontSize được cố định bằng inline style (14px) thay vì chỉ dùng class Tailwind:
// index.css có rule không-layer `input, textarea, select, button { font-size: var(--fs-base) }`
// (16→17px) luôn đè utility class trên thẻ input nếu không dùng inline style
// (tương tự cơ chế ở PillButton.jsx).
export default function PillInput({ className = '', style, ...props }) {
  return (
    <input
      className={[
        'w-full h-9 pointer-coarse:h-11 px-4 rounded-full border border-zinc-200 bg-white text-zinc-900',
        'outline-none transition-all placeholder:text-zinc-400 placeholder:text-sm',
        'focus:border-zinc-900 focus:outline-none focus:ring-0',
        'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
        className,
      ].filter(Boolean).join(' ')}
      style={{ fontSize: '14px', ...style }}
      {...props}
    />
  )
}
