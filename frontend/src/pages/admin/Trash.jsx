import { useState, useEffect } from 'react'
import Modal from '../../components/common/Modal'
import { SkeletonTable } from '../../components/skeletons'

import { getAdminTrash, restoreTrashItem, permanentDeleteTrashItem, purgeTrash, notifyTrashChanged } from '../../services/adminService'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import { showAlert } from '../../utils/alertUtils'

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
const BADGE_CLS = 'text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200'

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
  const [rowErrors, setRowErrors] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = (msg, kind = 'info') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 5000)
  }

  const loadTrash = async () => {
    try {
      setLoading(true)
      const data = await getAdminTrash()
      setItems(data || [])
      setRowErrors({})
    } catch {
      showAlert('Lỗi', 'Không thể tải danh sách thùng rác', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrash() }, [])

  const rowKey = item => `${item.type}:${item.id}`

  const handleRestore = async (item) => {
    try {
      setBusy(true)
      await restoreTrashItem(item.type, item.id)
      notifyTrashChanged({ type: item.type, id: item.id, action: 'restored' })
      setItems(prev => prev.filter(x => !(x.type === item.type && x.id === item.id)))
      setConfirming(null)
      showToast(`Đã khôi phục: ${item.title}`)
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Lỗi khôi phục'
      setRowErrors(prev => ({ ...prev, [rowKey(item)]: msg }))
      setConfirming(null)
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (item) => {
    try {
      setBusy(true)
      await permanentDeleteTrashItem(item.type, item.id)
      notifyTrashChanged({ type: item.type, id: item.id, action: 'deleted' })
      setItems(prev => prev.filter(x => !(x.type === item.type && x.id === item.id)))
      setConfirming(null)
      showToast(`Đã xóa vĩnh viễn: ${item.title}`)
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Lỗi xóa'
      setRowErrors(prev => ({ ...prev, [rowKey(item)]: msg }))
      setConfirming(null)
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handlePurge = async () => {
    try {
      setBusy(true)
      await purgeTrash()
      notifyTrashChanged({ action: 'purged' })
      setItems([])
      setPurgeConfirm(false)
      showToast('Đã dọn sạch thùng rác')
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Lỗi dọn thùng rác'
      setPurgeConfirm(false)
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const filtered = tab === 'all' ? items : items.filter(x => x.type === tab)
  const countByType = {}
  for (const item of items) countByType[item.type] = (countByType[item.type] || 0) + 1

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2.5">
              Thùng rác
              {items.length > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                  {items.length} mục
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Các mục đã xóa — tự động dọn sau {PURGE_DAYS} ngày</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setPurgeConfirm(true)}
              className="text-xs font-medium px-3.5 py-2 rounded-lg bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                  selected
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80'
                }`}
              >
                {t.label}
                {cnt > 0 && (
                  <span className={`ml-1.5 text-[11px] ${selected ? 'text-zinc-300' : 'text-zinc-400'}`}>
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
            <Trash2 size={48} strokeWidth={1.5} className="text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-400 text-xs">Thùng rác trống</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-500">Tên</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-500 hidden sm:table-cell w-40">Loại</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-500 hidden sm:table-cell w-44">Ngày xóa</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-zinc-500 w-52">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(item => {
                  const err = rowErrors[rowKey(item)]
                  const daysLeft = daysUntilPurge(item.deletedAt)
                  return (
                    <tr key={item.type + item.id} className={`transition ${err ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-zinc-50'}`}>
                      <td className="px-4 py-3 text-xs font-medium text-zinc-800 align-top">
                        {item.title}
                        {err && (
                          <div className="flex items-start gap-1 mt-1 text-[11px] font-normal text-red-600">
                            <AlertTriangle size={13} className="mt-px shrink-0" />
                            <span>{err}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell align-top">
                        <span className={BADGE_CLS}>{TYPE_LABEL[item.type] || item.type}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell align-top text-xs">
                        <div className="text-zinc-500">{new Date(item.deletedAt).toLocaleDateString('vi-VN')}</div>
                        <div className={`text-[11px] mt-0.5 ${daysLeft <= 3 ? 'text-red-600 font-medium' : 'text-zinc-400'}`}>
                          {daysLeft > 0 ? `tự dọn sau ${daysLeft} ngày` : 'sắp được dọn'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setConfirming({ ...item, action: 'restore' })}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100 transition shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                          >
                            Khôi phục
                          </button>
                          <button
                            onClick={() => setConfirming({ ...item, action: 'delete' })}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirming.action === 'restore' ? 'bg-zinc-100' : 'bg-red-50'}`}>
                {confirming.action === 'restore'
                  ? <RotateCcw size={20} className="text-zinc-800" />
                  : <Trash2 size={20} className="text-red-600" />}
              </div>
              <h3 className="font-semibold text-zinc-900 text-sm">
                {confirming.action === 'restore' ? 'Khôi phục mục này?' : 'Xóa vĩnh viễn?'}
              </h3>
            </div>
            <p className="text-xs text-zinc-700 mb-1 font-medium">{confirming.title}</p>
            <p className={`text-[11px] mb-5 ${confirming.action === 'delete' ? 'text-red-500' : 'text-zinc-400'}`}>
              {confirming.action === 'delete'
                ? 'Hành động này không thể hoàn tác.'
                : confirming.type === 'book'
                  ? 'Sẽ khôi phục cả các đề thi đã xóa cùng cuốn sách này.'
                  : 'Mục sẽ được khôi phục về trạng thái hoạt động.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirming(null)}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
                Hủy
              </button>
              <button
                disabled={busy}
                onClick={() => confirming.action === 'restore' ? handleRestore(confirming) : handleDelete(confirming)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium text-white transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  confirming.action === 'restore'
                    ? 'bg-zinc-900 hover:bg-zinc-800 focus-visible:ring-zinc-900'
                    : 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
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
              <h3 className="font-semibold text-zinc-900 text-sm">Dọn sạch thùng rác?</h3>
            </div>
            <p className="text-xs text-zinc-600 mb-1">Tất cả <span className="font-medium text-zinc-900">{items.length} mục</span> trong thùng rác sẽ bị xóa vĩnh viễn.</p>
            <p className="text-[11px] text-red-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPurgeConfirm(false)}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
                Hủy
              </button>
              <button disabled={busy} onClick={handlePurge}
                className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1">
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
            toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'
          }`}
        >
          {toast.kind === 'error' && <AlertTriangle size={16} className="mt-px shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
