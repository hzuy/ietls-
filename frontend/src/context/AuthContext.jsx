import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AuthModal from '../components/AuthModal'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const [modal, setModal] = useState({ open: false, tab: 'login', redirectTo: null })
  const navigate  = useNavigate()
  const location  = useLocation()

  // Khi được redirect sang "/" kèm state { authModal, redirectTo }
  // (PrivateRoute, AdminRoute, TeacherRoute, StaffRoute dùng cơ chế này)
  useEffect(() => {
    if (location.state?.authModal && !modal.open) {
      setModal({ open: true, tab: location.state.authModal, redirectTo: location.state.redirectTo || null })
      // Xóa state khỏi history để F5 không mở lại modal
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // useCallback (deps rỗng / chỉ navigate — cả 2 hàm không đọc state `modal`/`user`
  // hiện tại, chỉ gọi thẳng setter) để reference ổn định qua mỗi render — cần thiết
  // để useMemo(value) bên dưới thực sự có tác dụng, không chỉ đổi tên object.
  const openAuthModal = useCallback((tab = 'login', redirectTo = null) => {
    setModal({ open: true, tab, redirectTo })
  }, [])

  const handleAuthSuccess = (userData) => {
    setUser(userData)
    const redirectTo = modal.redirectTo
    setModal({ open: false, tab: 'login', redirectTo: null })
    if (redirectTo && redirectTo !== '/') {
      navigate(redirectTo)
    } else if (userData?.role === 'admin' || userData?.role === 'teacher') {
      navigate('/admin')
    }
  }

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('requirePasswordChange')
    setUser(null)
    navigate('/')
  }, [navigate])

  // Giải mã role từ JWT token nếu user object không có role (session cũ)
  const getRoleFromToken = () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.role || null
    } catch {
      return null
    }
  }

  const role = user?.role || getRoleFromToken() || 'user'

  // Memo hóa value — AuthProvider tự re-render mỗi lần đổi route (useLocation ở trên),
  // nếu không memo thì mọi component gọi useAuth() re-render theo dù user/role không đổi.
  const value = useMemo(
    () => ({ user, role, setUser, openAuthModal, handleLogout }),
    [user, role, openAuthModal, handleLogout]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {modal.open && (
        <AuthModal
          tab={modal.tab}
          onTabChange={tab => setModal(prev => ({ ...prev, tab }))}
          onSuccess={handleAuthSuccess}
          onClose={() => setModal(prev => ({ ...prev, open: false }))}
        />
      )}
    </AuthContext.Provider>
  )
}
