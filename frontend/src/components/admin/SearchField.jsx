import { Search } from 'lucide-react'
import { fieldPill } from './formField'

/**
 * Ô tìm kiếm dùng chung cho các trang danh sách admin.
 *
 * Trước đây 8 trang tự dựng lại ô search với 3 biến thể (có/không icon, nền
 * trắng/zinc-50, padding khác nhau). Component này giữ đúng một hình thức.
 */
export default function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
  className = '',
  inputClassName = '',
  ...rest
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={`${fieldPill} pl-8 pr-3 ${inputClassName}`}
        {...rest}
      />
    </div>
  )
}
