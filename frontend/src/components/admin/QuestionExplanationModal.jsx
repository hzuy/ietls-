import { useState, useEffect, useRef } from 'react'
import {
  X, Check, AlertTriangle, RefreshCw, Sparkles, Edit3, Eye,
  Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight, Plus, Trash2,
} from 'lucide-react'
import api from '../../utils/axios'
import ReviewExplanation from '../exam/ReviewExplanation'

export function getExplanationStatusInfo(explanation) {
  if (!explanation || typeof explanation !== 'object') {
    return {
      status: 'none',
      label: 'Chưa có lời giải',
      badgeClass: 'bg-zinc-50 text-zinc-400 border-zinc-200 border-dashed',
      dotClass: 'bg-zinc-300',
    }
  }

  const s = explanation.status

  // 3.2: Legacy explanations without status are treated as ai_generated
  if (!s || s === 'ai_generated') {
    return {
      status: 'ai_generated',
      label: 'AI sinh',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300',
      dotClass: 'bg-sky-500',
    }
  }

  if (s === 'teacher_reviewed') {
    return {
      status: 'teacher_reviewed',
      label: 'Đã duyệt',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      dotClass: 'bg-emerald-500',
    }
  }

  if (s === 'teacher_edited') {
    return {
      status: 'teacher_edited',
      label: 'Đã sửa tay',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300',
      dotClass: 'bg-indigo-500',
    }
  }

  if (s === 'conflict_pending') {
    return {
      status: 'conflict_pending',
      label: 'Chờ duyệt (Lệch)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
      dotClass: 'bg-amber-500',
    }
  }

  if (s === 'needs_regeneration') {
    return {
      status: 'needs_regeneration',
      label: 'Cần sinh lại',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-300',
      dotClass: 'bg-orange-500',
    }
  }

  if (s === 'possibly_stale') {
    return {
      status: 'possibly_stale',
      label: 'Có thể lỗi thời',
      badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-300',
      dotClass: 'bg-zinc-400',
    }
  }

  return {
    status: s,
    label: s,
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    dotClass: 'bg-zinc-400',
  }
}

export function ExplanationStatusBadge({ explanation, className = '' }) {
  const info = getExplanationStatusInfo(explanation)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${info.badgeClass} ${className}`}
      title={`Trạng thái: ${info.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${info.dotClass} shrink-0`} />
      <span>{info.label}</span>
    </span>
  )
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
}) {
  const [activeTab, setActiveTab] = useState('view') // 'view' | 'feedback' | 'edit'
  const [currentExplanation, setCurrentExplanation] = useState(null)

  // Feedback tab state
  const [feedbackText, setFeedbackText] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenError, setRegenError] = useState(null)

  // Edit tab state
  const [editPredict, setEditPredict] = useState('')
  const [editFullSentence, setEditFullSentence] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [editReasoning, setEditReasoning] = useState('')
  const [editDistractors, setEditDistractors] = useState([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)

  // Review state
  const [isReviewing, setIsReviewing] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const prevQKeyRef = useRef(null)

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
      setFeedbackText(exp?.teacherFeedback || '')
      setEditPredict(exp?.predict || '')
      setEditFullSentence(exp?.full_sentence || '')
      setEditTranslation(exp?.translation || '')
      setEditReasoning(exp?.reasoning || '')
      setEditDistractors(Array.isArray(exp?.distractors) ? [...exp.distractors] : [])
      setRegenError(null)
      setEditError(null)
      setActiveTab('view')
    } else if (exp && exp !== currentExplanation) {
      setCurrentExplanation(exp)
    }
  }, [isOpen, examId, isPractice, question?.id, question?.number, question?.explanation, initialExplanation])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !isRegenerating && !isSavingEdit && !isReviewing) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isRegenerating, isSavingEdit, isReviewing, onClose])

  if (!isOpen || !question) return null

  const statusInfo = getExplanationStatusInfo(currentExplanation)
  const qNum = question.number
  const qId = question.id || qNum

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ─── 4.3 REGENERATE HANDLER ────────────────────────────────────────────────
  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setRegenError(null)

    try {
      const url = isPractice
        ? `/practice/admin/${skill}/${examId}/questions/${qNum}/regenerate-explanation`
        : `/admin/exams/${examId}/questions/${qId}/regenerate-explanation`

      const res = await api.post(url, { teacherFeedback: feedbackText })
      const data = res.data

      if (data.ok === false) {
        setRegenError(data.message || 'Lỗi khi tạo lại giải thích.')
        return
      }

      if (data.explanation) {
        setCurrentExplanation(data.explanation)
        onExplanationUpdated?.(data.explanation, qNum)
        setActiveTab('view')
        showToast(data.message || 'Đã tạo lại giải thích thành công!')
      }
    } catch (err) {
      console.error('[REGENERATE ERROR]', err)
      setRegenError(err?.response?.data?.message || err?.message || 'Lỗi khi tạo lại giải thích.')
    } finally {
      setIsRegenerating(false)
    }
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
        predict: editPredict,
        full_sentence: editFullSentence,
        translation: editTranslation,
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
      alert(err?.response?.data?.message || err?.message || 'Lỗi khi duyệt lời giải.')
    } finally {
      setIsReviewing(false)
    }
  }

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
        if (e.target === e.currentTarget && !isRegenerating && !isSavingEdit && !isReviewing) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative border border-zinc-100 flex flex-col max-h-[92vh] my-auto">
        {/* Toast notification */}
        {toastMessage && (
          <div className="absolute top-4 right-14 z-20 bg-zinc-900 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="rounded-full bg-zinc-900 text-white text-xs font-bold px-3 py-1">
                Câu {qNum}
              </span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {question.type}
              </span>
              <ExplanationStatusBadge explanation={currentExplanation} />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 mt-1">
              <span className="font-semibold text-zinc-800">Đáp án chuẩn:</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono font-bold text-emerald-700">
                {question.correctAnswer || '(Chưa có)'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRegenerating || isSavingEdit || isReviewing}
            className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50 shrink-0 ml-3"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 border-b border-zinc-100 pt-3 pb-2 shrink-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'view'}
            onClick={() => setActiveTab('view')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'view'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Xem lời giải
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feedback'}
            onClick={() => setActiveTab('feedback')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'feedback'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Góp ý & Tạo lại
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'edit'}
            onClick={() => setActiveTab('edit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            Sửa trực tiếp
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
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
                      🔒 Lời giải này đang được <strong>ẨN KHỎI HỌC SINH</strong>. Bạn có thể dùng tab <em>Góp ý & Tạo lại</em> để AI lập luận chuẩn xác hơn hoặc bấm <em>Duyệt</em> nếu bạn đồng ý.
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
                      Lời giải hiện tại từng được sinh cho một đáp án khác nên đang bị ẩn khỏi học sinh. Vui lòng bấm vào tab <strong>"Góp ý & Tạo lại"</strong> để AI sinh lại lời giải phù hợp với đáp án <strong>"{question.correctAnswer}"</strong>.
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

              {/* 4-Step Explanation View */}
              <ReviewExplanation explanation={currentExplanation} />

              {/* Feedback History Block */}
              {Array.isArray(currentExplanation?.feedbackHistory) && currentExplanation.feedbackHistory.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-2 mt-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    Lịch sử góp ý của giáo viên (tối đa 5 lần gần nhất)
                  </div>
                  <div className="space-y-1.5">
                    {currentExplanation.feedbackHistory.map((h, i) => (
                      <div key={i} className="text-xs bg-white border border-zinc-200 rounded-xl p-2.5 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{h.at ? new Date(h.at).toLocaleString('vi-VN') : ''}</span>
                          <span className="font-mono text-[10px] bg-zinc-100 px-1.5 py-0.2 rounded text-zinc-600">{h.provider || 'AI'} ({h.model || 'model'})</span>
                        </div>
                        <p className="text-zinc-800 m-0 italic">"{h.feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FEEDBACK & REGENERATE */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Hướng dẫn góp ý cho AI
                </p>
                <p>
                  Góp ý là gợi ý về cách giải thích, hướng dẫn góc nhìn, nhấn mạnh ngữ cảnh hoặc giải thích các bẫy từ vựng (distractors). AI sẽ giữ nguyên đáp án chuẩn <strong>"{question.correctAnswer}"</strong> và bắt buộc phải xác thực bằng chứng nguyên văn trong bài.
                </p>
              </div>

              {regenError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Không thể tạo lại: </span>
                    {regenError}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Nội dung góp ý / hướng dẫn bổ sung cho AI:
                </label>
                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value.slice(0, 1000))}
                  placeholder="Ví dụ: 'Hãy giải thích rõ hơn vì sao đáp án B bị sai do từ then chốt ở câu thứ hai, và trích đoạn liên quan ở đoạn C...'"
                  className="w-full text-xs p-3 rounded-2xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none font-sans"
                  disabled={isRegenerating}
                />
                <div className="flex justify-between items-center text-[11px] text-zinc-400 mt-1">
                  <span>Tối đa 1000 ký tự</span>
                  <span>{feedbackText.length}/1000</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full py-2.5 px-4 rounded-2xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      AI đang suy luận và tạo lại lời giải...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Tạo lại lời giải với AI
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT MANUAL EDIT */}
          {activeTab === 'edit' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200 p-3.5 text-xs text-indigo-900 leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  Sửa tay an toàn (3.7)
                </p>
                <p>
                  Nội dung sửa tay sẽ được render dưới dạng văn bản thuần an toàn cho học sinh và gắn nhãn "Đã sửa tay". Để đảm bảo tính toàn vẹn dữ liệu, trường <em>Bằng chứng (evidence)</em> và <em>Đáp án (answer)</em> được giữ nguyên.
                </p>
              </div>

              {editError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Predict */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Bước 1: Dự đoán / Phân tích câu hỏi (predict, tối đa 1000 ký tự):
                </label>
                <input
                  type="text"
                  value={editPredict}
                  onChange={(e) => setEditPredict(e.target.value.slice(0, 1000))}
                  placeholder="Câu hỏi cần thông tin gì..."
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Full sentence & Translation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Câu hoàn chỉnh sau khi điền (full_sentence):
                  </label>
                  <input
                    type="text"
                    value={editFullSentence}
                    onChange={(e) => setEditFullSentence(e.target.value.slice(0, 1000))}
                    placeholder="Câu tiếng Anh đầy đủ..."
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Bản dịch tiếng Việt (translation):
                  </label>
                  <input
                    type="text"
                    value={editTranslation}
                    onChange={(e) => setEditTranslation(e.target.value.slice(0, 1000))}
                    placeholder="Dịch nghĩa tiếng Việt..."
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-zinc-700">
                    Bước 4: Suy luận & Giải thích chi tiết (reasoning, tối đa 2000 ký tự):
                  </label>
                  <span className="text-[11px] text-zinc-400">{editReasoning.length}/2000</span>
                </div>
                <textarea
                  rows={4}
                  value={editReasoning}
                  onChange={(e) => setEditReasoning(e.target.value.slice(0, 2000))}
                  placeholder="Lập luận vì sao đáp án này đúng, đối chiếu bài đọc..."
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none font-sans"
                />
              </div>

              {/* Distractors list */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700">
                    Phân tích các đáp án sai / nhiễu (distractors, tối đa 10):
                  </label>
                  <button
                    type="button"
                    onClick={addDistractor}
                    disabled={editDistractors.length >= 10}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" /> Thêm lựa chọn nhiễu
                  </button>
                </div>

                {editDistractors.map((d, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={d.option || ''}
                        onChange={(e) => updateDistractorField(idx, 'option', e.target.value.slice(0, 100))}
                        placeholder="Lựa chọn (VD: A. false / doctors)"
                        className="flex-1 text-xs p-1.5 rounded-lg border border-zinc-200 bg-white"
                      />
                      <input
                        type="text"
                        value={d.label || ''}
                        onChange={(e) => updateDistractorField(idx, 'label', e.target.value.slice(0, 100))}
                        placeholder="Nghĩa ngắn (tùy chọn)"
                        className="w-40 text-xs p-1.5 rounded-lg border border-zinc-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeDistractor(idx)}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Xóa lựa chọn này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={d.reason || ''}
                      onChange={(e) => updateDistractorField(idx, 'reason', e.target.value.slice(0, 500))}
                      placeholder="Lý do vì sao lựa chọn này sai hoặc bẫy từ vựng..."
                      className="w-full text-xs p-2 rounded-lg border border-zinc-200 bg-white resize-none"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="w-full py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang lưu chỉnh sửa...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Lưu thay đổi lời giải
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {statusInfo.status !== 'teacher_reviewed' ? (
              <button
                type="button"
                onClick={handleReview}
                disabled={isReviewing || !currentExplanation}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-xs"
                title="Đánh dấu đã duyệt để công bố cho học sinh"
              >
                {isReviewing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Duyệt giải thích
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Đã duyệt bởi giáo viên
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
