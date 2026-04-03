import { useState, useRef } from 'react'
import { uploadImage as uploadImageService } from '../../services/examService'
import { inputCls, labelCls, btnSecondary, toImgSrc } from '../../utils/practiceConfig'

export default function DiagramLabelEditor({ group, onChange }) {
  const [imgUploading, setImgUploading] = useState(false)
  const imgRef = useRef(null)

  const uploadImage = async (file) => {
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh tối đa 5MB'); return }
    setImgUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await uploadImageService(formData)
      onChange({ ...group, imageUrl: res.imageUrl })
    } catch { alert('Lỗi upload ảnh') }
    finally { setImgUploading(false) }
  }

  const addQuestion = () => {
    const nextNum = group.questions.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
    onChange({ ...group, qNumberEnd: nextNum, questions: [...group.questions, { number: nextNum, hint: '', correctAnswer: '' }] })
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Hình ảnh sơ đồ</label>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="URL ảnh (tự điền sau upload)"
            value={group.imageUrl || ''} onChange={e => onChange({ ...group, imageUrl: e.target.value })} />
          <button type="button" onClick={() => imgRef.current?.click()} disabled={imgUploading}
            className={`${btnSecondary} whitespace-nowrap`}>
            {imgUploading ? 'Đang upload...' : '🖼 Upload ảnh'}
          </button>
          {group.imageUrl && (
            <button type="button" onClick={() => onChange({ ...group, imageUrl: '' })}
              className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 border border-red-200 whitespace-nowrap">
              Xóa ảnh
            </button>
          )}
          <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden"
            ref={imgRef} onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
        </div>
        {group.imageUrl && (
          <img src={toImgSrc(group.imageUrl)}
            alt="diagram" className="mt-2 max-h-64 rounded-xl border object-contain w-full bg-gray-50" />
        )}
      </div>
      <div className="space-y-2">
        {group.questions.map((q, qi) => (
          <div key={qi} className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-600 w-10 shrink-0">Q{q.number}:</span>
              <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Mô tả vị trí label (tùy chọn, VD: Top of the arch)"
                value={q.hint || q.questionText || ''} onChange={e => updateQ(qi, 'hint', e.target.value)} />
              <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 text-xs">✕</button>
            </div>
            <div className="flex items-center gap-2 pl-12">
              <span className="text-xs text-gray-500 shrink-0">Đáp án:</span>
              <input className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                placeholder="VD: arch hoặc stone arch/arch stone"
                value={q.correctAnswer || ''} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)} />
              <span className="text-[10px] text-gray-400">Dùng / để tách nhiều đáp án</span>
            </div>
          </div>
        ))}
        <button type="button" onClick={addQuestion}
          className="w-full border-2 border-dashed border-rose-200 rounded-xl py-2 text-sm text-rose-400 hover:border-rose-400 hover:text-rose-600 transition font-medium">
          + Thêm câu hỏi
        </button>
      </div>
    </div>
  )
}
