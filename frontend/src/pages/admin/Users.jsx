import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminUsers, toggleUserLock, deleteAdminUser } from '../../services/adminService'
import { useToast } from '../../context/ToastContext'
import { SkeletonTable } from '../../components/skeletons'
import { Pencil, Lock, Unlock, Trash2, SearchX } from 'lucide-react'
import Modal from '../../components/common/Modal'
import Select from '../../components/admin/Select'

import { roundIELTS } from '../../utils/ielts'

import { useDebounce } from '../../hooks/useDebounce'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
}

function avatarInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}



export default function Users() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const debouncedSearch             = useDebounce(search, 400)
  const [togglingId, setTogglingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name, isLocked }
  const [confirmLock, setConfirmLock]     = useState(null) // { id, name }
  const [confirmUnlock, setConfirmUnlock] = useState(null) // { id, name }

  // Client-side filters (không đổi API call)
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy]             = useState('newest')

  const navigate = useNavigate()

  const {
    data,
    isPending,
  } = useQuery({
    queryKey: ['admin', 'users', { search: debouncedSearch, page, limit: 10, status: statusFilter, sort: sortBy }],
    queryFn: async () => {
      try {
        return await getAdminUsers({ search: debouncedSearch, page, limit: 10, status: statusFilter, sort: sortBy })
      } catch (err) {
        if (err.response?.status === 403) navigate('/')
        throw err
      }
    },
    staleTime: 1000 * 60 * 5, // Fresh 5 phút
    gcTime: 1000 * 60 * 30,    // Cache trong RAM 30 phút
    placeholderData: (prev) => prev, // Giữ nguyên danh sách cũ khi đổi trang/filter, không chớp trắng
  })

  const users = data?.users || []
  const total = data?.total || 0
  const pages = data?.pages || 1
  const totalActive = data?.totalActive || 0
  const totalLocked = data?.totalLocked || 0

  const lockMutation = useMutation({
    mutationFn: (userId) => toggleUserLock(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] })
    },
    onError: () => {
      showToast('Lỗi thao tác', 'error')
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] })
      setConfirmDelete(null)
      showToast('Đã xoá người dùng', 'success')
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Lỗi xóa', 'error')
    },
  })

  // wasLocked: true = user was locked before toggle (→ unlocking), false = was active (→ locking)
  const executeLock = (userId) => {
    if (lockMutation.isPending) return
    setConfirmLock(null)
    setConfirmUnlock(null)
    setTogglingId(userId)
    lockMutation.mutate(userId)
  }

  const handleDelete = () => {
    if (!confirmDelete || deleteMutation.isPending) return
    deleteMutation.mutate(confirmDelete.id)
  }

  // Stats từ DB (toàn hệ thống, không phụ thuộc trang hiện tại)
  const activeCount = totalActive
  const lockedCount = totalLocked

  const startIdx = (page - 1) * 10 + 1
  const endIdx   = Math.min(page * 10, total)

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">

        {/* ── Topbar ─────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-baseline gap-2">
            Người dùng
            <span className="text-xs font-normal text-zinc-500">
              {isPending && !data ? '' : `(${total} người)`}
            </span>
          </h1>
        </div>

        {/* ── Stats row ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-zinc-900">
              {isPending && !data ? <span className="inline-block w-12 h-7 bg-zinc-100 rounded animate-pulse" /> : total}
            </div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">Tổng người dùng</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-zinc-900">
              {isPending && !data ? <span className="inline-block w-12 h-7 bg-zinc-100 rounded animate-pulse" /> : activeCount}
            </div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">Đang hoạt động</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs">
            <div className="text-2xl font-bold tabular-nums text-zinc-900">
              {isPending && !data ? <span className="inline-block w-12 h-7 bg-zinc-100 rounded animate-pulse" /> : lockedCount}
            </div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">Bị khóa</div>
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 mb-4 shadow-xs">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Tìm tên / email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-[220px] px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white text-zinc-900 placeholder:text-zinc-400"
            />
            <Select
              className="w-[168px]"
              ariaLabel="Lọc theo trạng thái"
              value={statusFilter}
              onChange={v => { setStatusFilter(v); setPage(1) }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'active', label: 'Hoạt động' },
                { value: 'locked', label: 'Không hoạt động' },
              ]}
            />
            <Select
              className="w-[152px]"
              ariaLabel="Sắp xếp"
              value={sortBy}
              onChange={v => { setSortBy(v); setPage(1) }}
              options={[
                { value: 'newest', label: 'Mới nhất' },
                { value: 'oldest', label: 'Cũ nhất' },
                { value: 'az', label: 'A → Z' },
                { value: 'band', label: 'Band cao nhất' },
              ]}
            />
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          {isPending && !data ? (
            <SkeletonTable rows={8} cols={6} />
          ) : users.length === 0 ? (
            search || statusFilter ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <SearchX size={36} className="text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">Không tìm thấy người dùng phù hợp</p>
                <p className="text-xs text-zinc-400">Thử thay đổi từ khoá hoặc bộ lọc</p>
              </div>
            ) : (
              <p className="text-center text-zinc-400 py-12 text-sm">Không có người dùng nào</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                    <th className="px-5 py-3 text-left font-medium">Người dùng</th>
                    <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Lượt thi</th>
                    <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Band TB</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Ngày tham gia</th>
                    <th className="px-5 py-3 text-right font-medium text-[11px] uppercase tracking-wider text-zinc-500">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => {
                    const band = roundIELTS(u.avgScore)
                    return (
                      <tr
                        key={u.id}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                        className={`border-b border-zinc-100 hover:bg-zinc-50 transition cursor-pointer ${idx % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>

                        {/* Người dùng */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {avatarInitials(u.name)}
                            </div>
                            <div>
                              <p className="font-medium text-zinc-900 text-xs">{u.name}</p>
                              <p className="text-[11px] text-zinc-500">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td className="px-4 py-3">
                          {u.isLocked
                            ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 border border-red-500/20">Không HĐ</span>
                            : <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Hoạt động</span>
                          }
                        </td>

                        {/* Lượt thi */}
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-700 font-medium hidden sm:table-cell">
                          {u._count?.attempts ?? 0}
                        </td>

                        {/* Band TB */}
                        <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                          {band != null
                            ? <span className="font-semibold text-zinc-900">
                                {band.toFixed(1)}
                              </span>
                            : <span className="text-zinc-300">—</span>
                          }
                        </td>

                        {/* Ngày tham gia */}
                        <td className="px-4 py-3 text-[11px] text-zinc-500 hidden lg:table-cell">
                          {fmtDate(u.createdAt)}
                        </td>

                        {/* Hành động */}
                        <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admin/users/${u.id}`)}
                              title="Xem / Sửa"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer">
                              <Pencil size={15} />
                            </button>
                            {u.isLocked ? (
                              <button
                                onClick={() => setConfirmUnlock({ id: u.id, name: u.name })}
                                disabled={togglingId === u.id}
                                title="Mở khoá"
                                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer">
                                <Unlock size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmLock({ id: u.id, name: u.name })}
                                disabled={togglingId === u.id}
                                title="Khoá tài khoản"
                                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer">
                                <Lock size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete({ id: u.id, name: u.name, isLocked: u.isLocked })}
                              title="Xoá tài khoản"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100">
              <span className="text-xs text-zinc-500">
                Hiển thị {startIdx}–{endIdx} / {total} người dùng
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 font-medium transition shadow-2xs">
                  ←
                </button>
                <span className="text-xs text-zinc-600 font-semibold">
                  {page} / {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 font-medium transition shadow-2xs">
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Lock confirmation modal ────────────────────── */}
      {confirmLock && (
        <Modal onClose={() => setConfirmLock(null)} title="Khoá tài khoản" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Khoá tài khoản</h3>
          <p className="text-xs text-zinc-600 mb-6">
            Khoá tài khoản <strong>{confirmLock.name}</strong>? User sẽ không thể đăng nhập cho đến khi được mở khoá.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button
              onClick={() => setConfirmLock(null)}
              disabled={lockMutation.isPending}
              className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              Huỷ
            </button>
            <button
              onClick={() => executeLock(confirmLock.id, false)}
              disabled={lockMutation.isPending}
              className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {lockMutation.isPending && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {lockMutation.isPending ? 'Đang xử lý...' : 'Khoá'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Unlock confirmation modal ──────────────────── */}
      {confirmUnlock && (
        <Modal onClose={() => setConfirmUnlock(null)} title="Mở khoá tài khoản" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Mở khoá tài khoản</h3>
          <p className="text-xs text-zinc-600 mb-6">
            Mở khoá tài khoản <strong>{confirmUnlock.name}</strong>? User sẽ có thể đăng nhập trở lại.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button
              onClick={() => setConfirmUnlock(null)}
              disabled={lockMutation.isPending}
              className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              Huỷ
            </button>
            <button
              onClick={() => executeLock(confirmUnlock.id, true)}
              disabled={lockMutation.isPending}
              className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {lockMutation.isPending && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {lockMutation.isPending ? 'Đang xử lý...' : 'Mở khoá'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete modal ───────────────────────────────── */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} title="Xác nhận xóa" size="sm" className="p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Xác nhận xóa</h3>
          <p className="text-xs text-zinc-600 mb-6">
            Xóa người dùng <strong>{confirmDelete.name}</strong>? Hành động này không thể hoàn tác.
          </p>
          <div className="flex gap-2.5 justify-end">
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
              className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              Huỷ
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="h-9 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {deleteMutation.isPending && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
