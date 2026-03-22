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
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}