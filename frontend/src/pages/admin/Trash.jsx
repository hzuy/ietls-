import { useState, useEffect } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { getAdminTrash, restoreTrashItem, permanentDeleteTrashItem, purgeTrash } from '../../services/adminService'

const TYPE_LABEL = {
  reading_practice:   'Reading Practice',
  listening_practice: 'Listening Practice',
  writing_sample:     'Writing Sample',
  speaking_sample:    'Speaking Sample',
  exam_reading:       'Reading',
  exam_listening:     'Listening',
  exam_writing:       'Writing',
  exam_speaking:      'Speaking',
  exam_series:        'Bộ đề',
  book:               'Cuốn sách',
  series:             'Full-test Series',
}

const TYPE_COLOR = {
  reading_practice:   'bg-blue-50 text-blue-600',
  listening_practice: 'bg-green-50 text-green-600',
  writing_sample:     'bg-purple-50 text-purple-600',
  speaking_sample:    'bg-orange-50 text-orange-600',
  exam_reading:       'bg-sky-50 text-sky-600',
  exam_listening:     'bg-teal-50 text-teal-600',
  exam_writing:       'bg-violet-50 text-violet-600',
  exam_speaking:      'bg-amber-50 text-amber-600',
  exam_series:        'bg-gray-100 text-gray-700',
  book:               'bg-slate-50 text-slate-600',
  series:             'bg-indigo-50 text-indigo-600',
}

const TABS = [
  { key: 'all',                label: 'Tất cả' },
  { key: 'reading_practice',   label: 'Reading Practice' },
  { key: 'listening_practice', label: 'Listening Practice' },
  { key: 'writing_sample',     label: 'Writing Samples' },
  { key: 'speaking_sample',    label: 'Speaking Samples' },
  { key: 'exam_reading',       label: 'Reading' },
  { key: 'exam_listening',     label: 'Listening' },
  { key: 'exam_writing',       label: 'Writing' },
  { key: 'exam_speaking',      label: 'Speaking' },
  { key: 'exam_series',        label: 'Bộ đề' },
  { key: 'book',               label: 'Cuốn sách' },
  { key: 'series',             label: 'Full-test Series' },
]

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const resolveImg = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

export default function Trash() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [confirming, setConfirming] = useState(null) // { id, type, title, action }
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setItems(await getAdminTrash()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = tab === 'all' ? items : items.filter(i => i.type === tab)

  const handleRestore = async (item) => {
    setBusy(true)
    try {
      await restoreTrashItem(item.type, item.id)
      setConfirming(null)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi khôi phục') }
    setBusy(false)
  }

  const handleDelete = async (item) => {
    setBusy(true)
    try {
      await permanentDeleteTrashItem(item.type, item.id)
      setConfirming(null)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
    setBusy(false)
  }

  const handlePurge = async () => {
    setBusy(true)
    try {
      await purgeTrash()
      setPurgeConfirm(false)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi dọn rác') }
    setBusy(false)
  }

  // Count per tab
  const countByType = {}
  for (const item of items) countByType[item.type] = (countByType[item.type] || 0) + 1

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">🗑️ Thùng rác</h1>
            <p className="text-sm text-gray-500 mt-0.5">Các mục đã xóa — tự động xóa vĩnh viễn sau 30 ngày</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setPurgeConfirm(true)}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
            >
              Dọn sạch thùng rác
            </button>
          )}
        </div>

        {/* Tabs — scrollable */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => {
            const cnt = t.key === 'all' ? items.length : (countByType[t.key] || 0)
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  tab === t.key
                    ? 'bg-[#1a56db] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.label}
                {cnt > 0 && (
                  <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-100' : 'text-gray-400'}`}>
                    ({cnt})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🗑️</div>
            <p className="text-gray-400 text-sm">Thùng rác trống</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-14">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Ngày xóa</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(item => (
                  <tr key={item.type + item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {resolveImg(item.thumbnailUrl)
                          ? <img src={resolveImg(item.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#cbd5e1" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.title}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOR[item.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABEL[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {new Date(item.deletedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setConfirming({ ...item, action: 'restore' })}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition"
                        >
                          Khôi phục
                        </button>
                        <button
                          onClick={() => setConfirming({ ...item, action: 'delete' })}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                        >
                          Xóa vĩnh viễn
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm restore/delete modal */}
      {confirming && (
        <div
          onClick={() => setConfirming(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ background: confirming.action === 'restore' ? '#eff6ff' : '#fef2f2' }}>
                {confirming.action === 'restore' ? '♻️' : '🗑️'}
              </div>
              <h3 className="font-bold text-gray-800 text-base">
                {confirming.action === 'restore' ? 'Khôi phục mục này?' : 'Xóa vĩnh viễn?'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-1 font-medium">{confirming.title}</p>
            <p className={`text-xs mb-5 ${confirming.action === 'delete' ? 'text-red-500' : 'text-gray-400'}`}>
              {confirming.action === 'delete'
                ? 'Hành động này không thể hoàn tác.'
                : confirming.type === 'book'
                  ? 'Sẽ khôi phục cả các đề thi trong cuốn sách này.'
                  : 'Mục sẽ được khôi phục về trạng thái hoạt động.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirming(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Hủy
              </button>
              <button
                disabled={busy}
                onClick={() => confirming.action === 'restore' ? handleRestore(confirming) : handleDelete(confirming)}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition disabled:opacity-60 ${
                  confirming.action === 'restore' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {busy ? '...' : confirming.action === 'restore' ? 'Khôi phục' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm purge modal */}
      {purgeConfirm && (
        <div
          onClick={() => setPurgeConfirm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">⚠️</div>
              <h3 className="font-bold text-gray-800 text-base">Dọn sạch thùng rác?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">Tất cả <span className="font-semibold">{items.length} mục</span> trong thùng rác sẽ bị xóa vĩnh viễn.</p>
            <p className="text-xs text-red-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPurgeConfirm(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Hủy
              </button>
              <button disabled={busy} onClick={handlePurge}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-60">
                {busy ? '...' : 'Xóa tất cả'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
