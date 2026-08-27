import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminUsers, toggleUserLock, deleteAdminUser } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'
import { Pencil, Lock, Unlock, Trash2, SearchX } from 'lucide-react'

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

const AVATAR_COLORS = [
  'bg-[#1D4ED8]', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-600',
]

// Hash user id to a fixed colour index — same user always gets same colour
function avatarColorIdx(id) {
  return Math.abs(typeof id === 'number' ? id : String(id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % AVATAR_COLORS.length
}

export default function Users() {
  const [users, setUsers]           = useState([])
  const [total, setTotal]           = useState(0)
  const [totalActive, setTotalActive] = useState(0)
  const [totalLocked, setTotalLocked] = useState(0)
  const [pages, setPages]           = useState(1)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const debouncedSearch             = useDebounce(search, 400)
  const [loading, setLoading]       = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name, isLocked }
  const [confirmLock, setConfirmLock]     = useState(null) // { id, name }
  const [confirmUnlock, setConfirmUnlock] = useState(null) // { id, name }

  // Client-side filters (không đổi API call)
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy]             = useState('newest')

  const navigate = useNavigate()

  const fetchUsers = useCallback(() => {
    setLoading(true)
    getAdminUsers({ search: debouncedSearch, page, limit: 10, status: statusFilter, sort: sortBy })
      .then(data => {
        setUsers(data.users)
        setTotal(data.total)
        setPages(data.pages)
        if (data.totalActive != null) setTotalActive(data.totalActive)
        if (data.totalLocked != null) setTotalLocked(data.totalLocked)
      })
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [debouncedSearch, page, statusFilter, sortBy])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // wasLocked: true = user was locked before toggle (→ unlocking), false = was active (→ locking)
  const executeLock = async (userId, wasLocked) => {
    setConfirmLock(null)
    setConfirmUnlock(null)
    setTogglingId(userId)
    try {
      const data = await toggleUserLock(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isLocked: data.isLocked } : u))
      // Optimistic stats update — no API refetch
      if (wasLocked) {
        setTotalActive(a => a + 1)
        setTotalLocked(l => l - 1)
      } else {
        setTotalActive(a => a - 1)
        setTotalLocked(l => l + 1)
      }
    } catch { alert('Lỗi thao tác') }
    finally { setTogglingId(null) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    const { id, isLocked } = confirmDelete
    try {
      await deleteAdminUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      setTotal(t => t - 1)
      if (isLocked) setTotalLocked(l => l - 1)
      else setTotalActive(a => a - 1)
      setConfirmDelete(null)
    } catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  // Stats từ DB (toàn hệ thống, không phụ thuộc trang hiện tại)
  const activeCount = totalActive
  const lockedCount = totalLocked

  const startIdx = (page - 1) * 10 + 1
  const endIdx   = Math.min(page * 10, total)

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* ── Topbar ─────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">
            Người dùng{' '}
            <span className="text-base font-normal text-gray-400">({total} người)</span>
          </h1>
        </div>

        {/* ── Stats row ──────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="text-2xl font-bold text-[#1D4ED8]">{total}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">Tổng người dùng</div>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">Đang hoạt động</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-red-100">
            <div className="text-2xl font-bold text-red-500">{lockedCount}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">Bị khóa</div>
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Tìm tên / email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-[220px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8]"
            />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8]">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="locked">Không hoạt động</option>
            </select>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8]">
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="az">A → Z</option>
              <option value="band">Band cao nhất</option>
            </select>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            search || statusFilter ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <SearchX size={36} className="text-gray-300" />
                <p className="text-sm font-medium text-gray-500">Không tìm thấy người dùng phù hợp</p>
                <p className="text-xs text-gray-400">Thử thay đổi từ khoá hoặc bộ lọc</p>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-12 text-sm">Không có người dùng nào</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">Người dùng</th>
                    <th className="px-4 py-3 text-left font-medium">Vai trò</th>
                    <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Lượt thi</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Band TB</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Ngày tham gia</th>
                    <th className="px-4 py-3 text-left font-medium">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => {
                    const band = roundIELTS(u.avgScore)
                    return (
                      <tr
                        key={u.id}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                        className={`border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>

                        {/* Người dùng */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${AVATAR_COLORS[avatarColorIdx(u.id)]} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                              {avatarInitials(u.name)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{u.name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Vai trò */}
                        <td className="px-4 py-3">
                          {u.role === 'admin'
                            ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Admin</span>
                            : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">User</span>
                          }
                        </td>

                        {/* Trạng thái */}
                        <td className="px-4 py-3">
                          {u.isLocked
                            ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">Không HĐ</span>
                            : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Hoạt động</span>
                          }
                        </td>

                        {/* Lượt thi */}
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700 font-medium hidden sm:table-cell">
                          {u._count?.attempts ?? 0}
                        </td>

                        {/* Band TB */}
                        <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                          {band != null
                            ? <span className={`font-bold ${band >= 7 ? 'text-green-600' : band >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {band.toFixed(1)}
                              </span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>

                        {/* Ngày tham gia */}
                        <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                          {fmtDate(u.createdAt)}
                        </td>

                        {/* Hành động */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => navigate(`/admin/users/${u.id}`)}
                              title="Xem / Sửa"
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition">
                              <Pencil size={15} />
                            </button>
                            {u.isLocked ? (
                              <button
                                onClick={() => setConfirmUnlock({ id: u.id, name: u.name })}
                                disabled={togglingId === u.id}
                                title="Mở khoá"
                                className="p-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition">
                                <Unlock size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmLock({ id: u.id, name: u.name })}
                                disabled={togglingId === u.id}
                                title="Khoá tài khoản"
                                className="p-1.5 rounded-lg border border-orange-200 text-orange-500 hover:bg-orange-50 transition">
                                <Lock size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete({ id: u.id, name: u.name, isLocked: u.isLocked })}
                              title="Xoá tài khoản"
                              className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
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
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Hiển thị {startIdx}–{endIdx} / {total} người dùng
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  ←
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  {page} / {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Lock confirmation modal ────────────────────── */}
      {confirmLock && (
        <div
          onClick={() => setConfirmLock(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Khoá tài khoản</h3>
            <p className="text-sm text-gray-600 mb-6">
              Khoá tài khoản <strong>{confirmLock.name}</strong>? User sẽ không thể đăng nhập cho đến khi được mở khoá.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmLock(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Huỷ
              </button>
              <button
                onClick={() => executeLock(confirmLock.id, false)}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition">
                Khoá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlock confirmation modal ──────────────────── */}
      {confirmUnlock && (
        <div
          onClick={() => setConfirmUnlock(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Mở khoá tài khoản</h3>
            <p className="text-sm text-gray-600 mb-6">
              Mở khoá tài khoản <strong>{confirmUnlock.name}</strong>? User sẽ có thể đăng nhập trở lại.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmUnlock(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Huỷ
              </button>
              <button
                onClick={() => executeLock(confirmUnlock.id, true)}
                className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition">
                Mở khoá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ───────────────────────────────── */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 mb-6">
              Xóa người dùng <strong>{confirmDelete.name}</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Huỷ
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
