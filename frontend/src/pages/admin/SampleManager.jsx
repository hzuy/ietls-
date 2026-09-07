import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUnsavedChanges, NAV_LEAVE_MSG } from '../../hooks/useUnsavedChanges'
import { useDraftPersistence } from '../../hooks/useDraftPersistence'
import { ConfirmDeleteModal, DraftBanner, DraftSavedHint, AdminListHeader, ThumbnailPicker } from '../../components/admin/contentPageUI'
import { useToast } from '../../context/ToastContext'
import ImageWithFallback from '../../components/common/ImageWithFallback'

import RichTextEditor from '../../components/RichTextEditor'
import {
  getWritingSamples, getWritingSample, createWritingSample, updateWritingSample, deleteWritingSample, uploadWritingSampleThumbnailFile,
  getSpeakingSamples, getSpeakingSample, createSpeakingSample, updateSpeakingSample, deleteSpeakingSample, uploadSpeakingSampleThumbnailFile,
} from '../../services/sampleService'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

// ─── PER-KIND CONFIG ─────────────────────────────────────────────────────────
// Toàn bộ khác biệt giữa Writing Samples và Speaking Samples được gom vào đây.
// Phần còn lại của component (state, handlers, draft-safety, upload-hướng-a,
// modal/hover/layout đã chuẩn hoá) dùng chung nguyên vẹn cho cả 2 loại.
const CONFIG = {
  writing: {
    services: {
      list: getWritingSamples, get: getWritingSample,
      create: createWritingSample, update: updateWritingSample,
      remove: deleteWritingSample, uploadThumb: uploadWritingSampleThumbnailFile,
    },
    draftKeyPrefix: 'draft_writing_sample_',
    listTitle: 'Writing Samples',
    listSubtitle: 'Bài mẫu Writing — hiển thị trên trang chủ',
    addLabel: '+ Thêm mới',
    formTitleNew: 'Thêm Writing Sample mới',
    formTitleEdit: 'Chỉnh sửa Writing Sample',
    deleteTitle: 'Xóa bài Writing?',
    nameLabel: 'Tên bài',
    namePlaceholder: 'VD: Cambridge IELTS 19 — Task 1 Sample Answer',
    taskFieldLabel: 'Task',
    taskColHeader: 'Task / Dạng đề',
    tasks: [
      { value: '', label: '-- Task --' },
      { value: 'task1', label: 'Task 1' },
      { value: 'task2', label: 'Task 2' },
    ],
    taskLabels: { task1: 'Task 1', task2: 'Task 2' },
    examTypePlaceholder: {
      task1: 'VD: Bar chart, Line graph, Pie chart, Map, Process diagram...',
      task2: 'VD: Opinion essay, Discussion essay, Problem-solution...',
      '':    'VD: Bar chart, Opinion essay...',
    },
    showTags: false,
    tagPlaceholder: 'VD: Task 1, Band 8.0... (Enter để thêm)',
    contentPlaceholder: 'Nhập nội dung bài mẫu Writing...',
    tagChipClass: 'bg-zinc-100 text-zinc-800 border border-zinc-200',
    tagChipCloseClass: 'text-zinc-500 hover:text-zinc-800',
    tagAddBtnClass: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
    listChipStyle: { background: '#f4f4f5', color: '#18181b', border: '1px solid #e4e4e7' },
  },
  speaking: {
    services: {
      list: getSpeakingSamples, get: getSpeakingSample,
      create: createSpeakingSample, update: updateSpeakingSample,
      remove: deleteSpeakingSample, uploadThumb: uploadSpeakingSampleThumbnailFile,
    },
    draftKeyPrefix: 'draft_speaking_sample_',
    listTitle: 'Speaking Samples',
    listSubtitle: 'Bài mẫu Speaking — hiển thị trên trang chủ',
    addLabel: '+ Thêm mới',
    formTitleNew: 'Thêm Speaking Sample mới',
    formTitleEdit: 'Chỉnh sửa Speaking Sample',
    deleteTitle: 'Xóa bài Speaking?',
    nameLabel: 'Tên chủ đề',
    namePlaceholder: 'VD: Topic: Technology — Sample Answer Band 8',
    taskFieldLabel: 'Part',
    taskColHeader: 'Part / Dạng đề',
    tasks: [
      { value: '', label: '-- Part --' },
      { value: 'task1', label: 'Part 1' },
      { value: 'task2', label: 'Part 2' },
      { value: 'task3', label: 'Part 3' },
    ],
    taskLabels: { task1: 'Part 1', task2: 'Part 2', task3: 'Part 3' },
    examTypePlaceholder: {
      task1: 'VD: Personal questions, Hobbies, Daily routine...',
      task2: 'VD: Describe a person, Describe a place, Describe an event...',
      task3: 'VD: Abstract discussion, Society, Technology, Environment...',
      '':    'VD: Describe a person, Abstract discussion...',
    },
    showTags: false,
    tagPlaceholder: 'VD: Part 2, Band 7.5... (Enter để thêm)',
    contentPlaceholder: 'Nhập nội dung bài mẫu Speaking (cue card, sample answer, tips...)',
    tagChipClass: 'bg-zinc-100 text-zinc-800 border border-zinc-200',
    tagChipCloseClass: 'text-zinc-500 hover:text-zinc-800',
    tagAddBtnClass: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
    listChipStyle: { background: '#f4f4f5', color: '#18181b', border: '1px solid #e4e4e7' },
  },
}

const EMPTY_FORM = { title: '', level: '', examType: '', content: '', tagInput: '', tags: [], thumbnailUrl: null, thumbPreview: null, thumbFile: null }

// Chữ ký nội dung form (bỏ qua tagInput — chỉ là buffer gõ dở) để phát hiện thay đổi chưa lưu.
const formSig = (f) => JSON.stringify([f.title, f.level, f.examType, f.content, f.tags, f.thumbnailUrl, !!f.thumbFile])

export default function SampleManager({ kind }) {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const cfg = CONFIG[kind]
  const svc = cfg.services
  const formatTask = (level) => cfg.taskLabels[level] || level || ''

  const { data: list = [], isPending } = useQuery({
    queryKey: ['admin', 'samples', kind],
    queryFn: () => svc.list(),
    placeholderData: (prev) => prev,
  })
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const pristineRef = useRef('')

  // Cảnh báo đóng tab / F5 khi form có thay đổi chưa lưu (in-app nav xử lý ở AdminLayout).
  useUnsavedChanges(view === 'form' && isDirty)

  // isDirty = form hiện tại khác snapshot lúc mở form (openAdd/openEdit đặt lại pristineRef).
  useEffect(() => {
    if (view !== 'form') return
    setIsDirty(formSig(form) !== pristineRef.current)
  }, [form, view])

  // BUG-14: Draft auto-save (restore khi mở form, autosave 2s khi có thay đổi).
  const draftKey = `${cfg.draftKeyPrefix}${editing?.id || 'new'}`
  const { draftBanner, setDraftBanner, draftSavedAt, clearDraft } =
    useDraftPersistence(draftKey, form, { enabled: view === 'form', dirty: isDirty })

  const handleCancelOrBack = () => {
    if (isDirty && !window.confirm(NAV_LEAVE_MSG)) return
    setIsDirty(false)
    setView('list')
  }

  useEffect(() => {
    setView('list')
    setEditing(null)
    setForm(EMPTY_FORM)
    setDelConfirm(null)
    setIsDirty(false)
    pristineRef.current = ''
  }, [kind])

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
    setForm(EMPTY_FORM); setEditing(null); setIsDirty(false); setView('form')
  }

  const openEdit = async (item) => {
    try {
      const data = await svc.get(item.id)
      const next = { title: data.title, level: data.level || '', examType: data.examType || '', content: data.content || '', tagInput: '', tags: cfg.showTags ? (data.tags || []) : [], thumbnailUrl: data.thumbnailUrl, thumbPreview: resolveImg(data.thumbnailUrl), thumbFile: null }
      pristineRef.current = formSig(next)
      setForm(next)
      setEditing(data); setIsDirty(false); setView('form')
    } catch { showToast('Lỗi tải', 'error') }
  }

  const addTag = () => {
    const t = form.tagInput.trim()
    if (!t || form.tags.includes(t)) { setForm(f => ({ ...f, tagInput: '' })); return }
    setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }))
  }

  const removeTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Vui lòng nhập tên bài', 'error'); return }
    // BUG-15: Validate content not empty
    const plainContent = form.content.replace(/<[^>]*>/g, '').trim()
    if (!plainContent) { showToast('Vui lòng nhập nội dung bài mẫu', 'error'); return }
    setSaving(true)
    try {
      // ── Bước 1: upload ảnh mới (nếu có) TRƯỚC — record chỉ ghi khi file đã lên xong ──
      let thumbnailUrl = form.thumbnailUrl
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        try {
          thumbnailUrl = (await svc.uploadThumb(fd)).url
        } catch (e) {
          showToast(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.', 'error')
          return
        }
      }

      // ── Bước 2: ghi record với URL đã có sẵn ──
      const body = {
        title: form.title.trim(), level: form.level || null, examType: form.examType.trim() || null,
        content: form.content, thumbnailUrl: thumbnailUrl || null,
        ...(cfg.showTags ? { tags: form.tags } : {}),
      }
      if (!editing) await svc.create(body)
      else await svc.update(editing.id, body)

      setIsDirty(false); clearDraft(); setView('list')
      queryClient.invalidateQueries({ queryKey: ['admin', 'samples'] })
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi lưu', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await svc.remove(id)
      setDelConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'samples'] })
    }
    catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
  }

  if (view === 'form') {
    return (
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={handleCancelOrBack} aria-label="Quay lại danh sách" className="text-zinc-500 hover:text-zinc-800 text-sm font-semibold transition">←</button>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">{editing ? cfg.formTitleEdit : cfg.formTitleNew}</h1>
          </div>

          {/* BUG-14: Draft banner */}
          <DraftBanner draft={draftBanner}
            onRestore={() => { setForm(draftBanner.data); setDraftBanner(null) }}
            onDismiss={clearDraft} />
          {!draftBanner && <DraftSavedHint at={draftSavedAt} />}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="flex flex-col gap-4">
              {/* Basic info */}
              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <div className="mb-3.5">
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">{cfg.nameLabel} <span className="text-red-500 font-normal">*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={cfg.namePlaceholder}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition bg-white text-zinc-900 placeholder:text-zinc-400 shadow-2xs" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">{cfg.taskFieldLabel}</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value, examType: '' }))}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition bg-white text-zinc-900 shadow-2xs">
                    {cfg.tasks.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Dạng đề</label>
                  <input value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
                    placeholder={cfg.examTypePlaceholder[form.level] || cfg.examTypePlaceholder['']}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition bg-white text-zinc-900 placeholder:text-zinc-400 shadow-2xs" />
                </div>
                {/* Tags */}
                {cfg.showTags && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.tags.map(t => (
                        <span key={t} className={`inline-flex items-center gap-1 ${cfg.tagChipClass} rounded-full px-2 py-0.5 text-[11px] font-medium`}>
                          {t}
                          <button onClick={() => removeTag(t)} aria-label={`Xóa tag ${t}`} className={`bg-transparent border-0 cursor-pointer ${cfg.tagChipCloseClass} text-xs leading-none`}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input value={form.tagInput} onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                        placeholder={cfg.tagPlaceholder}
                        className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition bg-white text-zinc-900 placeholder:text-zinc-400 shadow-2xs" />
                      <button onClick={addTag} className={`px-3 py-1.5 rounded-lg ${cfg.tagAddBtnClass} text-xs font-medium`}>+ Thêm</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rich text content */}
              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <label className="block text-xs font-medium text-zinc-700 mb-2">Nội dung bài mẫu</label>
                <RichTextEditor value={form.content} onChange={html => setForm(f => ({ ...f, content: html }))}
                  maxHeight={520}
                  placeholder={cfg.contentPlaceholder} />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <ThumbnailPicker
                  preview={form.thumbPreview}
                  onSelect={file => setForm(prev => ({ ...prev, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))}
                  onClear={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleCancelOrBack} className="flex-1 px-3.5 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 font-medium transition">Hủy</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition disabled:opacity-50 shadow-xs">{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </div>
          </div>
        </div>
    )
  }

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <AdminListHeader title={cfg.listTitle} subtitle={cfg.listSubtitle} onAdd={openAdd} addLabel={cfg.addLabel} />
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          {isPending && list.length === 0 ? <div className="p-10 text-center text-xs text-zinc-400">Đang tải...</div>
            : list.length === 0 ? <div className="p-10 text-center text-xs text-zinc-400">Chưa có bài mẫu nào.</div>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 w-16">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tên bài</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">{cfg.taskColHeader}</th>
                  {cfg.showTags && <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Tags</th>}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Hành động</th>
                </tr></thead>
                <tbody>
                  {list.map(item => (
                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition">
                      <td className="px-4 py-3">
                        <div style={{ width: 60, height: 40, borderRadius: 8, overflow: 'hidden', background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageWithFallback
                            src={resolveImg(item.thumbnailUrl)}
                            alt={item.title || 'Thumbnail'}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">{item.title}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {item.level && (
                            <span style={{ fontSize: 11, background: cfg.listChipStyle.background, color: cfg.listChipStyle.color, borderRadius: 6, padding: '2px 8px', fontWeight: 600, border: '1px solid #e4e4e7' }}>
                              {formatTask(item.level)}
                            </span>
                          )}
                          {item.examType && (
                            <span style={{ fontSize: 11, background: '#ffffff', color: '#52525b', borderRadius: 6, padding: '2px 8px', border: '1px solid #e4e4e7' }}>
                              {item.examType}
                            </span>
                          )}
                        </div>
                      </td>
                      {cfg.showTags && <td className="px-4 py-3 hidden sm:table-cell"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{(item.tags || []).map(t => <span key={t} style={{ fontSize: 11, background: cfg.listChipStyle.background, color: cfg.listChipStyle.color, borderRadius: 6, padding: '2px 8px', border: '1px solid #e4e4e7' }}>{t}</span>)}</div></td>}
                      <td className="px-4 py-3 text-sm text-zinc-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 font-medium transition shadow-2xs">Sửa</button>
                        <button onClick={() => setDelConfirm(item.id)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-red-500 hover:bg-red-50 hover:border-red-200 font-medium transition shadow-2xs">Xóa</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
      <ConfirmDeleteModal
        open={!!delConfirm}
        title={cfg.deleteTitle}
        onCancel={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
      />
    </>
  )
}
