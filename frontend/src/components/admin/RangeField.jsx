import { fieldGroupInner, fieldGroupWrapper, fieldGroupWrapperPill } from './formField'

/**
 * Khung bao cho nhóm field con nằm trong một viền chung: "Khoảng ngày"
 * (2 input date) và "Khoảng Band" (2 input number).
 *
 * Wrapper giữ viền + focus ring; field con mang class `grouped-field` để CSS
 * admin không vẽ thêm viền/ring thứ hai lồng bên trong (xem index.css).
 *
 * Trước đây Attempts/AuditLogs dùng khung `rounded-full` còn Analytics dùng
 * `rounded-md` cho cùng một thành phần.
 */
export default function RangeField({ children, className = '', pill = true, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`${pill ? fieldGroupWrapperPill : fieldGroupWrapper} ${className}`}
    >
      {children}
    </div>
  )
}

