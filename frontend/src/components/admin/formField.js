/**
 * Token hiển thị form dùng chung cho toàn bộ Admin panel.
 *
 * Lý do tồn tại: trước đây mỗi trang tự khai báo class ô nhập (hoặc copy
 * `inputCls` ở 3 nơi khác nhau), dẫn tới 4 bán kính bo góc và 3 chiều cao khác
 * nhau cho cùng một vai trò. Từ đây mọi field lấy style từ file này.
 *
 * Quy ước:
 *   - Ô nhập/select mặc định: cao 36px (`h-9`), bo 8px (`rounded-lg`).
 *   - `rounded-full` chỉ dành cho search/filter (`fieldPill`) và button.
 *   - Cỡ chữ do CSS quy định (`index.css` → `.admin-main`, `.admin-modal-form`
 *     pin 14px), KHÔNG khai báo `text-*` ở đây để tránh class nói một đằng mà
 *     trình duyệt render một nẻo.
 *   - Focus/hover/invalid được chuẩn hoá bằng CSS một lần (`.admin-main`,
 *     `.admin-scope`, `.admin-modal-form`) nên token không cần ring utility.
 */

// Ô nhập / select tiêu chuẩn (input text, email, password, date, select...)
export const fieldBase = [
  'w-full h-9 rounded-lg border border-zinc-200 bg-white px-3',
  'text-zinc-900 placeholder:text-zinc-400 transition-colors',
  'hover:border-zinc-300',
  'focus:outline-none',
  'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
  'read-only:bg-zinc-50',
].join(' ')

// Biến thể nhỏ cho ô nằm trong bảng/editor chật (ví dụ ô đáp án w-16)
export const fieldSm = 'h-8 rounded-lg border border-zinc-200 bg-white px-2 text-zinc-900 placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed'

// Textarea: cùng viền/bo góc với field, tự do giãn theo nội dung
export const textareaBase = [
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2',
  'text-zinc-900 placeholder:text-zinc-400 transition-colors resize-y',
  'hover:border-zinc-300',
  'focus:outline-none',
  'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
  'read-only:bg-zinc-50',
].join(' ')

// Search / filter dạng viên thuốc — chỉ dùng cho thanh lọc danh sách
export const fieldPill = 'w-full h-9 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 text-zinc-900 placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:outline-none'

// Khung bao cho field nằm trong group (khoảng ngày, khoảng band...).
// Wrapper giữ viền + focus ring, field con để `grouped-field` (opt-out CSS).
export const fieldGroupWrapper = 'flex items-center h-9 rounded-lg border border-zinc-200 bg-white px-1 transition-colors hover:border-zinc-300 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900'
export const fieldGroupWrapperPill = 'flex items-center h-9 rounded-full border border-zinc-200 bg-zinc-50 px-1 transition-colors hover:border-zinc-300 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900'
export const fieldGroupInner = 'grouped-field h-full min-w-0 flex-1 bg-transparent px-2.5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none'

// Nhãn / gợi ý / lỗi
export const labelBase = 'block text-xs font-medium text-zinc-700 mb-1.5'
export const hintBase = 'text-xs text-zinc-500 mt-1'
export const errorBase = 'text-xs text-red-600 mt-1'

// Checkbox / radio trong form admin
export const checkboxBase = 'w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 accent-zinc-900 cursor-pointer'

// Field bắt buộc: dấu * đỏ đặt sau nhãn
export const requiredMark = 'text-red-500 font-normal'

// ─── Alias giữ tương thích với các import cũ ────────────────────────────────
// `inputCls` / `labelCls` từng được khai báo riêng ở adminConstants.js,
// practiceConfig.js và Profile.jsx (đã lệch nhau). Giờ chỉ còn một nguồn.
export const inputCls = fieldBase
export const textareaCls = textareaBase
export const labelCls = labelBase
