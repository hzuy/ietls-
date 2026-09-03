import { useState } from 'react'

/**
 * QuestionNavButton — nút số câu dùng chung cho MỌI navigator khi đang làm bài:
 * bottom bar + popover "Bảng câu hỏi" của Reading / Listening / Practice (6 chỗ).
 *
 * Bảng màu (token) — 3 tầng ngữ nghĩa tách bạch (đảo hướng "đã làm" so với P6-G):
 *   • CHỌN đáp án (MCQ / TRUE-FALSE…)     = nền nhạt + chỉ báo   — KHÔNG thuộc component này
 *   • TIẾN ĐỘ "đã làm" (component này)     = outline: nền + viền + chữ var(--primary)
 *   • VỊ TRÍ đang xem (PassagePills.isActive) = tô đặc var(--primary) — KHÔNG thuộc component này
 *
 *   chưa làm  — nền trắng               / viền var(--border)  / chữ var(--ink)
 *   hover     — nền trắng               / viền var(--primary) / chữ var(--primary)  (chỉ khi chưa làm)
 *   đã làm    — nền var(--primary-light) / viền var(--primary) / chữ var(--primary)  (khớp PassagePills.isComplete)
 *
 * Radius cố định 8px (var(--radius-sm)) — nút chữ nhật bo góc, không phải hình tròn.
 *
 * Props:
 *   number   — số câu hiển thị
 *   status   — 'unanswered' | 'answered'
 *   onClick  — () => void
 *   size     — cạnh nút tính bằng px (mặc định 32)
 */
export default function QuestionNavButton({ number, status, onClick, size = 32 }) {
  const [hovered, setHovered] = useState(false)
  const answered = status === 'answered'

  const backgroundColor = answered ? 'var(--primary-light)' : '#ffffff'
  const borderColor = answered
    ? 'var(--primary)'
    : hovered ? 'var(--primary)' : 'var(--border)'
  const color = answered
    ? 'var(--primary)'
    : hovered ? 'var(--primary)' : 'var(--ink)'

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Câu ${number}${answered ? ' — đã trả lời' : ''}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${borderColor}`,
        backgroundColor,
        color,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
      }}
    >
      {number}
    </button>
  )
}
