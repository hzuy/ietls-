import { useState, useEffect } from 'react'
import { useNavigate, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom'
import { queryClient } from '../lib/queryClient'
import { getExamSeries, getExamCounts } from '../services/examService'
import { onTrashChanged } from '../services/adminService'
import ReadingTab from '../components/admin/ReadingTab'
import ListeningTab from '../components/admin/ListeningTab'
import WritingTab from '../components/admin/WritingTab'
import SpeakingTab from '../components/admin/SpeakingTab'
import CambridgeTab from '../components/admin/CambridgeTab'

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'cambridge',  label: 'IELTS Test', path: 'cambridge' },
  { key: 'reading',    label: 'Reading',    path: 'reading' },
  { key: 'listening',  label: 'Listening',  path: 'listening' },
  { key: 'writing',    label: 'Writing',    path: 'writing' },
  { key: 'speaking',   label: 'Speaking',   path: 'speaking' },
]

export default function Admin() {
  const [, setTabCounts] = useState({ reading: 0, listening: 0, writing: 0, speaking: 0 })
  const [examSeries, setExamSeries] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  // Determine active tab from URL path
  const activeTab = TABS.find(tab => location.pathname.includes(`/admin/exams/${tab.path}`))?.key || 'cambridge'

  const fetchCounts = () => {
    getExamCounts().then(data => setTabCounts(data)).catch(() => {})
  }

  const handleRefresh = (skill = activeTab) => {
    fetchCounts()
    if (skill && skill !== 'cambridge') {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams', skill] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
    }
  }

  const handleExamsChanged = () => {
    fetchCounts()
    getExamSeries().then(data => setExamSeries(data)).catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['exam'] })
  }

  useEffect(() => {
    fetchCounts()
    getExamSeries().then(data => setExamSeries(data)).catch(() => {})
    const unsub = onTrashChanged(() => {
      fetchCounts()
      getExamSeries().then(data => setExamSeries(data)).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['exam'] })
    })
    return unsub
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Quản lý đề thi</h1>
        <p className="text-xs text-zinc-500 mt-1">Quản lý các bộ đề Cambridge và bài thi theo từng kỹ năng</p>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto pb-1 no-scrollbar mb-8">
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-xs w-fit">
          {TABS.map(tab => {
            const isTabActive = activeTab === tab.key
            return (
              <NavLink
                key={tab.key}
                to={`/admin/exams/${tab.path}`}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/admin/exams/${tab.path}`)
                }}
                className={`group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer select-none whitespace-nowrap shrink-0 ${
                  isTabActive
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <span>{tab.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>

        {/* Tab Content via Nested Routes */}
        <Routes>
          <Route index element={<Navigate to="cambridge" replace />} />
          <Route path="cambridge" element={<CambridgeTab initialSeriesList={examSeries} onExamsChanged={handleExamsChanged} />} />
          <Route path="reading"   element={<ReadingTab onRefresh={() => handleRefresh('reading')} examSeries={examSeries} />} />
          <Route path="listening" element={<ListeningTab onRefresh={() => handleRefresh('listening')} examSeries={examSeries} />} />
          <Route path="writing"   element={<WritingTab onRefresh={() => handleRefresh('writing')} examSeries={examSeries} />} />
          <Route path="speaking"  element={<SpeakingTab onRefresh={() => handleRefresh('speaking')} examSeries={examSeries} />} />
        </Routes>
      </div>
  )
}
