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
]
export const LISTENING_Q_TYPES = [
  { value: 'mcq',       label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'fill_blank',label: 'Form / Note / Table / Sentence Completion' },
  { value: 'matching',  label: 'Matching' },
  { value: 'map_diagram', label: 'Labeling a Map / Diagram' },
]
export const TYPES_WITH_MCQ_OPTIONS     = ['mcq', 'mcq_multi']
export const TYPES_WITH_DYNAMIC_OPTIONS = ['matching_headings','matching_features','matching_paragraph','matching_endings','matching','choose_title','map_diagram']
export const TYPES_WITH_IMAGE           = ['map_diagram', 'diagram_completion']

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
}

// ─── READING GROUP NUMBERING ─────────────────────────────────────────────────
export const TOKEN_BASED_TYPES = ['note_completion', 'table_completion', 'drag_word_bank']

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

export const emptyReadingGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: READING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: ['note_completion', 'drag_word_bank'].includes(type)
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
  noteSections: ['note_completion', 'drag_word_bank'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching', 'map_diagram', 'drag_word_bag', 'matching_drag'].includes(type)
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
export const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition'
export const labelCls = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'
export const btnPrimary = 'bg-[#1a56db] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary = 'border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition'
export const btnDanger = 'text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition font-medium'
export const btnGhost = 'text-[#1a56db] text-xs font-semibold hover:underline transition'

export const SERVER_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
export const toImgSrc = (url) => (url || '').startsWith('/') ? `${SERVER_BASE}${url}` : (url || '')
