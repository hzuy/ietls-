import { useState, isValidElement } from 'react'
import { handleImgError } from '../../utils/media'
import AcademicCover from './AcademicCover'

/**
 * <ContentCard> — thẻ nội dung dùng chung cho trang chủ + các trang danh sách
 * (Full Test carousel, Reading/Listening Practice, Writing/Speaking Samples).
 * Hợp nhất 5 biến thể card từng trùng lặp (Giai đoạn B — Phương án A).
 *
 * KHÔNG chứa logic auth-gate. Card chỉ gọi `onClick` được truyền vào — parent
 * tự bọc requireAuth() nếu cần.
 *
 * Props:
 *  - image        : URL ảnh ĐÃ resolve (string) hoặc null/undefined.
 *  - imageAlt     : alt cho ảnh.
 *  - placeholder  : { bg, icon } — hiển thị khi không có ảnh. `icon` là string
 *                   emoji (auto fontSize 32) hoặc ReactNode.
 *  - academicCover: ReactNode hoặc true → render <AcademicCover> cực nét thay vì placeholder rỗng.
 *  - thumbAspect  : tỉ lệ khung ảnh. '16/9' | '4/5' | … (aspect-ratio) HOẶC
 *                   chuỗi px cố định như '160px' (dùng height). Mặc định '16/9'.
 *  - title        : tiêu đề (string). Style/size/màu đã chuẩn hoá, KHÔNG param.
 *  - titleClamp   : số dòng giới hạn tiêu đề (number). Bỏ trống = không clamp.
 *  - meta         : ReactNode  HOẶC  { type:'count', text }  HOẶC
 *                   { type:'chips', chips:[{ label, tone }] }.
 *                   tone ∈ CHIP_TONES (writing|speaking|reading|listening|neutral).
 *  - action       : bỏ trống (không hiện affordance nào) | { disabled, disabledLabel }.
 *                   Đợt 3 — Việc 3: bỏ hẳn nút CTA giả chiếm hết chiều ngang.
 *                   Khi truyền `action` và card khả dụng (`disabled` không true),
 *                   chỉ hiện một mũi tên nhỏ góc dưới-phải — chỉ dấu "cả card bấm
 *                   được", không phải nút riêng, không có onClick của riêng nó.
 *                   Khi `disabled:true`, hiện pill nhãn trung tính (`disabledLabel`
 *                   hoặc `label`) thay mũi tên; card cũng mất hover-lift/cursor
 *                   pointer (xem `clickable` bên dưới — card "trang trí" không còn
 *                   giả vờ bấm được nữa).
 *  - accentBar    : true → dải màu primary dưới ảnh, hiện khi hover (chỉ showcase, chỉ khi clickable).
 *  - hoverStyle   : 'showcase' (JS state: lift + scale + shadow xanh + zoom ảnh)
 *                 | 'subtle'   (CSS thuần qua .card-base:hover). Mặc định 'subtle'.
 *  - onClick      : click cả card. Bỏ trống → card không clickable — showcase cũng
 *                   không lift/đổi border/shadow khi hover (tránh giả vờ tương tác được).
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

// Công thức hover "showcase" — chuẩn hóa phong cách Zinc Monochrome.
const SHOWCASE = {
  transition:  'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  restShadow:  '0 2px 8px rgba(0, 0, 0, 0.04)',
  hoverShadow: '0 16px 30px -6px rgba(0, 0, 0, 0.12), 0 6px 12px -4px rgba(0, 0, 0, 0.06)',
  restBorder:  '1px solid #e4e4e7',
  hoverBorder: '1.5px solid #18181b',
  hoverInk:    '#18181b',
}

function Chip({ label, tone }) {
  const t = CHIP_TONES[tone] || CHIP_TONES.neutral
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
    }}>{label}</span>
  )
}

// `pushBottom` mặc định true (Meta tự đẩy xuống đáy khi đứng một mình, không
// có `action` đi kèm). Khi dùng trong hàng chung với CardAffordance, wrapper
// ngoài đã tự marginTop:auto nên Meta không cần tự đẩy nữa (tránh 2 auto-margin
// cạnh nhau).
function Meta({ meta, countColor, pushBottom = true }) {
  if (meta == null) return null
  const topStyle = pushBottom ? { marginTop: 'auto' } : null

  if (isValidElement(meta) || typeof meta === 'string' || typeof meta === 'number') {
    return <div style={topStyle}>{meta}</div>
  }

  if (meta.type === 'count') {
    return (
      <div style={{
        fontFamily: 'var(--font-mono)', display: 'flex', gap: 12,
        fontSize: 12, color: countColor, transition: 'color 0.3s ease',
        ...topStyle,
      }}>{meta.text}</div>
    )
  }

  if (meta.type === 'chips') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...topStyle }}>
        {meta.chips.map((c, i) => <Chip key={i} label={c.label} tone={c.tone} />)}
      </div>
    )
  }

  return null
}

// Chỉ dấu nhỏ thay cho nút CTA giả: mũi tên (khả dụng) hoặc pill trung tính
// (đang cập nhật/disabled). Không có onClick riêng — cả card mới là vùng bấm.
function CardAffordance({ action, activeHover }) {
  const disabled = action.disabled === true

  if (disabled) {
    const label = action.disabledLabel ?? action.label
    return (
      <span
        style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: 'var(--surface-raised)', color: 'var(--subtle)',
          border: '1px solid var(--border)', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >{label}</span>
    )
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: activeHover ? 'var(--primary)' : 'var(--primary-light)',
        color: activeHover ? '#fff' : 'var(--primary)',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  )
}

export default function ContentCard({
  image,
  imageAlt = '',
  placeholder,
  academicCover,
  thumbAspect = '16/9',
  thumbOverlay,
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
  const clickable = typeof onClick === 'function'
  const [hovered, setHovered] = useState(false)
  // Chỉ áp hiệu ứng hover thật khi card thật sự bấm được — card "trang trí"
  // (không có onClick, vd đang cập nhật) không được giả vờ lift/đổi màu.
  const activeHover = isShowcase && clickable && hovered

  // V1 (không action, click cả card) → tiêu đề + meta đổi màu khi hover.
  // V2 (có action) → tiêu đề tĩnh, feedback nằm ở accent bar + mũi tên/pill.
  const inkShift = activeHover && !action

  const isPx = typeof thumbAspect === 'string' && thumbAspect.endsWith('px')
  const thumbBox = {
    width: '100%',
    ...(isPx ? { height: thumbAspect } : { aspectRatio: String(thumbAspect).replace('/', ' / ') }),
    overflow: 'hidden', flexShrink: 0, position: 'relative',
  }

  const rootStyle = isShowcase
    ? {
        cursor: clickable ? 'pointer' : 'default', overflow: 'hidden', background: '#ffffff', borderRadius: '1rem',
        border: activeHover ? SHOWCASE.hoverBorder : SHOWCASE.restBorder,
        transition: SHOWCASE.transition,
        transform: activeHover ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: activeHover ? SHOWCASE.hoverShadow : SHOWCASE.restShadow,
      }
    : { cursor: clickable ? 'pointer' : 'default' }

  const titleStyle = {
    fontWeight: 700, fontSize: 'var(--fs-sm)',
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
            className="img-crisp w-full h-full object-cover block"
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              imageRendering: '-webkit-optimize-contrast',
              backfaceVisibility: 'hidden',
              transition: isShowcase ? 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
              transform: activeHover ? 'scale(1.06) translateZ(0)' : 'scale(1) translateZ(0)',
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
        ) : academicCover ? (
          isValidElement(academicCover) ? academicCover : <AcademicCover title={title} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface-raised)' }} />
        )}

        {thumbOverlay}

        {accentBar && isShowcase && (
          <div className="cc-accent-bar" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
            background: 'var(--primary)',
            opacity: activeHover ? 1 : 0, transition: 'opacity 0.3s ease',
          }} />
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p style={titleStyle}>{title}</p>
        {action ? (
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Meta meta={meta} countColor={inkShift ? SHOWCASE.hoverInk : 'var(--muted)'} pushBottom={false} />
            <CardAffordance action={action} activeHover={activeHover} />
          </div>
        ) : (
          <Meta meta={meta} countColor={inkShift ? SHOWCASE.hoverInk : 'var(--muted)'} />
        )}
      </div>
    </div>
  )
}
