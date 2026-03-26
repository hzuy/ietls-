import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
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
import FullTestResult from './pages/FullTestResult'
import Dashboard from './pages/admin/Dashboard'
import Users from './pages/admin/Users'
import UserDetail from './pages/admin/UserDetail'
import Attempts from './pages/admin/Attempts'
import Analytics from './pages/admin/Analytics'
import Accounts from './pages/admin/Accounts'
import Settings from './pages/admin/Settings'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/reading" element={<PrivateRoute><ReadingList /></PrivateRoute>} />
        <Route path="/reading/:id" element={<PrivateRoute><ReadingExam /></PrivateRoute>} />
        <Route path="/listening" element={<PrivateRoute><ListeningList /></PrivateRoute>} />
        <Route path="/listening/:id" element={<PrivateRoute><ListeningExam /></PrivateRoute>} />
        <Route path="/writing" element={<PrivateRoute><WritingList /></PrivateRoute>} />
        <Route path="/writing/:id" element={<PrivateRoute><WritingExam /></PrivateRoute>} />
        <Route path="/speaking" element={<PrivateRoute><SpeakingList /></PrivateRoute>} />
        <Route path="/speaking/:id" element={<PrivateRoute><SpeakingExam /></PrivateRoute>} />
        <Route path="/full-test" element={<PrivateRoute><FullTest /></PrivateRoute>} />
        <Route path="/full-test/result" element={<PrivateRoute><FullTestResult /></PrivateRoute>} />

        {/* Admin routes */}
        <Route path="/admin" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/admin/exams" element={<PrivateRoute><Admin /></PrivateRoute>} />
        <Route path="/admin/users" element={<PrivateRoute><Users /></PrivateRoute>} />
        <Route path="/admin/users/:id" element={<PrivateRoute><UserDetail /></PrivateRoute>} />
        <Route path="/admin/attempts" element={<PrivateRoute><Attempts /></PrivateRoute>} />
        <Route path="/admin/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
        <Route path="/admin/accounts" element={<PrivateRoute><Accounts /></PrivateRoute>} />
        <Route path="/admin/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
