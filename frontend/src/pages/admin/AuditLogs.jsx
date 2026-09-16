import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminAuditLogs, getAdminAuditLogFilters } from '../../services/adminService'
import { SkeletonTable } from '../../components/skeletons'
import Select from '../../components/admin/Select'
import { useDebounce } from '../../hooks/useDebounce'
import { AuditLogDetailModal, ENTITY_TYPE_LABEL, fmtDateTime } from '../../components/admin/AuditLogDetailModal'

import { Search, RotateCcw, Eye, ChevronLeft, ChevronRight, ScrollText, Bot, UserX, X } from 'lucide-react'

function ActorCell({ log }) {
  if (log.actorType === 'system') {
    return (
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-zinc-500" />
        </span>
        <div>
          <p className="font-medium text-zinc-900 text-xs">Hệ thống</p>
          <p className="text-[11px] text-zinc-500">Tác vụ tự động</p>
        </div>
      </div>
    )
  }

  const accountGone = log.actorUserId == null
  // actorDisplayName rơi về actorEmail khi tài khoản không còn (xem backend
  // formatLog) — tránh in trùng cùng 1 chuỗi ở cả 2 dòng trong trường hợp đó.
  const showEmailLine = log.actorEmail && log.actorEmail !== log.actorDisplayName
  return (
    <div>
      <p className="font-medium text-zinc-900 text-xs flex items-center gap-1.5">
        <span>{log.actorDisplayName || '—'}</span>
        {accountGone && (
          <span
            title="Tài khoản này không còn tồn tại"
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
          >
            <UserX className="w-3 h-3" />
            Đã xóa
          </span>
        )}
      </p>
      {showEmailLine && <p className="text-[11px] text-zinc-500">{log.actorEmail}</p>}
    </div>
  )
}

export default function AuditLogs() {
  // Đọc entityType/entityId ban đầu từ query string (vd link "Xem tất cả" từ
  // khối Lịch sử thay đổi ở trang sửa đề) — chỉ dùng để khởi tạo state lúc
  // mount, không đồng bộ 2 chiều: đổi filter trong trang này không đổi URL.
  const [searchParams] = useSearchParams()
  const initialEntityType = searchParams.get('entityType') || ''
  const initialEntityId = searchParams.get('entityId') || ''

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [actorUserId, setActorUserId] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState(initialEntityType)
  const [entityId, setEntityId] = useState(initialEntityId)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detailLog, setDetailLog] = useState(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: filters = {} } = useQuery({
    queryKey: ['admin', 'auditLogFilters'],
    queryFn: getAdminAuditLogFilters,
    staleTime: 1000 * 60 * 10,
  })
  const actors = filters.actors || []
  const actionOptions = filters.actions || []
  const entityTypes = filters.entityTypes || []

  const {
    data = {},
    isLoading: loading,
  } = useQuery({
    queryKey: ['admin', 'auditLogs', { page, limit: 20, search: debouncedSearch, actorUserId, action, entityType, entityId, dateFrom, dateTo }],
    queryFn: () => {
      const params = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (actorUserId) params.actorUserId = actorUserId
      if (action) params.action = action
      if (entityType) params.entityType = entityType
      if (entityId) params.entityId = entityId
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
      return getAdminAuditLogs(params)
    },
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  })

  const logs = data.logs || []
  const total = data.total || 0
  const pages = data.pages || 1
  const hasActiveFilters = !!(debouncedSearch || actorUserId || action || entityType || entityId || dateFrom || dateTo)

  const reset = () => {
    setSearch(''); setActorUserId(''); setAction(''); setEntityType(''); setEntityId(''); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const handleDateFrom = (e) => {
    const value = e.target.value
    setDateFrom(value)
    if (value && dateTo && value > dateTo) setDateTo('')
    setPage(1)
  }
  const handleDateTo = (e) => { setDateTo(e.target.value); setPage(1) }

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto w-full flex-1">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2.5">
            Nhật ký hoạt động
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
              {total} bản ghi
            </span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Theo dõi các thao tác quản trị đã thực hiện trong hệ thống
          </p>
        </div>

        {entityId && (
          <div className="mb-4 flex items-center gap-2 text-xs font-medium text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-full w-fit px-3 py-1.5">
            <span>Đang lọc theo {ENTITY_TYPE_LABEL[entityType] || entityType || 'đối tượng'} #{entityId}</span>
            <button
              type="button"
              onClick={() => setEntityId('')}
              aria-label="Bỏ lọc theo đối tượng"
              className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 sm:p-5 shadow-xs mb-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Tìm kiếm</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm theo tên đối tượng hoặc email người thực hiện..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="w-full h-9 pl-8 pr-3 text-xs border border-zinc-200 rounded-md text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition shadow-2xs bg-zinc-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Người thực hiện</label>
              <Select
                buttonClassName="bg-zinc-50"
                ariaLabel="Người thực hiện"
                value={actorUserId}
                onChange={v => { setActorUserId(v); setPage(1) }}
                options={[
                  { value: '', label: 'Tất cả người thực hiện' },
                  ...actors.map(a => ({ value: String(a.id), label: a.name || a.email })),
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Loại hành động</label>
              <Select
                buttonClassName="bg-zinc-50"
                ariaLabel="Loại hành động"
                value={action}
                onChange={v => { setAction(v); setPage(1) }}
                options={[
                  { value: '', label: 'Tất cả hành động' },
                  ...actionOptions.map(a => ({ value: a.value, label: a.label })),
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Nhóm đối tượng</label>
              <Select
                buttonClassName="bg-zinc-50"
                ariaLabel="Nhóm đối tượng"
                value={entityType}
                onChange={v => { setEntityType(v); setPage(1) }}
                options={[
                  { value: '', label: 'Tất cả nhóm đối tượng' },
                  ...entityTypes.map(t => ({ value: t, label: ENTITY_TYPE_LABEL[t] || t })),
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Khoảng ngày</label>
              <div className="flex items-center border border-zinc-200 rounded-md h-9 bg-zinc-50 w-full hover:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-200 focus-within:border-zinc-900 transition shadow-2xs">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={handleDateFrom}
                  max={todayStr}
                  aria-label="Từ ngày"
                  className="grouped-field flex-1 min-w-0 h-full px-2.5 text-xs bg-transparent cursor-pointer text-zinc-900 focus:outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit-month-field]:bg-transparent [&::-webkit-datetime-edit-day-field]:bg-transparent [&::-webkit-datetime-edit-year-field]:bg-transparent [&::-webkit-datetime-edit-month-field]:text-zinc-900 [&::-webkit-datetime-edit-day-field]:text-zinc-900 [&::-webkit-datetime-edit-year-field]:text-zinc-900"
                />
                <span className="text-xs text-zinc-400 shrink-0">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={handleDateTo}
                  min={dateFrom || undefined}
                  max={todayStr}
                  aria-label="Đến ngày"
                  className="grouped-field flex-1 min-w-0 h-full px-2.5 text-xs bg-transparent cursor-pointer text-zinc-900 focus:outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit-month-field]:bg-transparent [&::-webkit-datetime-edit-day-field]:bg-transparent [&::-webkit-datetime-edit-year-field]:bg-transparent [&::-webkit-datetime-edit-month-field]:text-zinc-900 [&::-webkit-datetime-edit-day-field]:text-zinc-900 [&::-webkit-datetime-edit-year-field]:text-zinc-900"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={reset}
                className="w-full h-9 justify-center border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:border-zinc-900 px-3.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : logs.length === 0 ? (
          hasActiveFilters ? (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden w-full flex-1 shadow-xs">
              <p className="text-center text-zinc-400 py-16 text-xs font-medium">Không có nhật ký nào khớp bộ lọc</p>
            </div>
          ) : (
            <div className="w-full min-h-[340px] flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white/50 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
                <ScrollText size={20} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-zinc-900">Chưa có nhật ký nào</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Nhật ký chỉ ghi nhận các thao tác được thực hiện từ khi tính năng này được triển khai — không có dữ liệu lịch sử trước đó.
              </p>
            </div>
          )
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden w-full flex-1 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                    <th className="px-5 py-3 text-left">Thời gian</th>
                    <th className="px-4 py-3 text-left">Người thực hiện</th>
                    <th className="px-4 py-3 text-left">Hành động</th>
                    <th className="px-4 py-3 text-left">Đối tượng</th>
                    <th className="px-4 py-3 text-right">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {logs.map(log => (
                    <tr key={log.id} className="odd:bg-zinc-50/40 hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3 text-[11px] text-zinc-600 font-mono whitespace-nowrap align-top">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ActorCell log={log} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {log.actionLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-zinc-700 font-medium text-xs max-w-[220px] truncate">{log.entityLabel || '—'}</p>
                        <p className="text-[11px] text-zinc-500">{ENTITY_TYPE_LABEL[log.entityType] || log.entityType}</p>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => setDetailLog(log)}
                          title="Xem chi tiết nhật ký"
                          className="h-8 px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
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

      {detailLog && (
        <AuditLogDetailModal log={detailLog} onClose={() => setDetailLog(null)} />
      )}
    </>
  )
}
