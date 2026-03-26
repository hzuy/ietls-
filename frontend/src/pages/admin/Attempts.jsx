import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/axios'
import AdminLayout from '../../components/AdminLayout'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }

function bandColor(score) {
  if (score == null) return 'text-gray-300'
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-500'
}

function exportCSV(attempts) {
  const headers = ['Người dùng', 'Email', 'Kỹ năng', 'Đề thi', 'Band', 'Ngày thi']
  const rows = attempts.map(a => [
    a.user?.name, a.user?.email,
    SKILL_LABEL[a.exam?.skill] || a.exam?.skill,
    a.exam?.title,
    a.score != null ? a.score.toFixed(1) : '',
    new Date(a.createdAt).toLocaleDateString('vi-VN')
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'attempts.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function Attempts() {
  const [attempts, setAttempts] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [skill, setSkill] = useState('')
  const [scoreMin, setScoreMin] = useState('')
  const [scoreMax, setScoreMax] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [examSeries, setExamSeries] = useState([])
  const [seriesId, setSeriesId] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/exam-series').then(r => setExamSeries(r.data)).catch(() => {})
  }, [])

  const fetchAttempts = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20, search, skill, seriesId }
    if (scoreMin) params.scoreMin = scoreMin
    if (scoreMax) params.scoreMax = scoreMax
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo)   params.dateTo = dateTo
    api.get('/admin/attempts', { params })
      .then(r => { setAttempts(r.data.attempts); setTotal(r.data.total); setPages(r.data.pages) })
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [search, skill, scoreMin, scoreMax, dateFrom, dateTo, seriesId, page])

  useEffect(() => { fetchAttempts() }, [fetchAttempts])

  const reset = () => { setSearch(''); setSkill(''); setScoreMin(''); setScoreMax(''); setDateFrom(''); setDateTo(''); setSeriesId(''); setPage(1) }

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Lịch sử bài thi <span className="text-base font-normal text-gray-400">({total})</span></h1>
          <button onClick={() => exportCSV(attempts)}
            className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition">
            ↓ Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <input type="text" placeholder="Tìm tên/email..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
            <select value={skill} onChange={e => { setSkill(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]">
              <option value="">Tất cả kỹ năng</option>
              {Object.entries(SKILL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={seriesId} onChange={e => { setSeriesId(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]">
              <option value="">Tất cả bộ đề</option>
              {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" placeholder="Band min" value={scoreMin} min="0" max="9" step="0.5"
              onChange={e => { setScoreMin(e.target.value); setPage(1) }}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
            <input type="number" placeholder="Band max" value={scoreMax} min="0" max="9" step="0.5"
              onChange={e => { setScoreMax(e.target.value); setPage(1) }}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]" />
            <button onClick={reset} className="px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Reset</button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : attempts.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Không có lượt thi nào khớp bộ lọc</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">Người dùng</th>
                    <th className="px-4 py-3 text-left font-medium">Kỹ năng</th>
                    <th className="px-4 py-3 text-left font-medium">Đề thi</th>
                    <th className="px-4 py-3 text-left font-medium">Band</th>
                    <th className="px-4 py-3 text-left font-medium">Ngày thi</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{a.user?.name}</p>
                        <p className="text-xs text-gray-400">{a.user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{a.exam?.title}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${bandColor(a.score)}`}>
                          {a.score != null ? a.score.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Trang {page} / {pages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
