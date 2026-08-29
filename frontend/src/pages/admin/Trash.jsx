import { useState, useEffect } from 'react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/common/Modal'
import { SkeletonTable } from '../../components/skeletons'

import { getAdminTrash, restoreTrashItem, permanentDeleteTrashItem, purgeTrash, notifyTrashChanged } from '../../services/adminService'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'

const PURGE_DAYS = 30

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
}

// One neutral tone for every type badge — the type is told apart by its icon + label,
// not by colour (matches Attempts.jsx).
const BADGE_CLS = 'text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200'

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
]

// Whole days left before the 30-day auto-purge removes this item.
const daysUntilPurge = (deletedAt) =>
  Math.ceil((new Date(deletedAt).getTime() + PURGE_DAYS * 86_400_000 - Date.now()) / 86_400_000)

export default function Trash() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [confirming, setConfirming] = useState(null)
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)          // { kind: 'error' | 'success', msg }
  const [rowErrors, setRowErrors] = useState({})    // { `${type}-${id}`: message } — rows whose last action failed

  const rowKey = (item) => `${item.type}-${item.id}`
  const showToast = (kind, msg) => { setToast({ kind, msg }); setTimeout(() => setToast(null), 5000) }

  const load = async () => {
    setLoading(true)
    try { setItems(await getAdminTrash()) } catch { /* keep whatever is on screen */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = tab === 'all' ? items : items.filter(i => i.type === tab)

  const handleRestore = async (item) => {
    setBusy(true)
    try {
      await restoreTrashItem(item.type, item.id)
      setRowErrors(prev => { const n = { ...prev }; delete n[rowKey(item)]; return n })
      setConfirming(null)
      notifyTrashChanged()
      load()
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi khôi phục — thử lại sau'
      setRowErrors(prev => ({ ...prev, [rowKey(item)]: msg }))
      setConfirming(null)
      showToast('error', msg)
    }
    setBusy(false)
  }

  const handleDelete = async (item) => {
    setBusy(true)
    try {
      await permanentDeleteTrashItem(item.type, item.id)
      setRowErrors(prev => { const n = { ...prev }; delete n[rowKey(item)]; return n })
      setConfirming(null)
      notifyTrashChanged()
      load()
    } catch (err) {
      // Keep the failed row visible and flagged instead of letting it silently vanish.
      const msg = err.response?.data?.message || 'Lỗi xóa vĩnh viễn — thử lại sau'
      setRowErrors(prev => ({ ...prev, [rowKey(item)]: msg }))
      setConfirming(null)
      showToast('error', msg)
    }
    setBusy(false)
  }

  const handlePurge = async () => {
    setBusy(true)
    try {
      await purgeTrash()
      setRowErrors({})
      setPurgeConfirm(false)
      notifyTrashChanged()
      load()
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi dọn rác — thử lại sau'
      setPurgeConfirm(false)
      showToast('error', msg)
    }
    setBusy(false)
  }

  const countByType = {}
  for (const item of items) countByType[item.type] = (countByType[item.type] || 0) + 1

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              Thùng rác
              {items.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {items.length} mục
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-1">Các mục đã xóa — tự động dọn sau {PURGE_DAYS} ngày</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setPurgeConfirm(true)}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Dọn sạch thùng rác
            </button>
          )}
        </div>

        {/* Tabs — flex-wrap */}
        <div role="tablist" aria-label="Lọc theo loại" className="flex flex-wrap gap-2 items-center mb-5">
          {TABS.map(t => {
            const cnt = t.key === 'all' ? items.length : (countByType[t.key] || 0)
            const selected = tab === t.key
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={selected}
                aria-controls="trash-panel"
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                  selected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {t.label}
                {cnt > 0 && (
                  <span className={`ml-1.5 text-xs ${selected ? 'text-blue-100' : 'text-slate-400'}`}>
                    ({cnt})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div id="trash-panel" role="tabpanel">
        {loading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Trash2 size={48} strokeWidth={1.5} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Thùng rác trống</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell w-40">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell w-44">Ngày xóa</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-52">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const err = rowErrors[rowKey(item)]
                  const daysLeft = daysUntilPurge(item.deletedAt)
                  return (
                    <tr key={item.type + item.id} className={`transition ${err ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 align-top">
                        {item.title}
                        {err && (
                          <div className="flex items-start gap-1 mt-1 text-xs font-normal text-rose-600">
                            <AlertTriangle size={13} className="mt-px shrink-0" />
                            <span>{err}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell align-top">
                        <span className={BADGE_CLS}>{TYPE_LABEL[item.type] || item.type}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell align-top text-sm">
                        <div className="text-slate-500">{new Date(item.deletedAt).toLocaleDateString('vi-VN')}</div>
                        <div className={`text-xs mt-0.5 ${daysLeft <= 3 ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                          {daysLeft > 0 ? `tự dọn sau ${daysLeft} ngày` : 'sắp được dọn'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setConfirming({ ...item, action: 'restore' })}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            Khôi phục
                          </button>
                          <button
                            onClick={() => setConfirming({ ...item, action: 'delete' })}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          >
                            {err ? 'Thử lại' : 'Xóa vĩnh viễn'}
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
        </div>
      </div>

      {/* Confirm restore / delete */}
      {confirming && (
        <Modal
          onClose={() => setConfirming(null)}
          title={confirming.action === 'restore' ? 'Khôi phục mục này?' : 'Xóa vĩnh viễn mục này?'}
          size="sm"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirming.action === 'restore' ? 'bg-blue-50' : 'bg-rose-50'}`}>
                {confirming.action === 'restore'
                  ? <RotateCcw size={20} className="text-blue-600" />
                  : <Trash2 size={20} className="text-rose-500" />}
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                {confirming.action === 'restore' ? 'Khôi phục mục này?' : 'Xóa vĩnh viễn?'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-1 font-medium">{confirming.title}</p>
            <p className={`text-xs mb-5 ${confirming.action === 'delete' ? 'text-rose-500' : 'text-slate-400'}`}>
              {confirming.action === 'delete'
                ? 'Hành động này không thể hoàn tác.'
                : confirming.type === 'book'
                  ? 'Sẽ khôi phục cả các đề thi đã xóa cùng cuốn sách này.'
                  : 'Mục sẽ được khôi phục về trạng thái hoạt động.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirming(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                Hủy
              </button>
              <button
                disabled={busy}
                onClick={() => confirming.action === 'restore' ? handleRestore(confirming) : handleDelete(confirming)}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  confirming.action === 'restore'
                    ? 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500'
                    : 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                }`}
              >
                {busy ? '...' : confirming.action === 'restore' ? 'Khôi phục' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm purge */}
      {purgeConfirm && (
        <Modal onClose={() => setPurgeConfirm(false)} title="Dọn sạch thùng rác?" size="sm">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Dọn sạch thùng rác?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-1">Tất cả <span className="font-semibold">{items.length} mục</span> trong thùng rác sẽ bị xóa vĩnh viễn.</p>
            <p className="text-xs text-rose-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPurgeConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                Hủy
              </button>
              <button disabled={busy} onClick={handlePurge}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1">
                {busy ? '...' : 'Xóa tất cả'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast — persistent-ish (5s), replaces alert() */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className={`fixed bottom-4 right-4 z-50 max-w-sm text-sm px-4 py-3 rounded-lg shadow-lg cursor-pointer flex items-start gap-2 ${
            toast.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
          }`}
        >
          {toast.kind === 'error' && <AlertTriangle size={16} className="mt-px shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </AdminLayout>
  )
}
