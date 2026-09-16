import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { useAuth } from './context/AuthContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { FormDirtyProvider } from './context/FormDirtyContext'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import AdminLayout from './components/AdminLayout'
import UserLayout from './components/UserLayout'
import AIChatbotDrawer from './components/common/AIChatbotDrawer'
import TopProgressBar from './components/common/TopProgressBar'
import ScrollToTop from './components/common/ScrollToTop'
import UserPageSkeleton from './components/skeletons/UserPageSkeleton'
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
const AuditLogs         = lazy(() => import('./pages/admin/AuditLogs'))
const Analytics         = lazy(() => import('./pages/admin/Analytics'))
const Accounts          = lazy(() => import('./pages/admin/Accounts'))
const Staff             = lazy(() => import('./pages/admin/Staff'))
const Profile           = lazy(() => import('./pages/admin/Profile'))
const ReadingPractice   = lazy(() => import('./pages/admin/ReadingPractice'))
const ListeningPractice = lazy(() => import('./pages/admin/ListeningPractice'))
const SampleManager     = lazy(() => import('./pages/admin/SampleManager'))
const Trash             = lazy(() => import('./pages/admin/Trash'))

// Bọc nội dung route bằng key để animation "page-transition-in" (fade + slide nhẹ)
// restart mỗi lần chuyển route — tránh nội dung xuất hiện nhấp nháy nền trắng.
// Toàn bộ /admin/* dùng chung 1 key: AdminLayout (sidebar) không được remount khi
// chuyển giữa các mục quản trị — animation riêng cho nội dung admin đặt trong
// AdminLayout, bọc quanh <Outlet/>.
function PageTransition({ children }) {
  const { pathname } = useLocation()
  const transitionKey = pathname.startsWith('/admin') ? '/admin' : pathname
  return (
    <div key={transitionKey} className="page-transition-in">
      {children}
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
export function AdminRoute({ children }) {
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
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <AppEffects />
              <TopProgressBar />
              <ScrollToTop />
              <FormDirtyProvider>
              <Suspense fallback={<UserPageSkeleton />}>
                <PageTransition>
                <Routes>
                  <Route path="/login" element={<Navigate to="/" replace state={{ authModal: 'login' }} />} />
                  <Route path="/register" element={<Navigate to="/" replace state={{ authModal: 'register' }} />} />
                  <Route path="/change-password" element={<ChangePassword />} />
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
                  {/* Màn hình làm bài luyện tập lẻ — giữ nguyên tối giản, KHÔNG bọc UserLayout/Navbar
                      (PracticeExamPage tự quyết định khi nào hiện Navbar, chỉ ở loading/not-found). */}
                  <Route path="/practice/reading/:id" element={<PrivateRoute><PracticeExamPage skill="reading" /></PrivateRoute>} />
                  <Route path="/practice/listening/:id" element={<PrivateRoute><PracticeExamPage skill="listening" /></PrivateRoute>} />

                  {/* Layout mỏng cho khu vực người dùng — chỉ render Navbar 1 lần rồi
                      <Outlet/>, không đụng wrapper/padding riêng của từng trang con. */}
                  <Route element={<UserLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/full-test" element={<PrivateRoute><FullTest /></PrivateRoute>} />
                    <Route path="/full-test/:id" element={<FullTestDetail />} />
                    <Route path="/cambridge" element={<PrivateRoute><SeriesPage filterPattern="Cambridge" title="IELTS Cambridge Academic" description="Trọn bộ đề thi IELTS từ NXB Cambridge (cuốn 10 - 20)" /></PrivateRoute>} />
                    <Route path="/practice-plus" element={<PrivateRoute><SeriesPage filterPattern="Practice" title="IELTS Practice Test Plus" description="Dòng sách luyện đề chuyên sâu với độ khó cao" /></PrivateRoute>} />
                    <Route path="/practice/reading" element={<PrivateRoute><PracticeList skill="reading" /></PrivateRoute>} />
                    <Route path="/practice/listening" element={<PrivateRoute><PracticeList skill="listening" /></PrivateRoute>} />
                    <Route path="/writing-samples" element={<WritingSamplesPage />} />
                    <Route path="/speaking-samples" element={<SpeakingSamplesPage />} />
                    <Route path="/samples/writing/:id" element={<SampleDetailPage skill="writing" />} />
                    <Route path="/samples/speaking/:id" element={<SampleDetailPage skill="speaking" />} />
                    <Route path="/full-test/result" element={<PrivateRoute><FullTestResult /></PrivateRoute>} />
                    <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
                    <Route path="/progress" element={<PrivateRoute><ProgressAnalysis /></PrivateRoute>} />
                    {/* 404 Route */}
                    <Route path="*" element={<NotFound />} />
                  </Route>

                  {/* Admin routes — 1 route cha dùng <Outlet/> (AdminLayout không unmount/remount
                      giữa các mục nữa). Quyền hạn (AdminRoute vs StaffRoute) KHÔNG đồng nhất giữa
                      các trang con (vd /admin/users chỉ admin, /admin/attempts admin+teacher) nên
                      guard vẫn đặt riêng ở từng route con như cũ — không gộp lên route cha. */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index                    element={<StaffRoute><Analytics /></StaffRoute>} />
                    <Route path="exams/*"           element={<StaffRoute><Admin /></StaffRoute>} />
                    <Route path="attempts"          element={<StaffRoute><Attempts /></StaffRoute>} />
                    <Route path="audit-logs"        element={<AdminRoute><AuditLogs /></AdminRoute>} />
                    <Route path="analytics"         element={<Navigate to="/admin" replace />} />
                    <Route path="accounts"          element={<AdminRoute><Accounts /></AdminRoute>} />
                    <Route path="users"             element={<AdminRoute><Users /></AdminRoute>} />
                    <Route path="users/:id"         element={<AdminRoute><UserDetail /></AdminRoute>} />
                    <Route path="staff"             element={<AdminRoute><Staff /></AdminRoute>} />
                    <Route path="settings"          element={<Navigate to="/admin" replace />} />
                    <Route path="profile"           element={<StaffRoute><Profile /></StaffRoute>} />
                    <Route path="reading-practice"   element={<StaffRoute><ReadingPractice /></StaffRoute>} />
                    <Route path="listening-practice" element={<StaffRoute><ListeningPractice /></StaffRoute>} />
                    <Route path="writing-samples"    element={<StaffRoute><SampleManager kind="writing" /></StaffRoute>} />
                    <Route path="speaking-samples"   element={<StaffRoute><SampleManager kind="speaking" /></StaffRoute>} />
                    <Route path="trash"              element={<StaffRoute><Trash /></StaffRoute>} />
                  </Route>
                </Routes>
                </PageTransition>
              </Suspense>
              <FooterWrapper />
              <AIChatbotDrawer />
              </FormDirtyProvider>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
    </ThemeProvider>
  )
}
