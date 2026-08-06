import { useState, useRef } from 'react'
import { uploadImage as uploadImageService } from '../../services/examService'
import { inputCls, labelCls, btnSecondary, toImgSrc, getQuestionGroupTheme } from '../../utils/practiceConfig'

export default function MatchingEditor({ group, onChange }) {
  const isMap = group.type === 'map_diagram'
  const [imgUploading, setImgUploading] = useState(false)
  const imgRef = useRef(null)
  const theme = getQuestionGroupTheme(group.type)

  const uploadImage = async (file) => {
    setImgUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await uploadImageService(formData)
      onChange({ ...group, imageUrl: res.imageUrl })
    } catch { alert('Lỗi upload ảnh') }
    finally { setImgUploading(false) }
  }

  const updateOption = (oi, field, val) => {
    onChange({ ...group, matchingOptions: group.matchingOptions.map((mo, i) => i !== oi ? mo : { ...mo, [field]: val }) })
  }

  const addOption = () => {
    const nextLetter = String.fromCharCode(65 + group.matchingOptions.length)
    onChange({ ...group, matchingOptions: [...group.matchingOptions, { letter: nextLetter, text: '' }] })
  }

  const removeOption = (oi) => {
    onChange({ ...group, matchingOptions: group.matchingOptions.filter((_, i) => i !== oi) })
  }

  const addQuestion = () => {
    const nextNum = group.questions.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
    onChange({ ...group, qNumberEnd: nextNum, questions: [...group.questions, { number: nextNum, questionText: '', correctAnswer: '' }] })
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  const options = group.matchingOptions.filter(mo => (mo.letter || mo.optionLetter))
  const usedAnswers = new Set(group.questions.map(q => q.correctAnswer).filter(Boolean))
  const noFilter = group.type === 'matching' || group.type === 'map_diagram'

  return (
    <div className="space-y-3">
      {isMap && (
        <div>
          <label className={labelCls}>Hình ảnh Map/Diagram</label>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="URL ảnh (tự điền sau upload)"
              value={group.imageUrl || ''} onChange={e => onChange({ ...group, imageUrl: e.target.value })} />
            <button type="button" onClick={() => imgRef.current?.click()} disabled={imgUploading}
              className={`${btnSecondary} whitespace-nowrap`}>
              {imgUploading ? 'Đang upload...' : '🖼 Upload ảnh'}
            </button>
            <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp" className="hidden"
              ref={imgRef} onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
          </div>
          {group.imageUrl && (
            <img src={toImgSrc(group.imageUrl)}
              alt="map/diagram" className="mt-2 max-h-56 rounded-xl border object-contain w-full bg-gray-50" />
          )}
        </div>
      )}
      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-xl p-3.5`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Danh sách lựa chọn (A, B, C...)</p>
          <button type="button" onClick={addOption} className={`text-xs ${theme.subBoxText} font-semibold hover:underline`}>+ Thêm</button>
        </div>
        <div className="space-y-2">
          {group.matchingOptions.map((mo, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input className={`w-10 border ${theme.subBoxBorder} bg-white rounded px-1 py-1 text-xs text-center font-bold focus:outline-none`}
                value={mo.letter} onChange={e => updateOption(oi, 'letter', e.target.value)} />
              <input className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm focus:outline-none`}
                placeholder="Nội dung lựa chọn..."
                value={mo.text} onChange={e => updateOption(oi, 'text', e.target.value)} />
              <button type="button" onClick={() => removeOption(oi)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {group.questions.map((q, qi) => (
          <div key={qi} className={`flex items-center gap-2 ${theme.subBoxBg} rounded-xl p-2.5 border ${theme.subBoxBorder}`}>
            <span className={`text-xs font-bold ${theme.subBoxText} w-10 shrink-0`}>Q{q.number}:</span>
            <input className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm focus:outline-none`}
              placeholder="Đối tượng cần matching (VD: Cafe, Shop...)"
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
            <select className={`border ${theme.subBoxBorder} rounded-lg px-2 py-1 text-sm focus:outline-none bg-white max-w-[260px]`}
              value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)}>
              <option value="">-- Đáp án --</option>
              {options.filter(mo => {
                if (noFilter) return true
                const letter = mo.letter || mo.optionLetter
                return group.canReuse || letter === q.correctAnswer || !usedAnswers.has(letter)
              }).map(mo => {
                const letter = mo.letter || mo.optionLetter
                const text = mo.text || mo.optionText || ''
                return <option key={letter} value={letter}>{text ? `${letter} - ${text}` : letter}</option>
              })}
            </select>
            <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
        <button type="button" onClick={addQuestion}
          className={`w-full border-2 border-dashed ${theme.subBoxBorder} ${theme.subBoxText} bg-white/50 hover:bg-white rounded-xl py-2 text-sm font-semibold transition`}>
          + Thêm câu hỏi
        </button>
      </div>
    </div>
  )
}
