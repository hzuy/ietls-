import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AuthProvider } from './context/AuthContext'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import { getAdminSettings } from './services/adminService'
import { purgeExpiredDrafts } from './services/draftService'

// Eagerly loaded — critical path pages (always needed on first render)
import Home from './pages/Home'

// Lazily loaded — split into separate chunks, loaded on demand
const ChangePassword    = lazy(() => import('./pages/ChangePassword'))
const ReadingExam       = lazy(() => import('./pages/ReadingExam'))
const ListeningExam     = lazy(() => import('./pages/ListeningExam'))
const WritingExam       = lazy(() => import('./pages/WritingExam'))
const SpeakingExam      = lazy(() => import('./pages/SpeakingExam'))
const SkillResultPage   = lazy(() => import('./components/SkillResult'))
const Admin             = lazy(() => import('./pages/Admin'))
const FullTest          = lazy(() => import('./pages/FullTest'))
const FullTestDetail    = lazy(() => import('./pages/FullTestDetail'))
const SeriesPage        = lazy(() => import('./pages/SeriesPage'))
const FullTestResult    = lazy(() => import('./pages/FullTestResult'))
const PracticeExamPage  = lazy(() => import('./pages/PracticeExamPage'))
const PracticeList      = lazy(() => import('./pages/PracticeList'))
const SampleDetailPage  = lazy(() => import('./pages/SampleDetailPage'))
const WritingSamplesPage  = lazy(() => import('./pages/WritingSamplesPage'))
const SpeakingSamplesPage = lazy(() => import('./pages/SpeakingSamplesPage'))
const UserProfile       = lazy(() => import('./pages/UserProfile'))
const ProgressAnalysis  = lazy(() => import('./pages/ProgressAnalysis'))
const NotFound          = lazy(() => import('./pages/NotFound'))

// Admin pages — lazily loaded, heaviest chunks
const Dashboard         = lazy(() => import('./pages/admin/Dashboard'))
const Users             = lazy(() => import('./pages/admin/Users'))
const UserDetail        = lazy(() => import('./pages/admin/UserDetail'))
const Attempts          = lazy(() => import('./pages/admin/Attempts'))
const Analytics         = lazy(() => import('./pages/admin/Analytics'))
const Accounts          = lazy(() => import('./pages/admin/Accounts'))
const Settings          = lazy(() => import('./pages/admin/Settings'))
const Staff             = lazy(() => import('./pages/admin/Staff'))
const Profile           = lazy(() => import('./pages/admin/Profile'))
const ReadingPractice   = lazy(() => import('./pages/admin/ReadingPractice'))
const ListeningPractice = lazy(() => import('./pages/admin/ListeningPractice'))
const WritingSamples    = lazy(() => import('./pages/admin/WritingSamples'))
const SpeakingSamples   = lazy(() => import('./pages/admin/SpeakingSamples'))
const Trash             = lazy(() => import('./pages/admin/Trash'))

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1D4ED8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// Yêu cầu đăng nhập — mở modal nếu chưa login
function PrivateRoute({ children }) {
  const location = useLocation()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login', redirectTo: location.pathname }} />
  if (localStorage.getItem('requirePasswordChange') === 'true') return <Navigate to="/change-password" />
  return children
}

// Chỉ admin
function AdminRoute({ children }) {
  const { role } = useAuth()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login' }} />
  // BUG-20: Redirect to '/' instead of '/admin' to avoid redirect loop
  if (role !== 'admin') return <Navigate to="/" />
  return children
}

// Admin hoặc teacher
function StaffRoute({ children }) {
  const { role } = useAuth()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace state={{ authModal: 'login' }} />
  if (role !== 'admin' && role !== 'teacher') return <Navigate to="/" />
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

// BUG-24 + BUG-25: Fetch settings on app start — apply site_name to document.title
// and store system_announcement for display in Navbar
function AppEffects() {
  useEffect(() => {
    purgeExpiredDrafts() // dọn draft localStorage quá 7 ngày (1 lần / phiên)
    getAdminSettings()
      .then(settings => {
        if (settings.site_name && settings.site_name.trim()) {
          document.title = settings.site_name.trim()
        }
        if (settings.system_announcement && settings.system_announcement.trim()) {
          sessionStorage.setItem('__announcement__', settings.system_announcement.trim())
        } else {
          sessionStorage.removeItem('__announcement__')
        }
      })
      .catch(() => {})
  }, [])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppEffects />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace state={{ authModal: 'login' }} />} />
              <Route path="/register" element={<Navigate to="/" replace state={{ authModal: 'register' }} />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/" element={<Home />} />
              <Route path="/reading" element={<Navigate to="/practice/reading" replace />} />
              <Route path="/reading/:id/result" element={<PrivateRoute><SkillResultPage skillType="reading" /></PrivateRoute>} />
              <Route path="/reading/:id" element={<PrivateRoute><ReadingExam /></PrivateRoute>} />
              <Route path="/listening" element={<Navigate to="/practice/listening" replace />} />
              <Route path="/listening/:id/result" element={<PrivateRoute><SkillResultPage skillType="listening" /></PrivateRoute>} />
              <Route path="/listening/:id" element={<PrivateRoute><ListeningExam /></PrivateRoute>} />
              <Route path="/writing" element={<Navigate to="/writing-samples" replace />} />
              <Route path="/writing/:id" element={<PrivateRoute><WritingExam /></PrivateRoute>} />
              <Route path="/speaking" element={<Navigate to="/speaking-samples" replace />} />
              <Route path="/speaking/:id" element={<PrivateRoute><SpeakingExam /></PrivateRoute>} />
              <Route path="/full-test" element={<PrivateRoute><FullTest /></PrivateRoute>} />
              <Route path="/full-test/:id" element={<FullTestDetail />} />
              <Route path="/cambridge" element={<PrivateRoute><SeriesPage filterPattern="Cambridge" title="IELTS Cambridge Academic" description="Trọn bộ đề thi IELTS từ NXB Cambridge (cuốn 10 - 20)" /></PrivateRoute>} />
              <Route path="/practice-plus" element={<PrivateRoute><SeriesPage filterPattern="Practice" title="IELTS Practice Test Plus" description="Dòng sách luyện đề chuyên sâu với độ khó cao" /></PrivateRoute>} />
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
              <Route path="/progress" element={<PrivateRoute><ProgressAnalysis /></PrivateRoute>} />

              {/* Admin routes */}
              <Route path="/admin"              element={<StaffRoute><Analytics /></StaffRoute>} />
              <Route path="/admin/exams/*"      element={<StaffRoute><Admin /></StaffRoute>} />
              <Route path="/admin/attempts"     element={<StaffRoute><Attempts /></StaffRoute>} />
              <Route path="/admin/analytics"    element={<Navigate to="/admin" replace />} />
              <Route path="/admin/accounts"     element={<AdminRoute><Accounts /></AdminRoute>} />
              <Route path="/admin/users"        element={<AdminRoute><Users /></AdminRoute>} />
              <Route path="/admin/users/:id"    element={<AdminRoute><UserDetail /></AdminRoute>} />
              <Route path="/admin/staff"        element={<AdminRoute><Staff /></AdminRoute>} />
              <Route path="/admin/settings"     element={<AdminRoute><Settings /></AdminRoute>} />
              <Route path="/admin/profile"           element={<StaffRoute><Profile /></StaffRoute>} />
              <Route path="/admin/reading-practice"   element={<StaffRoute><ReadingPractice /></StaffRoute>} />
              <Route path="/admin/listening-practice" element={<StaffRoute><ListeningPractice /></StaffRoute>} />
              <Route path="/admin/writing-samples"    element={<StaffRoute><WritingSamples /></StaffRoute>} />
              <Route path="/admin/speaking-samples"   element={<StaffRoute><SpeakingSamples /></StaffRoute>} />
              <Route path="/admin/trash"             element={<StaffRoute><Trash /></StaffRoute>} />

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <FooterWrapper />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
