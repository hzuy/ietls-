import { useState, isValidElement } from 'react'
import { handleImgError } from '../../utils/media'

/**
 * <ContentCard> — thẻ nội dung dùng chung cho trang chủ + các trang danh sách
 * (Full Test carousel, Reading/Listening Practice, Writing/Speaking Samples).
 * Hợp nhất 5 biến thể card từng trùng lặp (Giai đoạn B — Phương án A).
 *
 * KHÔNG chứa logic auth-gate. Card chỉ gọi `onClick` / `action.onClick` được
 * truyền vào — parent tự bọc requireAuth() nếu cần.
 *
 * Props:
 *  - image        : URL ảnh ĐÃ resolve (string) hoặc null/undefined.
 *  - imageAlt     : alt cho ảnh.
 *  - placeholder  : { bg, icon } — hiển thị khi không có ảnh. `icon` là string
 *                   emoji (auto fontSize 32) hoặc ReactNode.
 *  - thumbAspect  : tỉ lệ khung ảnh. '16/9' | '4/5' | … (aspect-ratio) HOẶC
 *                   chuỗi px cố định như '160px' (dùng height). Mặc định '16/9'.
 *  - title        : tiêu đề (string). Style/size/màu đã chuẩn hoá, KHÔNG param.
 *  - titleClamp   : số dòng giới hạn tiêu đề (number). Bỏ trống = không clamp.
 *  - meta         : ReactNode  HOẶC  { type:'count', text }  HOẶC
 *                   { type:'chips', chips:[{ label, tone }] }.
 *                   tone ∈ CHIP_TONES (writing|speaking|reading|listening|neutral).
 *  - action       : bỏ trống  |  { label, onClick }  (nút thật)
 *                              |  { label, decorative:true }  (nút trang trí,
 *                                 click xuyên xuống card)
 *                              |  { label, disabled, disabledLabel }.
 *  - accentBar    : true → dải màu primary dưới ảnh, hiện khi hover (chỉ showcase).
 *  - hoverStyle   : 'showcase' (JS state: lift + scale + shadow xanh + zoom ảnh)
 *                 | 'subtle'   (CSS thuần qua .card-base:hover). Mặc định 'subtle'.
 *  - onClick      : click cả card. Bỏ trống → card không clickable (case V2 —
 *                   chỉ nút action mới bắt click).
 *  - className    : lớp bổ sung từ parent (animClass, width utilities…).
 */

// tone chip meta → bộ token skill
const CHIP_TONES = {
  writing:   { bg: 'var(--skill-w-bg)', color: 'var(--skill-w-color)', border: 'var(--skill-w-border)' },
  speaking:  { bg: 'var(--skill-s-bg)', color: 'var(--skill-s-color)', border: 'var(--skill-s-border)' },
  reading:   { bg: 'var(--skill-r-bg)', color: 'var(--skill-r-color)', border: 'var(--skill-r-border)' },
  listening: { bg: 'var(--skill-l-bg)', color: 'var(--skill-l-color)', border: 'var(--skill-l-border)' },
  neutral:   { bg: 'var(--surface-raised)', color: 'var(--muted)', border: 'var(--border)' },
}

// Công thức hover "showcase" — trích nguyên từ BookCard/PracticeCard cũ.
const SHOWCASE = {
  transition:  'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  restShadow:  '0 4px 12px rgba(15, 23, 42, 0.05)',
  hoverShadow: '0 20px 35px -8px rgba(37, 99, 235, 0.22), 0 10px 20px -6px rgba(37, 99, 235, 0.12)',
  restBorder:  '1px solid #e2e8f0',
  hoverBorder: '1.5px solid #60A5FA',
  hoverInk:    '#2563EB',
}

function Chip({ label, tone }) {
  const t = CHIP_TONES[tone] || CHIP_TONES.neutral
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
    }}>{label}</span>
  )
}

function Meta({ meta, countColor }) {
  if (meta == null) return null

  if (isValidElement(meta) || typeof meta === 'string' || typeof meta === 'number') {
    return <div style={{ marginTop: 'auto' }}>{meta}</div>
  }

  if (meta.type === 'count') {
    return (
      <div style={{
        fontFamily: 'var(--font-mono)', display: 'flex', gap: 12,
        fontSize: 12, color: countColor, marginTop: 'auto',
        transition: 'color 0.3s ease',
      }}>{meta.text}</div>
    )
  }

  if (meta.type === 'chips') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto' }}>
        {meta.chips.map((c, i) => <Chip key={i} label={c.label} tone={c.tone} />)}
      </div>
    )
  }

  return null
}

function ActionButton({ action, showcase, hovered, topGap }) {
  const disabled = action.disabled === true
  const decorative = action.decorative === true
  const label = disabled ? (action.disabledLabel ?? action.label) : action.label

  // decorative → luôn tone đặc (CTA chính của trang, không có hover-state để dựa vào).
  // action thật → mềm lúc nghỉ, đặc khi hover (chỉ showcase). disabled → xám.
  let tone
  if (disabled) {
    tone = { background: 'var(--border)', color: 'var(--subtle)', cursor: 'not-allowed' }
  } else if (decorative || (showcase && hovered)) {
    tone = { background: 'var(--primary)', color: '#fff', cursor: 'pointer' }
  } else {
    tone = { background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer' }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={decorative || disabled ? undefined : (e) => { e.stopPropagation(); action.onClick?.(e) }}
      style={{
        width: '100%', padding: '8px 0', marginTop: topGap,
        borderRadius: 'var(--radius-md)', border: 'none',
        fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', fontWeight: 700,
        transition: 'all var(--transition)',
        ...tone,
        ...(decorative ? { pointerEvents: 'none' } : null),
      }}
    >
      {label}
    </button>
  )
}

export default function ContentCard({
  image,
  imageAlt = '',
  placeholder,
  thumbAspect = '16/9',
  title,
  titleClamp,
  meta,
  action,
  accentBar = false,
  hoverStyle = 'subtle',
  onClick,
  className = '',
}) {
  const isShowcase = hoverStyle === 'showcase'
  const [hovered, setHovered] = useState(false)

  // V1 (không action, click cả card) → tiêu đề + meta đổi màu khi hover.
  // V2 (có nút action) → tiêu đề tĩnh, feedback nằm ở accent bar + nút.
  const inkShift = isShowcase && hovered && !action

  const isPx = typeof thumbAspect === 'string' && thumbAspect.endsWith('px')
  const thumbBox = {
    width: '100%',
    ...(isPx ? { height: thumbAspect } : { aspectRatio: String(thumbAspect).replace('/', ' / ') }),
    overflow: 'hidden', flexShrink: 0, position: 'relative',
  }

  const rootStyle = isShowcase
    ? {
        cursor: 'pointer', overflow: 'hidden', background: '#ffffff', borderRadius: '1rem',
        border: hovered ? SHOWCASE.hoverBorder : SHOWCASE.restBorder,
        transition: SHOWCASE.transition,
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? SHOWCASE.hoverShadow : SHOWCASE.restShadow,
      }
    : { cursor: onClick ? 'pointer' : 'default' }

  const titleStyle = {
    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--fs-sm)',
    lineHeight: 1.4, margin: '0 0 8px',
    color: inkShift ? SHOWCASE.hoverInk : 'var(--ink-soft)',
    transition: 'color 0.3s ease',
    ...(titleClamp
      ? {
          display: '-webkit-box', WebkitLineClamp: titleClamp, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', minHeight: `${titleClamp * 1.4}em`,
        }
      : null),
  }

  return (
    <div
      className={`${className} card-base flex flex-col overflow-hidden`.trim()}
      style={rootStyle}
      onClick={onClick}
      onMouseEnter={isShowcase ? () => setHovered(true) : undefined}
      onMouseLeave={isShowcase ? () => setHovered(false) : undefined}
    >
      {/* Thumb */}
      <div style={thumbBox} className="cc-thumb">
        {image ? (
          <img
            src={image}
            alt={imageAlt}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={handleImgError}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transition: isShowcase ? 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
              transform: isShowcase && hovered ? 'scale(1.06)' : 'scale(1)',
            }}
          />
        ) : placeholder ? (
          <div style={{
            width: '100%', height: '100%', background: placeholder.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {typeof placeholder.icon === 'string'
              ? <span style={{ fontSize: 32 }}>{placeholder.icon}</span>
              : placeholder.icon}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface-raised)' }} />
        )}

        {accentBar && isShowcase && (
          <div className="cc-accent-bar" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
            background: 'var(--primary)',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.3s ease',
          }} />
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p style={titleStyle}>{title}</p>
        <Meta meta={meta} countColor={inkShift ? SHOWCASE.hoverInk : 'var(--muted)'} />
        {action && (
          <ActionButton
            action={action}
            showcase={isShowcase}
            hovered={hovered}
            topGap={meta == null ? 'auto' : 12}
          />
        )}
      </div>
    </div>
  )
}
