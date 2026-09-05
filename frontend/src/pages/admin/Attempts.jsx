import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminAttempts, getAdminAttemptsExport, getAdminExamSeriesForFilter } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { SkeletonTable } from '../../components/skeletons'
import { ADMIN_SKILL_COLORS, SKILL_LABEL } from '../../utils/adminSkillColors'
import Modal from '../../components/common/Modal'

import { Download, RotateCcw, Eye, Search, ChevronLeft, ChevronRight, ChevronDown, ArrowUpDown } from 'lucide-react'
import { useDebounce } from '../../hooks/useDebounce'

const CRITERION_LABEL = {
  task_achievement: 'Task Achievement / Response',
  task_response: 'Task Response',
  coherence_cohesion: 'Coherence & Cohesion',
  lexical_resource: 'Lexical Resource',
  grammatical_range: 'Grammatical Range & Accuracy',
  fluency: 'Fluency & Coherence',
  vocabulary: 'Lexical Resource',
  grammar: 'Grammatical Range & Accuracy',
  pronunciation: 'Pronunciation',
}

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-800 font-medium text-right">{children}</dd>
    </div>
  )
}

function AttemptDetailModal({ attempt: a, onClose }) {
  let criteria = null
  if (a.exam?.skill === 'writing' || a.exam?.skill === 'speaking') {
    try {
      const parsed = JSON.parse(a.aiFeedback || '{}')
      if (parsed && parsed.criteria && Object.keys(parsed.criteria).length) criteria = parsed.criteria
    } catch { /* aiFeedback not JSON / not graded yet */ }
  }

  // R/L nộp bài tức thì → createdAt ≈ finishedAt; chỉ hiện "Hoàn thành lúc" khi lệch đáng kể
  const durationMs = a.finishedAt ? new Date(a.finishedAt) - new Date(a.createdAt) : 0
  const showFinished = a.finishedAt && durationMs > 60_000

  return (
    <Modal onClose={onClose} title={`Chi tiết lượt thi #${a.id}`} size="md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <h2 className="font-bold text-slate-800">Chi tiết lượt thi</h2>
        <button onClick={onClose} aria-label="Đóng"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 font-bold transition">✕</button>
      </div>

      <div className="p-5 space-y-4 text-sm">
        <div>
          <p className="font-semibold text-slate-800">{a.user?.name || '—'}</p>
          <p className="text-xs text-slate-500">{a.user?.email || ''}</p>
        </div>

        <dl className="space-y-2.5 pt-3 border-t border-slate-100">
          <DetailRow label="Kỹ năng">{SKILL_LABEL[a.exam?.skill] || a.exam?.skill || '—'}</DetailRow>
          <DetailRow label="Đề thi">{a.exam?.title || '—'}</DetailRow>
          <DetailRow label="Band">{getBandPill(a.score)}</DetailRow>
          <DetailRow label="Ngày làm bài">{fmtDateTime(a.createdAt)}</DetailRow>
          {showFinished && (
            <>
              <DetailRow label="Hoàn thành lúc">{fmtDateTime(a.finishedAt)}</DetailRow>
              <DetailRow label="Thời gian làm">{Math.round(durationMs / 60_000)} phút</DetailRow>
            </>
          )}
        </dl>

        {criteria && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Band theo tiêu chí</p>
            <div className="space-y-1.5">
              {Object.entries(criteria).map(([key, v]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-slate-600">{CRITERION_LABEL[key] || key.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-slate-800">
                    {v && v.score != null ? Number(v.score).toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(a.exam?.skill === 'writing' || a.exam?.skill === 'speaking') && !criteria && a.score == null && (
          <p className="text-xs text-slate-400 italic pt-2">Đề đang được AI chấm — chưa có điểm chi tiết.</p>
        )}
      </div>
    </Modal>
  )
}

function getBandPill(score) {
  if (score == null) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Đang chấm</span>
  if (score >= 7.0) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">BAND {score.toFixed(1)}</span>
  if (score >= 5.0) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">BAND {score.toFixed(1)}</span>
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">BAND {score.toFixed(1)}</span>
}

export default function Attempts() {
  const { showToast } = useToast()
  const [attempts, setAttempts] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [skill, setSkill] = useState('')
  const [scoreMin, setScoreMin] = useState('')
  const [scoreMax, setScoreMax] = useState('')
  const [sortMode, setSortMode] = useState('recent') // 'recent' | 'band_desc' | 'band_asc' — server-side
  const [statusFilter, setStatusFilter] = useState('') // '' | 'scored' | 'pending'
  const [selectedAttemptIds, setSelectedAttemptIds] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [examSeries, setExamSeries] = useState([])
  const [seriesId, setSeriesId] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [detailAttempt, setDetailAttempt] = useState(null)
  const navigate = useNavigate()

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getAdminExamSeriesForFilter().then(data => setExamSeries(data)).catch(() => {})
  }, [])

  const sanitizeBandValue = (val) => {
    if (val === '' || val === null || val === undefined) return ''
    const num = parseFloat(val)
    if (isNaN(num)) return ''
    if (num < 0) return '0'
    if (num > 9) return '9'
    const rounded = Math.round(num * 2) / 2
    return rounded.toString()
  }

  const handleScoreMinChange = (e) => {
    const raw = e.target.value
    if (raw.includes('e') || raw.includes('E') || raw.includes('+')) return
    setScoreMin(raw)
    setPage(1)
  }

  const handleScoreMinBlur = () => {
    setScoreMin(prev => sanitizeBandValue(prev))
  }

  const handleScoreMaxChange = (e) => {
    const raw = e.target.value
    if (raw.includes('e') || raw.includes('E') || raw.includes('+')) return
    setScoreMax(raw)
    setPage(1)
  }

  const handleScoreMaxBlur = () => {
    setScoreMax(prev => sanitizeBandValue(prev))
  }

  const fetchAttempts = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20, search: debouncedSearch, skill, seriesId }

    if (sortMode === 'band_desc') { params.sortBy = 'score'; params.sortOrder = 'desc' }
    else if (sortMode === 'band_asc') { params.sortBy = 'score'; params.sortOrder = 'asc' }

    // Chỉ gửi minBand/maxBand lên API khi giá trị hợp lệ theo thang 0.0 - 9.0 (bội số 0.5)
    const validMin = scoreMin !== '' && !isNaN(parseFloat(scoreMin)) && parseFloat(scoreMin) >= 0 && parseFloat(scoreMin) <= 9 ? (Math.round(parseFloat(scoreMin) * 2) / 2) : undefined
    const validMax = scoreMax !== '' && !isNaN(parseFloat(scoreMax)) && parseFloat(scoreMax) >= 0 && parseFloat(scoreMax) <= 9 ? (Math.round(parseFloat(scoreMax) * 2) / 2) : undefined

    if (validMin !== undefined) params.scoreMin = validMin
    if (validMax !== undefined) params.scoreMax = validMax
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo)   params.dateTo = dateTo
    getAdminAttempts(params)
      .then(data => { setAttempts(data.attempts); setTotal(data.total); setPages(data.pages) })
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [debouncedSearch, skill, scoreMin, scoreMax, dateFrom, dateTo, seriesId, sortMode, page])

  useEffect(() => { fetchAttempts() }, [fetchAttempts])

  const reset = () => { setSearch(''); setSkill(''); setScoreMin(''); setScoreMax(''); setSortMode('recent'); setStatusFilter(''); setDateFrom(''); setDateTo(''); setSeriesId(''); setSelectedAttemptIds([]); setPage(1) }

  const filteredAttempts = attempts.filter(a => {
    if (statusFilter === 'scored') return a.score != null
    if (statusFilter === 'pending') return a.score == null
    return true
  })

  // Sắp xếp do server đảm nhiệm (sortMode → sortBy/sortOrder); FE chỉ giữ lọc trạng thái chấm
  const displayedAttempts = filteredAttempts

  // Checkbox selection logic
  const isAllSelected = displayedAttempts.length > 0 && displayedAttempts.every(a => selectedAttemptIds.includes(a.id))

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = displayedAttempts.map(a => a.id)
      setSelectedAttemptIds(prev => Array.from(new Set([...prev, ...pageIds])))
    } else {
      const pageIds = new Set(displayedAttempts.map(a => a.id))
      setSelectedAttemptIds(prev => prev.filter(id => !pageIds.has(id)))
    }
  }

  const handleSelectOne = (id) => {
    setSelectedAttemptIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // dateFrom/dateTo đã ở dạng string 'YYYY-MM-DD' — khớp thẳng với value của <input type="date">
  const handleDateFrom = (e) => {
    const value = e.target.value
    setDateFrom(value)
    if (value && dateTo && value > dateTo) setDateTo('')
    setPage(1)
  }
  const handleDateTo = (e) => {
    setDateTo(e.target.value)
    setPage(1)
  }

  const handleExportExcel = async () => {
    if (selectedAttemptIds.length === 0) return

    setExporting(true)
    try {
      const params = {
        attemptIds: selectedAttemptIds
      }

      const response = await getAdminAttemptsExport(params)

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `attempts-selected-${selectedAttemptIds.length}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      let errMsg = 'Lỗi xuất file'
      if (err.response?.data) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text()
            const json = JSON.parse(text)
            errMsg = json.message || errMsg
          } catch {
            // ignore
          }
        } else if (err.response.data.message) {
          errMsg = err.response.data.message
        }
      }
      showToast(errMsg, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="p-6 w-full flex-1">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 w-full">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              Lịch sử bài thi
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {total} lượt
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý và tra cứu chi tiết các lượt làm bài thi của học viên
            </p>
          </div>

          {/* Action Header — Sắp xếp (đổi thứ tự hiển thị) + Download, tách khỏi vùng filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sắp xếp — server-side, áp dụng trên toàn bộ kết quả */}
            <div className="relative">
              <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortMode}
                onChange={e => { setSortMode(e.target.value); setPage(1) }}
                aria-label="Sắp xếp"
                className="h-10 pl-9 pr-9 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              >
                <option value="recent">Mới nhất</option>
                <option value="band_desc">Band cao nhất</option>
                <option value="band_asc">Band thấp nhất</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || selectedAttemptIds.length === 0}
              title={selectedAttemptIds.length === 0 ? 'Tích chọn ít nhất 1 bài thi để Download' : `Tải ${selectedAttemptIds.length} bài thi đã chọn`}
              className={`flex items-center gap-2 px-4 h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-normal transition shadow-xs ${
                selectedAttemptIds.length === 0 || exporting
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>
                {exporting
                  ? 'Đang xuất...'
                  : selectedAttemptIds.length > 0
                    ? `Download (${selectedAttemptIds.length})`
                    : 'Download'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Card — lưới 4 cột đồng nhất: mọi hàng phủ đủ chiều ngang, nút Đặt lại là ô cuối lưới */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

            {/* Tìm kiếm — 2/4 cột (rộng gấp đôi các ô còn lại) */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tìm kiếm</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email học viên..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            {/* Kỹ năng */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Kỹ năng</label>
              <div className="relative w-full">
                <select
                  value={skill}
                  onChange={e => { setSkill(e.target.value); setPage(1) }}
                  className="w-full h-10 pl-3 pr-9 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-normal bg-white appearance-none cursor-pointer"
                >
                  <option value="">Tất cả kỹ năng</option>
                  {Object.entries(SKILL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Bộ đề */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Bộ đề</label>
              <div className="relative w-full">
                <select
                  value={seriesId}
                  onChange={e => { setSeriesId(e.target.value); setPage(1) }}
                  className="w-full h-10 pl-3 pr-9 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-normal bg-white appearance-none cursor-pointer"
                >
                  <option value="">Tất cả bộ đề</option>
                  {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Khoảng ngày — 2/4 cột, thẳng hàng dưới ô Tìm kiếm */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Khoảng ngày</label>
              <div className="flex items-center border border-slate-200 rounded-lg h-10 bg-white w-full focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 transition">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={handleDateFrom}
                  max={todayStr}
                  aria-label="Từ ngày"
                  className="flex-1 min-w-0 h-full px-2.5 text-sm bg-transparent cursor-pointer text-slate-700 focus:outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <span className="text-xs text-slate-400 shrink-0">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={handleDateTo}
                  min={dateFrom || undefined}
                  max={todayStr}
                  aria-label="Đến ngày"
                  className="flex-1 min-w-0 h-full px-2.5 text-sm bg-transparent cursor-pointer text-slate-700 focus:outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            {/* Khoảng Band — cùng style với Khoảng ngày */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Khoảng Band</label>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 h-10 bg-white w-full focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 transition">
                <input
                  type="number" min="0" max="9" step="0.5" placeholder="Từ" value={scoreMin}
                  onChange={handleScoreMinChange} onBlur={handleScoreMinBlur}
                  className="w-full text-sm text-center font-normal text-slate-700 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-slate-400 shrink-0">–</span>
                <input
                  type="number" min="0" max="9" step="0.5" placeholder="Đến" value={scoreMax}
                  onChange={handleScoreMaxChange} onBlur={handleScoreMaxBlur}
                  className="w-full text-sm text-center font-normal text-slate-700 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Đặt lại — ô cuối lưới, lấp khoảng trống bên phải hàng 2 (filter tự áp dụng qua useEffect) */}
            <div>
              <button
                type="button"
                onClick={reset}
                className="w-full h-10 justify-center border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        {loading ? (
          <SkeletonTable rows={8} cols={7} />
        ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden w-full flex-1 shadow-xs">
          {attempts.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm font-medium">Không có lượt thi nào khớp bộ lọc</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 border-b border-slate-200">
                    <th className="px-4 py-3.5 text-center w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-5 py-3.5 text-left">Học viên</th>
                    <th className="px-4 py-3.5 text-left">Kỹ năng</th>
                    <th className="px-4 py-3.5 text-left">Đề thi</th>
                    <th className="px-4 py-3.5 text-left">Band Score</th>
                    <th className="px-4 py-3.5 text-left">Ngày làm bài</th>
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedAttempts.map(a => (
                    <tr key={a.id} className="odd:bg-slate-50/40 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selectedAttemptIds.includes(a.id)}
                          onChange={() => handleSelectOne(a.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800">{a.user?.name}</p>
                        <p className="text-xs text-slate-400">{a.user?.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: ADMIN_SKILL_COLORS[a.exam?.skill]?.bg,
                            color: ADMIN_SKILL_COLORS[a.exam?.skill]?.text
                          }}
                        >
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium max-w-[240px] truncate">{a.exam?.title}</td>
                      <td className="px-4 py-3.5">
                        {getBandPill(a.score)}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-500">
                        {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailAttempt(a)}
                          title="Xem tóm tắt lượt thi"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 transition shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50/30">
              <span className="text-xs font-medium text-slate-500">Trang {page} / {pages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {detailAttempt && (
        <AttemptDetailModal attempt={detailAttempt} onClose={() => setDetailAttempt(null)} />
      )}
    </>
  )
}

