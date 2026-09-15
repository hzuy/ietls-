import { useState, useRef } from 'react'
import { uploadImage as uploadImageService } from '../../../services/examService'
import { inputCls, labelCls, btnSecondary, toImgSrc } from '../adminConstants'
import { getQuestionGroupTheme as getAdminTheme } from '../adminConstants'
import { getQuestionGroupTheme as getPracticeTheme } from '../../../utils/practiceConfig'
import { useToast } from '../../../context/ToastContext'
import Select from '../Select'
import { Upload } from 'lucide-react'

export default function MatchingEditor({
  group = {},
  onChange,
  numberingMode = 'auto',
  themeSource = 'admin'
}) {
  const { showToast } = useToast()
  const groupType = group?.type || 'matching'
  const isMap = groupType === 'map_diagram'
  const theme = themeSource === 'practice'
    ? getPracticeTheme(groupType)
    : getAdminTheme(groupType)

  const [imgUploading, setImgUploading] = useState(false)
  const imgRef = useRef(null)

  const uploadImage = async (file) => {
    setImgUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await uploadImageService(formData)
      onChange({ ...group, imageUrl: res.imageUrl })
    } catch {
      showToast('Lỗi upload ảnh', 'error')
    } finally {
      setImgUploading(false)
    }
  }

  const updateOption = (oi, field, val) => {
    onChange({
      ...group,
      matchingOptions: (group.matchingOptions || []).map((mo, i) => i !== oi ? mo : { ...mo, [field]: val })
    })
  }

  const addOption = () => {
    const list = group.matchingOptions || []
    const nextLetter = String.fromCharCode(65 + list.length)
    onChange({ ...group, matchingOptions: [...list, { letter: nextLetter, text: '' }] })
  }

  const removeOption = (oi) => {
    onChange({
      ...group,
      matchingOptions: (group.matchingOptions || []).filter((_, i) => i !== oi)
    })
  }

  const addQuestion = () => {
    const qs = group.questions || []
    const nextNum = qs.length > 0
      ? (numberingMode === 'manual'
          ? Math.max(...qs.map(q => q.number || 0)) + 1
          : Math.max(group.qNumberEnd || 0, ...qs.map(q => q.number || 0)) + 1)
      : (group.qNumberStart || 1)

    onChange({
      ...group,
      qNumberEnd: nextNum,
      questions: [...qs, { number: nextNum, questionText: '', correctAnswer: '' }]
    })
  }

  const removeQuestion = (qi) => {
    const newQs = (group.questions || []).filter((_, i) => i !== qi)
    const newEnd = newQs.length > 0
      ? Math.max(...newQs.map(q => q.number || (group.qNumberStart || 1)))
      : (group.qNumberStart || 1)
    onChange({ ...group, questions: newQs, qNumberEnd: newEnd })
  }

  const updateQ = (qi, field, val) => {
    onChange({
      ...group,
      questions: (group.questions || []).map((q, i) => i !== qi ? q : { ...q, [field]: val })
    })
  }

  const options = (group.matchingOptions || []).filter(mo => (mo.letter || mo.optionLetter))
  const usedAnswers = new Set((group.questions || []).map(q => q.correctAnswer).filter(Boolean))
  const noFilter = group.type === 'matching' || group.type === 'map_diagram'

  return (
    <div className="space-y-3">
      {isMap && (
        <div>
          <label className={labelCls}>Hình ảnh Map/Diagram</label>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="URL ảnh (tự điền sau upload)"
              value={group.imageUrl || ''}
              onChange={e => onChange({ ...group, imageUrl: e.target.value })}
            />
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              disabled={imgUploading}
              className={`${btnSecondary} whitespace-nowrap flex items-center gap-1.5`}
            >
              {imgUploading ? 'Đang upload...' : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload ảnh</span>
                </>
              )}
            </button>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              ref={imgRef}
              onChange={e => e.target.files[0] && uploadImage(e.target.files[0])}
            />
          </div>
          {group.imageUrl && (
            <img
              src={toImgSrc(group.imageUrl)}
              alt="map/diagram"
              className="mt-2 max-h-56 rounded-lg border object-contain w-full bg-zinc-50"
            />
          )}
        </div>
      )}

      <div className={`${theme.subBoxBg} border ${theme.subBoxBorder} rounded-lg p-3.5`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs font-bold ${theme.subBoxText}`}>Danh sách lựa chọn (A, B, C...)</p>
          <button
            type="button"
            onClick={addOption}
            className={`text-xs ${theme.subBoxText} font-medium hover:underline`}
          >
            + Thêm
          </button>
        </div>
        <div className="space-y-2">
          {(group.matchingOptions || []).map((mo, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                className={`w-10 border ${theme.subBoxBorder} bg-white rounded px-1 py-1 text-xs text-center font-medium focus:outline-none`}
                value={mo.letter || mo.optionLetter || ''}
                onChange={e => updateOption(oi, 'letter', e.target.value)}
              />
              <input
                className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none`}
                placeholder="Nội dung lựa chọn..."
                value={mo.text || mo.optionText || ''}
                onChange={e => updateOption(oi, 'text', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeOption(oi)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className={`flex items-center gap-2 ${theme.subBoxBg} rounded-lg p-2.5 border ${theme.subBoxBorder}`}>
            <span className={`text-xs font-bold ${theme.subBoxText} w-10 shrink-0`}>Q{q.number}:</span>
            <input
              className={`flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none`}
              placeholder={isMap ? 'Tên mục (VD: Farm shop, Disabled entry...)' : 'Đối tượng cần matching (VD: Cafe, Shop...)'}
              value={q.questionText || ''}
              onChange={e => updateQ(qi, 'questionText', e.target.value)}
            />
            <Select
              className="max-w-[260px]"
              ariaLabel="Đáp án"
              value={q.correctAnswer || ''}
              onChange={v => updateQ(qi, 'correctAnswer', v)}
              options={[
                { value: '', label: '-- Đáp án --' },
                ...options.filter(mo => {
                  if (noFilter) return true
                  const letter = mo.letter || mo.optionLetter
                  return group.canReuse || letter === q.correctAnswer || !usedAnswers.has(letter)
                }).map(mo => {
                  const letter = mo.letter || mo.optionLetter
                  const text = mo.text || mo.optionText || ''
                  return { value: letter, label: text ? `${letter} - ${text}` : letter }
                }),
              ]}
            />
            <button
              type="button"
              onClick={() => removeQuestion(qi)}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className={`w-full border-2 border-dashed ${theme.subBoxBorder} ${theme.subBoxText} bg-white/50 hover:bg-white rounded-lg py-2 text-xs font-medium transition`}
        >
          + Thêm câu hỏi
        </button>
      </div>
    </div>
  )
}
