import { createContext, useContext, useState } from 'react'

/**
 * FormDirtyContext — cầu nối 1 chiều: trang con báo "form đang có thay đổi chưa lưu"
 * lên cho AdminLayout (sidebar + nút Đăng xuất) để hỏi xác nhận trước khi điều hướng.
 *
 * - Chỉ 4 trang soạn nội dung (Reading/Listening Practice, Writing/Speaking Samples)
 *   đẩy trạng thái lên — qua useUnsavedChanges(). Các trang admin khác không đụng
 *   tới → isDirty mặc định false → không ảnh hưởng gì.
 * - Không phụ thuộc router; provider đặt ở App.jsx bọc toàn bộ Routes.
 * - Ngoài provider (vd unit test render lẻ), useContext trả null → mọi call no-op.
 */
const FormDirtyContext = createContext(null)

export function FormDirtyProvider({ children }) {
  const [isDirty, setDirty] = useState(false)
  return (
    <FormDirtyContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </FormDirtyContext.Provider>
  )
}

/** Đọc trạng thái dirty hiện tại (AdminLayout). An toàn khi không có provider. */
export function useFormDirty() {
  return useContext(FormDirtyContext)?.isDirty ?? false
}

/** Context thô — cho useUnsavedChanges tự đăng ký trạng thái + dọn khi unmount. */
export { FormDirtyContext }
