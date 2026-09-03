import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAuthGate, routeNeedsAuth } from '../../hooks/useAuthGate'

/**
 * GatedLink — <Link> có auth-gate cho left-click.
 *
 * - Luôn render <Link to={to}> THẬT → middle-click / Ctrl/Cmd-click / "mở tab mới" /
 *   right-click đều hoạt động bình thường (và <PrivateRoute> vẫn enforce nếu là khách).
 * - CHỈ khi left-click thường (không phím bổ trợ) VÀ routeNeedsAuth(to) && chưa đăng nhập
 *   → preventDefault + gate(to) → mở modal đăng nhập ngay tại chỗ (không bounce về Home).
 * - Route public hoặc user đã đăng nhập → không can thiệp, để <Link> điều hướng SPA như thường.
 *
 * Props: to (string), tab ('login'|'register', mặc định 'login'), onClick (được gọi trước),
 *        cùng mọi prop khác forward thẳng xuống <Link> (className, style, aria-*, ...).
 */
export default function GatedLink({ to, tab = 'login', onClick, children, ...rest }) {
  const { user } = useAuth()
  const gate = useAuthGate()
  const guarded = typeof to === 'string' && routeNeedsAuth(to) && !user

  const handleClick = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (!guarded) return
    // Tôn trọng mở-tab-mới / mở-cửa-sổ-mới — để <Link> + <PrivateRoute> lo
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    gate(to, { tab })
  }

  return (
    <Link to={to} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
}
