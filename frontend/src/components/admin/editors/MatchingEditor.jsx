import AutoGrowTextarea from '../AutoGrowTextarea'
import { useState, useRef } from 'react'
import { uploadImage as uploadImageService } from '../../../services/examService'
import { inputCls, labelCls, btnSecondary, toImgSrc } from '../adminConstants'
import { getQuestionGroupTheme as getAdminTheme } from '../adminConstants'
import { getQuestionGroupTheme as getPracticeTheme } from '../../../utils/practiceConfig'
import { useToast } from '../../../context/ToastContext'
import Select from '../Select'
import { Upload } from 'lucide-react'
import { paragraphMatchingOptions } from '../../../utils/readingParagraphs'
import { relabelMatchingChoices } from '../../../utils/matchingChoices'

export default function MatchingEditor({
  group: originalGroup = {},
  onChange,
  numberingMode = 'auto',
  themeSource = 'admin',
  passage = '',
  letteredParagraphs = false,
}) {
  const { showToast } = useToast()
  const groupType = originalGroup?.type || 'matching'
  const isParagraph = groupType === 'matching_information'
  const sourceLinked = isParagraph && letteredParagraphs
  const group = sourceLinked
    ? { ...originalGroup, matchingOptions: paragraphMatchingOptions(passage, originalGroup.matchingOptions) }
    : isParagraph ? originalGroup : relabelMatchingChoices(originalGroup)
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
    const reserved = new Set([...list.map(option => option.letter ?? option.optionLetter), ...(group.questions || []).map(question => question.correctAnswer)])
    let index = 0
    while (reserved.has(String.fromCharCode(65 + index))) index++
    const nextLetter = String.fromCharCode(65 + index)
    onChange({ ...group, matchingOptions: [...list, { letter: nextLetter, text: '' }] })
  }

  const removeOption = (oi) => {
    onChange(relabelMatchingChoices(group, (group.matchingOptions || []).filter((_, i) => i !== oi)))
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
          <p className={`text-xs font-bold ${theme.subBoxText}`}>{isParagraph ? 'Các đoạn trong bài đọc' : 'Danh sách lựa chọn (A, B, C...)'}</p>
          {!isParagraph && (
          <button
            type="button"
            onClick={addOption}
            className={`text-xs ${theme.subBoxText} font-medium hover:underline`}
          >
            + Thêm lựa chọn
          </button>
          )}
        </div>
        {isParagraph ? <div className="space-y-2">
          <p className="text-xs leading-relaxed text-zinc-600">{letteredParagraphs ? 'Danh sách tự cập nhật theo các đoạn cách nhau bằng dòng trống trong bài đọc.' : 'Bật “Đoạn văn có ký hiệu chữ cái (A, B, C...)” để đồng bộ với bài đọc.'}</p>
          {sourceLinked && !options.length && <p className="text-sm text-zinc-600">Nhập nội dung bài đọc phía trên để có các đoạn A, B, C…</p>}
          <div className="flex flex-wrap gap-2" aria-label="Danh sách đoạn văn">
            {options.map(option => <span key={option.letter || option.optionLetter} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">Đoạn {option.letter || option.optionLetter}</span>)}
          </div>
        </div> : (
        <div className="space-y-2">
          {(group.matchingOptions || []).map((mo, oi) => (
            <div key={oi} className="flex items-start gap-2">
              <span aria-label={`Ký hiệu lựa chọn ${mo.letter}`} className="w-12 shrink-0 py-2 text-center text-sm font-bold text-zinc-700">{mo.letter}</span>
              <AutoGrowTextarea
                aria-label={`Nội dung lựa chọn ${mo.letter}`}
                className={`min-w-0 flex-1 border ${theme.subBoxBorder} bg-white rounded-lg px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-zinc-700`}
                placeholder="Nội dung lựa chọn..."
                value={mo.text || mo.optionText || ''}
                onChange={e => updateOption(oi, 'text', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeOption(oi)}
                aria-label={`Xóa lựa chọn ${mo.letter}`}
                className="h-10 w-10 shrink-0 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-zinc-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        )}
      </div>

      <div className="space-y-2">
        {(group.questions || []).map((q, qi) => (
          <div key={q.id ?? qi} className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-start gap-x-3 gap-y-2">
            <span className="pt-2 text-xs font-semibold text-zinc-700">Q{q.number}</span>
            <AutoGrowTextarea
              aria-label={`Nội dung câu ${q.number}`}
              className="min-w-0 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-zinc-700"
              placeholder={isMap ? 'Tên mục (VD: Farm shop, Disabled entry...)' : 'Đối tượng cần matching (VD: Cafe, Shop...)'}
              value={q.questionText || ''}
              onChange={e => updateQ(qi, 'questionText', e.target.value)}
            />
            <Select multiline
              className="col-start-2 row-start-2 w-full"
              ariaLabel="Đáp án"
              value={q.correctAnswer || ''}
              onChange={v => updateQ(qi, 'correctAnswer', v)}
              options={[
                { value: '', label: '-- Đáp án --' },
                ...(q.correctAnswer && !options.some(option => (option.letter || option.optionLetter) === q.correctAnswer) ? [{ value: q.correctAnswer, label: `${isParagraph ? 'Đoạn' : 'Lựa chọn'} ${q.correctAnswer} — không còn tồn tại`, disabled: true }] : []),
                ...options.filter(mo => {
                  if (noFilter) return true
                  const letter = mo.letter || mo.optionLetter
                  return group.canReuse || letter === q.correctAnswer || !usedAnswers.has(letter)
                }).map(mo => {
                  const letter = mo.letter || mo.optionLetter
                  const text = isParagraph ? '' : mo.text || mo.optionText || ''
                  return { value: letter, label: isParagraph ? `Đoạn ${letter}` : text ? `${letter} - ${text}` : letter }
                }),
              ]}
            />
            <button
              type="button"
              onClick={() => removeQuestion(qi)}
              aria-label={`Xóa câu ${q.number}`}
              className="col-start-3 row-start-1 row-span-2 h-10 w-10 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-zinc-700"
            >
              ✕
            </button>
            {sourceLinked && q.correctAnswer && !options.some(option => option.letter === q.correctAnswer) && <p role="alert" className="col-start-2 text-xs text-red-700">Đoạn {q.correctAnswer} không còn trong bài đọc. Chọn lại đáp án trước khi lưu.</p>}
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
