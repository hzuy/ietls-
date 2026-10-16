import { useState, useEffect, useCallback } from 'react'
import {
  Flag,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  MapPin,
  User,
  X,
} from 'lucide-react'
import api from '../../utils/axios'
import { useToast } from '../../context/ToastContext'

const ISSUE_LABELS = {
  content_wrong: { label: 'Đề / đáp án sai', color: 'bg-red-50 text-red-700 border-red-200' },
  ui_bug: { label: 'Giao diện', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  lost_work: { label: 'Mất bài làm', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  slow_hang: { label: 'Tải chậm / Treo', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  other: { label: 'Khác', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
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
      const params = { page, limit: 15 }
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
              <Flag className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Phản hồi & Báo lỗi từ học viên</h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500">
            Theo dõi, phân loại và xử lý các phản hồi về câu hỏi, đề thi hoặc lỗi giao diện.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 px-2">
          <Filter className="w-3.5 h-3.5" /> Bộ lọc:
        </span>

        {/* Status filters */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
          {[
            { id: '', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ xử lý' },
            { id: 'resolved', label: 'Đã giải quyết' },
            { id: 'dismissed', label: 'Bỏ qua' },
          ].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setStatusFilter(s.id); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                statusFilter === s.id
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Skill filters */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
          {[
            { id: '', label: 'Mọi kỹ năng' },
            { id: 'reading', label: 'Reading' },
            { id: 'listening', label: 'Listening' },
          ].map(sk => (
            <button
              key={sk.id}
              type="button"
              onClick={() => { setSkillFilter(sk.id); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                skillFilter === sk.id
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {sk.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs font-medium text-zinc-400 tabular-nums px-2">
          Tổng cộng: <strong>{total}</strong> báo lỗi
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-zinc-200">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm text-zinc-500">Đang tải danh sách báo lỗi...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-dashed border-zinc-300">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-800 mb-1">Không có báo lỗi nào</h3>
          <p className="text-xs text-zinc-400">Tất cả các báo lỗi đã được xử lý hoặc không khớp bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const meta = ISSUE_LABELS[report.issueType] || ISSUE_LABELS.other
            const isResolved = report.status === 'resolved'
            const isDismissed = report.status === 'dismissed'
            const isBusy = updatingId === report.id

            return (
              <div
                key={report.id}
                className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-zinc-300 transition-all flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}>
                      {meta.label}
                    </span>

                    <span className="uppercase text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                      {report.skill}
                    </span>

                    <span className="text-xs text-zinc-400 tabular-nums">
                      {new Date(report.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  {/* Status pill */}
                  <div>
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã giải quyết
                      </span>
                    ) : isDismissed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
                        <XCircle className="w-3.5 h-3.5" /> Đã bỏ qua
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        <Clock className="w-3.5 h-3.5" /> Chờ xử lý
                      </span>
                    )}
                  </div>
                </div>

                {/* Location and User Info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 bg-zinc-50/80 p-3 rounded-xl border border-zinc-100">
                  {report.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      <strong className="text-zinc-800">{report.location}</strong>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Người gửi: </span>
                    <strong className="text-zinc-800">
                      {report.user ? `${report.user.name} (${report.user.email})` : 'Khách vãng lai'}
                    </strong>
                  </div>
                </div>

                {/* Description Body */}
                <div className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap bg-white p-1">
                  {report.description}
                </div>

                {/* Attached Screenshot */}
                {report.imageUrl && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(report.imageUrl)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 transition cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      Xem ảnh đính kèm
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2.5">
                  {!isResolved && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-zinc-600 border border-zinc-200 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Bỏ qua
                    </button>
                  )}

                  {(isResolved || isDismissed) && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(report.id, 'pending')}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
                    >
                      Mở lại
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-zinc-300 transition p-2 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Screenshot full"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
