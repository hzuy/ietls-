import { READING_GROUP_TYPES, LISTENING_GROUP_TYPES, TASK_INSTRUCTIONS, questionGroupTheme, TOKEN_TYPES, TEXT_COMPLETION_TYPES, questionMechanic, isMultiChoice } from './questionTypes'
export { READING_GROUP_TYPES, LISTENING_GROUP_TYPES }
import { lineText } from './noteLine'
// ─── CONFIG ──────────────────────────────────────────────────────────────────
// URL ảnh/asset: nguồn chân lý ở ./media. Re-export giữ tên cũ để các editor +
// trang admin đang import { BACKEND_URL, resolveImg, toImgSrc } từ đây không phải sửa.
export { BACKEND_URL, resolveImg, toImgSrc, handleImgError } from './media'

// ─── LEVELS ──────────────────────────────────────────────────────────────────
export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

// ─── TOKEN-BASED TYPES ───────────────────────────────────────────────────────
export const TOKEN_BASED_TYPES = TOKEN_TYPES

// ─── ROMAN NUMERALS ──────────────────────────────────────────────────────────
export const ROMAN_KEYS = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx']

// ─── SHARED RECALC FUNCTION ───────────────────────────────────────────────────
export const recalcGroups = (groups) => {
  let next = 1
  return groups.map(g => {
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
}

export const getGroupSlots = (group) => {
  if (isMultiChoice(group.type)) return (group.questions || []).length * (group.maxChoices || 2)
  return (group.questions || []).length
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
export const inputCls = 'w-full border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 transition bg-white text-zinc-900 placeholder:text-zinc-400'
export const labelCls = 'block text-xs font-medium text-zinc-700 mb-1.5'
export const btnPrimary = 'bg-zinc-900 text-white px-3.5 py-2 rounded-lg font-medium text-xs hover:bg-zinc-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary = 'bg-white border border-zinc-200 text-zinc-900 px-3.5 py-2 rounded-lg text-xs font-medium hover:bg-zinc-50 transition shadow-xs'

// ─── READING GROUP CONSTANTS ──────────────────────────────────────────────────


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
  instruction: TASK_INSTRUCTIONS[type] || READING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: [...TEXT_COMPLETION_TYPES, 'drag_word_bank', 'diagram_label'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching_information', 'drag_word_bank', 'matching_drag'].includes(questionMechanic(type))
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }]
    : type === 'matching_headings'
    ? [{ letter: 'i', text: '' }, { letter: 'ii', text: '' }, { letter: 'iii', text: '' }, { letter: 'iv', text: '' }]
    : [],
  questions: [],
  canReuse: type === 'categorisation',
  maxChoices: isMultiChoice(type) ? 2 : 1,
})

// ─── LISTENING GROUP CONSTANTS ────────────────────────────────────────────────


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

export function getQuestionGroupTheme(type) { return questionGroupTheme(type) }

export const getQuestionTypeTheme = getQuestionGroupTheme

// ─── TYPE COLOR MAP (shared for GroupEditor headers & list badges) ──────────
export const GROUP_TYPE_COLORS = Object.fromEntries([...READING_GROUP_TYPES, ...LISTENING_GROUP_TYPES].map(t => [t.value, questionGroupTheme(t.value).badge]))

export const emptyListeningGroupOf = (type, startNum = 1) => ({
  _id: Date.now() + Math.random(),
  type,
  qNumberStart: startNum,
  qNumberEnd: startNum,
  instruction: TASK_INSTRUCTIONS[type] || LISTENING_GROUP_INSTRUCTIONS[type] || '',
  imageUrl: '',
  noteSections: [...TEXT_COMPLETION_TYPES, 'drag_word_bank', 'diagram_label'].includes(type)
    ? [{ title: '', lines: [{ content: '' }] }]
    : type === 'table_completion'
    ? [{ title: '', lines: [{ content: 'Cột 1|Cột 2|Cột 3', lineType: 'heading' }, { content: '||', lineType: 'content' }] }]
    : [],
  matchingOptions: ['matching', 'map_diagram', 'drag_word_bank', 'matching_drag'].includes(questionMechanic(type))
    ? [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }]
    : type === 'matching_headings'
    ? [{ letter: 'i', text: '' }, { letter: 'ii', text: '' }, { letter: 'iii', text: '' }, { letter: 'iv', text: '' }]
    : [],
  questions: [],
  canReuse: type === 'categorisation',
  maxChoices: isMultiChoice(type) ? 2 : 1,
})
