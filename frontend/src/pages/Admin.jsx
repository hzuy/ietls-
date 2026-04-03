import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { getExams, getExamSeries } from '../services/examService'
import ReadingTab from '../components/admin/ReadingTab'
import ListeningTab from '../components/admin/ListeningTab'
import WritingTab from '../components/admin/WritingTab'
import SpeakingTab from '../components/admin/SpeakingTab'
import CambridgeTab from '../components/admin/CambridgeTab'

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'cambridge',  label: 'IELTS Test', icon: '📚' },
  { key: 'reading',    label: 'Reading',    icon: '📖' },
  { key: 'listening',  label: 'Listening',  icon: '🎧' },
  { key: 'writing',    label: 'Writing',    icon: '✍️' },
  { key: 'speaking',   label: 'Speaking',   icon: '🎤' },
]

export default function Admin() {
  const [activeTab, setActiveTab] = useState('reading')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [examSeries, setExamSeries] = useState([])
  const navigate = useNavigate()

  const fetchExams = () => {
    getExams()
      .then(data => setExams(data))
      .catch(err => {
        if (err.response?.status === 403) navigate('/')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchExams()
  }, [])

  useEffect(() => {
    getExamSeries().then(data => setExamSeries(data)).catch(() => {})
  }, [])

  return (
    <AdminLayout>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Đang tải...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? 'bg-[#1a56db] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.key !== 'cambridge' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {exams.filter(e => e.skill === tab.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'cambridge'  && <CambridgeTab onRefresh={fetchExams} />}
            {activeTab === 'reading'    && <ReadingTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
            {activeTab === 'listening'  && <ListeningTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
            {activeTab === 'writing'    && <WritingTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
            {activeTab === 'speaking'   && <SpeakingTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
