import { createContext, useContext, useState, useEffect } from 'react'
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

  const openAuthModal = (tab = 'login', redirectTo = null) => {
    setModal({ open: true, tab, redirectTo })
  }

  const handleAuthSuccess = (userData) => {
    setUser(userData)
    const redirectTo = modal.redirectTo
    setModal({ open: false, tab: 'login', redirectTo: null })
    if (redirectTo && redirectTo !== '/') navigate(redirectTo)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('requirePasswordChange')
    setUser(null)
    navigate('/')
  }

  return (
    <AuthContext.Provider value={{ user, setUser, openAuthModal, handleLogout }}>
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
