import { useState, useEffect } from 'react'

// ─── SHARED HOOKS for exam-series dropdowns ────────────────────────────────────
export function useExamSeriesList() {
  const [list, setList] = useState([])
  useEffect(() => {
    import('../../utils/axios').then(api => {
      api.default.get('/admin/exam-series').then(r => setList(r.data)).catch(() => {})
    })
  }, [])
  return list
}

export function useSeriesBooks(seriesId) {
  const [books, setBooks] = useState([])
  useEffect(() => {
    if (!seriesId) { setBooks([]); return }
    setBooks([])
    import('../../utils/axios').then(api => {
      api.default.get(`/admin/exam-series/${seriesId}/books`)
        .then(r => setBooks(r.data))
        .catch(() => setBooks([]))
    })
  }, [seriesId])
  return books
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const READING_Q_TYPES = [
  { value: 'mcq',               label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi',         label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'true_false_ng',     label: 'True / False / Not Given' },
  { value: 'yes_no_ng',         label: 'Yes / No / Not Given' },
  { value: 'fill_blank',        label: 'Sentence / Summary / Table / Flow-chart Completion' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'matching_paragraph',label: 'Matching Paragraph Information' },
  { value: 'matching_endings',  label: 'Matching Sentence Endings' },
  { value: 'choose_title',      label: 'Choose the Best Title' },
  { value: 'diagram_completion',label: 'Diagram / Map Completion' },
  { value: 'diagram_label',     label: 'Diagram Label Completion' },
]

export const LISTENING_Q_TYPES = [
  { value: 'mcq',       label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'fill_blank',label: 'Form / Note / Table / Sentence Completion' },
  { value: 'matching',  label: 'Matching' },
  { value: 'map_diagram', label: 'Labeling a Map / Diagram' },
  { value: 'diagram_label', label: 'Diagram Label Completion' },
]

export function getQuestionGroupTheme(type) {
  switch (type) {
    case 'true_false_ng':
      return {
        cardBg: 'bg-emerald-50/70',
        cardBorder: 'border-emerald-300',
        headerBg: 'bg-emerald-100/60 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        subBoxBg: 'bg-emerald-100/50',
        subBoxBorder: 'border-emerald-200',
        subBoxText: 'text-emerald-800',
        subBoxHover: 'hover:bg-emerald-200/60',
        subBoxBtn: 'bg-emerald-200/70 text-emerald-900 border-emerald-300',
        accentColor: 'accent-emerald-600',
      }
    case 'yes_no_ng':
      return {
        cardBg: 'bg-teal-50/80',
        cardBorder: 'border-teal-300',
        headerBg: 'bg-teal-100/60 border-teal-200',
        badge: 'bg-teal-100 text-teal-800 border-teal-300',
        subBoxBg: 'bg-teal-100/50',
        subBoxBorder: 'border-teal-200',
        subBoxText: 'text-teal-800',
        subBoxHover: 'hover:bg-teal-200/60',
        subBoxBtn: 'bg-teal-200/70 text-teal-900 border-teal-300',
        accentColor: 'accent-teal-600',
      }
    case 'mcq':
      return {
        cardBg: 'bg-blue-50/80',
        cardBorder: 'border-blue-300',
        headerBg: 'bg-blue-100/60 border-blue-200',
        badge: 'bg-blue-100 text-blue-800 border-blue-300',
        subBoxBg: 'bg-blue-100/50',
        subBoxBorder: 'border-blue-200',
        subBoxText: 'text-blue-800',
        subBoxHover: 'hover:bg-blue-200/60',
        subBoxBtn: 'bg-blue-200/70 text-blue-900 border-blue-300',
        accentColor: 'accent-blue-600',
      }
    case 'mcq_multi':
      return {
        cardBg: 'bg-indigo-50/70',
        cardBorder: 'border-indigo-300',
        headerBg: 'bg-indigo-100/60 border-indigo-200',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        subBoxBg: 'bg-indigo-100/50',
        subBoxBorder: 'border-indigo-200',
        subBoxText: 'text-indigo-800',
        subBoxHover: 'hover:bg-indigo-200/60',
        subBoxBtn: 'bg-indigo-200/70 text-indigo-900 border-indigo-300',
        accentColor: 'accent-indigo-600',
      }
    case 'matching_information':
      return {
        cardBg: 'bg-purple-50/80',
        cardBorder: 'border-purple-300',
        headerBg: 'bg-purple-100/60 border-purple-200',
        badge: 'bg-purple-100 text-purple-800 border-purple-300',
        subBoxBg: 'bg-purple-100/50',
        subBoxBorder: 'border-purple-200',
        subBoxText: 'text-purple-800',
        subBoxHover: 'hover:bg-purple-200/60',
        subBoxBtn: 'bg-purple-200/70 text-purple-900 border-purple-300',
        accentColor: 'accent-purple-600',
      }
    case 'matching_headings':
      return {
        cardBg: 'bg-violet-50/80',
        cardBorder: 'border-violet-300',
        headerBg: 'bg-violet-100/60 border-violet-200',
        badge: 'bg-violet-100 text-violet-800 border-violet-300',
        subBoxBg: 'bg-violet-100/50',
        subBoxBorder: 'border-violet-200',
        subBoxText: 'text-violet-800',
        subBoxHover: 'hover:bg-violet-200/60',
        subBoxBtn: 'bg-violet-200/70 text-violet-900 border-violet-300',
        accentColor: 'accent-violet-600',
      }
    case 'matching':
    case 'matching_features':
    case 'matching_paragraph':
    case 'matching_endings':
      return {
        cardBg: 'bg-fuchsia-50/70',
        cardBorder: 'border-fuchsia-300',
        headerBg: 'bg-fuchsia-100/60 border-fuchsia-200',
        badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
        subBoxBg: 'bg-fuchsia-100/50',
        subBoxBorder: 'border-fuchsia-200',
        subBoxText: 'text-fuchsia-800',
        subBoxHover: 'hover:bg-fuchsia-200/60',
        subBoxBtn: 'bg-fuchsia-200/70 text-fuchsia-900 border-fuchsia-300',
        accentColor: 'accent-fuchsia-600',
      }
    case 'matching_drag':
      return {
        cardBg: 'bg-pink-50/80',
        cardBorder: 'border-pink-300',
        headerBg: 'bg-pink-100/60 border-pink-200',
        badge: 'bg-pink-100 text-pink-800 border-pink-300',
        subBoxBg: 'bg-pink-100/50',
        subBoxBorder: 'border-pink-200',
        subBoxText: 'text-pink-800',
        subBoxHover: 'hover:bg-pink-200/60',
        subBoxBtn: 'bg-pink-200/70 text-pink-900 border-pink-300',
        accentColor: 'accent-pink-600',
      }
    case 'note_completion':
    case 'fill_blank':
    case 'sentence_completion':
      return {
        cardBg: 'bg-amber-50/80',
        cardBorder: 'border-amber-300',
        headerBg: 'bg-amber-100/60 border-amber-200',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        subBoxBg: 'bg-amber-100/50',
        subBoxBorder: 'border-amber-200',
        subBoxText: 'text-amber-800',
        subBoxHover: 'hover:bg-amber-200/60',
        subBoxBtn: 'bg-amber-200/70 text-amber-900 border-amber-300',
        accentColor: 'accent-amber-600',
      }
    case 'table_completion':
      return {
        cardBg: 'bg-orange-50/80',
        cardBorder: 'border-orange-300',
        headerBg: 'bg-orange-100/60 border-orange-200',
        badge: 'bg-orange-100 text-orange-800 border-orange-300',
        subBoxBg: 'bg-orange-100/50',
        subBoxBorder: 'border-orange-200',
        subBoxText: 'text-orange-800',
        subBoxHover: 'hover:bg-orange-200/60',
        subBoxBtn: 'bg-orange-200/70 text-orange-900 border-orange-300',
        accentColor: 'accent-orange-600',
      }
    case 'drag_word_bank':
      return {
        cardBg: 'bg-yellow-50/80',
        cardBorder: 'border-yellow-300',
        headerBg: 'bg-yellow-100/60 border-yellow-200',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        subBoxBg: 'bg-yellow-100/50',
        subBoxBorder: 'border-yellow-200',
        subBoxText: 'text-yellow-800',
        subBoxHover: 'hover:bg-yellow-200/60',
        subBoxBtn: 'bg-yellow-200/70 text-yellow-900 border-yellow-300',
        accentColor: 'accent-yellow-600',
      }
    case 'summary_completion':
      return {
        cardBg: 'bg-lime-50/80',
        cardBorder: 'border-lime-300',
        headerBg: 'bg-lime-100/60 border-lime-200',
        badge: 'bg-lime-100 text-lime-800 border-lime-300',
        subBoxBg: 'bg-lime-100/50',
        subBoxBorder: 'border-lime-200',
        subBoxText: 'text-lime-800',
        subBoxHover: 'hover:bg-lime-200/60',
        subBoxBtn: 'bg-lime-200/70 text-lime-900 border-lime-300',
        accentColor: 'accent-lime-600',
      }
    case 'map_diagram':
      return {
        cardBg: 'bg-cyan-50/80',
        cardBorder: 'border-cyan-300',
        headerBg: 'bg-cyan-100/60 border-cyan-200',
        badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        subBoxBg: 'bg-cyan-100/50',
        subBoxBorder: 'border-cyan-200',
        subBoxText: 'text-cyan-800',
        subBoxHover: 'hover:bg-cyan-200/60',
        subBoxBtn: 'bg-cyan-200/70 text-cyan-900 border-cyan-300',
        accentColor: 'accent-cyan-600',
      }
    case 'diagram_label':
    case 'diagram_completion':
      return {
        cardBg: 'bg-red-50/80',
        cardBorder: 'border-red-300',
        headerBg: 'bg-red-100/60 border-red-200',
        badge: 'bg-red-100 text-red-800 border-red-300',
        subBoxBg: 'bg-red-100/50',
        subBoxBorder: 'border-red-200',
        subBoxText: 'text-red-800',
        subBoxHover: 'hover:bg-red-200/60',
        subBoxBtn: 'bg-red-200/70 text-red-900 border-red-300',
        accentColor: 'accent-red-600',
      }
    case 'short_answer':
    default:
      return {
        cardBg: 'bg-rose-50/80',
        cardBorder: 'border-rose-300',
        headerBg: 'bg-rose-100/60 border-rose-200',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
        subBoxBg: 'bg-rose-100/50',
        subBoxBorder: 'border-rose-200',
        subBoxText: 'text-rose-800',
        subBoxHover: 'hover:bg-rose-200/60',
        subBoxBtn: 'bg-rose-200/70 text-rose-900 border-rose-300',
        accentColor: 'accent-rose-600',
      }
  }
}

export const getQuestionTypeTheme = getQuestionGroupTheme

export const TYPES_WITH_MCQ_OPTIONS     = ['mcq', 'mcq_multi']
export const TYPES_WITH_DYNAMIC_OPTIONS = ['matching_headings','matching_features','matching_paragraph','matching_endings','matching','choose_title','map_diagram']
export const TYPES_WITH_IMAGE           = ['map_diagram', 'diagram_completion', 'diagram_label']

export const ANSWER_PLACEHOLDER = {
  mcq: 'Nhập đúng text đáp án đúng',
  mcq_multi: 'VD: A. text,C. text (phân cách bằng dấu phẩy)',
  true_false_ng: 'TRUE / FALSE / NOT GIVEN',
  yes_no_ng: 'YES / NO / NOT GIVEN',
  fill_blank: 'Nhập từ/cụm từ điền vào chỗ trống',
  matching_headings: 'i, ii, iii...',
  matching_features: 'A, B, C...',
  matching_paragraph: 'A, B, C...',
  matching_endings: 'A, B, C...',
  matching: 'Nhập đáp án khớp',
  choose_title: 'Nhập tiêu đề đúng',
  diagram_completion: 'Nhập nhãn đúng',
  map_diagram: 'A, B, C...',
  diagram_label: 'Nhập từ điền vào chỗ trống',
}

export const emptyQuestion = (num = 1) => ({
  number: num, type: 'mcq', questionText: '', options: ['', '', '', ''], correctAnswer: '', imageUrl: ''
})

export const emptyPassage = (num = 1) => ({
  number: num, title: '', subtitle: '', letteredParagraphs: false, body: '', questionGroups: []
})

export const emptySection = (num = 1) => ({
  number: num, context: '', audioUrl: '', transcript: '', questions: [emptyQuestion(1)]
})

export const emptyReadingForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  passages: [1, 2, 3].map(n => emptyPassage(n))
})

export const emptyListeningForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  sections: [1,2,3,4].map(n => ({
    number: n, context: '', audioUrl: '', transcript: '', questionGroups: []
  }))
})

export const SECTION_HINTS = {
  1: 'Hội thoại 2 người — ngữ cảnh xã hội thường ngày (đặt phòng, mua sắm,...)',
  2: 'Độc thoại — ngữ cảnh xã hội (giới thiệu tour, thông báo,...)',
  3: 'Hội thoại học thuật — tối đa 4 người (thảo luận seminar, bài tập,...)',
  4: 'Độc thoại học thuật — bài giảng, thuyết trình về chủ đề học thuật',
}

export const GROUP_TYPES = [
  { value: 'note_completion', label: 'Note / Form Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'mcq', label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'matching', label: 'Matching' },
  { value: 'map_diagram', label: 'Map / Diagram Labeling' },
  { value: 'drag_word_bank', label: 'Summary + Word Bank (kéo thả)' },
  { value: 'matching_drag', label: 'Matching - Kéo thả đáp án' },
  { value: 'diagram_label', label: 'Diagram Label Completion' },
]

export const GROUP_INSTRUCTIONS = {
  note_completion: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
  table_completion: 'Complete the table below. Write ONE WORD AND/OR A NUMBER for each answer.',
  mcq: 'Choose the correct letter, A, B or C.',
  mcq_multi: 'Choose TWO letters, A–E.',
  matching: 'What does the speaker say about each of the following? Choose the correct letter A–E.',
  map_diagram: 'Label the map/diagram below. Write the correct letter A–F next to each question number.',
  drag_word_bank: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the box for each answer.',
  matching_drag: 'Match each statement with the correct option A–F.',
  diagram_label: 'Complete the labels on the diagram below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
}

export const READING_GROUP_TYPES = [
  { value: 'true_false_ng', label: 'True / False / Not Given' },
  { value: 'yes_no_ng', label: 'Yes / No / Not Given' },
  { value: 'note_completion', label: 'Note / Form Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'mcq', label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (chọn TWO)' },
  { value: 'matching_information', label: 'Matching Information (nối đoạn)' },
  { value: 'drag_word_bank', label: 'Summary + Word Bank (kéo thả)' },
  { value: 'matching_drag', label: 'Matching - Kéo thả đáp án' },
  { value: 'diagram_label', label: 'Diagram Label Completion' },
]

export const READING_GROUP_INSTRUCTIONS = {
  true_false_ng: 'Do the following statements agree with the information given in the reading passage? Write TRUE, FALSE or NOT GIVEN.',
  yes_no_ng: 'Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.',
  note_completion: 'Complete the notes below. Write NO MORE THAN TWO WORDS from the passage for each answer.',
  table_completion: 'Complete the table below. Write NO MORE THAN TWO WORDS from the passage for each answer.',
  mcq: 'Choose the correct letter, A, B, C or D.',
  mcq_multi: 'Choose TWO letters, A–E.',
  matching_information: 'The reading passage has several paragraphs. Which paragraph contains the following information? Write the correct letter in the boxes below.',
  drag_word_bank: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the box for each answer.',
  matching_drag: 'Match each statement with the correct category A–F. You may use any letter more than once.',
  diagram_label: 'Label the diagram below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
}

// ─── READING GROUP NUMBERING ─────────────────────────────────────────────────
export const TOKEN_BASED_TYPES = ['note_completion', 'table_completion', 'drag_word_bank', 'diagram_label']

export const getGroupSlots = (group) => {
  if (group.type === 'mcq_multi') return group.questions.length * (group.maxChoices || 2)
  return group.questions.length
}

export const recalcAllGroupNumbers = (passages) => {
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

// ─── LISTENING GROUP NUMBERING ──────────────────────────────────────────────
// IELTS Listening is numbered continuously 1..40 across all 4 sections, exactly
// like Reading across its 3 passages. Sections and passages both expose
// `.questionGroups`, and recalcAllGroupNumbers touches nothing else, so the
// Reading implementation applies unchanged — one shared rule, one code path.
export const recalcAllListeningNumbers = recalcAllGroupNumbers

export const emptyReadingGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: READING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: ['note_completion', 'drag_word_bank', 'diagram_label'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching_information', 'drag_word_bank', 'matching_drag'].includes(type)
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }] : [],
  questions: [],
  canReuse: false,
  maxChoices: type === 'mcq_multi' ? 2 : 1,
})

export const emptyGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  maxChoices: type === 'mcq_multi' ? 2 : 1,
  noteSections: ['note_completion', 'drag_word_bank', 'diagram_label'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching', 'map_diagram', 'drag_word_bank', 'matching_drag'].includes(type)
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }]
    : [],
  questions: [],
})

export const emptyWritingForm = () => ({
  title: '', bookNumber: '', testNumber: '', seriesId: '',
  task1: { prompt: '', imageUrl: '' },
  task2: { prompt: '' }
})

export const emptySpeakingForm = () => ({
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
export const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition'
export const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'
export const btnPrimary = 'bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary = 'border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition'
export const btnDanger = 'text-rose-600 hover:text-rose-700 text-xs px-2 py-1 rounded-lg hover:bg-rose-50 transition font-medium'

export const SERVER_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
export const toImgSrc = (url) => (url || '').startsWith('/') ? `${SERVER_BASE}${url}` : (url || '')
