import { useState, useRef, useEffect } from 'react'
import { X, UploadCloud, MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../../utils/axios'
import { useToast } from '../../context/ToastContext'

const ISSUE_TYPES = [
  { id: 'content_wrong', label: 'Đề / đáp án sai' },
  { id: 'ui_bug', label: 'Giao diện' },
  { id: 'lost_work', label: 'Mất bài làm' },
  { id: 'slow_hang', label: 'Tải chậm / Treo' },
  { id: 'other', label: 'Khác' },
]

export default function ReportIssueModal({
  isOpen,
  onClose,
  examId = null,
  practiceExamId = null,
  skill = 'reading',
  sourceType = 'exam',
  location = '',
  questionNumber = null,
}) {
  const { showToast } = useToast()
  const [issueType, setIssueType] = useState('content_wrong')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setDescription('')
      setFile(null)
      setFilePreview(null)
      setIsSubmitting(false)
      setIssueType('content_wrong')
    }
  }, [isOpen])

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
    }
  }, [filePreview])

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      showToast('Chỉ chấp nhận file ảnh (PNG, JPG, WEBP)', 'error')
      return
    }

    if (selected.size > 5 * 1024 * 1024) {
      showToast('Dung lượng ảnh tối đa là 5MB', 'error')
      return
    }

    setFile(selected)
    setFilePreview(URL.createObjectURL(selected))
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return

    if (!dropped.type.startsWith('image/')) {
      showToast('Chỉ chấp nhận file ảnh (PNG, JPG, WEBP)', 'error')
      return
    }

    if (dropped.size > 5 * 1024 * 1024) {
      showToast('Dung lượng ảnh tối đa là 5MB', 'error')
      return
    }

    setFile(dropped)
    setFilePreview(URL.createObjectURL(dropped))
  }

  const removeFile = () => {
    setFile(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = description.trim()
    if (!trimmed) {
      showToast('Vui lòng nhập mô tả chi tiết lỗi gặp phải', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('issueType', issueType)
      formData.append('description', trimmed)
      formData.append('skill', skill || 'reading')
      formData.append('sourceType', sourceType || 'exam')
      if (examId) formData.append('examId', examId)
      if (practiceExamId) formData.append('practiceExamId', practiceExamId)
      if (location) formData.append('location', location)
      if (questionNumber != null) formData.append('questionNumber', questionNumber)
      if (file) formData.append('image', file)

      const res = await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      showToast(res.data?.message || 'Cảm ơn bạn đã gửi báo lỗi!', 'success')
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể gửi báo lỗi, vui lòng thử lại sau.'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative border border-zinc-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 transition p-1.5 rounded-full hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 pr-6">
          <h3 className="text-xl font-bold text-zinc-900 mb-1">Gửi phản hồi báo lỗi</h3>
          <p className="text-xs sm:text-sm text-zinc-500">
            Góp ý của bạn giúp IELTS Pro cải thiện sản phẩm tốt hơn.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Section: Lỗi nằm ở đâu? */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2.5">
              Lỗi nằm ở đâu?
            </label>
            <div className="flex flex-wrap gap-2">
              {ISSUE_TYPES.map((type) => {
                const isActive = issueType === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setIssueType(type.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-400 shadow-xs'
                        : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {type.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section: Mô tả chi tiết * */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Mô tả chi tiết <span className="text-red-500 font-bold">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bạn gặp lỗi gì, ở câu nào hoặc bước nào?"
              required
              className="w-full text-sm text-zinc-800 placeholder-zinc-400 border border-zinc-200 rounded-2xl p-3.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none bg-zinc-50/50"
            />
          </div>

          {/* Section: Hình ảnh đính kèm */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Hình ảnh đính kèm
            </label>

            {!filePreview ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50 hover:border-zinc-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white shadow-xs flex items-center justify-center text-zinc-500 mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-zinc-800 mb-0.5">
                  Upload your files
                </p>
                <p className="text-[11px] text-zinc-400">
                  Drag and Drop or <span className="text-blue-600 font-medium">Browse</span> to upload (max 5MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-2.5 rounded-2xl border border-zinc-200 bg-zinc-50/80">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="w-14 h-14 object-cover rounded-xl border border-zinc-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-800 truncate mb-0.5">{file?.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {(file ? file.size / (1024 * 1024) : 0).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  title="Xoá ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Section: Vị trí tự động */}
          {location && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">Gửi kèm vị trí: <strong className="font-medium text-zinc-800">{location}</strong></span>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition disabled:opacity-40 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Đang gửi...' : 'Gửi báo lỗi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
