import { cloneElement, isValidElement, useId } from 'react'
import { labelBase, hintBase, errorBase, requiredMark } from './formField'

/**
 * Wrapper cho một field form admin: nhãn + dấu bắt buộc + gợi ý + lỗi.
 *
 * Tự nối `id` / `aria-invalid` / `aria-describedby` vào phần tử con (input,
 * textarea hoặc Select) để screen reader đọc đúng lỗi/gợi ý — trước đây admin
 * có 17 kiểu nhãn khác nhau và không field nào báo lỗi inline.
 *
 * Dùng:
 *   <Field label="Email" required error={errors.email} hint="Dùng email công ty">
 *     <input className={fieldBase} value={...} onChange={...} />
 *   </Field>
 */
export default function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
  className = '',
}) {
  const autoId = useId()
  const fallbackId = id || autoId
  const childId = (isValidElement(children) && children.props.id) || fallbackId
  const hintId = hint ? `${childId}-hint` : undefined
  const errorId = error ? `${childId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const child = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || fallbackId,
        'aria-invalid': error ? 'true' : children.props['aria-invalid'],
        'aria-describedby': describedBy || children.props['aria-describedby'],
      })
    : children

  return (
    <div className={className}>
      {label && (
        <label htmlFor={childId} className={labelBase}>
          {label}
          {required && <span className={requiredMark}> *</span>}
        </label>
      )}
      {child}
      {error
        ? <p id={errorId} className={errorBase} role="alert">{error}</p>
        : hint
          ? <p id={hintId} className={hintBase}>{hint}</p>
          : null}
    </div>
  )
}
