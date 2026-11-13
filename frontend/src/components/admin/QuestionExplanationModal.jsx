import { useState, useEffect, useRef } from 'react'
import {
  X, Check, AlertTriangle, RefreshCw, Edit3, Eye,
  CheckCircle2, AlertCircle, Loader2, ArrowRight, Plus, Trash2,
} from 'lucide-react'
import api from '../../utils/axios'
import ReviewExplanation from '../exam/ReviewExplanation'

function AutoResizeTextarea({
  value = '',
  onChange,
  minRows = 3,
  className = '',
  placeholder = '',
  maxLength,
  disabled = false,
  ...props
}) {
  const textareaRef = useRef(null)

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const computedLineHeight = 22
    const minHeight = minRows * computedLineHeight + 24
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
  }

  useEffect(() => {
    adjustHeight()
  }, [value, minRows])

  return (
    <textarea
      ref={textareaRef}
      rows={minRows}
      value={value}
      onChange={(e) => {
        onChange?.(e)
        requestAnimationFrame(adjustHeight)
      }}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className={`w-full text-sm leading-relaxed p-3.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 font-sans resize-none overflow-hidden ${className}`}
      {...props}
    />
  )
}

export function getExplanationStatusInfo(explanation, {
  isGenerating = false,
  isUnsaved = false,
  runStatus = null,
  runErrorMessage = null,
} = {}) {
  if (isGenerating || runStatus === 'generating') {
    return {
      status: 'generating',
      label: 'Đang sinh...',
      chipLabel: 'Đang sinh',
      fullLabel: 'AI đang tạo giải thích...',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300 animate-pulse',
      dotClass: 'bg-sky-500 animate-ping',
    }
  }

  if (runStatus === 'error') {
    return {
      status: 'error',
      label: 'Lỗi sinh AI',
      chipLabel: 'Lỗi',
      fullLabel: runErrorMessage
        ? `Lỗi ở lần sinh gần nhất: ${runErrorMessage}`
        : 'Lỗi khi tạo giải thích bằng AI ở lần chạy gần nhất',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
      dotClass: 'bg-rose-500',
    }
  }

  if (runStatus === 'retry') {
    return {
      status: 'needs_retry',
      label: 'Cần kiểm tra lại',
      chipLabel: 'Cần kiểm tra',
      fullLabel: 'Kết quả dự phòng chưa đủ tin cậy, nên mở câu này để kiểm tra lại',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500',
    }
  }

  if (isUnsaved) {
    return {
      status: 'unsaved',
      label: 'Chưa lưu',
      chipLabel: 'Chưa lưu',
      fullLabel: 'Giải thích đã sửa đổi nhưng chưa lưu vào hệ thống',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500',
    }
  }

  if (!explanation || typeof explanation !== 'object') {
    return {
      status: 'none',
      label: 'Chưa có lời giải',
      chipLabel: 'Chưa sinh',
      fullLabel: 'Chưa có lời giải',
      badgeClass: 'bg-zinc-50 text-zinc-400 border-zinc-200 border-dashed',
      dotClass: 'bg-zinc-300',
    }
  }

  const s = explanation.status

  if (s === 'error') {
    return {
      status: 'error',
      label: 'Lỗi sinh AI',
      chipLabel: 'Lỗi',
      fullLabel: 'Lỗi khi tạo giải thích bằng AI',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
      dotClass: 'bg-rose-500',
    }
  }

  // 3.2: Legacy explanations without status are treated as ai_generated
  if (!s || s === 'ai_generated') {
    return {
      status: 'ai_generated',
      label: 'AI sinh',
      chipLabel: 'AI sinh',
      fullLabel: 'AI sinh',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300',
      dotClass: 'bg-sky-500',
    }
  }

  if (s === 'teacher_reviewed') {
    return {
      status: 'teacher_reviewed',
      label: 'Đã duyệt',
      chipLabel: 'Đã duyệt',
      fullLabel: 'Đã duyệt bởi giáo viên',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      dotClass: 'bg-emerald-500',
    }
  }

  if (s === 'teacher_edited') {
    return {
      status: 'teacher_edited',
      label: 'Đã sửa',
      chipLabel: 'Đã sửa',
      fullLabel: 'Đã sửa tay bởi giáo viên',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300',
      dotClass: 'bg-indigo-500',
    }
  }

  if (s === 'conflict_pending') {
    return {
      status: 'conflict_pending',
      label: 'Chờ duyệt',
      chipLabel: 'Chờ duyệt',
      fullLabel: 'Chờ duyệt (Lệch đáp án giữa AI và giáo viên)',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500',
    }
  }

  if (s === 'needs_regeneration') {
    return {
      status: 'needs_regeneration',
      label: 'Cần sinh lại',
      chipLabel: 'Cần sinh lại',
      fullLabel: 'Cần sinh lại lời giải do đổi đáp án',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-300',
      dotClass: 'bg-orange-500',
    }
  }

  if (s === 'possibly_stale') {
    return {
      status: 'possibly_stale',
      label: 'Có thể lỗi thời',
      chipLabel: 'Lỗi thời',
      fullLabel: 'Có thể lỗi thời do câu hỏi đã đổi',
      badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-300',
      dotClass: 'bg-zinc-400',
    }
  }

  return {
    status: s,
    label: s,
    chipLabel: s,
    fullLabel: s,
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    dotClass: 'bg-zinc-400',
  }
}

export function ExplanationStatusBadge({
  explanation,
  isGenerating = false,
  isUnsaved = false,
  runStatus = null,
  runErrorMessage = null,
  className = '',
}) {
  const info = getExplanationStatusInfo(explanation, { isGenerating, isUnsaved, runStatus, runErrorMessage })
  const isConflict = info.status === 'conflict_pending'
  const isGeneratingStatus = info.status === 'generating'
  const tooltipText = isConflict
    ? 'Chờ duyệt (Lệch đáp án giữa AI và giáo viên)'
    : info.fullLabel || `Trạng thái: ${info.label}`
  const displayLabel = info.chipLabel || info.label

  return (
    <span
      className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-tight border shrink-0 whitespace-nowrap h-5 ${info.badgeClass} ${className}`}
      title={tooltipText}
    >
      {isGeneratingStatus ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-600 shrink-0" />
      ) : isConflict ? (
        <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${info.dotClass} shrink-0`} />
      )}
      <span>{displayLabel}</span>
    </span>
  )
}

export function isSameAnswer(a, b) {
  if (a == null || b == null) return false
  const cleanA = String(a).trim().toLowerCase().replace(/^[A-Za-z][.:)]\s*/, '').replace(/[.,;:!?]+$/, '')
  const cleanB = String(b).trim().toLowerCase().replace(/^[A-Za-z][.:)]\s*/, '').replace(/[.,;:!?]+$/, '')
  const rawA = String(a).trim().toLowerCase().replace(/[.,;:!?]+$/, '')
  const rawB = String(b).trim().toLowerCase().replace(/[.,;:!?]+$/, '')
  return rawA === rawB || cleanA === cleanB || cleanA === rawB || rawA === cleanB
}

export default function QuestionExplanationModal({
  isOpen,
  onClose,
  examId,
  question,
  initialExplanation = null,
  skill = 'reading',
  isPractice = false,
  onExplanationUpdated,
  isAIBusy = false,
  runStatus = null,
  runErrorMessage = null,
}) {
  const [activeTab, setActiveTab] = useState('view') // 'view' | 'edit'
  const [currentExplanation, setCurrentExplanation] = useState(null)

  // Edit tab state
  // Bước 1
  const [editPredict, setEditPredict] = useState('')
  const [editQuestionChunks, setEditQuestionChunks] = useState([])
  // Bước 2
  const [editLocateNote, setEditLocateNote] = useState('')
  const [editLocateKeywords, setEditLocateKeywords] = useState([])
  // Bước 3
  const [editEvidenceParts, setEditEvidenceParts] = useState([])
  const [editEvidenceChunks, setEditEvidenceChunks] = useState([])
  const [editParaphrases, setEditParaphrases] = useState([])
  // Bước 4
  const [editFullSentence, setEditFullSentence] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [editReasoning, setEditReasoning] = useState('')
  const [editDistractors, setEditDistractors] = useState([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)

  // Review state
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)
  const prevQKeyRef = useRef(null)

  const qType = (question?.type || question?.group?.type || '').toLowerCase()
  const nonCompletionTypes = new Set([
    'mcq', 'multiple_choice', 'mcq_multi', 'list_selection', 'choose_title',
    'true_false_ng', 'yes_no_ng', 'true_false_not_given', 'yes_no_not_given',
    'matching', 'matching_headings', 'matching_features', 'matching_paragraph', 'matching_endings',
    'map_diagram', 'diagram_label', 'diagram_completion'
  ])
  const isCompletion = qType
    ? !nonCompletionTypes.has(qType)
    : Boolean(question?.explanation?.full_sentence || initialExplanation?.full_sentence || !question?.options)

  useEffect(() => {
    if (!isOpen) {
      prevQKeyRef.current = null
      return
    }
    const qKey = `${examId}-${isPractice ? 'p' : 'e'}-${question?.id || question?.number}`
    const exp = question?.explanation || initialExplanation || null
    if (prevQKeyRef.current !== qKey) {
      prevQKeyRef.current = qKey
      setCurrentExplanation(exp)
      setReviewError(null)
      // Bước 1
      setEditPredict(exp?.predict || '')
      setEditQuestionChunks(Array.isArray(exp?.question_chunks) ? exp.question_chunks.map(c => ({ text: c.text || '', label: c.label || '' })) : [])
      // Bước 2
      setEditLocateNote(exp?.locate?.note || '')
      setEditLocateKeywords(Array.isArray(exp?.locate?.keywords) ? [...exp.locate.keywords] : [])
      // Bước 3
      const parts = Array.isArray(exp?.evidence?.parts)
        ? exp.evidence.parts.map(p => ({ text: p.text || '' }))
        : (exp?.evidence?.text ? [{ text: exp.evidence.text }] : [])
      setEditEvidenceParts(parts)
      setEditEvidenceChunks(Array.isArray(exp?.evidence?.chunks) ? exp.evidence.chunks.map(c => ({ text: c.text || '', label: c.label || '' })) : [])
      setEditParaphrases(Array.isArray(exp?.paraphrases) ? exp.paraphrases.map(p => ({
        question: p.question || '',
        question_label: p.question_label || '',
        passage: p.passage || '',
        passage_label: p.passage_label || '',
      })) : [])
      // Bước 4
      setEditFullSentence(exp?.full_sentence || '')
      setEditTranslation(exp?.translation || '')
      setEditReasoning(exp?.reasoning || '')
      setEditDistractors(Array.isArray(exp?.distractors) ? [...exp.distractors] : [])
      setEditError(null)
      setActiveTab('view')
    } else if (exp && exp !== currentExplanation) {
      setCurrentExplanation(exp)
    }
  }, [isOpen, examId, isPractice, question?.id, question?.number, question?.explanation, initialExplanation])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSavingEdit && !isReviewing) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isSavingEdit, isReviewing, onClose])

  if (!isOpen || !question) return null

  const statusInfo = getExplanationStatusInfo(currentExplanation, { runStatus, runErrorMessage })
  const qNum = question.number
  const qId = question.id || qNum

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ─── 4.4 MANUAL EDIT HANDLER ──────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setIsSavingEdit(true)
    setEditError(null)

    try {
      const url = isPractice
        ? `/practice/admin/${skill}/${examId}/questions/${qNum}/explanation`
        : `/admin/exams/${examId}/questions/${qId}/explanation`

      const payload = {
        // Bước 1
        predict: editPredict,
        question_chunks: editQuestionChunks.filter(c => (c.text || '').trim()),

        // Bước 2
        locate: {
          note: editLocateNote,
          keywords: editLocateKeywords.map(k => (k || '').trim()).filter(Boolean),
        },

        // Bước 3
        evidence: {
          parts: editEvidenceParts.map(p => ({ text: (p.text || '').trim() })).filter(p => p.text),
          chunks: editEvidenceChunks.map(c => ({ text: (c.text || '').trim(), label: (c.label || '').trim() })).filter(c => c.text),
        },
        paraphrases: editParaphrases.map(p => ({
          question: (p.question || '').trim(),
          question_label: (p.question_label || '').trim(),
          passage: (p.passage || '').trim(),
          passage_label: (p.passage_label || '').trim(),
        })).filter(p => p.question && p.passage),

        // Bước 4
        full_sentence: isCompletion ? editFullSentence : '',
        translation: isCompletion ? editTranslation : '',
        reasoning: editReasoning,
        distractors: editDistractors.filter(d => (d.option || '').trim() && (d.reason || '').trim()),
      }

      const res = await api.put(url, payload)
      const data = res.data

      if (data.explanation) {
        setCurrentExplanation(data.explanation)
        onExplanationUpdated?.(data.explanation, qNum)
        setActiveTab('view')
        showToast('Đã lưu chỉnh sửa lời giải!')
      }
    } catch (err) {
      console.error('[SAVE EDIT ERROR]', err)
      setEditError(err?.response?.data?.message || err?.message || 'Lỗi khi lưu chỉnh sửa.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // ─── 4.5 REVIEW HANDLER ───────────────────────────────────────────────────
  const handleReview = async () => {
    setIsReviewing(true)
    setReviewError(null)
    try {
      const url = isPractice
        ? `/practice/admin/${skill}/${examId}/questions/${qNum}/review-explanation`
        : `/admin/exams/${examId}/questions/${qId}/review-explanation`

      const res = await api.post(url, {})
      const data = res.data

      if (data.explanation) {
        setCurrentExplanation(data.explanation)
        onExplanationUpdated?.(data.explanation, qNum)
        showToast('Đã duyệt lời giải thành công!')
      }
    } catch (err) {
      console.error('[REVIEW ERROR]', err)
      setReviewError(err?.response?.data?.message || err?.message || 'Không duyệt được lời giải. Vui lòng thử lại.')
    } finally {
      setIsReviewing(false)
    }
  }

  // --- Step 1 helpers ---
  const addQuestionChunk = () => {
    if (editQuestionChunks.length >= 12) return
    setEditQuestionChunks([...editQuestionChunks, { text: '', label: '' }])
  }
  const removeQuestionChunk = (idx) => {
    setEditQuestionChunks(editQuestionChunks.filter((_, i) => i !== idx))
  }
  const updateQuestionChunkField = (idx, field, value) => {
    const next = [...editQuestionChunks]
    next[idx] = { ...next[idx], [field]: value }
    setEditQuestionChunks(next)
  }

  // --- Step 2 helpers ---
  const addLocateKeyword = () => {
    if (editLocateKeywords.length >= 5) return
    setEditLocateKeywords([...editLocateKeywords, ''])
  }
  const removeLocateKeyword = (idx) => {
    setEditLocateKeywords(editLocateKeywords.filter((_, i) => i !== idx))
  }
  const updateLocateKeyword = (idx, value) => {
    const next = [...editLocateKeywords]
    next[idx] = value
    setEditLocateKeywords(next)
  }

  // --- Step 3 helpers ---
  const addEvidencePart = () => {
    if (editEvidenceParts.length >= 5) return
    setEditEvidenceParts([...editEvidenceParts, { text: '' }])
  }
  const removeEvidencePart = (idx) => {
    setEditEvidenceParts(editEvidenceParts.filter((_, i) => i !== idx))
  }
  const updateEvidencePart = (idx, value) => {
    const next = [...editEvidenceParts]
    next[idx] = { text: value }
    setEditEvidenceParts(next)
  }

  const addEvidenceChunk = () => {
    if (editEvidenceChunks.length >= 10) return
    setEditEvidenceChunks([...editEvidenceChunks, { text: '', label: '' }])
  }
  const removeEvidenceChunk = (idx) => {
    setEditEvidenceChunks(editEvidenceChunks.filter((_, i) => i !== idx))
  }
  const updateEvidenceChunkField = (idx, field, value) => {
    const next = [...editEvidenceChunks]
    next[idx] = { ...next[idx], [field]: value }
    setEditEvidenceChunks(next)
  }

  const addParaphrase = () => {
    if (editParaphrases.length >= 5) return
    setEditParaphrases([...editParaphrases, { question: '', question_label: '', passage: '', passage_label: '' }])
  }
  const removeParaphrase = (idx) => {
    setEditParaphrases(editParaphrases.filter((_, i) => i !== idx))
  }
  const updateParaphraseField = (idx, field, value) => {
    const next = [...editParaphrases]
    next[idx] = { ...next[idx], [field]: value }
    setEditParaphrases(next)
  }

  // --- Step 4 helpers ---
  const addDistractor = () => {
    if (editDistractors.length >= 10) return
    setEditDistractors([...editDistractors, { option: '', reason: '', label: '' }])
  }

  const removeDistractor = (idx) => {
    setEditDistractors(editDistractors.filter((_, i) => i !== idx))
  }

  const updateDistractorField = (idx, field, value) => {
    const next = [...editDistractors]
    next[idx] = { ...next[idx], [field]: value }
    setEditDistractors(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSavingEdit && !isReviewing) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-3xl w-[960px] max-w-[95vw] h-[720px] max-h-[92vh] p-6 sm:p-7 shadow-2xl relative border border-zinc-100 flex flex-col my-auto">
        {/* Toast notification */}
        {toastMessage && (
          <div className="absolute top-5 right-16 z-20 bg-zinc-900 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="rounded-full bg-zinc-900 text-white text-sm font-bold px-3.5 py-1">
                Câu {qNum}
              </span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {question.type}
              </span>
              <ExplanationStatusBadge explanation={currentExplanation} />
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="font-semibold text-zinc-800">Đáp án chuẩn:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono font-bold text-emerald-700 text-sm">
                {question.correctAnswer || '(Chưa có)'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSavingEdit || isReviewing}
            className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50 shrink-0 ml-3"
            aria-label="Đóng"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 border-b border-zinc-100 pt-3.5 pb-2.5 shrink-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'view'}
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'view'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            Xem lời giải
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'edit'}
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Edit3 className="w-4 h-4 text-indigo-400" />
            Sửa trực tiếp
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-2">
          {/* TAB 1: VIEW EXPLANATION */}
          {activeTab === 'view' && (
            <div className="space-y-4">
              {/* Conflict banner */}
              {statusInfo.status === 'conflict_pending' && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Lệch đáp án giữa AI và giáo viên (Chờ duyệt)</p>
                    <p>
                      Đáp án do AI sinh ra là: <strong className="underline">{currentExplanation?.aiAnswer || currentExplanation?.answer}</strong>, trong khi đáp án của đề là: <strong className="underline">{question.correctAnswer}</strong>.
                    </p>
                    <p className="text-amber-800 font-medium">
                      🔒 Lời giải này đang được <strong>ẨN KHỎI HỌC SINH</strong>. Bạn có thể mở tab <em>Sửa trực tiếp</em> để chỉnh lời giải cho khớp đáp án, hoặc bấm <em>Duyệt</em> nếu bạn đồng ý với lời giải hiện tại.
                    </p>
                  </div>
                </div>
              )}

              {/* Needs regeneration banner */}
              {statusInfo.status === 'needs_regeneration' && (
                <div className="rounded-2xl border border-orange-300 bg-orange-50/80 p-3.5 text-xs text-orange-900 flex items-start gap-3">
                  <RefreshCw className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Đáp án gốc của giáo viên được giữ nguyên</p>
                    <p>
                      Lời giải hiện tại từng được sinh cho một đáp án khác nên đang bị ẩn khỏi học sinh. Vui lòng mở tab <strong>"Sửa trực tiếp"</strong> để cập nhật lời giải cho khớp với đáp án <strong>"{question.correctAnswer}"</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Possibly stale banner */}
              {statusInfo.status === 'possibly_stale' && (
                <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-3.5 text-xs text-zinc-800 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Đề bài hoặc đáp án vừa được chỉnh sửa (Có thể lỗi thời)</p>
                    <p>
                      {currentExplanation?.staleReason || 'Câu hỏi đã thay đổi sau khi tạo giải thích.'} Lời giải đang tạm ẩn khỏi học sinh cho đến khi được duyệt hoặc tạo lại.
                    </p>
                  </div>
                </div>
              )}

              {/* C.4: Banner displaying which answer this explanation explains */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-600">Lời giải này giải thích đáp án:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono font-bold text-emerald-700 text-xs">
                    {currentExplanation?.answer || question.correctAnswer}
                  </span>
                </div>
                {currentExplanation?.answer && question.correctAnswer && !isSameAnswer(currentExplanation.answer, question.correctAnswer) && (
                  <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-medium">
                      Cảnh báo: Lời giải đang giải thích đáp án "{currentExplanation.answer}", khác với đáp án đang lưu "{question.correctAnswer}".
                    </span>
                  </div>
                )}
              </div>

              {/* 4-Step Explanation View */}
              <ReviewExplanation explanation={currentExplanation} correctAnswer={question.correctAnswer} />
            </div>
          )}

          {/* TAB 3: DIRECT MANUAL EDIT */}
          {activeTab === 'edit' && (
            <div className="space-y-6">
              {editError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* ──────── BƯỚC 1: Phân tích câu hỏi và dự đoán ──────── */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                  <span className="rounded-full bg-zinc-900 text-white text-[11px] font-bold px-2 py-0.5">
                    STEP 01
                  </span>
                  <h4 className="font-bold text-zinc-900 text-sm m-0">Bước 1: Phân tích câu hỏi và dự đoán</h4>
                </div>

                {/* Predict */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Dự đoán / Phân tích yêu cầu câu hỏi (predict, tối đa 1000 ký tự):
                    </label>
                    <span className="text-[11px] text-zinc-400">{editPredict.length}/1000</span>
                  </div>
                  <AutoResizeTextarea
                    minRows={2}
                    value={editPredict}
                    onChange={(e) => setEditPredict(e.target.value.slice(0, 1000))}
                    placeholder="Câu hỏi cần thông tin gì, loại đáp án cần tìm..."
                    maxLength={1000}
                  />
                </div>

                {/* Question Chunks */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700">
                      Tách cụm câu hỏi (question_chunks, tối đa 12 cụm):
                    </label>
                    <button
                      type="button"
                      onClick={addQuestionChunk}
                      disabled={editQuestionChunks.length >= 12}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm cụm
                    </button>
                  </div>

                  {editQuestionChunks.map((chunk, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-2.5">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={chunk.text || ''}
                          onChange={(e) => updateQuestionChunkField(idx, 'text', e.target.value.slice(0, 200))}
                          placeholder="Cụm tiếng Anh (VD: the global summit)"
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <input
                          type="text"
                          value={chunk.label || ''}
                          onChange={(e) => updateQuestionChunkField(idx, 'label', e.target.value.slice(0, 80))}
                          placeholder="Nghĩa / vai trò tiếng Việt (VD: chủ ngữ)"
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestionChunk(idx)}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                        title="Xóa cụm này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ──────── BƯỚC 2: Định vị thông tin liên quan ──────── */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                  <span className="rounded-full bg-zinc-900 text-white text-[11px] font-bold px-2 py-0.5">
                    STEP 02
                  </span>
                  <h4 className="font-bold text-zinc-900 text-sm m-0">Bước 2: Định vị thông tin liên quan</h4>
                </div>

                {/* Locate Note */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Ghi chú định vị (locate.note, tối đa 600 ký tự):
                    </label>
                    <span className="text-[11px] text-zinc-400">{editLocateNote.length}/600</span>
                  </div>
                  <AutoResizeTextarea
                    minRows={2}
                    value={editLocateNote}
                    onChange={(e) => setEditLocateNote(e.target.value.slice(0, 600))}
                    placeholder="Ý nào trong câu hỏi giúp tìm vùng cần đọc, tìm thấy ở đâu trong bài..."
                    maxLength={600}
                  />
                </div>

                {/* Locate Keywords */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block">
                        Từ khóa định vị (locate.keywords, tối đa 5 từ khóa):
                      </label>
                      <span className="text-[11px] text-zinc-400">
                        Mỗi từ khóa bắt buộc phải xuất hiện NGUYÊN VĂN trong bài đọc/transcript.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addLocateKeyword}
                      disabled={editLocateKeywords.length >= 5}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm từ khóa
                    </button>
                  </div>

                  {editLocateKeywords.map((kw, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={kw || ''}
                        onChange={(e) => updateLocateKeyword(idx, e.target.value.slice(0, 120))}
                        placeholder="Từ khóa nguyên văn trong bài đọc..."
                        className="flex-1 text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => removeLocateKeyword(idx)}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                        title="Xóa từ khóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Auto paragraph note */}
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-2.5 text-xs text-sky-800 flex items-center gap-2">
                  <span className="font-semibold text-sky-900">Vị trí đoạn (locate.paragraph):</span>
                  <span>Hệ thống sẽ tự động xác định số đoạn văn trong bài dựa trên bằng chứng và từ khóa hợp lệ khi lưu.</span>
                </div>
              </div>

              {/* ──────── BƯỚC 3: Đọc thông tin liên quan (evidence) ──────── */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                  <span className="rounded-full bg-zinc-900 text-white text-[11px] font-bold px-2 py-0.5">
                    STEP 03
                  </span>
                  <h4 className="font-bold text-zinc-900 text-sm m-0">Bước 3: Đọc thông tin liên quan (Bằng chứng)</h4>
                </div>

                {['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type) && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    Câu hỏi dạng hình ảnh / sơ đồ không có văn bản bài đọc: các trường bằng chứng ở chế độ chỉ đọc.
                  </div>
                )}

                {/* Evidence Parts */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block">
                        Câu/đoạn trích dẫn nguyên văn (evidence.parts, tối đa 5 câu):
                      </label>
                      <span className="text-[11px] text-zinc-400">
                        Chép NGUYÊN VĂN từng chữ từ bài đọc/transcript, server sẽ xác thực tính nguyên văn.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addEvidencePart}
                      disabled={editEvidenceParts.length >= 5 || ['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm câu trích
                    </button>
                  </div>

                  {editEvidenceParts.map((part, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                          Trích dẫn #{idx + 1}
                        </span>
                        <AutoResizeTextarea
                          minRows={2}
                          value={part.text || ''}
                          onChange={(e) => updateEvidencePart(idx, e.target.value.slice(0, 1200))}
                          placeholder="Chép nguyên văn câu trong bài đọc..."
                          disabled={['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                          maxLength={1200}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEvidencePart(idx)}
                        disabled={['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer mt-5"
                        title="Xóa câu trích"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Evidence Chunks */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block">
                        Cụm từ quan trọng trong câu trích (evidence.chunks, tối đa 10):
                      </label>
                      <span className="text-[11px] text-zinc-400">
                        Cụm tiếng Anh phải nằm NGUYÊN VĂN bên trong câu trích dẫn ở trên.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addEvidenceChunk}
                      disabled={editEvidenceChunks.length >= 10 || ['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm cụm từ
                    </button>
                  </div>

                  {editEvidenceChunks.map((chunk, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-2.5">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={chunk.text || ''}
                          onChange={(e) => updateEvidenceChunkField(idx, 'text', e.target.value.slice(0, 200))}
                          placeholder="Cụm từ nguyên văn trong câu trích"
                          disabled={['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <input
                          type="text"
                          value={chunk.label || ''}
                          onChange={(e) => updateEvidenceChunkField(idx, 'label', e.target.value.slice(0, 80))}
                          placeholder="Nghĩa ngắn tiếng Việt"
                          disabled={['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEvidenceChunk(idx)}
                        disabled={['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                        title="Xóa cụm từ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Paraphrases */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block">
                        Đối chiếu paraphrasing (paraphrases, tối đa 5 cặp):
                      </label>
                      <span className="text-[11px] text-zinc-400">
                        Cụm trong bài đọc bắt buộc phải xuất hiện NGUYÊN VĂN trong bài.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addParaphrase}
                      disabled={editParaphrases.length >= 5 || ['diagram_completion', 'diagram_label', 'map_diagram'].includes(question.type)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm cặp đối chiếu
                    </button>
                  </div>

                  {editParaphrases.map((p, idx) => (
                    <div key={idx} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cặp đối chiếu #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeParaphrase(idx)}
                          className="w-6 h-6 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Xóa cặp này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={p.question || ''}
                          onChange={(e) => updateParaphraseField(idx, 'question', e.target.value.slice(0, 160))}
                          placeholder="Cụm trong câu hỏi..."
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <input
                          type="text"
                          value={p.question_label || ''}
                          onChange={(e) => updateParaphraseField(idx, 'question_label', e.target.value.slice(0, 80))}
                          placeholder="Nghĩa cụm câu hỏi..."
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <input
                          type="text"
                          value={p.passage || ''}
                          onChange={(e) => updateParaphraseField(idx, 'passage', e.target.value.slice(0, 160))}
                          placeholder="Cụm NGUYÊN VĂN trong bài..."
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <input
                          type="text"
                          value={p.passage_label || ''}
                          onChange={(e) => updateParaphraseField(idx, 'passage_label', e.target.value.slice(0, 80))}
                          placeholder="Nghĩa cụm bài đọc..."
                          className="text-xs p-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ──────── BƯỚC 4: Chọn đáp án ──────── */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                  <span className="rounded-full bg-zinc-900 text-white text-[11px] font-bold px-2 py-0.5">
                    STEP 04
                  </span>
                  <h4 className="font-bold text-zinc-900 text-sm m-0">Bước 4: Chọn đáp án & Suy luận</h4>
                </div>

                {isCompletion && (
                  <>
                    {/* Full sentence */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-zinc-700">
                          Câu hoàn chỉnh sau khi điền (full_sentence, tối đa 1000 ký tự):
                        </label>
                        <span className="text-[11px] text-zinc-400">{editFullSentence.length}/1000</span>
                      </div>
                      <AutoResizeTextarea
                        minRows={2}
                        value={editFullSentence}
                        onChange={(e) => setEditFullSentence(e.target.value.slice(0, 1000))}
                        placeholder="Câu tiếng Anh đầy đủ sau khi điền đáp án..."
                        maxLength={1000}
                      />
                    </div>

                    {/* Translation */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-zinc-700">
                          Bản dịch tiếng Việt (translation, tối đa 1000 ký tự):
                        </label>
                        <span className="text-[11px] text-zinc-400">{editTranslation.length}/1000</span>
                      </div>
                      <AutoResizeTextarea
                        minRows={2}
                        value={editTranslation}
                        onChange={(e) => setEditTranslation(e.target.value.slice(0, 1000))}
                        placeholder="Dịch nghĩa tiếng Việt của câu trên..."
                        maxLength={1000}
                      />
                    </div>
                  </>
                )}

                {/* Reasoning */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Suy luận & Giải thích chi tiết (reasoning, tối đa 2000 ký tự):
                    </label>
                    <span className="text-[11px] text-zinc-400">{editReasoning.length}/2000</span>
                  </div>
                  <AutoResizeTextarea
                    minRows={4}
                    value={editReasoning}
                    onChange={(e) => setEditReasoning(e.target.value.slice(0, 2000))}
                    placeholder="Lập luận vì sao đáp án này đúng, đối chiếu bài đọc..."
                    maxLength={2000}
                  />
                </div>

                {/* Distractors list */}
                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700">
                      Phân tích các đáp án sai / nhiễu (distractors, tối đa 10):
                    </label>
                    <button
                      type="button"
                      onClick={addDistractor}
                      disabled={editDistractors.length >= 10}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm lựa chọn nhiễu
                    </button>
                  </div>

                  {editDistractors.map((d, idx) => (
                    <div key={idx} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700">Lựa chọn nhiễu #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeDistractor(idx)}
                          className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
                          title="Xóa lựa chọn này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-600 mb-1">
                            Lựa chọn (VD: A. false / doctors):
                          </label>
                          <AutoResizeTextarea
                            minRows={2}
                            value={d.option || ''}
                            onChange={(e) => updateDistractorField(idx, 'option', e.target.value.slice(0, 100))}
                            placeholder="Lựa chọn sai..."
                            className="text-xs p-2.5"
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-600 mb-1">
                            Nghĩa ngắn (tùy chọn):
                          </label>
                          <AutoResizeTextarea
                            minRows={2}
                            value={d.label || ''}
                            onChange={(e) => updateDistractorField(idx, 'label', e.target.value.slice(0, 100))}
                            placeholder="Nghĩa ngắn tiếng Việt..."
                            className="text-xs p-2.5"
                            maxLength={100}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">
                          Lý do sai hoặc bẫy từ vựng:
                        </label>
                        <AutoResizeTextarea
                          minRows={2}
                          value={d.reason || ''}
                          onChange={(e) => updateDistractorField(idx, 'reason', e.target.value.slice(0, 500))}
                          placeholder="Lý do vì sao lựa chọn này sai hoặc bẫy từ vựng..."
                          className="text-xs p-2.5"
                          maxLength={500}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'view' && reviewError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-start justify-between gap-3"
          >
            <span className="leading-relaxed">{reviewError}</span>
            <button
              type="button"
              onClick={handleReview}
              disabled={isReviewing || isAIBusy}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-rose-300 bg-white text-rose-800 font-semibold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
            >
              {isReviewing ? 'Đang thử...' : 'Thử lại'}
            </button>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-end shrink-0 gap-3">
          {activeTab === 'view' && (
            <div className="flex items-center gap-2">
              {statusInfo.status === 'teacher_reviewed' ? (
                <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-4 py-2 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Đã duyệt bởi giáo viên
                </span>
              ) : statusInfo.status === 'teacher_edited' ? (
                <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 px-4 py-2 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600" />
                  Đã sửa tay bởi giáo viên
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleReview}
                  disabled={isReviewing || !currentExplanation || isAIBusy}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-xs"
                  title={isAIBusy ? "Đang có tác vụ AI khác đang chạy..." : `Đánh dấu đã duyệt câu ${qNum} để công bố cho học sinh`}
                >
                  {isReviewing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Duyệt giải thích câu {qNum}
                </button>
              )}
            </div>
          )}

          {activeTab === 'edit' && (
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSavingEdit || isAIBusy}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
              title={isAIBusy ? "Đang có tác vụ AI khác đang chạy..." : undefined}
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu chỉnh sửa...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Lưu chỉnh sửa
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
