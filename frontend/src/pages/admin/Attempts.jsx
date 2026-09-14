import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-900 font-medium text-right">{children}</dd>
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
    <Modal onClose={onClose} title={`Chi tiết lượt thi #${a.id}`} size="md" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-slate-100">Chi tiết lượt thi</h2>
        <button onClick={onClose} aria-label="Đóng"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-slate-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-slate-200 font-bold transition-colors cursor-pointer">✕</button>
      </div>

      <div className="p-5 space-y-4 text-xs">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-slate-100 text-xs">{a.user?.name || '—'}</p>
          <p className="text-[11px] text-zinc-500 dark:text-slate-400">{a.user?.email || ''}</p>
        </div>

        <dl className="space-y-2.5 pt-3 border-t border-zinc-100 dark:border-slate-800">
          <DetailRow label="Kỹ năng">{SKILL_LABEL[a.exam?.skill] || a.exam?.skill || '—'}</DetailRow>
          <DetailRow label="Đề thi">{a.exam?.title || '—'}</DetailRow>
          <DetailRow label="Band">{getBandPill(a.score)}</DetailRow>
          <DetailRow label="Ngày làm bài">{fmtDateTime(a.createdAt)}</DetailRow>
          {showFinished && (
            <>
              <DetailRow label="Hoàn thành lúc">{fmtDateTime(a.finishedAt)}</DetailRow>
              <DetailRow label="Thời gian làm bài">{Math.round(durationMs / 60_000)} phút</DetailRow>
            </>
          )}
        </dl>

        {criteria && (
          <div className="pt-3 border-t border-zinc-100 dark:border-slate-800 space-y-2">
            <p className="font-semibold text-zinc-700 dark:text-slate-300 text-xs">Điểm từng tiêu chí AI</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(criteria).map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-zinc-50 dark:bg-slate-800/60 border border-zinc-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-slate-400 text-[11px]">{CRITERION_LABEL[k] || k}</span>
                  <span className="font-semibold text-zinc-900 dark:text-slate-100 font-mono text-[11px]">
                    {typeof v === 'number' ? v.toFixed(1) : v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(a.exam?.skill === 'writing' || a.exam?.skill === 'speaking') && !criteria && a.score == null && (
          <p className="text-[11px] text-zinc-400 dark:text-slate-500 italic pt-2">Đề đang được AI chấm — chưa có điểm chi tiết.</p>
        )}
      </div>
    </Modal>
  )
}

function getBandPill(score) {
  if (score == null) return <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-400 border border-zinc-200">Đang chấm</span>
  return <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">BAND {score.toFixed(1)}</span>
}

export default function Attempts() {
  const { showToast } = useToast()
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
  const [seriesId, setSeriesId] = useState('')
  const [exporting, setExporting] = useState(false)
  const [detailAttempt, setDetailAttempt] = useState(null)
  const navigate = useNavigate()

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: examSeries = [] } = useQuery({
    queryKey: ['admin', 'examSeriesFilter'],
    queryFn: getAdminExamSeriesForFilter,
    staleTime: 1000 * 60 * 10,
  })

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

  const {
    data = {},
    isLoading: loading,
  } = useQuery({
    queryKey: ['admin', 'attempts', {
      page, limit: 20, search: debouncedSearch, skill, seriesId,
      sortMode, scoreMin, scoreMax, dateFrom, dateTo,
    }],
    queryFn: async () => {
      const params = { page, limit: 20, search: debouncedSearch, skill, seriesId }
      if (sortMode === 'band_desc') { params.sortBy = 'score'; params.sortOrder = 'desc' }
      else if (sortMode === 'band_asc') { params.sortBy = 'score'; params.sortOrder = 'asc' }

      const validMin = scoreMin !== '' && !isNaN(parseFloat(scoreMin)) && parseFloat(scoreMin) >= 0 && parseFloat(scoreMin) <= 9 ? (Math.round(parseFloat(scoreMin) * 2) / 2) : undefined
      const validMax = scoreMax !== '' && !isNaN(parseFloat(scoreMax)) && parseFloat(scoreMax) >= 0 && parseFloat(scoreMax) <= 9 ? (Math.round(parseFloat(scoreMax) * 2) / 2) : undefined

      if (validMin !== undefined) params.scoreMin = validMin
      if (validMax !== undefined) params.scoreMax = validMax
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo)   params.dateTo = dateTo

      try {
        return await getAdminAttempts(params)
      } catch (err) {
        if (err.response?.status === 403) navigate('/')
        throw err
      }
    },
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  })

  const attempts = data.attempts || []
  const total = data.total || 0
  const pages = data.pages || 1

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
      <div className="p-6 max-w-6xl mx-auto w-full flex-1">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 w-full">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2.5">
              Lịch sử bài thi
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                {total} lượt
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Quản lý và tra cứu chi tiết các lượt làm bài thi của học viên
            </p>
          </div>

          {/* Action Header — Sắp xếp (đổi thứ tự hiển thị) + Download, tách khỏi vùng filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sắp xếp — server-side, áp dụng trên toàn bộ kết quả */}
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortMode}
                onChange={e => { setSortMode(e.target.value); setPage(1) }}
                aria-label="Sắp xếp"
                className="h-9 pl-8 pr-8 text-xs border border-zinc-200 rounded-lg text-zinc-700 bg-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition shadow-2xs"
              >
                <option value="recent">Mới nhất</option>
                <option value="band_desc">Band cao nhất</option>
                <option value="band_asc">Band thấp nhất</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || selectedAttemptIds.length === 0}
              title={selectedAttemptIds.length === 0 ? 'Tích chọn ít nhất 1 bài thi để Download' : `Tải ${selectedAttemptIds.length} bài thi đã chọn`}
              className={`flex items-center gap-2 px-3.5 h-9 rounded-md border border-zinc-200 bg-white text-zinc-700 text-xs font-medium transition shadow-2xs ${
                selectedAttemptIds.length === 0 || exporting
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer hover:bg-zinc-50 hover:border-zinc-300'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
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
        <div className="bg-white rounded-xl border border-zinc-200 p-4 sm:p-5 shadow-xs mb-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

            {/* Tìm kiếm — 2/4 cột (rộng gấp đôi các ô còn lại) */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Tìm kiếm</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email học viên..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="w-full h-9 pl-8 pr-3 text-xs border border-zinc-200 rounded-md text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition shadow-2xs bg-zinc-50"
                />
              </div>
            </div>

            {/* Kỹ năng */}
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Kỹ năng</label>
              <div className="relative w-full">
                <select
                  value={skill}
                  onChange={e => { setSkill(e.target.value); setPage(1) }}
                  className="w-full h-9 pl-3 pr-8 text-xs border border-zinc-200 rounded-md text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition font-normal bg-zinc-50 appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="">Tất cả kỹ năng</option>
                  {Object.entries(SKILL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Bộ đề */}
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Bộ đề</label>
              <div className="relative w-full">
                <select
                  value={seriesId}
                  onChange={e => { setSeriesId(e.target.value); setPage(1) }}
                  className="w-full h-9 pl-3 pr-8 text-xs border border-zinc-200 rounded-md text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition font-normal bg-zinc-50 appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="">Tất cả bộ đề</option>
                  {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Khoảng ngày — 2/4 cột, thẳng hàng dưới ô Tìm kiếm */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Khoảng ngày</label>
              <div className="flex items-center border border-zinc-200 rounded-md h-9 bg-zinc-50 w-full focus-within:ring-1 focus-within:ring-zinc-900 focus-within:border-zinc-900 transition shadow-2xs">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={handleDateFrom}
                  max={todayStr}
                  aria-label="Từ ngày"
                  className="flex-1 min-w-0 h-full px-2.5 text-xs bg-transparent cursor-pointer text-zinc-900 focus:outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <span className="text-xs text-zinc-400 shrink-0">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={handleDateTo}
                  min={dateFrom || undefined}
                  max={todayStr}
                  aria-label="Đến ngày"
                  className="flex-1 min-w-0 h-full px-2.5 text-xs bg-transparent cursor-pointer text-zinc-900 focus:outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            {/* Khoảng Band — cùng style với Khoảng ngày */}
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Khoảng Band</label>
              <div className="flex items-center gap-2 border border-zinc-200 rounded-md px-3 h-9 bg-zinc-50 w-full focus-within:ring-1 focus-within:ring-zinc-900 focus-within:border-zinc-900 transition shadow-2xs">
                <input
                  type="number" min="0" max="9" step="0.5" placeholder="Từ" value={scoreMin}
                  onChange={handleScoreMinChange} onBlur={handleScoreMinBlur}
                  className="w-full text-xs text-center font-normal text-zinc-900 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-zinc-400"
                />
                <span className="text-xs text-zinc-400 shrink-0">–</span>
                <input
                  type="number" min="0" max="9" step="0.5" placeholder="Đến" value={scoreMax}
                  onChange={handleScoreMaxChange} onBlur={handleScoreMaxBlur}
                  className="w-full text-xs text-center font-normal text-zinc-900 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* Đặt lại — ô cuối lưới, lấp khoảng trống bên phải hàng 2 (filter tự áp dụng qua useEffect) */}
            <div>
              <button
                type="button"
                onClick={reset}
                className="w-full h-9 justify-center border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 px-3.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        {loading ? (
          <SkeletonTable rows={8} cols={7} />
        ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden w-full flex-1 shadow-xs">
          {attempts.length === 0 ? (
            <p className="text-center text-zinc-400 py-16 text-xs font-medium">Không có lượt thi nào khớp bộ lọc</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                    <th className="px-4 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer accent-zinc-900"
                      />
                    </th>
                    <th className="px-5 py-3 text-left">Học viên</th>
                    <th className="px-4 py-3 text-left">Kỹ năng</th>
                    <th className="px-4 py-3 text-left">Đề thi</th>
                    <th className="px-4 py-3 text-left">Band Score</th>
                    <th className="px-4 py-3 text-left">Ngày làm bài</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {displayedAttempts.map(a => (
                    <tr key={a.id} className="odd:bg-zinc-50/40 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selectedAttemptIds.includes(a.id)}
                          onChange={() => handleSelectOne(a.id)}
                          className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer accent-zinc-900"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 text-xs">{a.user?.name}</p>
                        <p className="text-[11px] text-zinc-500">{a.user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200"
                        >
                          {SKILL_LABEL[a.exam?.skill]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 font-medium max-w-[240px] truncate text-xs">{a.exam?.title}</td>
                      <td className="px-4 py-3">
                        {getBandPill(a.score)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-zinc-600 font-mono">
                        {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailAttempt(a)}
                          title="Xem tóm tắt lượt thi"
                          className="h-8 px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
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
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200 bg-zinc-50/50">
              <span className="text-xs font-medium text-zinc-500">Trang {page} / {pages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition cursor-pointer flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition cursor-pointer flex items-center justify-center"
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

