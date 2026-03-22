import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/axios'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const READING_Q_TYPES = [
  { value: 'mcq',               label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi',         label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'true_false_ng',     label: 'True / False / Not Given' },
  { value: 'yes_no_ng',         label: 'Yes / No / Not Given' },
  { value: 'fill_blank',        label: 'Sentence / Summary / Table / Flow-chart Completion' },
  { value: 'short_answer',      label: 'Short Answer' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'matching_paragraph',label: 'Matching Paragraph Information' },
  { value: 'matching_endings',  label: 'Matching Sentence Endings' },
  { value: 'choose_title',      label: 'Choose the Best Title' },
  { value: 'diagram_completion',label: 'Diagram / Map Completion' },
]
const LISTENING_Q_TYPES = [
  { value: 'mcq',       label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'fill_blank',label: 'Form / Note / Table / Sentence Completion' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'matching',  label: 'Matching' },
  { value: 'map_diagram', label: 'Labeling a Map / Diagram' },
]
const TYPES_WITH_MCQ_OPTIONS     = ['mcq', 'mcq_multi']
const TYPES_WITH_DYNAMIC_OPTIONS = ['matching_headings','matching_features','matching_paragraph','matching_endings','matching','choose_title','map_diagram']
const TYPES_WITH_IMAGE           = ['map_diagram', 'diagram_completion']

const ANSWER_PLACEHOLDER = {
  mcq: 'Nhập đúng text đáp án đúng',
  mcq_multi: 'VD: A. text,C. text (phân cách bằng dấu phẩy)',
  true_false_ng: 'TRUE / FALSE / NOT GIVEN',
  yes_no_ng: 'YES / NO / NOT GIVEN',
  fill_blank: 'Nhập từ/cụm từ điền vào chỗ trống',
  short_answer: 'Nhập câu trả lời ngắn',
  matching_headings: 'i, ii, iii...',
  matching_features: 'A, B, C...',
  matching_paragraph: 'A, B, C...',
  matching_endings: 'A, B, C...',
  matching: 'Nhập đáp án khớp',
  choose_title: 'Nhập tiêu đề đúng',
  diagram_completion: 'Nhập nhãn đúng',
  map_diagram: 'A, B, C...',
}

const emptyQuestion = (num = 1) => ({
  number: num, type: 'mcq', questionText: '', options: ['', '', '', ''], correctAnswer: '', imageUrl: ''
})

const emptyPassage = (num = 1) => ({
  number: num, title: '', subtitle: '', letteredParagraphs: false, body: '', questionGroups: []
})

const emptySection = (num = 1) => ({
  number: num, context: '', audioUrl: '', transcript: '', questions: [emptyQuestion(1)]
})

const emptyReadingForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  passages: [1, 2, 3].map(n => emptyPassage(n))
})

const emptyListeningForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  sections: [1,2,3,4].map(n => ({
    number: n, context: '', audioUrl: '', transcript: '', questionGroups: []
  }))
})

const SECTION_HINTS = {
  1: 'Hội thoại 2 người — ngữ cảnh xã hội thường ngày (đặt phòng, mua sắm,...)',
  2: 'Độc thoại — ngữ cảnh xã hội (giới thiệu tour, thông báo,...)',
  3: 'Hội thoại học thuật — tối đa 4 người (thảo luận seminar, bài tập,...)',
  4: 'Độc thoại học thuật — bài giảng, thuyết trình về chủ đề học thuật',
}

const GROUP_TYPES = [
  { value: 'note_completion', label: 'Note / Form / Table Completion' },
  { value: 'mcq', label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'matching', label: 'Matching' },
  { value: 'map_diagram', label: 'Map / Diagram Labeling' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'drag_word_bank', label: 'Summary + Word Bank (kéo thả)' },
  { value: 'matching_drag', label: 'Matching - Kéo thả đáp án' },
]

const GROUP_INSTRUCTIONS = {
  note_completion: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
  mcq: 'Choose the correct letter, A, B or C.',
  mcq_multi: 'Choose TWO letters, A–E.',
  matching: 'What does the speaker say about each of the following? Choose the correct letter A–E.',
  map_diagram: 'Label the map/diagram below. Write the correct letter A–F next to each question number.',
  short_answer: 'Answer the questions below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
  drag_word_bank: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the box for each answer.',
  matching_drag: 'Match each statement with the correct option A–F.',
}

const READING_GROUP_TYPES = [
  { value: 'true_false_ng', label: 'True / False / Not Given' },
  { value: 'yes_no_ng', label: 'Yes / No / Not Given' },
  { value: 'note_completion', label: 'Note / Summary Completion' },
  { value: 'mcq', label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (chọn TWO)' },
  { value: 'matching_information', label: 'Matching Information (nối đoạn)' },
  { value: 'drag_word_bank', label: 'Summary + Word Bank (kéo thả)' },
  { value: 'matching_drag', label: 'Matching - Kéo thả đáp án' },
]

const READING_GROUP_INSTRUCTIONS = {
  true_false_ng: 'Do the following statements agree with the information given in the reading passage? Write TRUE, FALSE or NOT GIVEN.',
  yes_no_ng: 'Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.',
  note_completion: 'Complete the notes below. Write NO MORE THAN TWO WORDS from the passage for each answer.',
  mcq: 'Choose the correct letter, A, B, C or D.',
  mcq_multi: 'Choose TWO letters, A–E.',
  matching_information: 'The reading passage has several paragraphs. Which paragraph contains the following information? Write the correct letter in the boxes below.',
  drag_word_bank: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the box for each answer.',
  matching_drag: 'Match each statement with the correct category A–F. You may use any letter more than once.',
}

// ─── READING GROUP NUMBERING ─────────────────────────────────────────────────
// Token-based types embed question numbers in [Q:N] tokens — renumbering
// those tokens is too destructive, so we only update qNumberStart/qNumberEnd.
const TOKEN_BASED_TYPES = ['note_completion', 'drag_word_bank']

const getGroupSlots = (group) => {
  if (group.type === 'mcq_multi') return group.questions.length * (group.maxChoices || 2)
  return group.questions.length
}

const recalcAllGroupNumbers = (passages) => {
  let next = 1
  return passages.map(p => ({
    ...p,
    questionGroups: p.questionGroups.map(g => {
      const slots = getGroupSlots(g)
      const newStart = next
      const newEnd = slots > 0 ? next + slots - 1 : next
      next = newEnd + 1
      if (TOKEN_BASED_TYPES.includes(g.type)) {
        return { ...g, qNumberStart: newStart, qNumberEnd: newEnd }
      }
      // For sequential types: also renumber q.number values
      let qNum = newStart
      const updatedQuestions = g.questions.map(q => {
        const num = qNum
        qNum += (g.type === 'mcq_multi') ? (g.maxChoices || 2) : 1
        return { ...q, number: num }
      })
      return { ...g, qNumberStart: newStart, qNumberEnd: newEnd, questions: updatedQuestions }
    })
  }))
}

const emptyReadingGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: READING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: ['note_completion', 'drag_word_bank'].includes(type) ? [{ title: '', lines: [{ content: '' }] }] : [],
  matchingOptions: ['matching_information', 'drag_word_bank', 'matching_drag'].includes(type)
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }] : [],
  questions: [],
  canReuse: false,
  maxChoices: type === 'mcq_multi' ? 2 : 1,
})

const emptyGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  maxChoices: type === 'mcq_multi' ? 2 : 1,
  noteSections: ['note_completion', 'drag_word_bank'].includes(type) ? [{ title: '', lines: [{ content: '' }] }] : [],
  matchingOptions: ['matching', 'map_diagram', 'drag_word_bank', 'matching_drag'].includes(type)
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }]
    : [],
  questions: [],
})

const emptyWritingForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  task1: { prompt: '', imageUrl: '' },
  task2: { prompt: '' }
})

const emptySpeakingForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  part1: {
    description: 'The examiner asks you about yourself, your home, work or studies and other familiar topics.',
    questions: ['', '', '', '']
  },
  part2: {
    instructions: 'You will have to talk about the topic for one to two minutes. You have one minute to think about what you are going to say. You can make some notes to help you if you wish.',
    cueCard: '',
    questions: ['']
  },
  part3: {
    description: '',
    topics: [{ label: '', questions: ['', ''] }, { label: '', questions: ['', ''] }, { label: '', questions: ['', ''] }]
  }
})

// ─── STYLES ──────────────────────────────────────────────────────────────────
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'
const btnPrimary = 'bg-[#1a56db] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
const btnSecondary = 'border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition'
const btnDanger = 'text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition font-medium'
const btnGhost = 'text-[#1a56db] text-xs font-semibold hover:underline transition'

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function QuestionEditor({ question, questionIndex, onUpdate, onRemove, skill = 'reading' }) {
  const updateField = (field, val) => onUpdate(questionIndex, field, val)
  const updateOption = (oi, val) => {
    const opts = [...(question.options || [])]
    opts[oi] = val
    onUpdate(questionIndex, 'options', opts)
  }
  const addOption    = () => onUpdate(questionIndex, 'options', [...(question.options || []), ''])
  const removeOption = (oi) => onUpdate(questionIndex, 'options', (question.options || []).filter((_, i) => i !== oi))

  const types         = skill === 'listening' ? LISTENING_Q_TYPES : READING_Q_TYPES
  const isMcqOpts     = TYPES_WITH_MCQ_OPTIONS.includes(question.type)
  const isDynamicOpts = TYPES_WITH_DYNAMIC_OPTIONS.includes(question.type)
  const hasImage      = TYPES_WITH_IMAGE.includes(question.type)

  const handleTypeChange = (newType) => {
    const newOpts = TYPES_WITH_MCQ_OPTIONS.includes(newType)     ? ['', '', '', '']
                  : TYPES_WITH_DYNAMIC_OPTIONS.includes(newType) ? ['']
                  : null
    onUpdate(questionIndex, 'type', newType)
    onUpdate(questionIndex, 'options', newOpts)
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500">Câu {question.number}</span>
        <button type="button" onClick={() => onRemove(questionIndex)} className={btnDanger}>Xóa</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Loại câu hỏi</label>
          <select className={inputCls} value={question.type} onChange={e => handleTypeChange(e.target.value)}>
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Số thứ tự</label>
          <input type="number" className={inputCls} value={question.number}
            onChange={e => updateField('number', parseInt(e.target.value) || 1)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Nội dung câu hỏi</label>
        <textarea className={inputCls} rows={2} placeholder="Nhập câu hỏi / mệnh đề..."
          value={question.questionText} onChange={e => updateField('questionText', e.target.value)} />
      </div>

      {/* MCQ fixed A/B/C/D options */}
      {isMcqOpts && (
        <div>
          <label className={labelCls}>Các lựa chọn</label>
          <div className="grid grid-cols-2 gap-2">
            {(question.options || ['', '', '', '']).map((opt, oi) => (
              <input key={oi} className={inputCls}
                placeholder={`${String.fromCharCode(65 + oi)}. ...`}
                value={opt} onChange={e => updateOption(oi, e.target.value)} />
            ))}
          </div>
        </div>
      )}

      {/* Dynamic options for matching types */}
      {isDynamicOpts && (
        <div>
          <label className={labelCls}>Danh sách lựa chọn</label>
          <div className="space-y-1.5">
            {(question.options || ['']).map((opt, oi) => (
              <div key={oi} className="flex gap-2 items-center">
                <input className={inputCls} placeholder={`Lựa chọn ${oi + 1}...`}
                  value={opt} onChange={e => updateOption(oi, e.target.value)} />
                <button type="button" onClick={() => removeOption(oi)}
                  className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
              </div>
            ))}
            <button type="button" onClick={addOption}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold">+ Thêm lựa chọn</button>
          </div>
        </div>
      )}

      {/* Image URL for map/diagram */}
      {hasImage && (
        <div>
          <label className={labelCls}>URL hình ảnh (map/diagram)</label>
          <input className={inputCls} placeholder="https://... (để trống nếu chưa có)"
            value={question.imageUrl || ''} onChange={e => updateField('imageUrl', e.target.value)} />
        </div>
      )}

      <div>
        <label className={labelCls}>Đáp án đúng</label>
        <input className={`${inputCls} border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-blue-100`}
          placeholder={ANSWER_PLACEHOLDER[question.type] || 'Đáp án đúng'}
          value={question.correctAnswer} onChange={e => updateField('correctAnswer', e.target.value)} />
      </div>
    </div>
  )
}

function ExamList({ exams, skill, onDelete, onEdit, editingId }) {
  const [loadingId, setLoadingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, title }

  const skillLabel = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
  const skillColor = {
    reading: 'bg-[#eff6ff] text-[#1a56db]',
    listening: 'bg-[#eff6ff] text-[#1a56db]',
    writing: 'bg-[#eff6ff] text-[#1a56db]',
    speaking: 'bg-[#eff6ff] text-[#1a56db]',
  }
  const filtered = exams.filter(e => e.skill === skill)

  // Close confirm dialog on Escape
  useEffect(() => {
    if (!confirmDelete) return
    const handler = (e) => { if (e.key === 'Escape') setConfirmDelete(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [confirmDelete])

  const handleEdit = async (exam) => {
    setLoadingId(exam.id)
    const t0 = Date.now()
    await onEdit(exam.id)
    const elapsed = Date.now() - t0
    if (elapsed < 300) await new Promise(r => setTimeout(r, 300 - elapsed))
    setLoadingId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setConfirmDelete(null)
    await onDelete(id)
  }

  if (filtered.length === 0) {
    return <div className="text-center text-gray-400 py-8 text-sm">Chưa có đề nào. Tạo đề đầu tiên!</div>
  }

  const anyLoading = loadingId !== null

  return (
    <>
      <div className="space-y-2">
        {filtered.map(exam => {
          const isEditing = exam.id === editingId
          const isLoading = exam.id === loadingId
          return (
            <div key={exam.id}
              style={isEditing ? { background: '#eff6ff', borderLeft: '3px solid #1a56db' } : {}}
              className={`bg-white rounded-xl p-4 border flex items-center justify-between transition
                ${isEditing ? 'border-[#bfdbfe]' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm truncate ${isEditing ? 'text-[#1a56db] font-medium' : 'text-gray-800'}`}>
                      {exam.title}
                    </p>
                    {isEditing && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1a56db] text-white shrink-0">
                        Đang chỉnh sửa
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${skillColor[exam.skill]}`}>
                      {skillLabel[exam.skill]}
                    </span>
                    {exam.bookNumber && exam.testNumber && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Cambridge {exam.bookNumber} · Test {exam.testNumber}
                      </span>
                    )}
                    {exam._count?.attempts > 0 && (
                      <span className="text-xs text-gray-400">{exam._count.attempts} lượt thi</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => !anyLoading && handleEdit(exam)}
                  disabled={anyLoading}
                  className={btnSecondary + ' text-xs min-w-[72px] justify-center flex items-center gap-1.5'}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
                      </svg>
                      Đang tải...
                    </>
                  ) : 'Sửa'}
                </button>
                <button
                  onClick={() => !anyLoading && setConfirmDelete({ id: exam.id, title: exam.title })}
                  disabled={anyLoading}
                  className={btnDanger}
                >Xóa</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
          >
            <h3 className="font-bold text-gray-800 text-base mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Bạn có chắc muốn xóa đề <span className="font-semibold text-gray-800">"{confirmDelete.title}"</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
              >Quay lại</button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition"
                style={{ background: '#dc2626' }}
              >Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── CAMBRIDGE BOOK MODAL — Cover + PDF Import ────────────────────────────────

const SKILL_COLOR_CLASS = {
  reading:   'bg-[#1a56db] border-[#1a56db] text-white',
  listening: 'bg-[#1a56db] border-[#1a56db] text-white',
  writing:   'bg-[#1a56db] border-[#1a56db] text-white',
  speaking:  'bg-[#1a56db] border-[#1a56db] text-white',
}
const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }

function CoverTab({ bookNumber, seriesId, coverUrl, onCoverUploaded }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const upload = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await api.post(`/admin/exam-series/${seriesId}/covers/${bookNumber}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onCoverUploaded(res.data.coverImageUrl)
    } catch { alert('Lỗi upload ảnh bìa') }
    finally { setUploading(false) }
  }

  return (
    <div>
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
        onClick={() => inputRef.current?.click()}
      >
        {coverUrl
          ? <img src={`${SERVER_BASE}${coverUrl}`} alt="" className="h-36 mx-auto object-contain rounded-lg mb-3 shadow" />
          : <div className="text-5xl mb-3">📚</div>}
        <p className="text-sm font-semibold text-gray-600">{coverUrl ? 'Click để đổi ảnh bìa' : 'Click để upload ảnh bìa'}</p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — tối đa 20MB</p>
        {uploading && <p className="text-xs text-red-500 mt-2 font-medium">Đang upload...</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

function PDFImportTab({ bookNumber, seriesId, onRefresh }) {
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfMeta, setPdfMeta] = useState(null)   // { dataFile, originalName, pageCount }
  const [uploading, setUploading] = useState(false)
  const [selectedTest, setSelectedTest] = useState(1)
  const [selectedSkill, setSelectedSkill] = useState('reading')
  const [pageRange, setPageRange] = useState({ start: 0, end: 0 })
  const [answerRange, setAnswerRange] = useState({ start: 0, end: 0 })
  const [extracting, setExtracting] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const pdfRef = useRef(null)

  // Heuristic page-range suggestion based on Cambridge IELTS structure
  const suggestRange = useCallback((pageCount, testNum, skill) => {
    const front = 8
    const answerLen = Math.max(20, Math.floor(pageCount * 0.13))
    const contentEnd = pageCount - answerLen
    const perTest = Math.floor((contentEnd - front) / 4)
    const ts = front + (testNum - 1) * perTest
    const offsets = { listening: [0, 12], reading: [13, 36], writing: [37, 41], speaking: [42, 46] }
    const [ds, de] = offsets[skill] || [0, perTest - 1]
    return {
      content: { start: Math.min(ts + ds + 1, pageCount), end: Math.min(ts + de, pageCount) },
      answer:  { start: contentEnd + 1, end: pageCount }
    }
  }, [])

  useEffect(() => {
    if (!pdfMeta) return
    const { content, answer } = suggestRange(pdfMeta.pageCount, selectedTest, selectedSkill)
    setPageRange(content)
    if (selectedSkill === 'reading' || selectedSkill === 'listening') setAnswerRange(answer)
  }, [selectedTest, selectedSkill, pdfMeta, suggestRange])

  const handleUpload = async () => {
    if (!pdfFile) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('pdf', pdfFile)
      const res = await api.post('/admin/cambridge/upload-pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      })
      setPdfMeta(res.data)
    } catch (e) {
      setError(e.response?.data?.message || 'Lỗi đọc PDF')
    } finally { setUploading(false) }
  }

  const handleExtract = async () => {
    setExtracting(true); setError('')
    try {
      const res = await api.post('/admin/cambridge/extract-save', {
        dataFile: pdfMeta.dataFile,
        bookNumber,
        seriesId,
        testNumber: selectedTest,
        skill: selectedSkill,
        startPage: pageRange.start,
        endPage: pageRange.end,
        answerStart: (selectedSkill === 'reading' || selectedSkill === 'listening') ? answerRange.start : 0,
        answerEnd:   (selectedSkill === 'reading' || selectedSkill === 'listening') ? answerRange.end   : 0,
      }, { timeout: 180000 })
      setResults(r => [...r, res.data])
      onRefresh?.()
    } catch (e) {
      setError(e.response?.data?.message || 'Lỗi trích xuất')
    } finally { setExtracting(false) }
  }

  return (
    <div className="space-y-4">
      {!pdfMeta ? (
        <>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${pdfFile ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
            onClick={() => pdfRef.current?.click()}
          >
            <div className="text-4xl mb-2">{pdfFile ? '📄' : '📁'}</div>
            {pdfFile
              ? <><p className="font-semibold text-gray-800 text-sm">{pdfFile.name}</p><p className="text-xs text-gray-400 mt-1">{(pdfFile.size/1024/1024).toFixed(1)} MB</p></>
              : <><p className="font-semibold text-gray-600 text-sm">Kéo thả hoặc click để chọn file PDF</p><p className="text-xs text-gray-400 mt-1">Tối đa 300MB</p></>}
          </div>
          <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { if (e.target.files[0]) setPdfFile(e.target.files[0]); e.target.value = '' }} />
          {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          <button onClick={handleUpload} disabled={!pdfFile || uploading} className={btnPrimary + ' w-full'}>
            {uploading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Đang đọc PDF... (1–2 phút)</span>
              : 'Đọc PDF →'}
          </button>
        </>
      ) : (
        <>
          {/* File info bar */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{pdfMeta.originalName}</p>
                <p className="text-xs text-gray-400">{pdfMeta.pageCount} trang</p>
              </div>
            </div>
            <button onClick={() => { setPdfMeta(null); setPdfFile(null); setResults([]) }} className={btnSecondary + ' text-xs py-1'}>Đổi file</button>
          </div>

          {/* Already extracted */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Đã trích xuất</p>
              {results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${r.questionCount > 0 ? 'bg-[#eff6ff] border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                  <span className={`text-sm font-semibold truncate ${r.questionCount > 0 ? 'text-[#1a56db]' : 'text-amber-700'}`}>{r.title}</span>
                  <span className={`text-xs shrink-0 ml-2 font-bold ${r.questionCount > 0 ? 'text-[#1a56db]' : 'text-amber-600'}`}>
                    {r.questionCount > 0 ? `${r.questionCount} câu ✓` : '⚠ 0 câu — kiểm tra lại'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">{error}</div>}

          {/* Select Test */}
          <div>
            <label className={labelCls}>Chọn Test</label>
            <div className="flex gap-2">
              {[1,2,3,4].map(n => (
                <button key={n} type="button" onClick={() => setSelectedTest(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${selectedTest === n ? 'bg-[#1a56db] text-white border-[#1a56db]' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                  Test {n}
                </button>
              ))}
            </div>
          </div>

          {/* Select Skill */}
          <div>
            <label className={labelCls}>Chọn Kỹ năng</label>
            <div className="grid grid-cols-4 gap-2">
              {['reading','listening','writing','speaking'].map(sk => (
                <button key={sk} type="button" onClick={() => setSelectedSkill(sk)}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition ${selectedSkill === sk ? SKILL_COLOR_CLASS[sk] : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                  {SKILL_LABEL[sk]}
                </button>
              ))}
            </div>
          </div>

          {/* Page ranges */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Phạm vi trang — AI tự gợi ý, có thể chỉnh</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Trang bắt đầu ({SKILL_LABEL[selectedSkill]})</label>
                <input type="text" inputMode="numeric" className={inputCls}
                  value={pageRange.start || ''}
                  placeholder="0"
                  onChange={e => { const v = e.target.value.replace(/\D/g,''); setPageRange(p => ({ ...p, start: v === '' ? 0 : parseInt(v) })) }} />
              </div>
              <div>
                <label className={labelCls}>Trang kết thúc</label>
                <input type="text" inputMode="numeric" className={inputCls}
                  value={pageRange.end || ''}
                  placeholder="0"
                  onChange={e => { const v = e.target.value.replace(/\D/g,''); setPageRange(p => ({ ...p, end: v === '' ? 0 : parseInt(v) })) }} />
              </div>
            </div>
            {(selectedSkill === 'reading' || selectedSkill === 'listening') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Trang đáp án — từ</label>
                  <input type="text" inputMode="numeric" className={inputCls}
                    value={answerRange.start || ''}
                    placeholder="0"
                    onChange={e => { const v = e.target.value.replace(/\D/g,''); setAnswerRange(a => ({ ...a, start: v === '' ? 0 : parseInt(v) })) }} />
                </div>
                <div>
                  <label className={labelCls}>Trang đáp án — đến</label>
                  <input type="text" inputMode="numeric" className={inputCls}
                    value={answerRange.end || ''}
                    placeholder="0"
                    onChange={e => { const v = e.target.value.replace(/\D/g,''); setAnswerRange(a => ({ ...a, end: v === '' ? 0 : parseInt(v) })) }} />
                </div>
              </div>
            )}
          </div>

          {/* Extract button */}
          <button onClick={handleExtract} disabled={extracting} className={btnPrimary + ' w-full'}>
            {extracting
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>AI đang trích xuất... (30–90 giây)</span>
              : `Trích xuất Test ${selectedTest} · ${SKILL_LABEL[selectedSkill]}`}
          </button>
          <p className="text-xs text-center text-gray-400">Có thể trích xuất nhiều lần với các tổ hợp Test + Kỹ năng khác nhau từ cùng 1 PDF</p>
        </>
      )}
    </div>
  )
}

function BookModal({ bookNumber, seriesId, seriesName, coverUrl, onClose, onCoverUploaded, onRefresh }) {
  const [tab, setTab] = useState('cover')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {coverUrl && <img src={`${SERVER_BASE}${coverUrl}`} alt="" className="w-8 h-10 rounded object-cover shadow" />}
            <h2 className="font-extrabold text-gray-800">{seriesName} {bookNumber}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 font-bold transition">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {[{k:'cover',l:'🖼️ Ảnh bìa'},{k:'pdf',l:'📄 Import đề từ PDF'}].map(({k,l}) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${tab === k ? 'border-[#1a56db] text-[#1a56db]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {tab === 'cover' && <CoverTab bookNumber={bookNumber} seriesId={seriesId} coverUrl={coverUrl} onCoverUploaded={onCoverUploaded} />}
          {tab === 'pdf'   && <PDFImportTab bookNumber={bookNumber} seriesId={seriesId} onRefresh={onRefresh} />}
        </div>
      </div>
    </div>
  )
}

// ─── SERIES CARD ───────────────────────────────────────────────────────────────
function SeriesCard({ s, onManage, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">{s.name}</h4>
          <p className="text-xs text-gray-400 mt-0.5">{s._count?.bookCovers ?? 0} cuốn</p>
        </div>
        <span className="text-2xl">📚</span>
      </div>
      <div className="flex gap-2 mt-auto">
        <button onClick={() => onManage(s)} className="flex-1 py-1.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold hover:bg-[#1d4ed8] transition">Xem</button>
        <button onClick={() => onEdit(s)} className="py-1.5 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition">Sửa tên</button>
        <button onClick={() => setConfirmDelete(true)} className="py-1.5 px-3 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition">Xóa</button>
      </div>
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-2">Xóa bộ đề?</h3>
            <p className="text-sm text-gray-500 mb-4">Tất cả thông tin trong bộ đề <strong>{s.name}</strong> sẽ bị xóa.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">Hủy</button>
              <button onClick={() => { setConfirmDelete(false); onDelete(s.id) }} className="flex-1 py-2 rounded-xl bg-[#dc2626] text-white text-sm font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SeriesDetailView({ series, books, onBack, onBooksChanged, onRefresh }) {
  const [openModal, setOpenModal] = useState(null) // bookNumber
  const [addingBook, setAddingBook] = useState(false)
  const [deleteBook, setDeleteBook] = useState(null) // bookNumber
  const [coverMap, setCoverMap] = useState({})
  const [editingBook, setEditingBook] = useState(null) // bookNumber being edited
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef(null)

  useEffect(() => {
    const map = {}
    for (const b of books) if (b.coverImageUrl) map[b.bookNumber] = b.coverImageUrl
    setCoverMap(map)
  }, [books])

  useEffect(() => {
    if (editingBook !== null) editInputRef.current?.select()
  }, [editingBook])

  const handleAddBook = async () => {
    setAddingBook(true)
    try {
      await api.post(`/admin/exam-series/${series.id}/books`)
      onBooksChanged()
    } catch { alert('Lỗi thêm cuốn') }
    finally { setAddingBook(false) }
  }

  const handleDeleteBook = async (bookNumber) => {
    try {
      await api.delete(`/admin/exam-series/${series.id}/books/${bookNumber}`)
      onBooksChanged()
    } catch { alert('Lỗi xóa cuốn') }
    setDeleteBook(null)
  }

  const startEdit = (bookNumber, e) => {
    e.stopPropagation()
    setEditingBook(bookNumber)
    setEditValue(String(bookNumber))
  }

  const commitEdit = async () => {
    const newNumber = parseInt(editValue)
    if (!newNumber || newNumber < 1) { setEditingBook(null); return }
    if (newNumber !== editingBook) {
      try {
        await api.put(`/admin/exam-series/${series.id}/books/${editingBook}`, { bookNumber: newNumber })
        onBooksChanged()
      } catch { alert('Lỗi sửa số cuốn') }
    }
    setEditingBook(null)
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingBook(null)
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition text-sm font-bold">←</button>
          <div>
            <h3 className="font-bold text-gray-800">{series.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{books.length} cuốn · click vào cuốn để upload ảnh bìa hoặc import đề từ PDF</p>
          </div>
        </div>
        <button
          onClick={handleAddBook}
          disabled={addingBook}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold hover:bg-[#1d4ed8] transition disabled:opacity-50"
        >
          + Thêm cuốn
        </button>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
        {books.map(b => (
          <div key={b.bookNumber} className="flex flex-col items-center gap-1.5">
            <div className="relative group">
              <div
                className="w-12 h-16 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 cursor-pointer hover:border-blue-400 transition"
                onClick={() => setOpenModal(b.bookNumber)}
                title={`${series.name} ${b.bookNumber} — click để quản lý`}
              >
                {coverMap[b.bookNumber]
                  ? <img src={`${SERVER_BASE}${coverMap[b.bookNumber]}`} alt={`${series.name} ${b.bookNumber}`} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300 text-lg">📚</div>}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                  <span className="text-white text-lg">⚙</span>
                </div>
              </div>
              <button
                onClick={(e) => startEdit(b.bookNumber, e)}
                className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center leading-none"
                title="Sửa số cuốn"
              >✏</button>
              <button
                onClick={() => setDeleteBook(b.bookNumber)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center leading-none"
                title="Xóa cuốn"
              >✕</button>
            </div>
            {editingBook === b.bookNumber ? (
              <input
                ref={editInputRef}
                type="number"
                min="1"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                className="w-12 text-xs text-center border border-[#1a56db] rounded px-1 py-0.5 outline-none font-medium"
              />
            ) : (
              <span className="text-xs text-gray-500 font-medium">{b.bookNumber}</span>
            )}
          </div>
        ))}
      </div>

      {openModal && (
        <BookModal
          bookNumber={openModal}
          seriesId={series.id}
          seriesName={series.name}
          coverUrl={coverMap[openModal]}
          onClose={() => setOpenModal(null)}
          onCoverUploaded={url => setCoverMap(c => ({ ...c, [openModal]: url }))}
          onRefresh={onRefresh}
        />
      )}

      {deleteBook && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteBook(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-2">Xóa cuốn {deleteBook}?</h3>
            <p className="text-sm text-gray-500 mb-4">Tất cả đề thi (Reading, Listening, Writing, Speaking) trong cuốn này sẽ bị xóa vĩnh viễn.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteBook(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">Hủy</button>
              <button onClick={() => handleDeleteBook(deleteBook)} className="flex-1 py-2 rounded-xl bg-[#dc2626] text-white text-sm font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: READING ─────────────────────────────────────────────────────────────

// Reading-specific group editors

function TrueFalseEditor({ group, onChange }) {
  const isTF = group.type === 'true_false_ng'
  const answerOptions = isTF ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']

  const addQuestion = () => {
    const nextNum = group.questions.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
    onChange({
      ...group,
      qNumberEnd: nextNum,
      questions: [...group.questions, { number: nextNum, questionText: '', correctAnswer: '' }]
    })
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  return (
    <div className="space-y-2">
      {group.questions.map((q, qi) => (
        <div key={qi} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">Câu {q.number}</span>
            <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
          </div>
          <textarea rows={2}
            className="w-full border border-blue-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:border-blue-400"
            placeholder="Nội dung câu phát biểu..."
            value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
          <select
            className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6] bg-white"
            value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)}>
            <option value="">-- Chọn đáp án --</option>
            {answerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      ))}
      <button type="button" onClick={addQuestion}
        className="w-full border-2 border-dashed border-blue-200 rounded-xl py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
        + Thêm câu phát biểu
      </button>
    </div>
  )
}

function SummaryCompletionEditor({ group, onChange }) {
  const lineRefs = useRef({})

  const allTokenNums = group.noteSections.flatMap(ns =>
    ns.lines.flatMap(l => {
      const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  const insertBlank = (nsi, li) => {
    const key = `${nsi}-${li}`
    const el = lineRefs.current[key]
    const pos = el ? el.selectionStart : (group.noteSections[nsi].lines[li].content || '').length
    const token = `[Q:${nextQNum}]`
    const oldContent = group.noteSections[nsi].lines[li].content || ''
    const newContent = oldContent.slice(0, pos) + token + oldContent.slice(pos)
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: newContent })
    })
    const existingNums = new Set(group.questions.map(q => q.number))
    const newQuestions = existingNums.has(nextQNum) ? group.questions
      : [...group.questions, { number: nextQNum, correctAnswer: '' }].sort((a, b) => a.number - b.number)
    onChange({ ...group, noteSections: sections, questions: newQuestions, qNumberEnd: Math.max(group.qNumberStart, nextQNum) })
  }

  const updateLine = (nsi, li, val) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: val })
    })
    onChange({ ...group, noteSections: sections })
  }

  const updateLineType = (nsi, li, type) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, lineType: type })
    })
    onChange({ ...group, noteSections: sections })
  }

  const addLine = (nsi) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, lines: [...ns.lines, { content: '', lineType: 'content' }] })
    onChange({ ...group, noteSections: sections })
  }

  const removeLine = (nsi, li) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, lines: ns.lines.filter((_, j) => j !== li) })
    onChange({ ...group, noteSections: sections })
  }

  const addSection = () => {
    onChange({ ...group, noteSections: [...group.noteSections, { title: '', lines: [{ content: '', lineType: 'content' }] }] })
  }

  const updateSectionTitle = (nsi, val) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, title: val })
    onChange({ ...group, noteSections: sections })
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

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  const letters = group.matchingOptions.map(mo => mo.letter).filter(Boolean)

  return (
    <div className="space-y-3">
      {/* Word Bank */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-indigo-700">Word Bank (Ngân hàng từ)</p>
          <button type="button" onClick={addOption} className="text-xs text-indigo-600 font-semibold hover:underline">+ Thêm từ</button>
        </div>
        <div className="space-y-2">
          {group.matchingOptions.map((mo, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input className="w-10 border border-indigo-200 rounded px-1 py-1 text-xs text-center font-bold focus:outline-none"
                value={mo.letter} onChange={e => updateOption(oi, 'letter', e.target.value)} />
              <input className="flex-1 border border-indigo-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-indigo-400"
                placeholder="Từ/cụm từ..."
                value={mo.text} onChange={e => updateOption(oi, 'text', e.target.value)} />
              <button type="button" onClick={() => removeOption(oi)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Note Content */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-amber-700">Nội dung Summary/Note</p>
          <button type="button" onClick={addSection} className="text-xs text-amber-600 font-semibold hover:underline">+ Thêm phần</button>
        </div>
        <div className="space-y-4">
          {group.noteSections.map((ns, nsi) => (
            <div key={nsi} className="bg-white rounded-lg border border-amber-200 p-3">
              <input
                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold placeholder-gray-300 focus:outline-none focus:border-amber-400 mb-2"
                placeholder="Tiêu đề phần (tùy chọn)"
                value={ns.title} onChange={e => updateSectionTitle(nsi, e.target.value)} />
              <div className="space-y-2">
                {ns.lines.map((line, li) => {
                  const isHeading = line.lineType === 'heading'
                  return (
                  <div key={li} className={`flex items-start gap-2 rounded-lg p-1 ${isHeading ? 'bg-gray-50' : ''}`}>
                    <button
                      type="button"
                      title={isHeading ? 'Heading — click để đổi sang Nội dung' : 'Nội dung — click để đổi sang Heading'}
                      onClick={() => updateLineType(nsi, li, isHeading ? 'content' : 'heading')}
                      className={`shrink-0 text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded border transition ${
                        isHeading
                          ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                          : 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200'
                      }`}
                    >
                      {isHeading ? 'H' : '•'}
                    </button>
                    <textarea
                      ref={el => lineRefs.current[`${nsi}-${li}`] = el}
                      rows={1}
                      className={`flex-1 border rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono ${
                        isHeading
                          ? 'font-bold border-gray-300 focus:border-gray-400 bg-gray-50 text-gray-700'
                          : 'border-gray-200 focus:border-amber-400'
                      }`}
                      placeholder={isHeading ? 'VD: THE PARK / BENEFITS OF...' : `VD: The process was [Q:${group.qNumberStart}] in the early stages.`}
                      value={line.content}
                      onChange={e => updateLine(nsi, li, e.target.value)}
                      style={{ minHeight: '34px' }}
                    />
                    {!isHeading && (
                      <button type="button" onClick={() => insertBlank(nsi, li)}
                        className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-amber-200 whitespace-nowrap">
                        + Ô trống
                      </button>
                    )}
                    {ns.lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(nsi, li)} className="shrink-0 text-red-400 hover:text-red-600 text-xs py-1.5">✕</button>
                    )}
                  </div>
                  )
                })}
                <button type="button" onClick={() => addLine(nsi)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">+ Thêm dòng</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answers */}
      {group.questions.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
          <p className="text-xs font-bold text-[#1a56db] mb-2">Đáp án (chữ cái từ Word Bank)</p>
          <div className="grid grid-cols-2 gap-2">
            {group.questions.map(q => {
              const usedByOthers = new Set(group.questions.filter(other => other.number !== q.number && other.correctAnswer).map(other => other.correctAnswer))
              return (
              <div key={q.number} className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1a56db] w-14 shrink-0">Q{q.number}:</span>
                <select
                  className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6] bg-white"
                  value={q.correctAnswer}
                  onChange={e => updateAnswer(q.number, e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {group.matchingOptions.filter(mo => !usedByOthers.has(mo.letter)).map(mo => (
                    <option key={mo.letter} value={mo.letter}>{mo.letter}{mo.text ? ` - ${mo.text}` : ''}</option>
                  ))}
                </select>
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


function ReadingGroupEditor({ group, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const typeLabel = READING_GROUP_TYPES.find(t => t.value === group.type)?.label || group.type

  const typeColors = {
    true_false_ng: 'bg-blue-100 text-blue-800 border-blue-300',
    yes_no_ng: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    note_completion: 'bg-amber-100 text-amber-800 border-amber-300',
    mcq: 'bg-blue-100 text-blue-800 border-blue-300',
    mcq_multi: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    matching_information: 'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
    drag_word_bank: 'bg-sky-100 text-sky-800 border-sky-300',
    matching_drag: 'bg-violet-100 text-violet-800 border-violet-300',
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeColors[group.type] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-gray-500 font-medium">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-red-50">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2}
            className={`${inputCls} resize-none`}
            placeholder="Hướng dẫn làm bài..."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {(group.type === 'true_false_ng' || group.type === 'yes_no_ng') && (
          <TrueFalseEditor group={group} onChange={onChange} />
        )}
        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_information' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1a56db]" />
              <span className="text-xs text-gray-600 font-medium">Cho phép dùng lại chữ cái (mỗi đoạn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
      </div>
    </div>
  )
}

// ─── INLINE ADMIN PREVIEW COMPONENTS ─────────────────────────────────────────

// tokenNumMap: { originalDbNum: displayNum } — maps DB question numbers to
// position-based display numbers (qStart + index within group).
// Answer lookup still uses the original DB number; only the label changes.
function PreviewTokenLine({ content, questions, showAnswers, tokenNumMap = {} }) {
  const parts = (content || '').split(/(\[Q:\d+\])/)
  return (
    <p className="text-sm leading-8 text-gray-700">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const displayNum = tokenNumMap[qNum] ?? qNum
          const q = questions.find(q => q.number === qNum)
          const val = showAnswers ? (q?.correctAnswer || '') : ''
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs shrink-0">{displayNum}</span>
              <span className={`inline-block min-w-20 border-b-2 ${showAnswers ? 'border-[#1a56db] text-[#1a56db] font-semibold' : 'border-gray-300 text-gray-400'} px-1 text-sm text-center`}>
                {val || (showAnswers ? '?' : '___')}
              </span>
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// Scans all noteSections of a token-based group in order and builds
// a map from original DB question number → display number (qStart + position).
function buildTokenNumMap(group) {
  const map = {}
  let idx = 0
  ;(group.noteSections || []).forEach(ns => {
    ;(ns.lines || []).forEach(line => {
      const content = line.contentWithTokens || line.content || ''
      const tokens = [...content.matchAll(/\[Q:(\d+)\]/g)]
      tokens.forEach(m => {
        const num = parseInt(m[1])
        if (!(num in map)) { map[num] = group.qNumberStart + idx; idx++ }
      })
    })
  })
  return map
}

function AdminGroupPreview({ group, showAnswers }) {
  const qStart = group.qNumberStart
  const qEnd = group.qNumberEnd
  const maxChoices = group.maxChoices || 2

  const Banner = () => (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
      <p className="font-bold text-gray-800 mb-0.5">Questions {qStart}–{qEnd}</p>
      {group.instruction && <p className="text-gray-600 text-xs">{group.instruction}</p>}
    </div>
  )

  if (group.type === 'true_false_ng' || group.type === 'yes_no_ng') {
    const choices = group.type === 'true_false_ng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="mb-3 pl-1">
            <div className="flex gap-2 items-start mb-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
              <p className="text-sm text-gray-700 leading-5">{q.questionText}</p>
            </div>
            <div className="flex gap-2 pl-7">
              {choices.map(c => (
                <span key={c} className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${showAnswers && q.correctAnswer === c ? 'bg-[#1a56db] text-white border-[#1a56db]' : 'border-gray-200 text-gray-400'}`}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (group.type === 'note_completion') {
    const hasSections = (group.noteSections || []).length > 0
    const tokenNumMap = hasSections ? buildTokenNumMap(group) : {}
    return (
      <div className="mb-4">
        <Banner />
        {hasSections ? (
          (group.noteSections || []).map((ns, nsi) => (
            <div key={nsi} className="mb-3">
              {ns.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{ns.title}</p>}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} className="rounded-lg p-3 space-y-1">
                {(ns.lines || []).map((line, li) => (
                  line.lineType === 'heading'
                    ? <p key={li} className="font-bold text-[#1e293b] text-[0.95rem] pt-1 pb-0.5">{line.content || ''}</p>
                    : <PreviewTokenLine key={li} content={line.content || ''} questions={group.questions} showAnswers={showAnswers} tokenNumMap={tokenNumMap} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-2">
            {(group.questions || []).map((q, qi) => (
              <div key={qi} className="flex gap-2 items-center text-sm">
                <span className="w-5 h-5 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs flex items-center justify-center shrink-0">{qStart + qi}</span>
                <span className="flex-1 text-gray-700">{q.questionText}</span>
                <span className={`border-b-2 ${showAnswers ? 'border-[#1a56db] text-[#1a56db] font-semibold' : 'border-gray-200 text-gray-400'} min-w-24 text-center text-sm`}>
                  {showAnswers ? q.correctAnswer : '___'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (group.type === 'mcq') {
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => {
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          return (
            <div key={qi} className="mb-4">
              <p className="text-sm text-gray-800 mb-2 flex gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
                <span>{q.questionText}</span>
              </p>
              <div className="space-y-1 pl-8">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const isCorrect = showAnswers && q.correctAnswer === opt
                  return (
                    <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe] text-[#1a56db]' : 'text-gray-600'}`}>
                      <span className="text-xs text-gray-400 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-bold text-[#1a56db]">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (group.type === 'mcq_multi') {
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => {
          const qS = qStart + qi * maxChoices
          const qE = qS + maxChoices - 1
          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : [])
          const correctList = showAnswers ? (q.correctAnswer || '').split(',').filter(Boolean) : []
          return (
            <div key={qi} className="mb-4">
              {q.questionText && (
                <p className="text-sm text-gray-800 mb-2 flex gap-2">
                  <span className="font-bold text-gray-700 shrink-0">{qS}–{qE}.</span>
                  <span>{q.questionText}</span>
                </p>
              )}
              <div className="space-y-1 pl-2">
                {opts.filter(o => o && o.trim()).map((opt, oi) => {
                  const isCorrect = showAnswers && correctList.includes(opt)
                  return (
                    <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe] text-[#1a56db]' : 'text-gray-600'}`}>
                      <span className="text-xs text-gray-400 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-bold text-[#1a56db]">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (group.type === 'matching') {
    return (
      <div className="mb-4">
        <Banner />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(group.matchingOptions || []).map((mo, mi) => (
            <span key={mi} className="text-xs px-2 py-0.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
              <span className="font-bold text-[#1a56db]">{mo.letter}.</span> {mo.text}
            </span>
          ))}
        </div>
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="flex items-center gap-2 mb-2 text-sm">
            <span className="w-6 text-xs font-bold text-gray-500 shrink-0">{qStart + qi}.</span>
            <span className="flex-1 text-gray-700">{q.questionText}</span>
            <span className={`font-bold text-sm ${showAnswers ? 'text-[#1a56db]' : 'text-gray-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  if (group.type === 'map_diagram') {
    const letters = (group.matchingOptions || []).map(mo => mo.letter || mo.optionLetter).filter(Boolean)
    return (
      <div className="mb-4">
        <Banner />
        {group.imageUrl && (
          <img src={toImgSrc(group.imageUrl)}
            alt="diagram" className="w-full max-w-sm rounded-lg mb-3 border" />
        )}
        {letters.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 border-r border-gray-200 min-w-[180px]" />
                  {letters.map(l => (
                    <th key={l} className="px-2 py-2 text-center font-semibold text-gray-700 w-10 border-r border-gray-100 last:border-r-0 text-xs">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(group.questions || []).map((q, qi) => {
                  const correct = q.correctAnswer || ''
                  return (
                    <tr key={qi} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-2.5 border-r border-gray-200 align-middle">
                        <span className="font-bold text-[#1a56db] mr-1.5 text-xs">{qStart + qi}.</span>
                        <span className="text-gray-700 text-xs leading-snug">{q.questionText}</span>
                      </td>
                      {letters.map(l => {
                        const isCorrect = showAnswers && correct === l
                        return (
                          <td key={l} className="px-2 py-2.5 text-center border-r border-gray-100 last:border-r-0 align-middle">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded border text-sm font-bold
                              ${isCorrect
                                ? 'bg-[#eff6ff] border-[#1a56db] text-[#1a56db]'
                                : 'bg-white border-gray-200 text-transparent'}`}>
                              ✓
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          (group.questions || []).map((q, qi) => (
            <div key={qi} className="flex items-center gap-2 mb-2 text-sm">
              <span className="w-6 text-xs font-bold text-gray-500 shrink-0">{qStart + qi}.</span>
              <span className="flex-1 text-gray-700">{q.questionText}</span>
              <span className={`font-bold text-sm ${showAnswers ? 'text-[#1a56db]' : 'text-gray-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
            </div>
          ))
        )}
      </div>
    )
  }

  if (group.type === 'matching_information') {
    const letters = (group.matchingOptions || []).map(mo => mo.letter || mo.optionLetter).filter(Boolean)
    return (
      <div className="mb-4">
        <Banner />
        {/* Paragraph labels */}
        {(group.matchingOptions || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(group.matchingOptions || []).map((mo, mi) => (
              <span key={mi} className="text-xs px-2 py-0.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
                <span className="font-bold text-[#1a56db]">{mo.letter || mo.optionLetter}.</span> {mo.text || mo.optionText}
              </span>
            ))}
          </div>
        )}
        {/* Grid table */}
        {letters.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 border-r border-gray-200 min-w-[180px]" />
                  {letters.map(l => (
                    <th key={l} className="px-2 py-2 text-center font-semibold text-gray-700 w-10 border-r border-gray-100 last:border-r-0 text-xs">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(group.questions || []).map((q, qi) => (
                  <tr key={qi} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-2.5 border-r border-gray-200 align-middle">
                      <span className="font-bold text-[#1a56db] mr-1.5 text-xs">{qStart + qi}.</span>
                      <span className="text-gray-700 text-xs leading-snug">{q.questionText}</span>
                    </td>
                    {letters.map(l => {
                      const isCorrect = showAnswers && q.correctAnswer === l
                      return (
                        <td key={l} className="px-2 py-2.5 text-center border-r border-gray-100 last:border-r-0 align-middle">
                          <span className={`w-6 h-6 flex items-center justify-center mx-auto text-xs font-bold rounded border
                            ${isCorrect ? 'bg-[#eff6ff] border-[#1a56db] text-[#1a56db]' : 'bg-white border-gray-200 text-transparent'}`}>✓</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          (group.questions || []).map((q, qi) => (
            <div key={qi} className="flex items-center gap-2 mb-2 text-sm">
              <span className="w-6 text-xs font-bold text-gray-500 shrink-0">{qStart + qi}.</span>
              <span className="flex-1 text-gray-700">{q.questionText}</span>
              <span className={`font-bold text-sm ${showAnswers ? 'text-[#1a56db]' : 'text-gray-300'}`}>{showAnswers ? q.correctAnswer : '—'}</span>
            </div>
          ))
        )}
      </div>
    )
  }

  if (group.type === 'short_answer') {
    return (
      <div className="mb-4">
        <Banner />
        {(group.questions || []).map((q, qi) => (
          <div key={qi} className="flex gap-2 items-start mb-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{qStart + qi}</span>
            <div className="flex-1">
              <p className="text-gray-700 mb-1">{q.questionText}</p>
              <span className={`border-b-2 ${showAnswers ? 'border-[#1a56db] text-[#1a56db] font-semibold' : 'border-gray-300 text-gray-400'} inline-block min-w-28 text-center`}>
                {showAnswers ? q.correctAnswer : '___'}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (group.type === 'drag_word_bank') {
    const wordBank = group.matchingOptions || []
    const tokenNumMap = buildTokenNumMap(group)
    return (
      <div className="mb-4">
        <Banner />
        {/* Word bank */}
        <div className="rounded-xl p-3 border border-[#e2e8f0] bg-white mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Word Bank</p>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((wb, wi) => (
              <span key={wi} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bfdbfe] bg-white text-sm">
                <span className="font-bold text-xs text-[#1a56db]">{wb.letter || wb.optionLetter}</span>
                <span className="text-gray-700">{wb.text || wb.optionText}</span>
              </span>
            ))}
          </div>
        </div>
        {/* Note sections with tokens */}
        {(group.noteSections || []).map((ns, nsi) => (
          <div key={nsi} className="mb-3">
            {ns.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{ns.title}</p>}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} className="rounded-lg p-3 space-y-1">
              {(ns.lines || []).map((line, li) => {
                const content = line.contentWithTokens || line.content || ''
                const parts = content.split(/(\[Q:\d+\])/)
                return (
                  <p key={li} className="text-sm leading-8 text-gray-700">
                    {parts.map((part, pi) => {
                      const match = part.match(/\[Q:(\d+)\]/)
                      if (match) {
                        const qNum = parseInt(match[1])
                        const displayNum = tokenNumMap[qNum] ?? qNum
                        const q = (group.questions || []).find(q => q.number === qNum)
                        const ans = showAnswers ? (q?.correctAnswer || '') : ''
                        const ansWord = ans ? (wordBank.find(wb => (wb.letter || wb.optionLetter) === ans) || {}) : {}
                        return (
                          <span key={pi} className="inline-flex items-center gap-1 mx-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs shrink-0">{displayNum}</span>
                            <span className={`inline-block min-w-20 border-b-2 ${showAnswers && ans ? 'border-[#1a56db] text-[#1a56db] font-semibold' : 'border-gray-300 text-gray-400'} px-1 text-sm text-center`}>
                              {ans ? `${ans}. ${ansWord.text || ansWord.optionText || ''}` : '___'}
                            </span>
                          </span>
                        )
                      }
                      return <span key={pi}>{part}</span>
                    })}
                  </p>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (group.type === 'matching_drag') {
    const opts = group.matchingOptions || []
    return (
      <div className="mb-4">
        <Banner />
        <div className="flex gap-3">
          {/* Left: questions with drop-zone slots */}
          <div className="flex-1 space-y-2">
            {(group.questions || []).map((q, qi) => {
              const answer = showAnswers ? (q.correctAnswer || '') : ''
              const answerOpt = opts.find(o => (o.letter || o.optionLetter) === answer)
              return (
                <div key={qi} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-sm text-gray-800 mb-2 leading-relaxed flex gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs shrink-0 mt-0.5">{qStart + qi}</span>
                    <span>{q.questionText}</span>
                  </p>
                  <div className={`min-h-[36px] rounded-lg border-2 px-3 py-1.5 flex items-center text-sm
                    ${answer ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                    {answer ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1a56db] text-xs shrink-0">{answer}</span>
                        <span className="text-[#1a56db] text-xs leading-snug">{answerOpt?.text || answerOpt?.optionText || ''}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Kéo hoặc click đáp án...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Right: options pool */}
          <div className="w-48 shrink-0">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Options</p>
            <div className="space-y-1.5">
              {opts.map((opt, oi) => (
                <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs">
                  <span className="font-bold text-[#1a56db] shrink-0">{opt.letter || opt.optionLetter}</span>
                  <span className="text-gray-700 leading-relaxed">{opt.text || opt.optionText}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: never silently drop a group — always show the banner at minimum
  return (
    <div className="mb-4">
      <Banner />
      <p className="text-xs text-gray-400 italic px-1">Dạng câu hỏi: <span className="font-mono">{group.type}</span></p>
    </div>
  )
}

function InlinePreviewPanel({ title, showAnswers, setShowAnswers, onClose, children }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-indigo-800">Xem trước — {title}</span>
          <button
            type="button"
            onClick={() => setShowAnswers(v => !v)}
            className={`text-xs px-3 py-1 rounded-full font-semibold transition ${showAnswers ? 'bg-[#1a56db] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#bfdbfe] hover:text-[#1a56db]'}`}
          >
            {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition font-medium"
        >
          Thu gọn ↑
        </button>
      </div>
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function ListeningFormPreview({ form, showAnswers }) {
  const [activeSection, setActiveSection] = useState(0)
  const section = form.sections[activeSection]

  return (
    <div>
      {/* Section tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {form.sections.map((s, si) => {
          const total = s.questionGroups.reduce((acc, g) => acc + (g.qNumberEnd - g.qNumberStart + 1), 0)
          const isActive = activeSection === si
          return (
            <button
              key={si}
              type="button"
              onClick={() => setActiveSection(si)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
              style={{
                background: isActive ? '#1a56db' : '#fff',
                color: isActive ? '#fff' : '#1e293b',
                borderColor: isActive ? '#1a56db' : '#e2e8f0',
              }}
            >
              Section {s.number}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active section content */}
      {section && (
        <div>
          {section.context && (
            <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-[#bfdbfe] pl-2">{section.context}</p>
          )}
          {section.questionGroups.length > 0 ? (
            <div className="space-y-3">
              {section.questionGroups.map((group, gi) => (
                <AdminGroupPreview key={gi} group={group} showAnswers={showAnswers} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có câu hỏi</p>
          )}
        </div>
      )}
    </div>
  )
}

function ReadingFormPreview({ form, showAnswers }) {
  const [activePassage, setActivePassage] = useState(0)
  const [leftPct, setLeftPct] = useState(40)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const passage = form.passages[activePassage]
  const sortedGroups = passage
    ? [...(passage.questionGroups || [])].sort((a, b) => a.qNumberStart - b.qNumberStart)
    : []

  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const container = containerRef.current
    if (!container) return

    const onMouseMove = (ev) => {
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(75, Math.max(25, pct)))
    }
    const onMouseUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div>
      {form.passages.length > 1 && (
        <div className="flex gap-2 mb-4">
          {form.passages.map((p, pi) => (
            <button
              key={pi}
              type="button"
              onClick={() => setActivePassage(pi)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${activePassage === pi ? 'bg-[#1a56db] text-white' : 'bg-gray-100 text-gray-600 hover:bg-[#eff6ff] hover:text-[#1a56db]'}`}
            >
              Passage {p.number}
            </button>
          ))}
        </div>
      )}
      {passage && (
        <div
          ref={containerRef}
          className="flex border border-gray-200 rounded-xl overflow-hidden"
          style={{ minHeight: 400, userSelect: dragging ? 'none' : 'auto' }}
        >
          {/* Left: Passage text */}
          <div className="overflow-y-auto bg-white p-5" style={{ width: `${leftPct}%`, maxHeight: 600, flexShrink: 0 }}>
            {passage.title && <h2 className="font-bold text-gray-800 text-sm mb-1">{passage.title}</h2>}
            {passage.subtitle && <p className="text-xs text-gray-500 italic mb-3">{passage.subtitle}</p>}
            {passage.body ? (
              <div className="text-sm text-gray-700 leading-7 whitespace-pre-wrap">{passage.body}</div>
            ) : (
              <p className="text-sm text-gray-400 italic">Chưa có nội dung bài đọc</p>
            )}
          </div>

          {/* Divider */}
          <div
            onMouseDown={onDividerMouseDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, background: dragging ? '#3b82f6' : '#e5e7eb', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#93c5fd' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e5e7eb' }}
          />

          {/* Right: Questions */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-5" style={{ maxHeight: 600 }}>
            {sortedGroups.length > 0 ? (
              <div className="space-y-3">
                {sortedGroups.map((group, gi) => (
                  <AdminGroupPreview key={gi} group={group} showAnswers={showAnswers} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Chưa có câu hỏi cho passage này</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SpeakingRecordMockup() {
  return (
    <div className="flex flex-col items-center gap-4 bg-white rounded-2xl border border-[#bfdbfe] p-5 h-full min-h-[260px] justify-center">
      {/* Waveform placeholder */}
      <div className="flex items-end gap-0.5 h-10 mb-1">
        {[3,6,4,8,5,9,4,7,3,6,5,8,4,6,3].map((h, i) => (
          <div key={i} style={{ height: `${h * 4}px`, width: 3, borderRadius: 2, background: '#bfdbfe' }} />
        ))}
      </div>
      {/* Record button */}
      <button type="button" disabled
        className="w-14 h-14 rounded-full bg-[#1a56db] flex items-center justify-center shadow-lg opacity-60 cursor-default">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
          <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <p className="text-xs text-gray-400 font-medium">Sẵn sàng ghi âm</p>
      {/* Play back */}
      <div className="flex items-center gap-2 w-full mt-1">
        <button type="button" disabled
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center opacity-40 cursor-default">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#1a56db"><polygon points="4,2 14,8 4,14"/></svg>
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-gray-100" />
        <span className="text-xs text-gray-300 font-mono">0:00</span>
      </div>
      <p className="text-[10px] text-gray-300 italic text-center mt-1">Giao diện ghi âm — chỉ xem trước, không hoạt động trong preview</p>
    </div>
  )
}

function SpeakingFormPreview({ form }) {
  const [activePart, setActivePart] = useState(1)
  const PART_META = {
    1: { title: 'Part 1 — Introduction & Interview' },
    2: { title: 'Part 2 — Individual Long Turn' },
    3: { title: 'Part 3 — Two-way Discussion' },
  }

  const renderContent = () => {
    if (activePart === 1) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part1.description && <p className="text-sm text-gray-600 italic mb-3 border-l-2 border-[#bfdbfe] pl-3">{form.part1.description}</p>}
          <div className="space-y-2">
            {form.part1.questions.filter(q => q.trim()).map((q, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs flex items-center justify-center">{i + 1}</span>
                <p className="text-sm text-gray-700">{q}</p>
              </div>
            ))}
            {form.part1.questions.filter(q => q.trim()).length === 0 && <p className="text-sm text-gray-400 italic">Chưa có câu hỏi</p>}
          </div>
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )

    if (activePart === 2) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part2.instructions && <p className="text-sm text-gray-500 italic mb-3">{form.part2.instructions}</p>}
          {form.part2.cueCard ? (
            <div className="bg-[#eff6ff] border-l-4 border-[#1a56db] rounded-r-xl p-4">
              <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-2">Cue Card</p>
              <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap font-medium">{form.part2.cueCard}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có Cue Card</p>
          )}
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )

    if (activePart === 3) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part3.description && <p className="text-sm text-gray-500 italic mb-3 border-l-2 border-[#bfdbfe] pl-3">{form.part3.description}</p>}
          <div className="space-y-3">
            {form.part3.topics.map((topic, ti) => (
              <div key={ti} className="bg-white rounded-xl border border-[#e2e8f0] p-3">
                {topic.label && <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-2 pb-1.5 border-b border-[#e2e8f0]">{topic.label}</p>}
                <div className="space-y-1.5">
                  {topic.questions.filter(q => q.trim()).map((q, qi) => (
                    <div key={qi} className="flex gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs flex items-center justify-center mt-0.5">{qi + 1}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )
  }

  return (
    <div>
      {/* Part tabs */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3].map(p => (
          <button key={p} type="button" onClick={() => setActivePart(p)}
            style={{
              background: activePart === p ? '#1a56db' : '#fff',
              color: activePart === p ? '#fff' : '#1e293b',
              borderColor: activePart === p ? '#1a56db' : '#e2e8f0',
            }}
            className="px-4 py-1.5 rounded-lg border text-sm font-medium transition">
            Part {p}
          </button>
        ))}
      </div>
      {/* Active part content */}
      <div className="border border-[#bfdbfe] rounded-2xl overflow-hidden">
        <div className="bg-[#1a56db] text-white px-4 py-2.5 font-semibold text-sm">{PART_META[activePart].title}</div>
        <div className="p-4 bg-[#eff6ff]/40">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

function ReadingTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptyReadingForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openPassage, setOpenPassage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [addingGroupPassage, setAddingGroupPassage] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_reading_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_reading_${editingId || 'new'}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
      setTimeout(() => setToast(''), 3000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    setLoadingEdit(true)
    try {
      const res = await api.get(`/admin/exams/${id}`)
      const exam = res.data
      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        passages: exam.passages.map(p => ({
          number: p.number,
          title: p.title,
          subtitle: p.subtitle || '',
          letteredParagraphs: p.letteredParagraphs || false,
          body: p.body,
          questionGroups: (p.questionGroups || []).map(g => ({
            _id: g.id,
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || '',
            canReuse: g.canReuse || false,
            maxChoices: g.maxChoices || 2,
            noteSections: (g.noteSections || []).map(ns => ({
              title: ns.title || '',
              lines: (ns.lines || []).map(l => ({ content: l.contentWithTokens || '' }))
            })),
            matchingOptions: (g.matchingOptions || []).map(mo => ({ letter: mo.optionLetter, text: mo.optionText })),
            questions: (g.questions || []).map(q => ({
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['', '', '', ''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        }))
      })
      setForm(f => ({ ...f, passages: recalcAllGroupNumbers(f.passages) }))
      setEditingId(id)
      setOpenPassage(0)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { alert('Lỗi tải đề để sửa') }
    finally { setLoadingEdit(false) }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyReadingForm()); setOpenPassage(0); setEditHighlight(false) }

  const updatePassage = (pi, field, val) => {
    const p = [...form.passages]
    p[pi] = { ...p[pi], [field]: val }
    setForm({ ...form, passages: p })
  }

  const addGroup = (pi, type) => {
    const p = [...form.passages]
    const newGroup = emptyReadingGroupOf(type, 1) // start placeholder; recalc fixes it
    p[pi] = { ...p[pi], questionGroups: [...p[pi].questionGroups, newGroup] }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
    setAddingGroupPassage(null)
  }

  const updateGroup = (pi, gi, newGroup) => {
    const p = [...form.passages]
    const groups = [...p[pi].questionGroups]
    const prevSlots = getGroupSlots(groups[gi])
    const nextSlots = getGroupSlots(newGroup)
    groups[gi] = newGroup
    p[pi] = { ...p[pi], questionGroups: groups }
    // Only recalc downstream numbers when question count changes
    const recalced = prevSlots !== nextSlots ? recalcAllGroupNumbers(p) : p
    setForm({ ...form, passages: recalced })
  }

  const removeGroup = (pi, gi) => {
    const p = [...form.passages]
    p[pi] = { ...p[pi], questionGroups: p[pi].questionGroups.filter((_, i) => i !== gi) }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
  }

  const moveGroup = (pi, gi, dir) => {
    const p = [...form.passages]
    const groups = [...p[pi].questionGroups]
    const ni = gi + dir
    if (ni < 0 || ni >= groups.length) return
    ;[groups[gi], groups[ni]] = [groups[ni], groups[gi]]
    p[pi] = { ...p[pi], questionGroups: groups }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        passages: form.passages.map(p => ({
          number: p.number,
          title: p.title,
          subtitle: p.subtitle || null,
          letteredParagraphs: p.letteredParagraphs || false,
          body: p.body,
          questionGroups: p.questionGroups.map((g, gi) => ({
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || null,
            canReuse: g.canReuse || false,
            maxChoices: g.maxChoices || 2,
            noteSections: g.noteSections,
            matchingOptions: g.matchingOptions,
            questions: g.questions
          }))
        }))
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_reading_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/reading', payload)
        localStorage.removeItem('draft_reading_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyReadingForm())
        setOpenPassage(0)
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi lưu đề Reading')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa đề này?')) return
    try {
      await api.delete(`/admin/exams/${id}`)
      onRefresh()
    } catch { alert('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all duration-500 ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-gray-100'}`}>
        <h3 className="font-bold text-gray-800 mb-5">
          {editingId ? `Sửa đề Reading #${editingId}` : 'Tạo đề Reading mới'}
        </h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        {draftBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-yellow-700">📋 Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">Đang sửa đề #{editingId}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-blue-200 bg-white text-blue-500 hover:border-blue-400 hover:text-blue-700 transition">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>Tên đề</label>
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Reading"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-xs font-bold text-blue-700 mb-2">📚 Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <select className={inputCls} value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value, bookNumber: '' })}>
                <option value="">-- Không gắn --</option>
                {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <select className={inputCls} value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })} disabled={!form.seriesId}>
                <option value="">-- Chọn cuốn --</option>
                {examSeries.find(s => s.id === parseInt(form.seriesId))
                  ? Array.from({ length: examSeries.find(s => s.id === parseInt(form.seriesId))?._count?.bookCovers || 0 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)
                  : null
                }
              </select>
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <select className={inputCls} value={form.testNumber} onChange={e => setForm({ ...form, testNumber: e.target.value })} disabled={!form.bookNumber}>
                <option value="">-- Chọn test --</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Test {n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Passages accordion — always 3 */}
        <div className="space-y-3 mb-5">
          {form.passages.map((passage, pi) => {
            const totalQs = passage.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)
            return (
              <div key={pi} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPassage(openPassage === pi ? -1 : pi)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-blue-50 hover:bg-blue-100 transition"
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="font-bold text-sm text-blue-800">Passage {passage.number}</span>
                    <span className="text-xs text-blue-500 mt-0.5">{passage.title || '(chưa đặt tiêu đề)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400">{passage.questionGroups.length} nhóm · {totalQs} câu</span>
                    <span className="text-blue-400 text-xs">{openPassage === pi ? '▲' : '▼'}</span>
                  </div>
                </button>

                {openPassage === pi && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Tiêu đề chính</label>
                        <input className={inputCls} placeholder="VD: The Evolution of AI"
                          value={passage.title} onChange={e => updatePassage(pi, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Tiêu đề phụ (tùy chọn)</label>
                        <input className={inputCls} placeholder="VD: A study on machine cognition"
                          value={passage.subtitle} onChange={e => updatePassage(pi, 'subtitle', e.target.value)} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={passage.letteredParagraphs}
                          onChange={e => updatePassage(pi, 'letteredParagraphs', e.target.checked)}
                          className="accent-[#1a56db]" />
                        <span className="text-xs text-gray-600 font-medium">Đoạn văn có ký hiệu chữ cái (A, B, C...) — dùng cho Matching Paragraph</span>
                      </label>
                    </div>

                    <div>
                      <label className={labelCls}>Nội dung bài đọc</label>
                      <textarea className={`${inputCls} resize-none`} rows={10}
                        placeholder="Dán toàn bộ nội dung bài đọc vào đây. Dùng dòng trống để phân cách đoạn văn..."
                        value={passage.body} onChange={e => updatePassage(pi, 'body', e.target.value)} />
                    </div>

                    {/* Question Groups */}
                    <div>
                      <label className={labelCls}>Nhóm câu hỏi ({passage.questionGroups.length})</label>
                      <div className="space-y-3 mb-3">
                        {passage.questionGroups.map((group, gi) => (
                          <ReadingGroupEditor
                            key={group._id || gi}
                            group={group}
                            onChange={newGroup => updateGroup(pi, gi, newGroup)}
                            onRemove={() => removeGroup(pi, gi)}
                            onMoveUp={() => moveGroup(pi, gi, -1)}
                            onMoveDown={() => moveGroup(pi, gi, 1)}
                            isFirst={gi === 0}
                            isLast={gi === passage.questionGroups.length - 1}
                          />
                        ))}
                      </div>

                      {addingGroupPassage === pi ? (
                        <div className="border border-dashed border-[#1a56db] rounded-xl p-4">
                          <p className="text-xs font-bold text-gray-600 mb-3">Chọn loại nhóm câu hỏi:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {READING_GROUP_TYPES.map(t => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => addGroup(pi, t.value)}
                                className="text-left px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#1a56db] hover:text-[#1a56db] hover:bg-blue-50 transition font-medium"
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => setAddingGroupPassage(null)}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingGroupPassage(pi)}
                          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#1a56db] hover:text-[#1a56db] transition font-medium">
                          + Thêm nhóm câu hỏi
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Reading' : 'Tạo đề Reading'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          {showPreview ? '▲ Thu gọn preview' : '👁 Xem trước nội dung đề'}
        </button>
      </form>

      {showPreview && (
        <InlinePreviewPanel
          title={form.title || 'Reading'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <ReadingFormPreview form={form} showAnswers={showAnswers} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Reading ({exams.filter(e => e.skill === 'reading').length})</h3>
        <ExamList exams={exams} skill="reading" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} />
      </div>
    </div>
  )
}

// ─── TAB: LISTENING ───────────────────────────────────────────────────────────

function NoteCompletionEditor({ group, onChange }) {
  const lineRefs = useRef({})

  const allTokenNums = group.noteSections.flatMap(ns =>
    ns.lines.flatMap(l => {
      const matches = [...(l.content || '').matchAll(/\[Q:(\d+)\]/g)]
      return matches.map(m => parseInt(m[1]))
    })
  )
  const nextQNum = allTokenNums.length > 0 ? Math.max(...allTokenNums) + 1 : group.qNumberStart

  // Unique token numbers in order of first appearance in the note
  const tokenOrder = []
  const _seenTokens = new Set()
  allTokenNums.forEach(n => { if (!_seenTokens.has(n)) { _seenTokens.add(n); tokenOrder.push(n) } })
  // Map token number → display number (qNumberStart + position), updates live when qNumberStart changes
  const tokenDisplayMap = {}
  tokenOrder.forEach((n, idx) => { tokenDisplayMap[n] = group.qNumberStart + idx })

  const insertBlank = (nsi, li) => {
    const key = `${nsi}-${li}`
    const el = lineRefs.current[key]
    const pos = el ? el.selectionStart : (group.noteSections[nsi].lines[li].content || '').length
    const token = `[Q:${nextQNum}]`
    const oldContent = group.noteSections[nsi].lines[li].content || ''
    const newContent = oldContent.slice(0, pos) + token + oldContent.slice(pos)

    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: newContent })
    })

    const existingNums = new Set(group.questions.map(q => q.number))
    const newQuestions = existingNums.has(nextQNum) ? group.questions
      : [...group.questions, { number: nextQNum, correctAnswer: '' }].sort((a, b) => a.number - b.number)

    onChange({
      ...group,
      noteSections: sections,
      questions: newQuestions,
      qNumberEnd: Math.max(group.qNumberStart, nextQNum)
    })
  }

  const updateLine = (nsi, li, val) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, content: val })
    })
    onChange({ ...group, noteSections: sections })
  }

  const updateLineType = (nsi, li, type) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.map((l, j) => j !== li ? l : { ...l, lineType: type })
    })
    onChange({ ...group, noteSections: sections })
  }

  const addLine = (nsi) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: [...ns.lines, { content: '', lineType: 'content' }]
    })
    onChange({ ...group, noteSections: sections })
  }

  const removeLine = (nsi, li) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : {
      ...ns, lines: ns.lines.filter((_, j) => j !== li)
    })
    onChange({ ...group, noteSections: sections })
  }

  const addSection = () => {
    onChange({ ...group, noteSections: [...group.noteSections, { title: '', lines: [{ content: '', lineType: 'content' }] }] })
  }

  const removeSection = (nsi) => {
    onChange({ ...group, noteSections: group.noteSections.filter((_, i) => i !== nsi) })
  }

  const updateSectionTitle = (nsi, val) => {
    const sections = group.noteSections.map((ns, i) => i !== nsi ? ns : { ...ns, title: val })
    onChange({ ...group, noteSections: sections })
  }

  const updateAnswer = (qNum, val) => {
    onChange({ ...group, questions: group.questions.map(q => q.number === qNum ? { ...q, correctAnswer: val } : q) })
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-amber-700">Nội dung Note/Form</p>
          <button type="button" onClick={addSection}
            className="text-xs text-amber-600 font-semibold hover:underline">+ Thêm phần</button>
        </div>
        <div className="space-y-4">
          {group.noteSections.map((ns, nsi) => (
            <div key={nsi} className="bg-white rounded-lg border border-amber-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold placeholder-gray-300 focus:outline-none focus:border-amber-400"
                  placeholder="Tiêu đề phần (VD: The park, Event details...)"
                  value={ns.title} onChange={e => updateSectionTitle(nsi, e.target.value)} />
                {group.noteSections.length > 1 && (
                  <button type="button" onClick={() => removeSection(nsi)}
                    className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                )}
              </div>
              <div className="space-y-2">
                {ns.lines.map((line, li) => {
                  const isHeading = line.lineType === 'heading'
                  return (
                    <div key={li} className={`flex items-start gap-2 rounded-lg p-1 ${isHeading ? 'bg-gray-50' : ''}`}>
                      <button
                        type="button"
                        title={isHeading ? 'Heading — click để đổi sang Nội dung' : 'Nội dung — click để đổi sang Heading'}
                        onClick={() => updateLineType(nsi, li, isHeading ? 'content' : 'heading')}
                        className={`shrink-0 text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded border transition ${
                          isHeading
                            ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                            : 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200'
                        }`}
                      >
                        {isHeading ? 'H' : '•'}
                      </button>
                      <textarea
                        ref={el => lineRefs.current[`${nsi}-${li}`] = el}
                        rows={1}
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm resize-none focus:outline-none font-mono ${
                          isHeading
                            ? 'font-bold border-gray-300 focus:border-gray-400 bg-gray-50 text-gray-700'
                            : 'border-gray-200 focus:border-amber-400'
                        }`}
                        placeholder={isHeading ? 'VD: THE PARK / BENEFITS OF...' : `VD: Area: [Q:${group.qNumberStart}] hectares`}
                        value={line.content}
                        onChange={e => updateLine(nsi, li, e.target.value)}
                        style={{ minHeight: '34px' }}
                      />
                      {!isHeading && (
                        <button type="button" onClick={() => insertBlank(nsi, li)}
                          className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-amber-200 whitespace-nowrap">
                          + Ô trống
                        </button>
                      )}
                      {ns.lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(nsi, li)}
                          className="shrink-0 text-red-400 hover:text-red-600 text-xs py-1.5">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addLine(nsi)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium">+ Thêm dòng</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tokenOrder.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#1a56db]">Đáp án (từ ô trống trong note)</p>
            <p className="text-[10px] text-gray-400">Dùng <span className="font-mono bg-gray-100 px-1 rounded">/</span> để tách nhiều đáp án chấp nhận được. VD: <span className="font-mono">intestine/gut</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tokenOrder.map(tokenNum => {
              const displayNum = tokenDisplayMap[tokenNum]
              const q = group.questions.find(q => q.number === tokenNum)
              return (
                <div key={tokenNum} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1a56db] w-14 shrink-0">Q{displayNum}:</span>
                  <input
                    className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                    placeholder="VD: word hoặc word1/word2"
                    value={q?.correctAnswer || ''}
                    onChange={e => updateAnswer(tokenNum, e.target.value)} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MCQGroupEditor({ group, onChange }) {
  const isMulti = group.type === 'mcq_multi'
  const maxChoices = group.maxChoices || 2

  const defaultOpts = isMulti ? ['', '', '', '', ''] : ['', '', '', '']

  const addQuestion = () => {
    if (isMulti) {
      const nextNum = group.qNumberStart + group.questions.length * maxChoices
      const newQs = [...group.questions, { number: nextNum, questionText: '', options: [...defaultOpts], correctAnswer: '' }]
      const newEnd = group.qNumberStart + newQs.length * maxChoices - 1
      onChange({ ...group, qNumberEnd: newEnd, questions: newQs })
    } else {
      const nextNum = group.questions.length > 0 ? group.qNumberEnd + 1 : group.qNumberStart
      onChange({
        ...group,
        qNumberEnd: nextNum,
        questions: [...group.questions, { number: nextNum, questionText: '', options: [...defaultOpts], correctAnswer: '' }]
      })
    }
  }

  const removeQuestion = (qi) => {
    const newQs = group.questions.filter((_, i) => i !== qi)
    if (isMulti) {
      const newEnd = newQs.length > 0 ? group.qNumberStart + newQs.length * maxChoices - 1 : group.qNumberStart
      onChange({ ...group, questions: newQs, qNumberEnd: Math.max(group.qNumberStart, newEnd) })
    } else {
      onChange({ ...group, questions: newQs, qNumberEnd: newQs.length > 0 ? newQs[newQs.length - 1].number : group.qNumberStart })
    }
  }

  const updateQ = (qi, field, val) => {
    onChange({ ...group, questions: group.questions.map((q, i) => i !== qi ? q : { ...q, [field]: val }) })
  }

  const updateOption = (qi, oi, val) => {
    const newOpts = [...(group.questions[qi].options || defaultOpts)]
    newOpts[oi] = val
    // If the edited option was part of correctAnswer, clear it (text changed)
    updateQ(qi, 'options', newOpts)
  }

  const addOption = (qi) => {
    const opts = [...(group.questions[qi].options || defaultOpts), '']
    updateQ(qi, 'options', opts)
  }

  const removeOption = (qi, oi) => {
    const opts = (group.questions[qi].options || defaultOpts).filter((_, i) => i !== oi)
    // Also remove from correctAnswer if the removed option was selected
    const removedText = (group.questions[qi].options || defaultOpts)[oi]
    const correct = (group.questions[qi].correctAnswer || '').split(',').filter(c => c && c !== removedText)
    const q = { ...group.questions[qi], options: opts, correctAnswer: correct.join(',') }
    onChange({ ...group, questions: group.questions.map((orig, i) => i !== qi ? orig : q) })
  }

  const toggleCorrect = (qi, optText) => {
    if (!optText.trim()) return
    const current = (group.questions[qi].correctAnswer || '').split(',').filter(Boolean)
    const next = current.includes(optText)
      ? current.filter(c => c !== optText)
      : [...current, optText]
    updateQ(qi, 'correctAnswer', next.join(','))
  }

  return (
    <div className="space-y-3">
      {isMulti && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-indigo-700 shrink-0">Số đáp án cần chọn:</span>
          <input
            type="number" min={1} max={10}
            className="w-16 border border-indigo-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-indigo-400"
            value={maxChoices}
            onChange={e => {
              const newMax = parseInt(e.target.value) || 2
              const newEnd = group.qNumberStart + (group.questions.length * newMax) - 1
              onChange({ ...group, maxChoices: newMax, qNumberEnd: Math.max(group.qNumberStart, newEnd) })
            }}
          />
          <span className="text-xs text-indigo-500">(mặc định 2 — "Choose TWO")</span>
        </div>
      )}

      {group.questions.map((q, qi) => {
        const opts = q.options || defaultOpts
        const correctList = (q.correctAnswer || '').split(',').filter(Boolean)
        const correctCount = correctList.length
        const warn = isMulti && correctCount !== maxChoices

        return (
          <div key={qi} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700">
                {isMulti
                  ? `Câu ${group.qNumberStart + qi * maxChoices}–${group.qNumberStart + qi * maxChoices + maxChoices - 1}`
                  : `Câu ${q.number}`}
              </span>
              <button type="button" onClick={() => removeQuestion(qi)}
                className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
            </div>
            <textarea rows={2}
              className="w-full border border-blue-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:border-blue-400"
              placeholder="Nội dung câu hỏi..."
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />

            {isMulti ? (
              /* Multi: dynamic options with checkboxes for correct answer */
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-medium">Tick ô bên phải để đánh dấu đáp án đúng</p>
                {opts.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = correctList.includes(opt)
                  return (
                    <div key={oi} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isCorrect ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'border border-transparent'}`}>
                      <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{letter}.</span>
                      <input
                        className={`flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none ${isCorrect ? 'border-[#e2e8f0] focus:border-[#3b82f6] bg-[#eff6ff]' : 'border-blue-200 focus:border-blue-400'}`}
                        placeholder={`Lựa chọn ${letter}...`}
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                      />
                      <input
                        type="checkbox"
                        checked={isCorrect}
                        disabled={!opt.trim()}
                        onChange={() => toggleCorrect(qi, opt)}
                        title="Đánh dấu đáp án đúng"
                        className="w-4 h-4 accent-[#1a56db] shrink-0 cursor-pointer"
                      />
                      {opts.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)}
                          className="text-red-300 hover:text-red-500 text-xs shrink-0">✕</button>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addOption(qi)}
                  className="text-xs text-blue-400 hover:text-blue-600 font-medium mt-1">+ Thêm lựa chọn</button>
                {warn && (
                  <p className={`text-xs font-semibold mt-1 ${correctCount < maxChoices ? 'text-amber-600' : 'text-red-500'}`}>
                    ⚠ Đang chọn {correctCount}/{maxChoices} đáp án đúng
                    {correctCount < maxChoices ? ` — cần chọn thêm ${maxChoices - correctCount}` : ` — chọn thừa ${correctCount - maxChoices}`}
                  </p>
                )}
              </div>
            ) : (
              /* Single MCQ: fixed options + text correct answer */
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {opts.map((opt, oi) => (
                    <input key={oi}
                      className="border border-blue-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                      placeholder={`${String.fromCharCode(65+oi)}. ...`}
                      value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                  ))}
                </div>
                <input
                  className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                  placeholder="Đáp án đúng (VD: A. text)"
                  value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)} />
              </>
            )}
          </div>
        )
      })}
      <button type="button" onClick={addQuestion}
        className="w-full border-2 border-dashed border-blue-200 rounded-xl py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
        + Thêm câu hỏi {isMulti ? 'MCQ Multi' : 'MCQ'}
      </button>
    </div>
  )
}

function MatchingEditor({ group, onChange }) {
  const isMap = group.type === 'map_diagram'

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
  const [imgUploading, setImgUploading] = useState(false)
  const imgRef = useRef(null)

  const uploadImage = async (file) => {
    setImgUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await api.post('/admin/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      onChange({ ...group, imageUrl: res.data.imageUrl })
    } catch { alert('Lỗi upload ảnh') }
    finally { setImgUploading(false) }
  }

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
              ref={imgRef}
              onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
          </div>
          {group.imageUrl && (
            <img
              src={group.imageUrl.startsWith('/') ? `http://localhost:3001${group.imageUrl}` : group.imageUrl}
              alt="map/diagram" className="mt-2 max-h-56 rounded-xl border object-contain w-full bg-gray-50" />
          )}
        </div>
      )}

      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-[#1a56db]">Danh sách lựa chọn (A, B, C...)</p>
          <button type="button" onClick={addOption}
            className="text-xs text-[#1a56db] font-semibold hover:underline">+ Thêm</button>
        </div>
        <div className="space-y-2">
          {group.matchingOptions.map((mo, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input className="w-10 border border-[#bfdbfe] rounded px-1 py-1 text-xs text-center font-bold focus:outline-none"
                value={mo.letter} onChange={e => updateOption(oi, 'letter', e.target.value)} />
              <input className="flex-1 border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
                placeholder="Nội dung lựa chọn..."
                value={mo.text} onChange={e => updateOption(oi, 'text', e.target.value)} />
              <button type="button" onClick={() => removeOption(oi)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {group.questions.map((q, qi) => (
          <div key={qi} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
            <span className="text-xs font-bold text-gray-500 w-10 shrink-0">Q{q.number}:</span>
            <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-gray-400"
              placeholder={isMap ? 'Tên mục (VD: Farm shop, Disabled entry...)' : 'Đối tượng cần matching (VD: Cafe, Shop...)'}
              value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
            <select className="border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6] bg-white max-w-[260px]"
              value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)}>
              <option value="">-- Đáp án --</option>
              {options.filter(mo => {
                const letter = mo.letter || mo.optionLetter
                return letter === q.correctAnswer || !usedAnswers.has(letter)
              }).map(mo => {
                const letter = mo.letter || mo.optionLetter
                const text = mo.text || mo.optionText || ''
                return <option key={letter} value={letter}>{text ? `${letter} - ${text}` : letter}</option>
              })}
            </select>
            <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 text-xs">✕</button>
          </div>
        ))}
        <button type="button" onClick={addQuestion}
          className="w-full border-2 border-dashed border-blue-200 rounded-xl py-2 text-sm text-blue-400 hover:border-blue-400 hover:text-blue-600 transition font-medium">
          + Thêm câu hỏi
        </button>
      </div>
    </div>
  )
}

function ShortAnswerEditor({ group, onChange }) {
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

  return (
    <div className="space-y-2">
      {group.questions.map((q, qi) => (
        <div key={qi} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Câu {q.number}</span>
            <button type="button" onClick={() => removeQuestion(qi)} className="text-red-400 text-xs">✕ Xóa</button>
          </div>
          <textarea rows={2}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm resize-none focus:outline-none focus:border-gray-400"
            placeholder="Nội dung câu hỏi..."
            value={q.questionText} onChange={e => updateQ(qi, 'questionText', e.target.value)} />
          <input
            className="w-full border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#3b82f6]"
            placeholder="Đáp án đúng..."
            value={q.correctAnswer} onChange={e => updateQ(qi, 'correctAnswer', e.target.value)} />
        </div>
      ))}
      <button type="button" onClick={addQuestion}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition font-medium">
        + Thêm câu hỏi Short Answer
      </button>
    </div>
  )
}

// ─── GROUP EDITOR ─────────────────────────────────────────────────────────────

const SERVER_BASE = 'http://localhost:3001'
const toImgSrc = (url) => (url || '').startsWith('/') ? `${SERVER_BASE}${url}` : (url || '')

function GroupEditor({ group, onChange, onRemove }) {
  const typeLabel = GROUP_TYPES.find(t => t.value === group.type)?.label || group.type

  const typeColors = {
    note_completion: 'bg-amber-100 text-amber-800 border-amber-300',
    mcq: 'bg-blue-100 text-blue-800 border-blue-300',
    mcq_multi: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    matching: 'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
    map_diagram: 'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
    short_answer: 'bg-gray-100 text-gray-800 border-gray-300',
    drag_word_bank: 'bg-sky-100 text-sky-800 border-sky-300',
    matching_drag: 'bg-violet-100 text-violet-800 border-violet-300',
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeColors[group.type] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-gray-500 font-medium">
          Câu {group.qNumberStart}–{group.qNumberEnd}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Từ câu</label>
            <input type="number" min={1}
              className="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
              value={group.qNumberStart}
              onChange={e => {
                const newStart = parseInt(e.target.value) || 1
                const newGroup = { ...group, qNumberStart: newStart }
                if (group.type === 'mcq_multi') {
                  newGroup.qNumberEnd = Math.max(newStart, newStart + group.questions.length * (group.maxChoices || 2) - 1)
                }
                onChange(newGroup)
              }} />
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-red-50">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2}
            className={`${inputCls} resize-none`}
            placeholder="VD: Choose the correct letter, A, B or C."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'matching' || group.type === 'map_diagram') && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
        {group.type === 'short_answer' && (
          <ShortAnswerEditor group={group} onChange={onChange} />
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
      </div>
    </div>
  )
}

function ListeningTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptyListeningForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openSection, setOpenSection] = useState(0)
  const [uploading, setUploading] = useState({})
  const [transcribing, setTranscribing] = useState({})
  const [addingGroupSection, setAddingGroupSection] = useState(null)
  const fileRefs = useRef({})
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_listening_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_listening_${editingId || 'new'}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
      setTimeout(() => setToast(''), 3000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    setLoadingEdit(true)
    try {
      const res = await api.get(`/admin/exams/${id}`)
      const exam = res.data
      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        sections: exam.listeningSections.map(s => ({
          number: s.number,
          context: s.context || '',
          audioUrl: s.audioUrl || '',
          transcript: s.transcript || '',
          questionGroups: (s.questionGroups || []).map(g => ({
            _id: g.id,
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || '',
            noteSections: (g.noteSections || []).map(ns => ({
              title: ns.title || '',
              lines: (ns.lines || []).map(l => ({ content: l.contentWithTokens || '' }))
            })),
            matchingOptions: (g.matchingOptions || []).map(mo => ({ letter: mo.optionLetter, text: mo.optionText })),
            questions: (g.questions || []).map(q => ({
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['','','',''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        }))
      })
      setEditingId(id)
      setOpenSection(0)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { alert('Lỗi tải đề để sửa') }
    finally { setLoadingEdit(false) }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyListeningForm()); setOpenSection(0); setEditHighlight(false) }

  const updateSection = (si, field, val) => {
    const s = [...form.sections]
    s[si] = { ...s[si], [field]: val }
    setForm({ ...form, sections: s })
  }

  const uploadAudio = async (si, file) => {
    setUploading(u => ({ ...u, [si]: true }))
    try {
      const formData = new FormData()
      formData.append('audio', file)
      const res = await api.post('/admin/upload-audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      updateSection(si, 'audioUrl', res.data.audioUrl)
    } catch { alert('Lỗi upload audio') }
    finally { setUploading(u => ({ ...u, [si]: false })) }
  }

  const transcribeAudio = async (si) => {
    const audioUrl = form.sections[si].audioUrl
    if (!audioUrl) return
    setTranscribing(t => ({ ...t, [si]: true }))
    try {
      const res = await api.post('/admin/transcribe', { audioUrl })
      updateSection(si, 'transcript', res.data.transcript || '')
    } catch { alert('Lỗi phiên âm audio') }
    finally { setTranscribing(t => ({ ...t, [si]: false })) }
  }

  const addGroup = (si, type) => {
    const s = [...form.sections]
    const lastGroup = s[si].questionGroups[s[si].questionGroups.length - 1]
    const startNum = lastGroup ? lastGroup.qNumberEnd + 1 : 1
    const newGroup = emptyGroupOf(type, startNum)
    newGroup.qNumberEnd = startNum
    s[si] = { ...s[si], questionGroups: [...s[si].questionGroups, newGroup] }
    setForm({ ...form, sections: s })
    setAddingGroupSection(null)
  }

  const updateGroup = (si, gi, newGroup) => {
    const s = [...form.sections]
    const groups = [...s[si].questionGroups]
    groups[gi] = newGroup
    s[si] = { ...s[si], questionGroups: groups }
    setForm({ ...form, sections: s })
  }

  const removeGroup = (si, gi) => {
    const s = [...form.sections]
    s[si] = { ...s[si], questionGroups: s[si].questionGroups.filter((_, i) => i !== gi) }
    setForm({ ...form, sections: s })
  }

  const moveGroup = (si, gi, dir) => {
    const s = [...form.sections]
    const groups = [...s[si].questionGroups]
    const ni = gi + dir
    if (ni < 0 || ni >= groups.length) return
    ;[groups[gi], groups[ni]] = [groups[ni], groups[gi]]
    s[si] = { ...s[si], questionGroups: groups }
    setForm({ ...form, sections: s })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        sections: form.sections.map(s => ({
          number: s.number,
          context: s.context,
          audioUrl: s.audioUrl || null,
          transcript: s.transcript || null,
          questionGroups: s.questionGroups.map(g => ({
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || null,
            noteSections: g.noteSections,
            matchingOptions: g.matchingOptions,
            questions: g.questions
          }))
        }))
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_listening_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/listening', payload)
        localStorage.removeItem('draft_listening_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyListeningForm())
        setOpenSection(0)
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi lưu đề Listening')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa đề này?')) return
    try {
      await api.delete(`/admin/exams/${id}`)
      onRefresh()
    } catch { alert('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all duration-500 ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-gray-100'}`}>
        <h3 className="font-bold text-gray-800 mb-5">
          {editingId ? `✏️ Sửa đề Listening #${editingId}` : 'Tạo đề Listening mới'}
        </h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        {draftBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-yellow-700">📋 Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">✏️ Đang sửa đề #{editingId}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-blue-200 bg-white text-blue-500 hover:border-blue-400 hover:text-blue-700 transition">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>Tên đề</label>
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Listening"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-xs font-bold text-blue-700 mb-2">📚 Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <select className={inputCls} value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value, bookNumber: '' })}>
                <option value="">-- Không gắn --</option>
                {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <select className={inputCls} value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })} disabled={!form.seriesId}>
                <option value="">-- Chọn cuốn --</option>
                {examSeries.find(s => s.id === parseInt(form.seriesId))
                  ? Array.from({ length: examSeries.find(s => s.id === parseInt(form.seriesId))?._count?.bookCovers || 0 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)
                  : null
                }
              </select>
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <select className={inputCls} value={form.testNumber} onChange={e => setForm({ ...form, testNumber: e.target.value })} disabled={!form.bookNumber}>
                <option value="">-- Chọn test --</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Test {n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {form.sections.map((section, si) => (
            <div key={si} className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === si ? -1 : si)}
                className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="font-bold text-sm text-gray-800">Section {section.number}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{SECTION_HINTS[section.number] || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{section.questionGroups.length} nhóm · {section.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)} câu</span>
                  {section.audioUrl && <span className="text-xs bg-[#eff6ff] text-[#1a56db] font-semibold px-2 py-0.5 rounded-full">🎵 Audio</span>}
                  {section.transcript && <span className="text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">📝 Transcript</span>}
                  <span className="text-gray-400 text-xs">{openSection === si ? '▲' : '▼'}</span>
                </div>
              </button>

              {openSection === si && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelCls}>File MP3 — Section {section.number}</label>
                    <div className="flex gap-2">
                      <input className={inputCls} placeholder="URL audio sau khi upload"
                        value={section.audioUrl} onChange={e => updateSection(si, 'audioUrl', e.target.value)} />
                      <button type="button" onClick={() => fileRefs.current[si]?.click()} disabled={uploading[si]}
                        className={`${btnSecondary} whitespace-nowrap`}>
                        {uploading[si] ? 'Đang upload...' : '📁 Upload MP3'}
                      </button>
                      <input type="file" accept=".mp3,.wav,.ogg,.m4a,.aac" className="hidden"
                        ref={el => fileRefs.current[si] = el}
                        onChange={e => e.target.files[0] && uploadAudio(si, e.target.files[0])} />
                    </div>
                    {section.audioUrl && (
                      <audio
                        controls
                        src={section.audioUrl.startsWith('/') ? `http://localhost:3001${section.audioUrl}` : section.audioUrl}
                        className="w-full mt-2 rounded-lg"
                        style={{ height: '40px' }}
                      />
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Mô tả tình huống (Context)</label>
                    <textarea className={`${inputCls} h-16 resize-none`}
                      placeholder={section.number <= 2 ? 'VD: Two friends are discussing their weekend plans...' : 'VD: A professor is giving a lecture about climate change...'}
                      value={section.context} onChange={e => updateSection(si, 'context', e.target.value)} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>Transcript</label>
                      <button type="button" onClick={() => transcribeAudio(si)}
                        disabled={!section.audioUrl || transcribing[si]}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          backgroundColor: section.audioUrl && !transcribing[si] ? '#EFF6FF' : '#F3F4F6',
                          color: section.audioUrl && !transcribing[si] ? '#2563EB' : '#9CA3AF',
                          border: `1px solid ${section.audioUrl && !transcribing[si] ? '#BFDBFE' : '#E5E7EB'}`,
                          cursor: section.audioUrl && !transcribing[si] ? 'pointer' : 'not-allowed'
                        }}>
                        {transcribing[si] ? (
                          <>
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                            </svg>
                            Đang phiên âm...
                          </>
                        ) : <>🤖 AI Phiên âm</>}
                      </button>
                    </div>
                    <textarea className={`${inputCls} h-28 resize-none`}
                      placeholder={section.audioUrl ? 'Nhấn "🤖 AI Phiên âm" hoặc nhập thủ công...' : 'Upload audio để dùng AI phiên âm...'}
                      value={section.transcript} onChange={e => updateSection(si, 'transcript', e.target.value)} />
                  </div>

                  <div>
                    <label className={labelCls}>Nhóm câu hỏi ({section.questionGroups.length})</label>
                    <div className="space-y-3 mb-3">
                      {section.questionGroups.map((group, gi) => (
                        <div key={group._id || gi} className="flex gap-2 items-start">
                          <div className="flex flex-col gap-1 pt-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveGroup(si, gi, -1)}
                              disabled={gi === 0}
                              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition"
                              title="Di chuyển lên">▲</button>
                            <button
                              type="button"
                              onClick={() => moveGroup(si, gi, 1)}
                              disabled={gi === section.questionGroups.length - 1}
                              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition"
                              title="Di chuyển xuống">▼</button>
                          </div>
                          <div className="flex-1">
                            <GroupEditor
                              group={group}
                              onChange={newGroup => updateGroup(si, gi, newGroup)}
                              onRemove={() => removeGroup(si, gi)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {addingGroupSection === si ? (
                      <div className="border border-dashed border-[#1a56db] rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-600 mb-3">Chọn loại nhóm câu hỏi:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {GROUP_TYPES.map(t => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => addGroup(si, t.value)}
                              className="text-left px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#1a56db] hover:text-[#1a56db] hover:bg-blue-50 transition font-medium"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setAddingGroupSection(null)}
                          className="mt-2 text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingGroupSection(si)}
                        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#1a56db] hover:text-[#1a56db] transition font-medium">
                        + Thêm nhóm câu hỏi
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Listening' : '💾 Tạo đề Listening'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          {showPreview ? '▲ Thu gọn preview' : '👁 Xem trước nội dung đề'}
        </button>
      </form>

      {showPreview && (
        <InlinePreviewPanel
          title={form.title || 'Listening'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <ListeningFormPreview form={form} showAnswers={showAnswers} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Listening ({exams.filter(e => e.skill === 'listening').length})</h3>
        <ExamList exams={exams} skill="listening" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} />
      </div>
    </div>
  )
}

// ─── PREVIEW: WRITING ─────────────────────────────────────────────────────────

function WritingFormPreview({ form }) {
  const [activeTask, setActiveTask] = useState(1)
  const [lightbox, setLightbox] = useState(null)

  const tasks = [
    { num: 1, data: form.task1, minWords: 150, timeHint: '20 phút' },
    { num: 2, data: form.task2, minWords: 250, timeHint: '40 phút' },
  ]
  const task = tasks.find(t => t.num === activeTask)

  return (
    <div>
      {/* Task tabs */}
      <div className="flex gap-1.5 mb-4">
        {tasks.map(t => (
          <button key={t.num} type="button" onClick={() => setActiveTask(t.num)}
            style={{
              background: activeTask === t.num ? '#1a56db' : '#fff',
              color: activeTask === t.num ? '#fff' : '#1e293b',
              borderColor: activeTask === t.num ? '#1a56db' : '#e2e8f0',
            }}
            className="px-4 py-1.5 rounded-lg border text-sm font-medium transition">
            Task {t.num}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex gap-4" style={{ minHeight: 320 }}>
        {/* Left: task prompt */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[#bfdbfe] p-5 overflow-y-auto" style={{ maxHeight: 480 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold uppercase tracking-wide">
              TASK {task.num}
            </span>
          </div>
          {task.num === 1 && task.data.imageUrl && (
            <div onClick={() => setLightbox(toImgSrc(task.data.imageUrl))}
              className="relative cursor-pointer group mb-4 inline-block w-full">
              <img src={toImgSrc(task.data.imageUrl)} alt="Task 1 visual"
                className="w-full rounded-xl border border-gray-200 object-contain" />
              <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 11, opacity: 0, transition: 'opacity 0.15s' }}
                className="group-hover:opacity-100">
                Phóng to
              </div>
            </div>
          )}
          {task.data.prompt ? (
            <p className="text-sm text-gray-700 leading-7">{task.data.prompt}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có đề bài</p>
          )}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1">
            <p className="text-xs text-gray-400">Tối thiểu <span className="font-bold text-gray-600">{task.minWords} từ</span></p>
            <p className="text-xs text-gray-400">Khuyến nghị: <span className="font-medium text-gray-500">{task.timeHint}</span></p>
          </div>
        </div>

        {/* Right: essay area demo */}
        <div className="w-80 shrink-0 flex flex-col gap-2">
          <div className="bg-white rounded-xl border border-gray-200 flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Bài viết Task {task.num}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                0/{task.minWords} từ
              </span>
            </div>
            <textarea
              disabled
              placeholder={`Bắt đầu viết Task ${task.num} tại đây...`}
              style={{ backgroundColor: '#f8fafc', flex: 1, minHeight: 200, padding: '16px', fontSize: 13, lineHeight: 1.75, resize: 'none', border: 'none', outline: 'none', color: '#9ca3af', cursor: 'not-allowed' }}
            />
          </div>
          <p className="text-[10px] text-gray-300 italic text-center">Khu vực demo — không nhập được trong preview</p>
          <button type="button" disabled
            className="w-full py-2.5 rounded-xl bg-gray-200 text-gray-400 text-sm font-bold cursor-not-allowed opacity-60">
            Nộp Task {task.num} để AI chấm
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 16, right: 20, zIndex: 10000, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: 36, height: 36, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <img src={lightbox} alt="Task visual fullsize" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

// ─── TAB: WRITING ─────────────────────────────────────────────────────────────

function WritingTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptyWritingForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const formRef = useRef(null)
  const imgRef = useRef(null)

  const uploadTask1Image = async (file) => {
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh tối đa 5MB'); return }
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['png', 'jpg', 'jpeg'].includes(ext)) { alert('Chỉ chấp nhận PNG hoặc JPG'); return }
    setImgUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/admin/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, task1: { ...f.task1, imageUrl: res.data.imageUrl } }))
    } catch { alert('Lỗi upload ảnh') }
    finally { setImgUploading(false) }
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_writing_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_writing_${editingId || 'new'}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
      setTimeout(() => setToast(''), 3000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    try {
      const res = await api.get(`/admin/exams/${id}`)
      const exam = res.data
      const t1 = exam.writingTasks.find(t => t.number === 1)
      const t2 = exam.writingTasks.find(t => t.number === 2)
      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        task1: { prompt: t1?.prompt || '', imageUrl: t1?.imageUrl || '' },
        task2: { prompt: t2?.prompt || '' }
      })
      setEditingId(id)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { alert('Lỗi tải đề để sửa') }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyWritingForm()); setEditHighlight(false) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        task1: { prompt: form.task1.prompt, imageUrl: form.task1.imageUrl || null },
        task2: { prompt: form.task2.prompt }
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_writing_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/writing', payload)
        localStorage.removeItem('draft_writing_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyWritingForm())
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi tạo đề Writing')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa đề này?')) return
    try {
      await api.delete(`/admin/exams/${id}`)
      onRefresh()
    } catch { alert('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all duration-500 ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-gray-100'}`}>
        <h3 className="font-bold text-gray-800 mb-5">{editingId ? `✏️ Sửa đề Writing #${editingId}` : 'Tạo đề Writing mới'}</h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        {draftBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-yellow-700">📋 Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">✏️ Đang sửa đề #{editingId}</span>
            <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="col-span-2">
            <label className={labelCls}>Tên đề</label>
            <input className={inputCls} required placeholder="VD: IELTS Writing Practice Test 1"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-xs font-bold text-blue-700 mb-2">📚 Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <select className={inputCls} value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value, bookNumber: '' })}>
                <option value="">-- Không gắn --</option>
                {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <select className={inputCls} value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })} disabled={!form.seriesId}>
                <option value="">-- Chọn cuốn --</option>
                {examSeries.find(s => s.id === parseInt(form.seriesId))
                  ? Array.from({ length: examSeries.find(s => s.id === parseInt(form.seriesId))?._count?.bookCovers || 0 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)
                  : null
                }
              </select>
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <select className={inputCls} value={form.testNumber} onChange={e => setForm({ ...form, testNumber: e.target.value })} disabled={!form.bookNumber}>
                <option value="">-- Chọn test --</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Test {n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Task 1 */}
        <div className="border border-amber-200 rounded-2xl p-5 mb-5 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">1</div>
            <span className="font-semibold text-gray-700">Task 1 — Mô tả biểu đồ / bản đồ / quy trình (tối thiểu 150 từ)</span>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Hình ảnh (biểu đồ / bản đồ) — tùy chọn</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => imgRef.current?.click()} disabled={imgUploading}
                className={`${btnSecondary} whitespace-nowrap`}>
                {imgUploading ? 'Đang upload...' : '📷 Upload ảnh'}
              </button>
              {form.task1.imageUrl && (
                <button type="button" onClick={() => setForm(f => ({ ...f, task1: { ...f.task1, imageUrl: '' } }))}
                  className="text-red-400 hover:text-red-600 text-xs px-2">✕ Xóa ảnh</button>
              )}
              <input ref={imgRef} type="file" accept=".png,.jpg,.jpeg" className="hidden"
                onChange={e => { if (e.target.files[0]) uploadTask1Image(e.target.files[0]); e.target.value = '' }} />
            </div>
            {form.task1.imageUrl && (
              <img
                src={form.task1.imageUrl.startsWith('/') ? `http://localhost:3001${form.task1.imageUrl}` : form.task1.imageUrl}
                alt="task1 preview" className="mt-2 max-h-48 rounded-xl border object-contain w-full bg-gray-50" />
            )}
            <p className="text-xs text-gray-400 mt-1">PNG hoặc JPG, tối đa 5MB</p>
          </div>
          <div>
            <label className={labelCls}>Đề bài Task 1</label>
            <textarea className={`${inputCls} h-28 resize-none`}
              placeholder="VD: The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
              value={form.task1.prompt} required
              onChange={e => setForm({ ...form, task1: { ...form.task1, prompt: e.target.value } })} />
          </div>
        </div>

        {/* Task 2 */}
        <div className="border border-blue-200 rounded-2xl p-5 mb-6 bg-blue-50/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</div>
            <span className="font-semibold text-gray-700">Task 2 — Viết luận (tối thiểu 250 từ)</span>
          </div>
          <div>
            <label className={labelCls}>Đề bài Task 2 (Essay)</label>
            <textarea className={`${inputCls} h-32 resize-none`}
              placeholder="VD: Some people believe that governments should invest more money in public transport rather than building new roads. To what extent do you agree or disagree?"
              value={form.task2.prompt} required
              onChange={e => setForm({ ...form, task2: { prompt: e.target.value } })} />
          </div>
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Writing' : 'Tạo đề Writing'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          {showPreview ? '▲ Thu gọn preview' : '👁 Xem trước nội dung đề'}
        </button>
      </form>

      {showPreview && (
        <InlinePreviewPanel
          title={form.title || 'Writing'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <WritingFormPreview form={form} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Writing ({exams.filter(e => e.skill === 'writing').length})</h3>
        <ExamList exams={exams} skill="writing" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} />
      </div>
    </div>
  )
}

// ─── TAB: SPEAKING ────────────────────────────────────────────────────────────

function SpeakingTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptySpeakingForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_speaking_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_speaking_${editingId || 'new'}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
      setTimeout(() => setToast(''), 3000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    try {
      const res = await api.get(`/admin/exams/${id}`)
      const exam = res.data
      const p1 = exam.speakingParts.find(p => p.number === 1)
      const p2 = exam.speakingParts.find(p => p.number === 2)
      const p3 = exam.speakingParts.find(p => p.number === 3)

      // Reconstruct Part 3 topic groups from ##TOPIC## markers
      const part3Topics = []
      let currentTopic = null
      for (const q of (p3?.questions || [])) {
        if (q.questionText.startsWith('##TOPIC##:')) {
          if (currentTopic) part3Topics.push(currentTopic)
          currentTopic = { label: q.questionText.replace('##TOPIC##:', ''), questions: [] }
        } else {
          if (!currentTopic) currentTopic = { label: '', questions: [] }
          currentTopic.questions.push(q.questionText)
        }
      }
      if (currentTopic) part3Topics.push(currentTopic)
      if (!part3Topics.length) part3Topics.push({ label: '', questions: [''] })

      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        part1: { description: p1?.cueCard || '', questions: p1?.questions.map(q => q.questionText) || [''] },
        part2: (() => {
          const raw = p2?.cueCard || ''
          const sep = raw.indexOf('\n===\n')
          return sep === -1
            ? { instructions: '', cueCard: raw, questions: p2?.questions.map(q => q.questionText) || [''] }
            : { instructions: raw.slice(0, sep), cueCard: raw.slice(sep + 5), questions: p2?.questions.map(q => q.questionText) || [''] }
        })(),
        part3: { description: p3?.cueCard || '', topics: part3Topics }
      })
      setEditingId(id)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { alert('Lỗi tải đề để sửa') }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptySpeakingForm()); setEditHighlight(false) }

  // ── Part 1 helpers ─────────────────────────────────────────────
  const updateP1Question = (idx, val) => {
    const qs = [...form.part1.questions]; qs[idx] = val
    setForm({ ...form, part1: { ...form.part1, questions: qs } })
  }
  const addP1Question = () =>
    setForm(f => ({ ...f, part1: { ...f.part1, questions: [...f.part1.questions, ''] } }))
  const removeP1Question = (idx) => {
    const qs = form.part1.questions.filter((_, i) => i !== idx)
    setForm(f => ({ ...f, part1: { ...f.part1, questions: qs.length ? qs : [''] } }))
  }

  // ── Part 2 helpers ─────────────────────────────────────────────
  const updateP2Question = (idx, val) => {
    const qs = [...form.part2.questions]; qs[idx] = val
    setForm({ ...form, part2: { ...form.part2, questions: qs } })
  }
  const addP2Question = () =>
    setForm({ ...form, part2: { ...form.part2, questions: [...form.part2.questions, ''] } })
  const removeP2Question = (idx) => {
    const qs = form.part2.questions.filter((_, i) => i !== idx)
    setForm({ ...form, part2: { ...form.part2, questions: qs.length ? qs : [''] } })
  }

  // ── Part 3 topic helpers ────────────────────────────────────────
  const updateTopicLabel = (ti, val) => {
    const topics = [...form.part3.topics]
    topics[ti] = { ...topics[ti], label: val }
    setForm({ ...form, part3: { topics } })
  }
  const updateTopicQuestion = (ti, qi, val) => {
    const topics = [...form.part3.topics]
    const qs = [...topics[ti].questions]; qs[qi] = val
    topics[ti] = { ...topics[ti], questions: qs }
    setForm({ ...form, part3: { topics } })
  }
  const addTopicQuestion = (ti) => {
    const topics = [...form.part3.topics]
    topics[ti] = { ...topics[ti], questions: [...topics[ti].questions, ''] }
    setForm({ ...form, part3: { topics } })
  }
  const removeTopicQuestion = (ti, qi) => {
    const topics = [...form.part3.topics]
    const qs = topics[ti].questions.filter((_, i) => i !== qi)
    topics[ti] = { ...topics[ti], questions: qs.length ? qs : [''] }
    setForm({ ...form, part3: { topics } })
  }
  const addTopic = () =>
    setForm({ ...form, part3: { topics: [...form.part3.topics, { label: '', questions: ['', ''] }] } })
  const removeTopic = (ti) => {
    const topics = form.part3.topics.filter((_, i) => i !== ti)
    setForm({ ...form, part3: { topics: topics.length ? topics : [{ label: '', questions: [''] }] } })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      // Flatten Part 3 topics → questions with ##TOPIC## markers
      const part3Questions = form.part3.topics.flatMap(t => [
        t.label.trim() ? `##TOPIC##:${t.label.trim()}` : null,
        ...t.questions.filter(q => q.trim())
      ]).filter(Boolean)

      const p2CueCard = form.part2.instructions.trim()
        ? `${form.part2.instructions.trim()}\n===\n${form.part2.cueCard}`
        : form.part2.cueCard
      const speakingPayload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        part1: { cueCard: form.part1.description, questions: form.part1.questions.filter(q => q.trim()) },
        part2: { cueCard: p2CueCard, questions: form.part2.questions.filter(q => q.trim()) },
        part3: { cueCard: form.part3.description, questions: part3Questions }
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, speakingPayload)
        localStorage.removeItem(`draft_speaking_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/speaking', speakingPayload)
        localStorage.removeItem('draft_speaking_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptySpeakingForm())
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi tạo đề Speaking')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa đề này?')) return
    try {
      await api.delete(`/admin/exams/${id}`)
      onRefresh()
    } catch { alert('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all duration-500 ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-gray-100'}`}>
        <h3 className="font-bold text-gray-800 mb-5">{editingId ? `✏️ Sửa đề Speaking #${editingId}` : 'Tạo đề Speaking mới'}</h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        {draftBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-yellow-700">📋 Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">✏️ Đang sửa đề #{editingId}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-blue-200 bg-white text-blue-500 hover:border-blue-400 hover:text-blue-700 transition">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>Tên đề</label>
          <input className={inputCls} required placeholder="VD: Cambridge 18 · Test 1 · Speaking"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-xs font-bold text-blue-700 mb-2">📚 Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <select className={inputCls} value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value, bookNumber: '' })}>
                <option value="">-- Không gắn --</option>
                {examSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <select className={inputCls} value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })} disabled={!form.seriesId}>
                <option value="">-- Chọn cuốn --</option>
                {examSeries.find(s => s.id === parseInt(form.seriesId))
                  ? Array.from({ length: examSeries.find(s => s.id === parseInt(form.seriesId))?._count?.bookCovers || 0 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)
                  : null
                }
              </select>
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <select className={inputCls} value={form.testNumber} onChange={e => setForm({ ...form, testNumber: e.target.value })} disabled={!form.bookNumber}>
                <option value="">-- Chọn test --</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Test {n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Part 1 ── */}
        <div className="border border-[#bfdbfe] rounded-2xl p-5 mb-4 bg-[#eff6ff]/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1a56db] text-xs font-bold flex items-center justify-center">1</div>
            <div>
              <span className="font-semibold text-gray-700">Part 1 — Introduction & Interview</span>
              <p className="text-xs text-gray-400 mt-0.5">Examiner hỏi về chủ đề quen thuộc trong cuộc sống</p>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Mô tả / Hướng dẫn cho thí sinh</label>
            <textarea className={`${inputCls} h-20 resize-none`}
              placeholder="VD: The examiner asks you about yourself, your home, work or studies and other familiar topics."
              value={form.part1.description}
              onChange={e => setForm({ ...form, part1: { ...form.part1, description: e.target.value } })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Câu hỏi</label>
              <button type="button" onClick={addP1Question} className={btnGhost}>+ Thêm câu</button>
            </div>
            <div className="space-y-2">
              {form.part1.questions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={inputCls}
                    placeholder={`VD: Can you find food from many different countries where you live? [Why/Why not?]`}
                    value={q} onChange={e => updateP1Question(idx, e.target.value)} />
                  {form.part1.questions.length > 1 && (
                    <button type="button" onClick={() => removeP1Question(idx)}
                      className="text-red-400 hover:text-red-600 px-2 flex-shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Part 2 ── */}
        <div className="border border-[#bfdbfe] rounded-2xl p-5 mb-4 bg-[#eff6ff]/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1a56db] text-xs font-bold flex items-center justify-center">2</div>
            <div>
              <span className="font-semibold text-gray-700">Part 2 — Individual Long Turn (Cue Card)</span>
              <p className="text-xs text-gray-400 mt-0.5">Thí sinh chuẩn bị 1 phút, nói 1–2 phút</p>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Mô tả / Hướng dẫn cho thí sinh</label>
            <textarea className={`${inputCls} h-16 resize-none`}
              placeholder="VD: You will have to talk about the topic for one to two minutes..."
              value={form.part2.instructions}
              onChange={e => setForm({ ...form, part2: { ...form.part2, instructions: e.target.value } })} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>Nội dung Cue Card</label>
            <textarea className={`${inputCls} h-36 resize-none`}
              placeholder={`Describe a law that was introduced in your country and that you thought was a very good idea.\n\nYou should say:\n  what the law was\n  who introduced it\n  when and why it was introduced\nand explain why you thought this law was such a good idea.`}
              value={form.part2.cueCard}
              onChange={e => setForm({ ...form, part2: { ...form.part2, cueCard: e.target.value } })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Follow-up questions (tùy chọn)</label>
              <button type="button" onClick={addP2Question} className={btnGhost}>+ Thêm câu</button>
            </div>
            <div className="space-y-2">
              {form.part2.questions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={inputCls} placeholder={`Follow-up ${idx + 1}...`}
                    value={q} onChange={e => updateP2Question(idx, e.target.value)} />
                  {form.part2.questions.length > 1 && (
                    <button type="button" onClick={() => removeP2Question(idx)}
                      className="text-red-400 hover:text-red-600 px-2 flex-shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Part 3 ── */}
        <div className="border border-[#bfdbfe] rounded-2xl p-5 mb-6 bg-[#eff6ff]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1a56db] text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <span className="font-semibold text-gray-700">Part 3 — Two-way Discussion</span>
                <p className="text-xs text-gray-400 mt-0.5">Nhiều chủ đề thảo luận, mỗi chủ đề có nhiều câu hỏi</p>
              </div>
            </div>
            <button type="button" onClick={addTopic} className={btnGhost}>+ Thêm chủ đề</button>
          </div>

          <div className="mb-4">
            <label className={labelCls}>Mô tả / Hướng dẫn cho thí sinh</label>
            <textarea className={`${inputCls} h-16 resize-none`}
              placeholder="VD: Discussion topics: The examiner will ask you questions about the following topics."
              value={form.part3.description}
              onChange={e => setForm({ ...form, part3: { ...form.part3, description: e.target.value } })} />
          </div>

          <div className="space-y-4">
            {form.part3.topics.map((topic, ti) => (
              <div key={ti} className="bg-white border border-[#e2e8f0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input className={inputCls} placeholder={`VD: School rules`}
                    value={topic.label} onChange={e => updateTopicLabel(ti, e.target.value)} />
                  {form.part3.topics.length > 1 && (
                    <button type="button" onClick={() => removeTopic(ti)}
                      className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap shrink-0">
                      Xóa chủ đề
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {topic.questions.map((q, qi) => (
                    <div key={qi} className="flex gap-2">
                      <input className={inputCls}
                        placeholder={`VD: What kinds of rules are common in a school?`}
                        value={q} onChange={e => updateTopicQuestion(ti, qi, e.target.value)} />
                      {topic.questions.length > 1 && (
                        <button type="button" onClick={() => removeTopicQuestion(ti, qi)}
                          className="text-red-400 hover:text-red-600 px-2 flex-shrink-0">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addTopicQuestion(ti)} className={btnGhost + ' text-xs'}>
                    + Thêm câu hỏi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Speaking' : 'Tạo đề Speaking'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          {showPreview ? '▲ Thu gọn preview' : '👁 Xem trước nội dung đề'}
        </button>
      </form>

      {showPreview && (
        <InlinePreviewPanel
          title={form.title || 'Speaking'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <SpeakingFormPreview form={form} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Speaking ({exams.filter(e => e.skill === 'speaking').length})</h3>
        <ExamList exams={exams} skill="speaking" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} />
      </div>
    </div>
  )
}

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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'cambridge',  label: 'IELTS Test', icon: '📚' },
  { key: 'reading',    label: 'Reading',    icon: '📖' },
  { key: 'listening',  label: 'Listening',  icon: '🎧' },
  { key: 'writing',    label: 'Writing',    icon: '✍️' },
  { key: 'speaking',   label: 'Speaking',   icon: '🎤' },
]

export default function Admin() {
  const [activeTab, setActiveTab] = useState('reading')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [examSeries, setExamSeries] = useState([])
  const navigate = useNavigate()

  const fetchExams = () => {
    api.get('/admin/exams')
      .then(res => setExams(res.data))
      .catch(err => {
        if (err.response?.status === 403) navigate('/')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchExams()
  }, [])

  useEffect(() => {
    api.get('/admin/exam-series').then(r => setExamSeries(r.data)).catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-['Nunito',sans-serif]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-600 transition text-sm font-medium flex items-center gap-1">
              ← Quay lại
            </button>
            <div className="w-px h-5 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1a56db] rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">A</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-800 text-sm">Admin Panel</h1>
                <p className="text-xs text-gray-400">IELTS App Management</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{exams.length} đề thi</span>
            <div className="w-2 h-2 rounded-full bg-[#1a56db]"></div>
            <span className="text-xs text-gray-500 font-medium">Online</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-[#1a56db] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.key !== 'cambridge' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {exams.filter(e => e.skill === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'cambridge'  && <CambridgeTab onRefresh={fetchExams} />}
        {activeTab === 'reading'    && <ReadingTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
        {activeTab === 'listening' && <ListeningTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
        {activeTab === 'writing' && <WritingTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
        {activeTab === 'speaking' && <SpeakingTab exams={exams} onRefresh={fetchExams} examSeries={examSeries} />}
      </div>
    </div>
  )
}
