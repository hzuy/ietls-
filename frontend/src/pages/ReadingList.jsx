import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/axios'
import Navbar from '../components/Navbar'

function Spinner({ color }) {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function ReadingList() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [navigatingId, setNavigatingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/reading/exams')
      .then(res => setExams(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleStart = (exam) => {
    if (navigatingId) return
    setNavigatingId(exam.id)
    setTimeout(() => navigate(`/reading/${exam.id}`), 350)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M12 20h9" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: '#1e3a5f' }}>Reading</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>3 đoạn văn · 40 câu hỏi · 60 phút</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: '#1e3a5f' }}>Danh sách đề thi</h2>
            <p className="text-sm" style={{ color: '#64748b' }}>{exams.length} đề có sẵn</p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />)}</div>
        ) : exams.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0' }}>
            <div className="text-4xl mb-3">📄</div>
            <p className="font-bold" style={{ color: '#1e293b' }}>Chưa có đề nào</p>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>Admin chưa thêm đề Reading</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam, idx) => {
              const isNavigating = navigatingId === exam.id
              return (
                <div key={exam.id}
                  onClick={() => handleStart(exam)}
                  className="rounded-2xl p-5 cursor-pointer transition-all flex items-center justify-between group"
                  style={{
                    backgroundColor: isNavigating ? '#F5F7FF' : 'white',
                    border: `1px solid ${isNavigating ? '#C7D2FE' : '#e2e8f0'}`,
                    boxShadow: isNavigating ? '0 4px 16px rgba(43,82,212,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
                    pointerEvents: navigatingId ? 'none' : 'auto'
                  }}
                  onMouseEnter={e => { if (!navigatingId) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#C7D2FE' } }}
                  onMouseLeave={e => { if (!navigatingId) { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e2e8f0' } }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0" style={{ backgroundColor: '#EEF2FF', color: '#1a56db' }}>
                      {isNavigating
                        ? <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#C7D2FE" strokeWidth="3"/><path d="M12 2a10 10 0 0110 10" stroke="#1a56db" strokeWidth="3" strokeLinecap="round"/></svg>
                        : String(idx + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm mb-1" style={{ color: '#1e3a5f' }}>{exam.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#8594A3' }}>{exam._count?.questions || 0} câu hỏi</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2"
                    style={{ backgroundColor: '#1a56db', minWidth: '80px', justifyContent: 'center' }}
                    onMouseEnter={e => { if (!navigatingId) e.currentTarget.style.backgroundColor = '#1e3fa8' }}
                    onMouseLeave={e => { if (!navigatingId) e.currentTarget.style.backgroundColor = '#1a56db' }}
                  >
                    {isNavigating ? <><Spinner /><span>Đang vào...</span></> : 'Làm bài'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
