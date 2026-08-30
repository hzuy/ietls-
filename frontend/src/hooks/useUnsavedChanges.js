import { useContext, useEffect } from 'react'
import { FormDirtyContext } from '../context/FormDirtyContext'

// Message dùng chung cho mọi điểm hỏi "rời trang?": AdminLayout (sidebar/logout)
// và popstate-trap (Back/Forward) bên dưới.
export const NAV_LEAVE_MSG = 'Rời trang? Nội dung đã được lưu nháp tự động, bạn có thể quay lại sau.'

/**
 * BUG-13: Cảnh báo khi rời form có thay đổi chưa lưu.
 *
 * Chặn được:
 *  - Đóng tab / F5 / gõ URL khác → dialog gốc trình duyệt (beforeunload).
 *  - Điều hướng in-app (bấm sidebar / nút Đăng xuất trong AdminLayout) → đẩy
 *    trạng thái dirty lên FormDirtyContext để AdminLayout window.confirm().
 *  - Nút Back / Forward trình duyệt → popstate sentinel-trap (như useExitGuard,
 *    nhưng bỏ disarm()/onBeforeExit — không có gì cần persist, autosave 2s đã đủ).
 *
 * KHÔNG dùng useBlocker: app chạy <BrowserRouter> declarative (không Data Router)
 * nên useBlocker gọi useDataRouterContext() → invariant throw → crash cả cây route.
 * (Cùng lý do useExitGuard phải né useBlocker, dùng popstate-trap.)
 *
 * @param {boolean} isDirty - form có thay đổi chưa lưu hay không
 */
export function useUnsavedChanges(isDirty) {
  const formDirty = useContext(FormDirtyContext)

  // Đóng tab / reload
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Đăng ký trạng thái dirty lên context cho AdminLayout đọc; dọn về false khi unmount.
  // No-op nếu không có provider (vd render hook trong unit test).
  useEffect(() => {
    formDirty?.setDirty(isDirty)
    return () => formDirty?.setDirty(false)
  }, [isDirty, formDirty])

  // Back / Forward: khi dirty, chèn 1 "sentinel" cùng URL vào history. Lần Back đầu
  // tiên "ăn" sentinel → popstate nổ → hỏi xác nhận:
  //  - Ở lại  → chèn lại sentinel, người dùng đứng yên (URL không đổi).
  //  - Rời đi → history.back() thật (cờ `leaving` để bỏ qua popstate do chính nó gây ra).
  // Không dọn sentinel khi cleanup (giống useExitGuard) — trường hợp lưu xong rồi
  // bấm Back có thể tốn 1 lần bấm "trượt", chấp nhận được.
  useEffect(() => {
    if (!isDirty) return

    window.history.pushState(null, '', window.location.href)
    let leaving = false

    const onPopState = () => {
      if (leaving) return
      if (window.confirm(NAV_LEAVE_MSG)) {
        leaving = true
        window.history.back()
      } else {
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isDirty])
}
