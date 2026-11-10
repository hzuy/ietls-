import { READING_GROUP_TYPES, LISTENING_GROUP_TYPES, TASK_INSTRUCTIONS, questionGroupTheme, TOKEN_TYPES, TEXT_COMPLETION_TYPES, questionMechanic, isMultiChoice } from '../../utils/questionTypes'
export { READING_GROUP_TYPES, LISTENING_GROUP_TYPES }
import { useState, useEffect } from 'react'
import { lineText } from '../../utils/noteLine'

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
  { value: 'matching_paragraph',label: 'Matching Information' },
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

export function getQuestionGroupTheme(type) { return questionGroupTheme(type) }

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

export const GROUP_TYPES = LISTENING_GROUP_TYPES

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
export const TOKEN_BASED_TYPES = TOKEN_TYPES

export const getGroupSlots = (group) => {
  if (isMultiChoice(group.type)) return group.questions.length * (group.maxChoices || 2)
  return group.questions.length
}

export const recalcAllGroupNumbers = (passages) => {
  let next = 1
  return passages.map(p => ({
    ...p,
    questionGroups: (p.questionGroups || []).map(g => {
      const numberMap = new Map()
      const renumber = (q, number) => {
        numberMap.set(q.number, number)
        return { ...q, number }
      }
      const finish = (updated) => {
        if (!g.explanations) return updated
        const explanations = Object.fromEntries(
          Object.entries(g.explanations)
            .filter(([old]) => numberMap.has(Number(old)))
            .map(([old, value]) => [numberMap.get(Number(old)), value])
        )
        return { ...updated, explanations }
      }
      const slots = getGroupSlots(g)
      const newStart = next
      const newEnd = slots > 0 ? next + slots - 1 : next
      next += slots

      if (TOKEN_BASED_TYPES.includes(g.type)) {
        // Collect tokens in order of appearance
        const seenTokens = new Set()
        const tokenOrder = []
        ;(g.noteSections || []).forEach(ns => {
          ;(ns.lines || []).forEach(l => {
            const text = lineText(l)
            for (const m of text.matchAll(/\[Q:(\d+)\]/g)) {
              const num = parseInt(m[1], 10)
              if (!seenTokens.has(num)) {
                seenTokens.add(num)
                tokenOrder.push(num)
              }
            }
          })
        })

        if (tokenOrder.length === 0) {
          // No tokens in text (e.g. diagram_label or empty note_completion)
          let qNum = newStart
          const updatedQuestions = (g.questions || []).map(q => {
            const num = qNum
            qNum += 1
            return renumber(q, num)
          })
          return finish({
            ...g,
            qNumberStart: newStart,
            qNumberEnd: newEnd,
            questions: updatedQuestions,
          })
        }

        const oldToNew = new Map()
        tokenOrder.forEach((oldNum, idx) => {
          oldToNew.set(oldNum, newStart + idx)
        })

        const rewriteText = (str) => {
          if (!str) return str
          return str.replace(/\[Q:(\d+)\]/g, (match, p1) => {
            const oldNum = parseInt(p1, 10)
            const newNum = oldToNew.get(oldNum)
            return newNum !== undefined ? `[Q:${newNum}]` : match
          })
        }

        const updatedNoteSections = (g.noteSections || []).map(ns => ({
          ...ns,
          lines: (ns.lines || []).map(l => {
            const updatedLine = { ...l }
            if (l.content !== undefined) updatedLine.content = rewriteText(l.content)
            if (l.contentWithTokens !== undefined) updatedLine.contentWithTokens = rewriteText(l.contentWithTokens)
            if (l.content !== undefined && l.contentWithTokens === undefined) {
              updatedLine.contentWithTokens = updatedLine.content
            }
            if (l.contentWithTokens !== undefined && l.content === undefined) {
              updatedLine.content = updatedLine.contentWithTokens
            }
            return updatedLine
          })
        }))

        const qByOldNum = new Map()
        ;(g.questions || []).forEach(q => {
          qByOldNum.set(q.number, q)
        })

        const updatedQuestions = []
        const usedOldNums = new Set()

        tokenOrder.forEach((oldNum, idx) => {
          const q = qByOldNum.get(oldNum)
          if (q) {
            updatedQuestions.push(renumber(q, newStart + idx))
            usedOldNums.add(oldNum)
          } else {
            updatedQuestions.push({ number: newStart + idx, questionText: '', correctAnswer: '' })
          }
        })

        let extraIdx = tokenOrder.length
        ;(g.questions || []).forEach(q => {
          if (!usedOldNums.has(q.number)) {
            updatedQuestions.push(renumber(q, newStart + extraIdx))
            extraIdx++
          }
        })

        updatedQuestions.sort((a, b) => a.number - b.number)
        next = newStart + updatedQuestions.length

        return finish({
          ...g,
          qNumberStart: newStart,
          qNumberEnd: Math.max(newStart, next - 1),
          questions: updatedQuestions,
          noteSections: updatedNoteSections,
        })
      }

      let qNum = newStart
      const updatedQuestions = (g.questions || []).map(q => {
        const num = qNum
        qNum += (isMultiChoice(g.type)) ? (g.maxChoices || 2) : 1
        return renumber(q, num)
      })
      return finish({ ...g, qNumberStart: newStart, qNumberEnd: newEnd, questions: updatedQuestions })
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
  instruction: TASK_INSTRUCTIONS[type] || READING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: [...TEXT_COMPLETION_TYPES, 'drag_word_bank', 'diagram_label'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching_information', 'drag_word_bank', 'matching_drag'].includes(questionMechanic(type))
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }] : type === 'matching_headings' ? [{ letter: 'i', text: '' }, { letter: 'ii', text: '' }, { letter: 'iii', text: '' }] : [],
  questions: [],
  canReuse: type === 'categorisation',
  maxChoices: isMultiChoice(type) ? 2 : 1,
})

export const emptyGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: TASK_INSTRUCTIONS[type] || GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  maxChoices: isMultiChoice(type) ? 2 : 1,
  noteSections: [...TEXT_COMPLETION_TYPES, 'drag_word_bank', 'diagram_label'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching', 'map_diagram', 'drag_word_bank', 'matching_drag'].includes(questionMechanic(type))
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }]
    : type === 'matching_headings' ? [{ letter: 'i', text: '' }, { letter: 'ii', text: '' }, { letter: 'iii', text: '' }] : [],
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
    questions: ['', '', '']
  }
})

// ─── STYLES ──────────────────────────────────────────────────────────────────
export const inputCls = 'w-full border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 transition bg-white text-zinc-900 placeholder:text-zinc-400'
export const labelCls = 'block text-xs font-medium text-zinc-700 mb-1.5'
export const btnPrimary = 'bg-zinc-900 text-white px-3.5 py-2 rounded-lg font-medium text-xs hover:bg-zinc-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary = 'bg-white border border-zinc-200 text-zinc-900 px-3.5 py-2 rounded-lg text-xs font-medium hover:bg-zinc-50 transition shadow-xs'
export const btnDanger = 'text-red-600 hover:text-red-700 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition font-medium'

// URL ảnh/asset: nguồn chân lý ở src/utils/media.js. Re-export giữ tên cũ để
// mọi editor/tab admin đang import { SERVER_BASE, toImgSrc } từ đây không phải sửa.
export { BACKEND_URL as SERVER_BASE, toImgSrc, handleImgError } from '../../utils/media'
