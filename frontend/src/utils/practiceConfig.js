// ─── CONFIG ──────────────────────────────────────────────────────────────────
export const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
export const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url
export const toImgSrc = (url) => (url || '').startsWith('/') ? `${BACKEND_URL}${url}` : (url || '')

// ─── LEVELS ──────────────────────────────────────────────────────────────────
export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

// ─── TOKEN-BASED TYPES ───────────────────────────────────────────────────────
export const TOKEN_BASED_TYPES = ['note_completion', 'table_completion', 'drag_word_bank']

// ─── ROMAN NUMERALS ──────────────────────────────────────────────────────────
export const ROMAN_KEYS = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx']

// ─── SHARED RECALC FUNCTION ───────────────────────────────────────────────────
export const recalcGroups = (groups) => {
  let next = 1
  return groups.map(g => {
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
}

export const getGroupSlots = (group) => {
  if (group.type === 'mcq_multi') return group.questions.length * (group.maxChoices || 2)
  return group.questions.length
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
export const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition'
export const labelCls = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'
export const btnPrimary = 'bg-[#1a56db] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary = 'border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition'

// ─── READING GROUP CONSTANTS ──────────────────────────────────────────────────
export const READING_GROUP_TYPES = [
  { value: 'true_false_ng',        label: 'True / False / Not Given' },
  { value: 'yes_no_ng',            label: 'Yes / No / Not Given' },
  { value: 'note_completion',      label: 'Note / Form Completion' },
  { value: 'table_completion',     label: 'Table Completion' },
  { value: 'mcq',                  label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi',            label: 'Multiple Choice (chọn TWO)' },
  { value: 'matching_information', label: 'Matching Information (nối đoạn)' },
  { value: 'drag_word_bank',       label: 'Summary + Word Bank (kéo thả)' },
  { value: 'matching_drag',        label: 'Matching - Kéo thả đáp án' },
  { value: 'diagram_label',        label: 'Diagram Label Completion' },
  { value: 'matching_headings',    label: 'Matching Headings' },
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
  diagram_label: 'Complete the labels on the diagram. Write NO MORE THAN TWO WORDS from the passage for each answer.',
  matching_headings: 'The reading passage has several paragraphs. Choose the correct heading for each paragraph from the list of headings below.',
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
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }]
    : type === 'matching_headings'
    ? [{ letter: 'i', text: '' }, { letter: 'ii', text: '' }, { letter: 'iii', text: '' }, { letter: 'iv', text: '' }]
    : [],
  questions: [],
  canReuse: false,
  maxChoices: type === 'mcq_multi' ? 2 : 1,
})

// ─── LISTENING GROUP CONSTANTS ────────────────────────────────────────────────
export const LISTENING_GROUP_TYPES = [
  { value: 'note_completion',  label: 'Note / Form Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'mcq',              label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi',        label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'matching',         label: 'Matching' },
  { value: 'map_diagram',      label: 'Map / Diagram Labeling' },
  { value: 'drag_word_bank',   label: 'Summary + Word Bank (kéo thả)' },
  { value: 'matching_drag',    label: 'Matching - Kéo thả đáp án' },
  { value: 'diagram_label',   label: 'Diagram Label Completion' },
  { value: 'matching_headings', label: 'Matching Headings' },
]

export const LISTENING_GROUP_INSTRUCTIONS = {
  note_completion:  'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
  table_completion: 'Complete the table below. Write ONE WORD AND/OR A NUMBER for each answer.',
  mcq:              'Choose the correct letter, A, B or C.',
  mcq_multi:        'Choose TWO letters, A–E.',
  matching:         'What does the speaker say about each of the following? Choose the correct letter A–E.',
  map_diagram:      'Label the map/diagram below. Write the correct letter A–F next to each question number.',
  drag_word_bank:   'Complete the summary below. Choose NO MORE THAN TWO WORDS from the box for each answer.',
  matching_drag:    'Match each statement with the correct option A–F.',
  diagram_label:    'Complete the labels on the diagram. Write ONE OR TWO WORDS AND/OR A NUMBER for each answer.',
  matching_headings: 'Choose the correct heading for each section from the list of headings below.',
}

// ─── TYPE COLOR MAP (shared for GroupEditor headers) ─────────────────────────
export const GROUP_TYPE_COLORS = {
  true_false_ng:       'bg-blue-100 text-blue-800 border-blue-300',
  yes_no_ng:           'bg-cyan-100 text-cyan-800 border-cyan-300',
  note_completion:     'bg-amber-100 text-amber-800 border-amber-300',
  table_completion:    'bg-emerald-100 text-emerald-800 border-emerald-300',
  mcq:                 'bg-blue-100 text-blue-800 border-blue-300',
  mcq_multi:           'bg-indigo-100 text-indigo-800 border-indigo-300',
  matching:            'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
  matching_information:'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
  map_diagram:         'bg-teal-100 text-teal-800 border-teal-300',
  drag_word_bank:      'bg-sky-100 text-sky-800 border-sky-300',
  matching_drag:       'bg-violet-100 text-violet-800 border-violet-300',
  diagram_label:       'bg-rose-100 text-rose-800 border-rose-300',
  matching_headings:   'bg-green-100 text-green-800 border-green-300',
}

export const emptyListeningGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: LISTENING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: ['note_completion', 'drag_word_bank'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching', 'map_diagram', 'drag_word_bank', 'matching_drag'].includes(type)
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }]
    : type === 'matching_headings'
    ? [{ letter: 'i', text: '' }, { letter: 'ii', text: '' }, { letter: 'iii', text: '' }, { letter: 'iv', text: '' }]
    : [],
  questions: [],
  canReuse: false,
  maxChoices: type === 'mcq_multi' ? 2 : 1,
})
