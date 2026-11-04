import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  MapPin,
  User,
  X,
} from 'lucide-react'
import api from '../../utils/axios'
import { useToast } from '../../context/ToastContext'
import Pagination from '../../components/admin/Pagination'
import { ADMIN_SKILL_COLORS, SKILL_LABEL } from '../../utils/adminSkillColors'

const PAGE_SIZE = 15

const ISSUE_LABELS = {
  content_wrong: { label: 'Đáp án sai', color: 'bg-red-50 text-red-700 border-red-200' },
  ui_bug: { label: 'Giao diện', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  lost_work: { label: 'Mất bài làm', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  slow_hang: { label: 'Tải chậm / Treo', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  other: { label: 'Khác', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
}

// Writing/Speaking trước đây không có trong bộ lọc dù học viên đã gửi được
// (WritingExam/SpeakingExam truyền skill tương ứng) → bổ sung cho đủ 4 kỹ năng.
// "Chung" đã bỏ khỏi bộ lọc vì trùng ý với "Tất cả" (báo lỗi general vẫn hiện
// badge "Chung" trong danh sách và vẫn xem được khi chọn "Tất cả").
const SKILL_OPTIONS = [
  { id: '', label: 'Tất cả' },
  { id: 'reading', label: SKILL_LABEL.reading },
  { id: 'listening', label: SKILL_LABEL.listening },
  { id: 'writing', label: SKILL_LABEL.writing },
  { id: 'speaking', label: SKILL_LABEL.speaking },
]

const STATUS_OPTIONS = [
  { id: '', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xử lý' },
  { id: 'resolved', label: 'Đã giải quyết' },
  { id: 'dismissed', label: 'Bỏ qua' },
]

const pillGroupCls = 'inline-flex flex-wrap items-center gap-0.5 bg-zinc-100 p-1 rounded-full'
const pillCls = (active) =>
  `h-7 px-3 rounded-full text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
    active ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
  }`

function SkillBadge({ skill }) {
  const meta = ADMIN_SKILL_COLORS[skill]
  const label = SKILL_LABEL[skill] || (skill === 'general' ? 'Chung' : skill)
  if (!label) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
        meta ? '' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
      }`}
      style={meta ? { background: meta.bg, color: meta.text, borderColor: `${meta.base}33` } : undefined}
    >
      {meta && <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.base }} aria-hidden="true" />}
      {label}
    </span>
  )
}

function StatusPill({ status }) {
  if (status === 'resolved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> Đã giải quyết
      </span>
    )
  }
  if (status === 'dismissed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 whitespace-nowrap">
        <XCircle className="w-3 h-3" /> Đã bỏ qua
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      <Clock className="w-3 h-3" /> Chờ xử lý
    </span>
  )
}

export default function ErrorReports() {
  const { showToast } = useToast()
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [skillFilter, setSkillFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedImage, setSelectedImage] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: PAGE_SIZE }
      if (statusFilter) params.status = statusFilter
      if (skillFilter) params.skill = skillFilter

      const res = await api.get('/reports/admin', { params })
      setReports(res.data?.reports || [])
      setTotal(res.data?.total || 0)
    } catch (err) {
      showToast('Không tải được danh sách báo lỗi', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, skillFilter, page, showToast])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleUpdateStatus = async (id, status, adminNote = null) => {
    setUpdatingId(id)
    try {
      await api.patch(`/reports/admin/${id}`, { status, adminNote })
      showToast(status === 'resolved' ? 'Đã đánh dấu xử lý xong' : 'Đã bỏ qua báo lỗi', 'success')
      fetchReports()
    } catch (err) {
      showToast('Không cập nhật được trạng thái', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2.5 whitespace-nowrap">
            Báo lỗi đề thi
            {total > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                {total} báo lỗi
              </span>
            )}
          </h1>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="self-start sm:self-auto h-9 px-4 whitespace-nowrap rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium inline-flex items-center gap-2 shadow-2xs transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 shadow-xs mb-6">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="flex flex-col gap-2">
            <span className="pl-1 text-[11px] font-medium text-zinc-500 leading-4">Trạng thái</span>
            <div className={pillGroupCls + ' max-w-full'}>
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.id || 'all'}
                  type="button"
                  onClick={() => { setStatusFilter(s.id); setPage(1) }}
                  aria-pressed={statusFilter === s.id}
                  className={pillCls(statusFilter === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="pl-1 text-[11px] font-medium text-zinc-500 leading-4">Kỹ năng</span>
            <div className={pillGroupCls + ' max-w-full'}>
              {SKILL_OPTIONS.map(sk => (
                <button
                  key={sk.id || 'all-skills'}
                  type="button"
                  onClick={() => { setSkillFilter(sk.id); setPage(1) }}
                  aria-pressed={skillFilter === sk.id}
                  className={pillCls(skillFilter === sk.id)}
                >
                  {sk.label}
                </button>
              ))}
            </div>
          </div>

          <span className="ml-auto self-end pb-2 text-xs font-medium text-zinc-400 tabular-nums">
            Tổng cộng: <strong className="text-zinc-600">{total}</strong> báo lỗi
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-zinc-200">
          <Loader2 className="w-7 h-7 text-zinc-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-500">Đang tải danh sách báo lỗi...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
            <CheckCircle2 size={20} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-zinc-900">Không có báo lỗi nào</p>
          <p className="text-xs text-zinc-500 mt-1">Tất cả báo lỗi đã được xử lý hoặc không khớp bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const meta = ISSUE_LABELS[report.issueType] || ISSUE_LABELS.other
            const isResolved = report.status === 'resolved'
            const isDismissed = report.status === 'dismissed'
            const isBusy = updatingId === report.id

            return (
              <article
                key={report.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-zinc-300 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${meta.color}`}>
                      {meta.label}
                    </span>
                    <SkillBadge skill={report.skill} />
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {new Date(report.createdAt).toLocaleString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <StatusPill status={report.status} />
                </div>

                {/* Vị trí + người gửi */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2">
                  {report.location && (
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-zinc-800 font-medium truncate">{report.location}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">
                      {report.user ? `${report.user.name} (${report.user.email})` : 'Khách vãng lai'}
                    </span>
                  </span>
                </div>

                <p className="mt-3 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap break-words">
                  {report.description}
                </p>

                {report.adminNote && (
                  <p className="mt-2 text-xs text-zinc-500 italic">Ghi chú xử lý: {report.adminNote}</p>
                )}

                {report.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedImage(report.imageUrl)}
                    className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition shadow-2xs cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                    Xem ảnh đính kèm
                  </button>
                )}

                <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-end gap-2">
                  {!isResolved && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                      className="h-8 px-3.5 rounded-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer whitespace-nowrap"
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Đánh dấu đã sửa
                    </button>
                  )}

                  {!isDismissed && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                      className="h-8 px-3.5 rounded-full text-xs font-medium text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 transition shadow-2xs disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer whitespace-nowrap"
                    >
                      Bỏ qua
                    </button>
                  )}

                  {(isResolved || isDismissed) && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(report.id, 'pending')}
                      className="h-8 px-3 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer whitespace-nowrap"
                    >
                      Mở lại
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Pagination — trước đây chỉ tải 15 báo lỗi đầu tiên và không có cách xem tiếp */}
      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <Pagination
            page={page}
            pages={pages}
            onChange={setPage}
            disabled={loading}
            summary={`${total} báo lỗi · Trang ${page} / ${pages}`}
          />
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Ảnh đính kèm báo lỗi"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-zinc-300 transition p-2 cursor-pointer"
              aria-label="Đóng ảnh"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Ảnh đính kèm báo lỗi"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
