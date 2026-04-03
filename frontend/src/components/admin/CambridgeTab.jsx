import { useState } from 'react'
import api from '../../utils/axios'
import { inputCls, labelCls } from './adminConstants'
import { SeriesCard, SeriesDetailView, BookModal } from './CambridgeBookComponents'

// ─── TAB: CAMBRIDGE IMPORT ────────────────────────────────────────────────────

const SKILLS_LIST = ['reading', 'listening', 'writing', 'speaking']
const skillLabel = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const skillColor = {
  reading: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1a56db]',
  listening: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1a56db]',
  writing: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1a56db]',
  speaking: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1a56db]',
}

function CambridgeTab({ onRefresh }) {
  const [seriesList, setSeriesList] = useState([])
  const [activeSeries, setActiveSeries] = useState(null)
  const [activeBooks, setActiveBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const fetchSeries = () => {
    api.get('/admin/exam-series').then(r => setSeriesList(r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  const fetchBooks = (seriesId) => {
    api.get(`/admin/exam-series/${seriesId}/books`).then(r => setActiveBooks(r.data)).catch(() => {})
  }

  useEffect(() => { fetchSeries() }, [])

  const handleManage = (s) => {
    setActiveSeries(s)
    fetchBooks(s.id)
  }

  const handleAddSeries = async () => {
    if (!newName.trim()) return
    try {
      await api.post('/admin/exam-series', { name: newName.trim() })
      setNewName(''); setShowAdd(false)
      fetchSeries()
    } catch { alert('Lỗi tạo bộ đề') }
  }

  const handleEditSeries = async (id) => {
    if (!editName.trim()) return
    try {
      const updated = await api.put(`/admin/exam-series/${id}`, { name: editName.trim() })
      setSeriesList(list => list.map(s => s.id === id ? { ...s, name: updated.data.name } : s))
      if (activeSeries?.id === id) setActiveSeries(s => ({ ...s, name: updated.data.name }))
      setEditId(null)
    } catch { alert('Lỗi sửa tên') }
  }

  const handleDeleteSeries = async (id) => {
    try {
      await api.delete(`/admin/exam-series/${id}`)
      if (activeSeries?.id === id) setActiveSeries(null)
      fetchSeries()
    } catch { alert('Lỗi xóa bộ đề') }
  }

  if (activeSeries) {
    return (
      <SeriesDetailView
        series={activeSeries}
        books={activeBooks}
        onBack={() => { setActiveSeries(null); fetchSeries() }}
        onBooksChanged={() => fetchBooks(activeSeries.id)}
        onRefresh={onRefresh}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800">Quản lý IELTS Test</h3>
            <p className="text-xs text-gray-400 mt-0.5">Quản lý các bộ đề và cuốn sách IELTS</p>
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold hover:bg-[#1d4ed8] transition"
          >
            + Thêm bộ đề mới
          </button>
        </div>

        {showAdd && (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#1a56db] outline-none"
              placeholder="Tên bộ đề (VD: IELTS Practice Test Plus)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSeries(); if (e.key === 'Escape') { setShowAdd(false); setNewName('') } }}
            />
            <button onClick={handleAddSeries} className="px-3 py-2 rounded-lg bg-[#1a56db] text-white text-xs font-bold hover:bg-[#1d4ed8] transition">Tạo</button>
            <button onClick={() => { setShowAdd(false); setNewName('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition">Hủy</button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Đang tải...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {seriesList.map(s => (
              editId === s.id ? (
                <div key={s.id} className="bg-white border border-[#1a56db] rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                  <input
                    autoFocus
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#1a56db] outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSeries(s.id); if (e.key === 'Escape') setEditId(null) }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSeries(s.id)} className="flex-1 py-1.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold">Lưu</button>
                    <button onClick={() => setEditId(null)} className="py-1.5 px-3 rounded-lg border border-gray-200 text-gray-500 text-xs">Hủy</button>
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
  )
}

export default CambridgeTab