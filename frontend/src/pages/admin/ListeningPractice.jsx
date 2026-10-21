import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUnsavedChanges, NAV_LEAVE_MSG } from '../../hooks/useUnsavedChanges'
import { useDraftPersistence } from '../../hooks/useDraftPersistence'
import { useCollapsibleGroups } from '../../hooks/useCollapsibleGroups'
import { validateAudioFile } from '../../utils/fileValidation'
import { ConfirmDeleteModal, DraftBanner, DraftSavedHint, AdminListHeader, ThumbnailPicker } from '../../components/admin/contentPageUI'
import { useToast } from '../../context/ToastContext'
import { Volume2, Eye, BookOpen, Upload, Loader2, RotateCcw } from 'lucide-react'
import api from '../../utils/axios'
import PracticeGroupCard from '../../components/admin/PracticeGroupCard'
import {
  getListeningPracticeList, getListeningPractice,
  createListeningPractice, updateListeningPractice,
  deleteListeningPractice, uploadListeningThumbnailFile, uploadListeningAudioFile,
} from '../../services/practiceService'
import {
  resolveImg, toImgSrc, recalcGroups,
  LISTENING_GROUP_TYPES, emptyListeningGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
} from '../../utils/practiceConfig'
import AdminGroupPreview from '../../components/practice/AdminGroupPreview'
import ImageWithFallback from '../../components/common/ImageWithFallback'
import Select from '../../components/admin/Select'
import { AdminTableSkeleton } from '../../components/skeletons'
import ExplanationConflictModal from '../../components/admin/ExplanationConflictModal'
import OverwriteProtectedConfirmModal from '../../components/admin/OverwriteProtectedConfirmModal'
import { showAlert } from '../../utils/alertUtils'
import { validatePracticeListening, formatValidationAlert } from '../../utils/questionValidation'
import { executeTimedAIGenerationLoop } from '../../utils/examExplanationUtils'
import { useExplanationGenerationLock } from '../../hooks/useExplanationGenerationLock'
import AIGenerationStickyProgress from '../../components/admin/AIGenerationStickyProgress'
import AIGenerationExitConfirmModal from '../../components/admin/AIGenerationExitConfirmModal'
import AIGenerationResumeBanner from '../../components/admin/AIGenerationResumeBanner'
import {
  smartMergeDraft,
  analyzeDraftDifferences,
  extractExplanationsMap,
  isExplanationEqual,
} from '../../utils/draftMergeUtils'

// ─── PREVIEW MODAL ────────────────────────────────────────────────────────────
function ListeningPracticePreviewModal({ form, showAnswers, setShowAnswers, onClose }) {
  const [leftPct, setLeftPct] = useState(42)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const container = containerRef.current
    if (!container) return
    const onMouseMove = (ev) => {
      const rect = container.getBoundingClientRect()
      setLeftPct(Math.min(75, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onMouseUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const audioSrc = form.audioBlobUrl || (form.audioUrl ? toImgSrc(form.audioUrl) : null)
  const thumbSrc = form.thumbPreview || (form.thumbnailUrl ? toImgSrc(form.thumbnailUrl) : null)

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '95vw', height: '90vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900">Preview — {form.title || 'Listening Practice'}</span>
            <button type="button" onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition cursor-pointer ${showAnswers ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition font-medium cursor-pointer">
            ✕ Đóng
          </button>
        </div>

        <div ref={containerRef} className="flex flex-1 overflow-hidden"
          style={{ userSelect: dragging ? 'none' : 'auto' }}>
          {/* CỘT TRÁI (Audio, Tình huống, Ảnh bìa, Transcript) */}
          <div className="overflow-y-auto bg-white px-7 py-6 space-y-5" style={{ width: `${leftPct}%`, flexShrink: 0 }}>
            {audioSrc && (
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-2xs">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-600" />
                  <span>File Audio bài nghe</span>
                </p>
                <audio controls src={audioSrc} key={audioSrc} className="w-full h-10 rounded-lg" />
              </div>
            )}

            {thumbSrc && (
              <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 max-h-56">
                <img
                  src={thumbSrc}
                  alt={form.title}
                  className="w-full h-full object-cover max-h-56"
                />
              </div>
            )}

            {form.context && (
              <div className="bg-zinc-50/70 p-4 rounded-xl border border-zinc-200">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">Mô tả tình huống (Context)</p>
                <p className="text-sm text-zinc-700 leading-relaxed italic">{form.context}</p>
              </div>
            )}

            {form.transcript ? (
              <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Transcript (Lời thoại)</p>
                  <span className="text-[11px] text-zinc-400">Xem kèm đối chiếu</span>
                </div>
                <p className="text-sm text-zinc-700 leading-7 whitespace-pre-wrap font-normal">{form.transcript}</p>
              </div>
            ) : (
              !form.context && !thumbSrc && !audioSrc && (
                <p className="text-sm text-zinc-400 italic">Chưa có thông tin bài nghe</p>
              )
            )}
          </div>

          {/* THANH KÉO CO GIÃN 2 CỘT */}
          <div onMouseDown={onDividerMouseDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, background: dragging ? '#18181b' : '#e4e4e7', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#a1a1aa' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e4e4e7' }} />

          {/* CỘT PHẢI (Danh sách câu hỏi + giải thích) */}
          <div className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-6">
            {form.questionGroups.length > 0
              ? form.questionGroups.map((g, gi) => (
                  <AdminGroupPreview
                    key={gi}
                    group={g}
                    showAnswers={showAnswers}
                  />
                ))
              : <p className="text-sm text-zinc-400 italic text-center mt-10">Chưa có câu hỏi</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', context: '', transcript: '',
  audioUrl: null, audioBlobUrl: null, audioFile: null, audioName: null,
  questionGroups: [],
  thumbnailUrl: null, thumbPreview: null, thumbFile: null,
}

// Chữ ký nội dung form (bỏ thumbPreview/audioName/audioBlobUrl — phái sinh) để phát hiện thay
// đổi chưa lưu (derive-snapshot, giống SampleManager).
const formSig = (f) => JSON.stringify([f.title, f.context, f.transcript, f.questionGroups, f.thumbnailUrl, !!f.thumbFile, f.audioUrl, !!f.audioFile])

export default function ListeningPractice() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data: list = [], isPending } = useQuery({
    queryKey: ['admin', 'practice', 'listening'],
    queryFn: getListeningPracticeList,
    placeholderData: (prev) => prev,
  })
  const [view, setView]               = useState('list')
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [transcribing, setTranscribing]     = useState(false)
  const [showTranscriptBox, setShowTranscriptBox] = useState(false)
  const [delConfirm, setDelConfirm]   = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [loadingEditId, setLoadingEditId] = useState(null)
  const [addGroupType, setAddGroupType] = useState(LISTENING_GROUP_TYPES[0].value)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  // Search, filter & sort state
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const filteredList = useMemo(() => {
    let res = list || []
    const q = search.trim().toLowerCase()
    if (q) {
      res = res.filter(item => (item.title || '').toLowerCase().includes(q))
    }
    if (filterStatus === 'has_audio') {
      res = res.filter(item => Boolean(item.audioUrl))
    } else if (filterStatus === 'no_audio') {
      res = res.filter(item => !item.audioUrl)
    } else if (filterStatus === 'has_questions') {
      res = res.filter(item => (item.questionCount ?? 0) > 0)
    } else if (filterStatus === 'no_questions') {
      res = res.filter(item => (item.questionCount ?? 0) === 0)
    }

    return [...res].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '')
      if (sortBy === 'questions') return (b.questionCount ?? 0) - (a.questionCount ?? 0)
      return 0
    })
  }, [list, search, filterStatus, sortBy])

  const hasActiveFilter = Boolean(search.trim() || filterStatus !== 'all' || sortBy !== 'newest')
  const resetFilters = () => {
    setSearch('')
    setFilterStatus('all')
    setSortBy('newest')
  }
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiConflicts, setAiConflicts] = useState([])
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [overwriteModalOpen, setOverwriteModalOpen] = useState(false)
  const [protectedStats, setProtectedStats] = useState({ reviewedCount: 0, editedCount: 0 })
  const [aiProgress, setAiProgress] = useState(null)
  const [isCancellingAI, setIsCancellingAI] = useState(false)
  const isCancellingAIRef = useRef(false)
  const abortControllerRef = useRef(null)
  // BUG-13: Track unsaved changes (derive-snapshot: formSig(form) vs pristineRef)
  const [isDirty, setIsDirty] = useState(false)
  const pristineRef = useRef('')
  const pristineExplanationsRef = useRef({})
  const audioRef = useRef()

  // BUG-13: Block navigation when form is dirty
  useUnsavedChanges(view === 'form' && isDirty)

  // isDirty = form hiện tại khác snapshot lúc mở form (openAdd/openEdit đặt lại pristineRef).
  useEffect(() => {
    if (view !== 'form') return
    setIsDirty(formSig(form) !== pristineRef.current)
  }, [form, view])

  // BUG-14: Draft auto-save (restore khi mở form, autosave 2s khi có thay đổi).
  const draftKey = `draft_listening_practice_${editing?.id || 'new'}`
  const { draftBanner, setDraftBanner, draftSavedAt, clearDraft } =
    useDraftPersistence(draftKey, form, { enabled: view === 'form', dirty: isDirty })

  // Thu gọn/bung từng nhóm câu hỏi (mặc định thu gọn khi mở đề).
  const groupCollapse = useCollapsibleGroups()

  // Concurrency lock, multi-tab sync, grace window & exit confirmation hook
  const expLock = useExplanationGenerationLock({
    examId: editing?.id,
    type: 'practice',
    skill: 'listening',
    enabled: view === 'form' && !!editing?.id,
    onResumeGenerate: (unprocessedNums) => {
      handleGenerateAI({ questionNumbers: unprocessedNums })
    },
  })

  // Compare explanations with DB snapshot to detect unsaved changes
  const unsavedQuestionNumbers = useMemo(() => {
    if (!editing || !pristineExplanationsRef.current) return new Set()
    const set = new Set()
    const currentExps = extractExplanationsMap(form)
    for (const [k, exp] of Object.entries(currentExps)) {
      const qNum = Number(k)
      if (!qNum) continue
      const pristineExp = pristineExplanationsRef.current[qNum]
      if (!isExplanationEqual(exp, pristineExp)) {
        set.add(qNum)
      }
    }
    return set
  }, [form, editing])

  // Analyze differences between draft in localStorage and active DB form
  const draftDiffInfo = useMemo(() => {
    if (!draftBanner?.data) return null
    return analyzeDraftDifferences({
      draftData: draftBanner.data,
      currentDbForm: form,
      draftSavedAt: draftBanner.savedAtTs ?? draftBanner.savedAt ?? null,
    })
  }, [draftBanner, form])

  const handleRestoreDraft = (resolutionChoice = null) => {
    if (!draftBanner?.data) return
    // Không có lựa chọn rõ ràng -> dùng khuyến nghị dựa trên mốc thời gian
    // (nháp lưu sau lần cập nhật cuối của DB thì ưu tiên bản nháp).
    const effectiveChoice = resolutionChoice
      || draftDiffInfo?.recommendedChoice
      || 'keep_db'
    const merged = smartMergeDraft({
      draftData: draftBanner.data,
      currentDbForm: form,
      resolutionChoice: effectiveChoice,
      draftSavedAt: draftBanner.savedAtTs ?? draftBanner.savedAt ?? null,
    })
    groupCollapse.setAll([])
    setForm(merged)
    setDraftBanner(null)
    showToast(
      effectiveChoice === 'keep_draft'
        ? 'Đã khôi phục bản nháp gồm các giải thích đã sửa'
        : 'Đã khôi phục bản nháp (giữ nguyên giải thích mới nhất từ hệ thống)',
      'info'
    )
  }

  const handleCancelOrBack = () => {
    expLock.handleSafeActionOrExit(() => {
      if (isDirty && !window.confirm(NAV_LEAVE_MSG)) return
      setIsDirty(false)
      setView('list')
    })
  }

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
    pristineExplanationsRef.current = {}
    groupCollapse.setAll([])
    setShowTranscriptBox(false)
    setForm(EMPTY_FORM); setEditing(null); setIsDirty(false); setView('form')
  }

  const openEdit = async (item) => {
    if (loadingEditId !== null) return
    setLoadingEditId(item.id)
    try {
      const data  = await getListeningPractice(item.id)
      const qData = data.questions
        ? (typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions)
        : { groups: [] }
      const next = {
        title: data.title || '',
        context: data.passage || '',
        transcript: data.transcript || '',
        audioUrl: data.audioUrl || null,
        audioBlobUrl: null,
        audioFile: null,
        audioName: data.audioUrl ? data.audioUrl.split('/').pop() : null,
        questionGroups: qData.groups || [],
        thumbnailUrl: data.thumbnailUrl || null,
        thumbPreview: resolveImg(data.thumbnailUrl),
        thumbFile: null,
      }
      setShowTranscriptBox(Boolean(data.transcript))
      pristineRef.current = formSig(next)
      pristineExplanationsRef.current = extractExplanationsMap(next)
      groupCollapse.setAll([])
      setForm(next)
      setEditing(data); setIsDirty(false); setView('form')
    } catch { showToast('Lỗi tải bài', 'error') }
    finally { setLoadingEditId(null) }
  }

  const handleGroupChange = (i, updated) => {
    setForm(f => ({ ...f, questionGroups: recalcGroups(f.questionGroups.map((g, idx) => idx === i ? updated : g)) }))
  }
  const handleGroupRemove = (i) => {
    setForm(f => ({ ...f, questionGroups: recalcGroups(f.questionGroups.filter((_, idx) => idx !== i)) }))
  }
  const handleGroupMove = (i, dir) => {
    setForm(f => {
      const arr = [...f.questionGroups]; const j = i + dir
      if (j < 0 || j >= arr.length) return f
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...f, questionGroups: recalcGroups(arr) }
    })
  }
  const handleAddGroup = () => {
    const lastEnd = form.questionGroups.length > 0 ? form.questionGroups[form.questionGroups.length - 1].qNumberEnd : 0
    const newGroup = emptyListeningGroupOf(addGroupType, lastEnd + 1)
    setForm(f => ({ ...f, questionGroups: [...f.questionGroups, newGroup] }))
    groupCollapse.reveal(newGroup._id)
  }

  const handleAudioPick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const v = validateAudioFile(file)
    if (!v.ok) { showToast(v.error, 'error'); e.target.value = ''; return }
    const blobUrl = URL.createObjectURL(file)
    setForm(prev => ({
      ...prev,
      audioBlobUrl: blobUrl,
      audioName: file.name,
    }))
    setUploadingAudio(true)
    try {
      const fd = new FormData()
      fd.append('audio', file)
      const res = await uploadListeningAudioFile(fd)
      setForm(prev => ({
        ...prev,
        audioUrl: res.url || res.audioUrl,
        audioName: file.name,
        audioFile: null,
      }))
      showToast('Đã tải lên audio thành công', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi tải audio lên — kiểm tra định dạng và dung lượng (≤ 50MB)', 'error')
    } finally {
      setUploadingAudio(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleTranscribeAudio = async () => {
    if (!form.audioUrl) {
      showToast('Vui lòng tải lên file audio trước khi phiên âm', 'error')
      return
    }
    setTranscribing(true)
    try {
      const res = await api.post('/admin/transcribe', { audioUrl: form.audioUrl })
      if (res.data?.transcript) {
        setForm(f => ({ ...f, transcript: res.data.transcript }))
        setShowTranscriptBox(true)
        showToast('Phiên âm AI thành công!', 'success')
      } else {
        showToast('Không có kết quả phiên âm từ audio', 'error')
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Lỗi phiên âm audio — thử lại sau'
      showToast(errMsg, 'error')
    } finally {
      setTranscribing(false)
    }
  }

  const handleSave = async () => {
    const val = validatePracticeListening(form, { isForAI: false })
    if (!val.isValid) {
      const alertMsg = formatValidationAlert('Không thể lưu bài Listening Practice', val.errors)
      showAlert(alertMsg, 'error')
      showToast(val.errors[0] || 'Vui lòng điền đầy đủ thông tin bài nghe và đáp án đúng', 'error')
      return
    }

    setSaving(true)
    try {
      // ── Bước 1: upload file mới (nếu có) TRƯỚC — record chỉ ghi khi file đã lên xong ──
      let thumbnailUrl = form.thumbnailUrl
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        try {
          thumbnailUrl = (await uploadListeningThumbnailFile(fd)).url
        } catch (e) {
          showToast(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.', 'error')
          return
        }
      }

      let audioUrl = form.audioUrl
      if (form.audioFile) {
        const fd = new FormData(); fd.append('audio', form.audioFile)
        try {
          audioUrl = (await uploadListeningAudioFile(fd)).url
        } catch (e) {
          showToast(e.response?.data?.message || 'Tải file audio lên thất bại. Bài chưa được lưu, vui lòng thử lại.', 'error')
          return
        }
      }

      // ── Bước 2: ghi record với URL đã có sẵn ──
      const body = {
        title: form.title.trim(),
        passage: form.context,
        transcript: form.transcript || null,
        thumbnailUrl: thumbnailUrl || null,
        audioUrl: audioUrl || null,
        questions: form.questionGroups.map((group, index) => ({ ...group, orderIndex: index }))
      }
      if (!editing) await createListeningPractice(body)
      else await updateListeningPractice(editing.id, body)

      clearDraft(); setIsDirty(false); setView('list')
      queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi lưu bài thi', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteListeningPractice(id)
      setDelConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
    }
    catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
    finally { setDeleting(false) }
  }

  const countProtectedQuestions = () => {
    let reviewedCount = 0
    let editedCount = 0
    for (const g of form.questionGroups || []) {
      const byNumber = g.explanations || {}
      for (const exp of Object.values(byNumber)) {
        if (exp?.status === 'teacher_reviewed') reviewedCount++
        if (exp?.status === 'teacher_edited') editedCount++
      }
    }
    return { reviewedCount, editedCount }
  }

  const handleStartGenerateAI = (e, { questionNumbers = null } = {}) => {
    if (!editing?.id) {
      showToast('Vui lòng lưu bài thi trước khi tạo giải thích bằng AI', 'info')
      return
    }
    const val = validatePracticeListening(form, { isForAI: true })
    if (!val.isValid) {
      const alertMsg = formatValidationAlert('Không thể tạo giải thích bằng AI', val.errors)
      showAlert(alertMsg, 'error')
      showToast(val.errors[0] || 'Vui lòng điền đầy đủ thông tin bài nghe và đáp án đúng', 'error')
      return
    }
    const stats = countProtectedQuestions()
    if (stats.reviewedCount + stats.editedCount > 0) {
      setProtectedStats(stats)
      setOverwriteModalOpen(true)
    } else {
      handleGenerateAI({ overwriteProtected: false, questionNumbers })
    }
  }

  const handleCancelAI = () => {
    isCancellingAIRef.current = true
    setIsCancellingAI(true)
    expLock.setIsCancelling(true)
    abortControllerRef.current?.abort()
  }

  const handleGenerateAI = async ({ resolveChoices = {}, overwriteProtected = false, questionNumbers = null } = {}) => {
    if (!editing?.id) {
      showToast('Vui lòng lưu bài thi trước khi tạo giải thích bằng AI', 'info')
      return
    }
    const val = validatePracticeListening(form, { isForAI: true })
    if (!val.isValid) {
      const alertMsg = formatValidationAlert('Không thể tạo giải thích bằng AI', val.errors)
      showAlert(alertMsg, 'error')
      showToast(val.errors[0] || 'Vui lòng điền đầy đủ thông tin bài nghe và đáp án đúng', 'error')
      return
    }

    setGeneratingAI(true)
    setIsCancellingAI(false)
    isCancellingAIRef.current = false
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setAiProgress({ current: 0, total: 0, label: 'chuẩn bị...' })

    const totalTarget = questionNumbers
      ? questionNumbers.length
      : form.questionGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0)

    expLock.startLocalGeneration({
      abortController,
      total: totalTarget,
      current: 0,
    })

    let loopResult = null

    try {
      // Tự động đồng bộ các thay đổi mới nhất lên server nếu form đang có chỉnh sửa
      if (isDirty) {
        let thumbnailUrl = form.thumbnailUrl
        if (form.thumbFile) {
          const fd = new FormData()
          fd.append('thumbnail', form.thumbFile)
          try {
            thumbnailUrl = (await uploadListeningThumbnailFile(fd)).url
          } catch { /* giữ URL cũ nếu lỗi ảnh */ }
        }
        let audioUrl = form.audioUrl
        if (form.audioFile) {
          const fd = new FormData()
          fd.append('audio', form.audioFile)
          try {
            audioUrl = (await uploadListeningAudioFile(fd)).url
          } catch { /* giữ URL cũ nếu lỗi audio */ }
        }
        const body = {
          title: form.title.trim(),
          context: form.context,
          transcript: form.transcript || null,
          audioUrl: audioUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          questions: form.questionGroups.map((group, index) => ({ ...group, orderIndex: index }))
        }
        await updateListeningPractice(editing.id, body)
        setIsDirty(false)
        pristineRef.current = formSig(form)
        pristineExplanationsRef.current = extractExplanationsMap(form)
      }

      loopResult = await executeTimedAIGenerationLoop({
        fetchChunk: (payload, opts) => {
          expLock.notifyChunkStart({
            current: aiProgress?.current || 0,
            total: aiProgress?.total || totalTarget,
          })
          return api.post(`/practice/admin/listening/${editing.id}/generate-explanations`, payload, opts)
        },
        basePayload: { force: true, overwriteProtected, resolveChoices, questionNumbers },
        signal: abortController.signal,
        onProgress: ({ current, total }) => {
          const p = {
            current,
            total,
            label: total > 0 ? `${current}/${total} câu` : 'đang xử lý...',
          }
          setAiProgress(p)
          expLock.updateLocalProgress(p)
        },
        onChunkSuccess: async () => {
          expLock.notifyChunkEnd({
            current: aiProgress?.current || 0,
            total: aiProgress?.total || totalTarget,
          })
          try {
            const fresh = await getListeningPractice(editing.id)
            const qData = typeof fresh.questions === 'string'
              ? JSON.parse(fresh.questions)
              : (fresh.questions || {})
            if (Array.isArray(qData.groups)) {
              setForm(f => ({ ...f, questionGroups: qData.groups }))
              pristineRef.current = formSig({ ...form, questionGroups: qData.groups })
              pristineExplanationsRef.current = extractExplanationsMap({ questionGroups: qData.groups })
            }
          } catch { /* ignore refresh error */ }
        },
      })

      if (loopResult.cancelled) {
        showToast('Đã dừng tác vụ sinh AI. Các câu đã xong đã được lưu lại.', 'info')
      } else if (loopResult.hasConflicts) {
        setAiConflicts(loopResult.conflicts || [])
        setConflictModalOpen(true)
        showToast('AI phát hiện đáp án có sự khác biệt so với bài nghe. Vui lòng kiểm tra!', 'warning')
      } else if (loopResult.errors?.length) {
        const firstErr = loopResult.errors[0]
        const msg = firstErr?.message || 'Không thể tạo giải thích bằng AI'
        if (firstErr?.status === 409) {
          showAlert(msg, 'warning')
        } else {
          showToast(msg, 'error')
        }
      } else {
        showToast(`Đã tạo giải thích 4 bước thành công cho ${loopResult.totalGenerated} câu hỏi!`, 'success')
        setConflictModalOpen(false)
        queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
      }
    } catch (err) {
      if (err.response?.status === 409) {
        showAlert(err.response?.data?.message || 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này.', 'warning')
      } else if (!abortController.signal.aborted && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        showToast(err.response?.data?.message || 'Không thể tạo giải thích bằng AI', 'error')
      }
    } finally {
      setGeneratingAI(false)
      setIsCancellingAI(false)
      setAiProgress(null)
      abortControllerRef.current = null
      expLock.endLocalGeneration({ completed: !loopResult?.cancelled, cancelled: Boolean(loopResult?.cancelled) })
    }
  }

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <>
        <div className="p-4 sm:p-6 max-w-[1520px] mx-auto">
          {/* Top Bar: Tiêu đề + Bộ nút thao tác chính (Sticky top) */}
          <div className="sticky top-0 z-20 bg-zinc-50/95 backdrop-blur-xs py-3.5 mb-5 border-b border-zinc-200 -mx-4 sm:-mx-6 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelOrBack}
                disabled={expLock.isLockedOperation}
                title={expLock.lockTooltip || 'Quay lại danh sách'}
                aria-label="Quay lại danh sách"
                className="w-8 h-8 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 flex items-center justify-center text-sm font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
                  {editing ? 'Chỉnh sửa bài Listening Practice' : 'Thêm bài Listening Practice mới'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-zinc-500 font-medium">
                    {form.questionGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0)} câu hỏi · {form.questionGroups.length} nhóm
                  </span>
                  {!draftBanner && <DraftSavedHint at={draftSavedAt} />}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={handleStartGenerateAI}
                  disabled={expLock.isLockedGenerate}
                  className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={expLock.isLockedGenerate ? (expLock.lockTooltip || 'Đang sinh giải thích AI, vui lòng chờ') : 'AI giải thích 4 bước từ transcript'}
                >
                  <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="hidden sm:inline">AI giải thích</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={expLock.isLockedOperation}
                aria-label="Preview nội dung đề"
                className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={expLock.lockTooltip}
              >
                <Eye className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Preview</span>
              </button>
              <button
                type="button"
                onClick={handleCancelOrBack}
                disabled={saving || expLock.isLockedOperation}
                className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-xs font-semibold transition shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || expLock.isLockedOperation}
                title={expLock.lockTooltip}
                className="h-9 px-4.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Đang lưu...' : 'Lưu bài'}
              </button>
            </div>
          </div>

          <AIGenerationResumeBanner
            banner={expLock.resumeBanner}
            disabled={expLock.isLockedOperation}
          />

          <DraftBanner
            draft={draftBanner}
            diffInfo={draftDiffInfo}
            onRestore={() => handleRestoreDraft()}
            onRestoreKeepDraft={() => handleRestoreDraft('keep_draft')}
            onDismiss={clearDraft}
          />

          {/* Grid 2 cột: Cột trái (Thông tin, Audio & Transcript), Cột phải (Nhóm câu hỏi) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── CỘT TRÁI (5/12): THÔNG TIN BÀI, AUDIO & TRANSCRIPT (Sticky) ── */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-[74px] lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto pr-0.5">
              {/* Card 1: Thông tin bài, Thumbnail & Context */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs space-y-3.5">
                <div>
                  <label className={labelCls}>Tên bài nghe <span className="text-red-500 font-normal">*</span></label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="VD: Listening — Section 1: Telephone Enquiry"
                    className={inputCls}
                  />
                </div>

                <div className="pt-1">
                  <ThumbnailPicker
                    preview={form.thumbPreview}
                    onSelect={file => setForm(f => ({ ...f, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))}
                    onClear={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                    hint="jpg, png, webp — tối đa 5MB"
                  />
                </div>

                <div>
                  <label className={labelCls}>Mô tả tình huống (Context)</label>
                  <textarea
                    value={form.context}
                    onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                    rows={3}
                    placeholder="VD: You will hear a conversation between a student and a library assistant..."
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 resize-y bg-white text-zinc-900 placeholder:text-zinc-400"
                    style={{ lineHeight: 1.6 }}
                  />
                </div>
              </div>

              {/* Card 2: Audio & Transcript */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs space-y-3.5">
                {/* Audio Upload / Player */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls + ' mb-0 font-bold'}>File Audio bài nghe</label>
                    {(form.audioName || form.audioUrl) && (
                      <button
                        type="button"
                        onClick={() => audioRef.current?.click()}
                        disabled={uploadingAudio}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                      >
                        Đổi file
                      </button>
                    )}
                  </div>

                  {uploadingAudio ? (
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-center flex flex-col items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5 text-zinc-700" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                      </svg>
                      <span className="text-xs text-zinc-600 font-medium">Đang tải audio lên hệ thống...</span>
                    </div>
                  ) : form.audioName || form.audioUrl ? (
                    <>
                      <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                        <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-800 font-medium flex-1 truncate">
                          {form.audioName || form.audioUrl?.split('/').pop() || 'Audio đã tải lên'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, audioFile: null, audioBlobUrl: null, audioName: null, audioUrl: null }))}
                          aria-label="Xóa file audio"
                          className="text-zinc-400 hover:text-red-500 text-sm shrink-0 font-bold transition p-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      {(form.audioBlobUrl || form.audioUrl) && (
                        <div className="mt-2.5">
                          <audio
                            controls
                            src={form.audioBlobUrl || toImgSrc(form.audioUrl)}
                            key={form.audioBlobUrl || form.audioUrl}
                            className="w-full rounded-lg"
                            style={{ height: '38px' }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => audioRef.current?.click()}
                      className="w-full border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/50 transition flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs cursor-pointer py-4"
                    >
                      <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-zinc-700">Chọn file audio (mp3, wav, m4a...)</span>
                      <span className="text-[11px] text-zinc-400">Tối đa 50MB</span>
                    </button>
                  )}
                  <input
                    ref={audioRef}
                    type="file"
                    accept=".mp3,.wav,.ogg,.m4a,.aac"
                    className="hidden"
                    onChange={handleAudioPick}
                  />
                </div>

                {/* Transcript + AI transcribe */}
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls + ' mb-0'}>Transcript (Lời thoại)</label>
                    <button
                      type="button"
                      onClick={handleTranscribeAudio}
                      disabled={!form.audioUrl || transcribing}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                        form.audioUrl && !transcribing
                          ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 cursor-pointer shadow-2xs'
                          : 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                      }`}
                    >
                      {transcribing ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5 text-zinc-600" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                          </svg>
                          <span>Đang phiên âm...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-zinc-700" />
                          <span>AI Phiên âm</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!form.transcript && !showTranscriptBox ? (
                    <div className="p-3 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
                      <span>{form.audioUrl ? 'Nhấn "Tự động phiên âm" để sinh transcript từ audio.' : 'Upload file audio để dùng tính năng phiên âm tự động.'}</span>
                      <button
                        type="button"
                        onClick={() => setShowTranscriptBox(true)}
                        className="text-zinc-600 hover:text-zinc-900 underline text-xs font-medium shrink-0 ml-2 cursor-pointer"
                      >
                        Nhập thủ công
                      </button>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={form.transcript}
                        onChange={e => setForm(f => ({ ...f, transcript: e.target.value }))}
                        rows={7}
                        placeholder={form.audioUrl ? 'Nhấn "AI Phiên âm" hoặc nhập thủ công...' : 'Upload audio để dùng AI phiên âm...'}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 resize-y bg-white text-zinc-900 placeholder:text-zinc-400"
                        style={{ lineHeight: 1.6 }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── CỘT PHẢI (7/12): NHÓM CÂU HỎI ── */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs">
                {/* Sticky Progress khi đang sinh AI */}
                <AIGenerationStickyProgress
                  isGenerating={expLock.isGenerating}
                  isCancelling={expLock.isCancelling}
                  progress={expLock.localProgress}
                  onCancel={handleCancelAI}
                />

                {/* Header thêm nhóm câu hỏi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100">
                  <div>
                    <label className={labelCls + ' mb-0 text-sm font-bold text-zinc-900'}>Nhóm câu hỏi</label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Thêm và cấu hình các dạng câu hỏi cho bài nghe
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      className="w-52 sm:w-60"
                      ariaLabel="Loại nhóm câu hỏi"
                      value={addGroupType}
                      onChange={setAddGroupType}
                      options={LISTENING_GROUP_TYPES}
                    />
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      disabled={expLock.isLockedOperation}
                      title={expLock.lockTooltip}
                      className={btnPrimary + ' h-9 py-0 px-4 text-xs font-semibold shrink-0 cursor-pointer flex items-center justify-center rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed'}
                    >
                      + Thêm nhóm
                    </button>
                  </div>
                </div>

                {form.questionGroups.length > 0 && (
                  <div className="flex items-center justify-between mb-3 text-xs px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-700">
                        Danh sách nhóm câu hỏi
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                        {form.questionGroups.length} nhóm · {form.questionGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0)} câu
                      </span>
                    </div>
                    {form.questionGroups.length > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => groupCollapse.setAll(form.questionGroups.map(g => g._id))}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                        >
                          Mở tất cả
                        </button>
                        <span className="text-zinc-300">·</span>
                        <button
                          type="button"
                          onClick={() => groupCollapse.setAll([])}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                        >
                          Thu gọn tất cả
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {form.questionGroups.length === 0 ? (
                  <div className="text-center text-zinc-400 text-xs py-14 border-2 border-dashed border-zinc-200 rounded-xl">
                    Chưa có nhóm câu hỏi nào. Chọn loại câu hỏi ở trên và bấm "+ Thêm nhóm".
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.questionGroups.map((g, i) => (
                      <PracticeGroupCard
                        key={g._id || g.id || i}
                        skill="listening"
                        group={g}
                        examId={editing?.id}
                        passage={form.transcript}
                        expanded={groupCollapse.isExpanded(g._id)}
                        onToggle={() => groupCollapse.toggle(g._id)}
                        onChange={updated => handleGroupChange(i, updated)}
                        onRemove={() => handleGroupRemove(i)}
                        onMoveUp={() => handleGroupMove(i, -1)}
                        onMoveDown={() => handleGroupMove(i, 1)}
                        isFirst={i === 0}
                        isLast={i === form.questionGroups.length - 1}
                        isAIBusy={expLock.isLockedOperation}
                        unsavedQuestionNumbers={unsavedQuestionNumbers}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showPreview && (
          <ListeningPracticePreviewModal
            form={form}
            showAnswers={showAnswers}
            setShowAnswers={setShowAnswers}
            onClose={() => { setShowPreview(false); setShowAnswers(false) }}
          />
        )}

        <ExplanationConflictModal
          isOpen={conflictModalOpen}
          onClose={() => setConflictModalOpen(false)}
          conflicts={aiConflicts}
          isSubmitting={generatingAI}
          onConfirmResolve={(choices) => handleGenerateAI({ resolveChoices: choices, overwriteProtected: false })}
        />

        <OverwriteProtectedConfirmModal
          isOpen={overwriteModalOpen}
          onClose={() => setOverwriteModalOpen(false)}
          reviewedCount={protectedStats.reviewedCount}
          editedCount={protectedStats.editedCount}
          isSubmitting={generatingAI}
          onConfirm={({ overwriteProtected }) => {
            setOverwriteModalOpen(false)
            handleGenerateAI({ overwriteProtected })
          }}
        />

        <AIGenerationExitConfirmModal
          isOpen={expLock.exitConfirmOpen}
          onClose={expLock.closeExitConfirm}
          onConfirmExit={expLock.confirmExit}
          currentCount={expLock.localProgress?.current || 0}
          totalCount={expLock.localProgress?.total || 0}
        />
      </>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <AdminListHeader
          title="Listening Practice"
          subtitle="Bài luyện nghe riêng lẻ — hiển thị trên trang chủ"
          onAdd={openAdd}
        />

        {/* Search & filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label htmlFor="listening-practice-search" className="sr-only">Tìm kiếm</label>
          <input
            id="listening-practice-search"
            type="text"
            placeholder="Tìm theo tên bài..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] h-9 px-3.5 text-xs border border-zinc-200 rounded-full focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white text-zinc-900 placeholder:text-zinc-400"
          />
          <label htmlFor="listening-practice-status" className="sr-only">Lọc theo trạng thái</label>
          <Select
            pill
            id="listening-practice-status"
            className="w-[168px] min-w-[168px] shrink-0"
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'has_audio', label: 'Có audio' },
              { value: 'no_audio', label: 'Chưa có audio' },
              { value: 'has_questions', label: 'Có câu hỏi' },
              { value: 'no_questions', label: 'Chưa có câu hỏi' },
            ]}
          />
          <label htmlFor="listening-practice-sort" className="sr-only">Sắp xếp</label>
          <Select
            pill
            id="listening-practice-sort"
            className="w-[168px] min-w-[168px] shrink-0"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'newest', label: 'Mới nhất' },
              { value: 'oldest', label: 'Cũ nhất' },
              { value: 'name', label: 'Tên A→Z' },
              { value: 'questions', label: 'Nhiều câu nhất' },
            ]}
          />
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 px-3.5 text-xs font-medium border border-zinc-200 rounded-full transition flex items-center gap-1.5 shrink-0 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 shadow-2xs cursor-pointer"
            title="Đặt lại bộ lọc"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Reset</span>
          </button>
        </div>

        {hasActiveFilter && (
          <p className="text-[11px] text-zinc-500 mb-3">{filteredList.length} bài khớp bộ lọc</p>
        )}

        {isPending && list.length === 0 ? (
          <AdminTableSkeleton firstColType="thumbnail" rows={6} cols={6} />
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            {list.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400">Chưa có bài nào.</div>
            ) : filteredList.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400">
                <p>Không tìm thấy bài nào khớp với bộ lọc.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition text-xs cursor-pointer"
                >
                  Reset bộ lọc
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="rtable w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 w-16">Ảnh</th>
                    <th className="min-w-[10rem] px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tên bài</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Audio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Câu</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Ngày tạo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map(item => (
                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition">
                      <td className="rt-thumb px-4 py-3">
                        <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageWithFallback
                            src={resolveImg(item.thumbnailUrl)}
                            alt={item.title || 'Thumbnail'}
                          />
                        </div>
                      </td>
                      <td className="rt-main px-4 py-3 text-sm font-medium text-zinc-800">{item.title}</td>
                      <td data-label="Audio" className="px-4 py-3 hidden sm:table-cell">
                        {item.audioUrl
                          ? <span className="text-xs text-green-600 font-medium">🎵 Có audio</span>
                          : <span className="text-xs text-amber-600 font-medium">⚠ Thiếu audio</span>}
                      </td>
                      <td data-label="Số câu" className="px-4 py-3 hidden sm:table-cell">
                        {(() => {
                          const count = item.questionCount ?? 0; const total = 40
                          const bg    = count === total ? '#dcfce7' : count > total ? '#fee2e2' : '#f4f4f5'
                          const color = count === total ? '#15803d' : count > total ? '#dc2626' : '#71717a'
                          return <span style={{ background: bg, color, borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{count}/{total}</span>
                        })()}
                      </td>
                      <td data-label="Ngày tạo" className="px-4 py-3 text-sm text-zinc-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="rt-actions px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(item)} disabled={loadingEditId !== null} className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Sửa</button>
                          <button onClick={() => setDelConfirm(item.id)} disabled={loadingEditId !== null} className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!delConfirm}
        title="Xóa bài nghe?"
        onCancel={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
        loading={deleting}
      />

      <ExplanationConflictModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflicts={aiConflicts}
        isSubmitting={generatingAI}
        onConfirmResolve={(choices) => handleGenerateAI(choices)}
      />
    </>
  )
}
