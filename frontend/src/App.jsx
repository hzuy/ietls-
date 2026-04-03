import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Footer from './components/Footer'
import ChangePassword from './pages/ChangePassword'
import Home from './pages/Home'
import About from './pages/About'
import ReadingList from './pages/ReadingList'
import ReadingExam from './pages/ReadingExam'
import ListeningList from './pages/ListeningList'
import ListeningExam from './pages/ListeningExam'
import WritingList from './pages/WritingList'
import WritingExam from './pages/WritingExam'
import SpeakingList from './pages/SpeakingList'
import SpeakingExam from './pages/SpeakingExam'
import Admin from './pages/Admin'
import FullTest from './pages/FullTest'
import FullTestDetail from './pages/FullTestDetail'
import FullTestResult from './pages/FullTestResult'
import Dashboard from './pages/admin/Dashboard'
import Users from './pages/admin/Users'
import UserDetail from './pages/admin/UserDetail'
import Attempts from './pages/admin/Attempts'
import Analytics from './pages/admin/Analytics'
import Accounts from './pages/admin/Accounts'
import Settings from './pages/admin/Settings'
import Staff from './pages/admin/Staff'
import SeriesManager from './pages/admin/SeriesManager'
import Profile from './pages/admin/Profile'
import ReadingPractice from './pages/admin/ReadingPractice'
import ListeningPractice from './pages/admin/ListeningPractice'
import WritingSamples from './pages/admin/WritingSamples'
import SpeakingSamples from './pages/admin/SpeakingSamples'
import Trash from './pages/admin/Trash'
import PracticeExamPage from './pages/PracticeExamPage'
import PracticeList from './pages/PracticeList'
import SampleDetailPage from './pages/SampleDetailPage'
import WritingSamplesPage from './pages/WritingSamplesPage'
import SpeakingSamplesPage from './pages/SpeakingSamplesPage'
import UserProfile from './pages/UserProfile'

// Yêu cầu đăng nhập — mở modal nếu chưa login
function PrivateRoute({ children }) {
  const location = useLocation()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login', redirectTo: location.pathname }} />
  if (localStorage.getItem('requirePasswordChange') === 'true') return <Navigate to="/change-password" />
  return children
}

function getRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role) return user.role
    const token = localStorage.getItem('token')
    if (token) return JSON.parse(atob(token.split('.')[1])).role || 'user'
  } catch {}
  return 'user'
}

// Chỉ admin
function AdminRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login' }} />
  if (getRole() !== 'admin') return <Navigate to="/admin" state={{ forbidden: true }} />
  return children
}

// Chỉ teacher
function TeacherRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login' }} />
  if (getRole() !== 'teacher') return <Navigate to="/admin" state={{ forbidden: true }} />
  return children
}

// Admin hoặc teacher
function StaffRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login' }} />
  const r = getRole()
  if (r !== 'admin' && r !== 'teacher') return <Navigate to="/" />
  return children
}

// Ẩn footer trên admin và các trang làm bài
function FooterWrapper() {
  const { pathname } = useLocation()
  const hide =
    pathname.startsWith('/admin') ||
    /^\/(reading|listening|writing|speaking)\/[^/]+/.test(pathname) ||
    /^\/full-test\/\d+/.test(pathname) ||
    /^\/practice\/(reading|listening)\/[^/]+/.test(pathname)
  if (hide) return null
  return <Footer />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/reading" element={<PrivateRoute><ReadingList /></PrivateRoute>} />
          <Route path="/reading/:id" element={<PrivateRoute><ReadingExam /></PrivateRoute>} />
          <Route path="/listening" element={<PrivateRoute><ListeningList /></PrivateRoute>} />
          <Route path="/listening/:id" element={<PrivateRoute><ListeningExam /></PrivateRoute>} />
          <Route path="/writing" element={<PrivateRoute><WritingList /></PrivateRoute>} />
          <Route path="/writing/:id" element={<PrivateRoute><WritingExam /></PrivateRoute>} />
          <Route path="/speaking" element={<PrivateRoute><SpeakingList /></PrivateRoute>} />
          <Route path="/speaking/:id" element={<PrivateRoute><SpeakingExam /></PrivateRoute>} />
          <Route path="/full-test" element={<PrivateRoute><FullTest /></PrivateRoute>} />
          <Route path="/full-test/:id" element={<FullTestDetail />} />
          <Route path="/practice/reading" element={<PrivateRoute><PracticeList skill="reading" /></PrivateRoute>} />
          <Route path="/practice/reading/:id" element={<PrivateRoute><PracticeExamPage skill="reading" /></PrivateRoute>} />
          <Route path="/practice/listening" element={<PrivateRoute><PracticeList skill="listening" /></PrivateRoute>} />
          <Route path="/practice/listening/:id" element={<PrivateRoute><PracticeExamPage skill="listening" /></PrivateRoute>} />
          <Route path="/writing-samples" element={<WritingSamplesPage />} />
          <Route path="/speaking-samples" element={<SpeakingSamplesPage />} />
          <Route path="/samples/writing/:id" element={<SampleDetailPage skill="writing" />} />
          <Route path="/samples/speaking/:id" element={<SampleDetailPage skill="speaking" />} />
          <Route path="/full-test/result" element={<PrivateRoute><FullTestResult /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />

          {/* Admin routes */}
          <Route path="/admin"              element={<StaffRoute><Dashboard /></StaffRoute>} />
          <Route path="/admin/exams"        element={<TeacherRoute><Admin /></TeacherRoute>} />
          <Route path="/admin/attempts"     element={<TeacherRoute><Attempts /></TeacherRoute>} />
          <Route path="/admin/analytics"    element={<TeacherRoute><Analytics /></TeacherRoute>} />
          <Route path="/admin/accounts"     element={<AdminRoute><Accounts /></AdminRoute>} />
          <Route path="/admin/users"        element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="/admin/users/:id"    element={<AdminRoute><UserDetail /></AdminRoute>} />
          <Route path="/admin/staff"        element={<AdminRoute><Staff /></AdminRoute>} />
          <Route path="/admin/settings"     element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="/admin/profile"           element={<StaffRoute><Profile /></StaffRoute>} />
          <Route path="/admin/reading-practice"   element={<TeacherRoute><ReadingPractice /></TeacherRoute>} />
          <Route path="/admin/listening-practice" element={<TeacherRoute><ListeningPractice /></TeacherRoute>} />
          <Route path="/admin/writing-samples"    element={<TeacherRoute><WritingSamples /></TeacherRoute>} />
          <Route path="/admin/speaking-samples"   element={<TeacherRoute><SpeakingSamples /></TeacherRoute>} />
          <Route path="/admin/trash"             element={<TeacherRoute><Trash /></TeacherRoute>} />
          <Route path="/admin/series" element={<AdminRoute><SeriesManager /></AdminRoute>} />
        </Routes>
        <FooterWrapper />
      </AuthProvider>
    </BrowserRouter>
  )
}
