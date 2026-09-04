import { useState, useEffect } from 'react'
import { useNavigate, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom'
import { getExams, getExamSeries, getExamCounts } from '../services/examService'
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
  const [tabCounts, setTabCounts] = useState({ reading: 0, listening: 0, writing: 0, speaking: 0 })
  const [tabCache, setTabCache] = useState({ reading: null, listening: null, writing: null, speaking: null })
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState({}) // { [skill]: true } khi fetch danh sách lỗi
  const [examSeries, setExamSeries] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  // Determine active tab from URL path
  const activeTab = TABS.find(tab => location.pathname.includes(`/admin/exams/${tab.path}`))?.key || 'cambridge'

  const fetchCounts = () => {
    getExamCounts().then(data => setTabCounts(data)).catch(() => {})
  }

  const fetchSkillExams = (skill, {
    page = 1, search = '', seriesId = '', status = 'all',
    sortBy = 'createdAt', sortOrder = 'desc', force = false,
  } = {}) => {
    if (!skill || skill === 'cambridge') return
    const isPristine = page === 1 && !search && !seriesId && status === 'all' && sortBy === 'createdAt' && sortOrder === 'desc'
    if (!force && tabCache[skill] && isPristine) {
      return
    }
    setLoadError(prev => (prev[skill] ? { ...prev, [skill]: false } : prev)) // xóa lỗi cũ khi thử lại
    setLoading(true)
    getExams({ skill, page, limit: 20, search, seriesId, status, sortBy, sortOrder })
      .then(res => {
        const payload = Array.isArray(res) ? { exams: res, total: res.length, page: 1, pages: 1, stats: null } : res
        setTabCache(prev => ({ ...prev, [skill]: payload }))
      })
      .catch(err => {
        if (err.response?.status === 403) navigate('/')
        else setLoadError(prev => ({ ...prev, [skill]: true }))
      })
      .finally(() => setLoading(false))
  }

  const handleRefresh = (skill = activeTab) => {
    fetchCounts()
    setTabCache(prev => ({ ...prev, [skill]: null }))
    fetchSkillExams(skill, { force: true })
  }

  useEffect(() => {
    fetchCounts()
    getExamSeries().then(data => setExamSeries(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab && activeTab !== 'cambridge') {
      fetchSkillExams(activeTab)
    }
  }, [activeTab])

  const currentTabExams = tabCache[activeTab]?.exams || []

  return (
    <div className="p-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
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
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer select-none ${
                  isTabActive
                    ? 'bg-[#1D4ED8] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.key !== 'cambridge' && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      isTabActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tabCounts[tab.key] ?? 0}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Tab Content via Nested Routes */}
        <Routes>
          <Route index element={<Navigate to="cambridge" replace />} />
          <Route path="cambridge" element={<CambridgeTab initialSeriesList={examSeries} />} />
          <Route path="reading"   element={<ReadingTab exams={tabCache.reading?.exams || []} paginationData={tabCache.reading} fetchExams={(opts) => fetchSkillExams('reading', { ...opts, force: true })} onRefresh={() => handleRefresh('reading')} examSeries={examSeries} loading={loading} loadError={!!loadError.reading} />} />
          <Route path="listening" element={<ListeningTab exams={tabCache.listening?.exams || []} paginationData={tabCache.listening} fetchExams={(opts) => fetchSkillExams('listening', { ...opts, force: true })} onRefresh={() => handleRefresh('listening')} examSeries={examSeries} loading={loading} loadError={!!loadError.listening} />} />
          <Route path="writing"   element={<WritingTab exams={tabCache.writing?.exams || []} paginationData={tabCache.writing} fetchExams={(opts) => fetchSkillExams('writing', { ...opts, force: true })} onRefresh={() => handleRefresh('writing')} examSeries={examSeries} loading={loading} loadError={!!loadError.writing} />} />
          <Route path="speaking"  element={<SpeakingTab exams={tabCache.speaking?.exams || []} paginationData={tabCache.speaking} fetchExams={(opts) => fetchSkillExams('speaking', { ...opts, force: true })} onRefresh={() => handleRefresh('speaking')} examSeries={examSeries} loading={loading} loadError={!!loadError.speaking} />} />
        </Routes>
      </div>
  )
}
