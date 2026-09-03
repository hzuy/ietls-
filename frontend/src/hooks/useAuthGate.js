import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Prefix của các route được bọc <PrivateRoute> trong App.jsx.
 *
 * ĐỒNG BỘ THỦ CÔNG với App.jsx. <PrivateRoute> mới là enforcement thật —
 * danh sách này chỉ để useAuthGate() bỏ qua bước "bounce về Home + mở modal"
 * cho khách chưa đăng nhập (mở modal ngay tại chỗ thay vì đổi URL 2 lần).
 * Nếu list lệch khỏi App.jsx: tệ nhất khách gặp lại bounce cũ cho 1 route,
 * KHÔNG phải lỗ hổng bảo mật.
 */
const AUTH_PREFIXES = [
  '/full-test',         // /full-test, /full-test/result  (TRỪ /full-test/:id — xem loại trừ bên dưới)
  '/cambridge',
  '/practice-plus',
  '/practice/reading',  // + /practice/reading/:id
  '/practice/listening', // + /practice/listening/:id
  '/reading',           // /reading/:id, /reading/:id/result
  '/listening',         // /listening/:id, /listening/:id/result
  '/writing',           // /writing/:id  (KHÔNG bắt /writing-samples — startsWith('/writing/') chặn)
  '/speaking',          // /speaking/:id
  '/profile',
  '/progress',
]

/**
 * routeNeedsAuth — path này có nằm trong vùng <PrivateRoute> không?
 * Pure function, không phụ thuộc React. Dùng bởi useAuthGate() + <GatedLink>.
 *
 * @param {string} path - pathname (có thể kèm ?query / #hash — sẽ được cắt bỏ)
 * @returns {boolean}
 */
export function routeNeedsAuth(path) {
  if (typeof path !== 'string') return false
  const clean = path.split(/[?#]/)[0] // bỏ query + hash

  // /full-test/:id (FullTestDetail) là PUBLIC — loại trừ TRƯỚC khi xét prefix /full-test.
  // Lưu ý: /full-test/result vẫn PRIVATE vì "\d" không khớp ký tự "r".
  if (/^\/full-test\/\d/.test(clean)) return false

  return AUTH_PREFIXES.some(p => clean === p || clean.startsWith(p + '/'))
}

/**
 * useAuthGate — điều hướng có kiểm soát auth.
 *
 * gate(path, { tab, force }):
 *   - Cần auth (routeNeedsAuth hoặc force=true) && chưa đăng nhập
 *       → openAuthModal(tab, path)  [redirectTo = path → handleAuthSuccess tự navigate tới đó sau khi login]
 *   - Ngược lại → navigate(path) thẳng
 *
 * @returns {(path: string, opts?: { tab?: 'login'|'register', force?: boolean }) => void}
 */
export function useAuthGate() {
  const { user, openAuthModal } = useAuth()
  const navigate = useNavigate()

  return useCallback((path, { tab = 'login', force } = {}) => {
    const needsAuth = force ?? routeNeedsAuth(path)
    if (needsAuth && !user) {
      openAuthModal(tab, path)
    } else {
      navigate(path)
    }
  }, [user, navigate, openAuthModal])
}

export default useAuthGate
