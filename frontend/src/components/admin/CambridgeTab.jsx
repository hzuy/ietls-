import { useState, useEffect } from 'react'
import api from '../../utils/axios'
import { showAlert } from '../../utils/alertUtils'
import { notifyTrashChanged } from '../../services/adminService'
import { SeriesCard, SeriesDetailView } from './CambridgeBookComponents'
import { BookOpen } from 'lucide-react'

// ─── TAB: SERIES & BOOKS ──────────────────────────────────────────────────────

let cachedSeriesList = null

function CambridgeTab({ initialSeriesList = [], onExamsChanged }) {
  const [seriesList, setSeriesList] = useState(cachedSeriesList || initialSeriesList)
  const [activeSeries, setActiveSeries] = useState(null)
  const [activeBooks, setActiveBooks] = useState([])
  const [booksError, setBooksError] = useState('')
  const [loading, setLoading] = useState(!cachedSeriesList && initialSeriesList.length === 0)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const fetchSeries = (silent = false) => {
    if (!silent && !cachedSeriesList && seriesList.length === 0) {
      setLoading(true)
    }
    api.get('/admin/exam-series')
      .then(r => {
        cachedSeriesList = r.data
        setSeriesList(r.data)
        setLoadError('')
      })
      .catch(() => {
        const msg = 'Không tải được danh sách bộ đề. Tải lại trang hoặc thử lại.'
        setLoadError(msg)
        showAlert(msg, 'error')
      })
      .finally(() => setLoading(false))
  }

  const fetchBooks = (seriesId) => {
    setBooksError('')
    api.get(`/admin/exam-series/${seriesId}/books`)
      .then(r => setActiveBooks(r.data))
      .catch(() => {
        const msg = 'Không tải được danh sách cuốn. Quay lại và thử lại.'
        setBooksError(msg)
        showAlert(msg, 'error')
      })
  }

  useEffect(() => {
    if (initialSeriesList.length > 0 && !cachedSeriesList) {
      cachedSeriesList = initialSeriesList
      setSeriesList(initialSeriesList)
      setLoading(false)
    }
    fetchSeries(Boolean(cachedSeriesList || seriesList.length > 0))
  }, [initialSeriesList])

  const handleManage = (s) => {
    setActiveSeries(s)
    setActiveBooks([])
    fetchBooks(s.id)
  }

  const handleAddSeries = async () => {
    if (!newName.trim()) return
    try {
      await api.post('/admin/exam-series', { name: newName.trim() })
      setNewName(''); setShowAdd(false)
      fetchSeries(true)
      onExamsChanged?.()
      showToast('✅ Đã tạo bộ đề')
    } catch { showToast('Lỗi tạo bộ đề') }
  }

  const handleEditSeries = async (id) => {
    if (!editName.trim()) return
    try {
      const updated = await api.put(`/admin/exam-series/${id}`, { name: editName.trim() })
      setSeriesList(list => {
        const next = list.map(s => s.id === id ? { ...s, name: updated.data.name } : s)
        cachedSeriesList = next
        return next
      })
      if (activeSeries?.id === id) setActiveSeries(s => ({ ...s, name: updated.data.name }))
      setEditId(null)
      onExamsChanged?.()
      showToast('✅ Đã đổi tên bộ đề')
    } catch { showToast('Lỗi sửa tên bộ đề') }
  }

  const handleDeleteSeries = async (id) => {
    try {
      await api.delete(`/admin/exam-series/${id}`)
      notifyTrashChanged()
      onExamsChanged?.()
      if (activeSeries?.id === id) setActiveSeries(null)
      fetchSeries(true)
      showToast('✅ Đã xóa bộ đề')
    } catch { showToast('Lỗi xóa bộ đề') }
  }

  const toastEl = toast && (
    <div className="fixed bottom-4 right-4 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-[60]">
      {toast}
    </div>
  )

  if (activeSeries) {
    return (
      <>
        {toastEl}
        <SeriesDetailView
          series={activeSeries}
          books={activeBooks}
          booksError={booksError}
          onBack={() => { setActiveSeries(null); fetchSeries() }}
          onBooksChanged={() => { fetchBooks(activeSeries.id); onExamsChanged?.() }}
          showToast={showToast}
        />
      </>
    )
  }

  return (
    <>
      {toastEl}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Quản lý IELTS Test</h3>
              <p className="text-xs text-zinc-500 mt-1">Quản lý các bộ đề và cuốn sách IELTS</p>
            </div>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition shadow-sm"
            >
              + Thêm bộ đề mới
            </button>
          </div>

          {showAdd && (
            <div className="flex gap-2 mb-4">
              <input
                autoFocus
                className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 outline-none"
                placeholder="Tên bộ đề (VD: IELTS Practice Test Plus)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSeries(); if (e.key === 'Escape') { setShowAdd(false); setNewName('') } }}
              />
              <button onClick={handleAddSeries} className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition shadow-sm">Tạo</button>
              <button onClick={() => { setShowAdd(false); setNewName('') }} className="px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition shadow-2xs">Hủy</button>
            </div>
          )}

          {loadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-xs">{loadError}</div>
          )}

          {loading ? (
            <p className="text-xs text-zinc-400 text-center py-6">Đang tải...</p>
          ) : seriesList.length === 0 && !loadError ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-xl">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-zinc-300 stroke-[1.5]" />
              <p className="text-xs text-zinc-500 mb-4">Chưa có bộ đề nào</p>
              <button onClick={() => setShowAdd(true)}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition shadow-sm">
                + Tạo bộ đề đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {seriesList.map(s => (
                editId === s.id ? (
                  <div key={s.id} className="bg-white border border-zinc-400 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                    <input
                      autoFocus
                      className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 outline-none"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSeries(s.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleEditSeries(s.id)} className="flex-1 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition shadow-sm">Lưu</button>
                      <button onClick={() => setEditId(null)} className="py-1.5 px-3 rounded-lg border border-zinc-200 text-zinc-600 text-xs hover:bg-zinc-50 transition shadow-2xs">Hủy</button>
                    </div>
                  </div>
                ) : (
                  <SeriesCard
                    key={s.id}
                    s={s}
                    onManage={handleManage}
                    onEdit={s => { setEditId(s.id); setEditName(s.name) }}
                    onDelete={handleDeleteSeries}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default CambridgeTab
