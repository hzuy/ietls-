import { readingParagraphs } from './readingParagraphs'

/**
 * Validation utility for IELTS Exam and Practice questions.
 * Ensures tests have complete passages/audio, question prompts, and correct answers
 * before saving or generating AI explanations.
 */

export function hasValidAnswer(answer) {
  if (answer === null || answer === undefined) return false
  if (typeof answer === 'string') return answer.trim().length > 0
  if (Array.isArray(answer)) {
    return answer.length > 0 && answer.every(a => typeof a === 'string' && a.trim().length > 0)
  }
  if (typeof answer === 'number') return true
  return false
}

export function validateHeadingSource(group, passage) {
  if (group.type !== 'matching_headings') return []
  const paragraphs = readingParagraphs(passage)
  const keys = new Set()
  const errors = []
  for (const q of group.questions || []) {
    const key = (q.questionText || '').split('|')[0].trim()
    if (!/^[A-Z]$/.test(key) || !paragraphs[key.charCodeAt(0) - 65]) errors.push(`Câu ${q.number}: đoạn ${key || '?'} không còn trong bài đọc`)
    if (keys.has(key)) errors.push(`Câu ${q.number}: đoạn ${key} đã được chọn`)
    keys.add(key)
    if (!(group.matchingOptions || []).some(h => h.letter === q.correctAnswer && String(h.text || '').trim())) errors.push(`Câu ${q.number}: heading đúng chưa có nội dung hoặc không còn tồn tại`)
  }
  return errors
}

// Question types that require explicit questionText / prompt / statement
const PROMPT_REQUIRED_TYPES = new Set([
  'mcq',
  'mcq_multi',
  'true_false_ng',
  'yes_no_ng',
  'matching',
  'matching_information',
  'matching_drag',
  'short_answer',
  'sentence_completion',
  'matching_endings',
  'matching_headings',
  'categorisation',
  'choose_title',
  'list_selection',
])

export function validateQuestionItem(q, groupType) {
  const qNum = q.number || q.orderNum || '?'
  const missing = []

  if (!hasValidAnswer(q.correctAnswer)) {
    missing.push('answer')
  }

  const effectiveType = q.type || groupType
  if (PROMPT_REQUIRED_TYPES.has(effectiveType) && !String(q.questionText ?? '').trim()) {
    missing.push('text')
  }

  return { qNum, missing }
}

export function formatValidationAlert(title, errors = []) {
  if (!errors.length) return ''
  const bullets = errors.map(err => `• ${err}`).join('\n')
  return `${title}:\n${bullets}\n\nVui lòng điền đầy đủ thông tin để tiếp tục.`
}

/**
 * Validates Reading Practice form
 */
export function validatePracticeReading(form) {
  const errors = []
  const missingAnswers = []
  const missingTexts = []

  if (!String(form.title ?? '').trim()) {
    errors.push('Chưa nhập tên bài đọc')
  }

  if (!String(form.passage ?? '').trim()) {
    errors.push('Chưa nhập nội dung bài đọc (Passage)')
  }

  const groups = form.questionGroups || []
  if (!groups.length) {
    errors.push('Bài luyện tập phải có ít nhất một nhóm câu hỏi')
  } else {
    groups.forEach((group, gi) => {
      errors.push(...validateHeadingSource(group, form.passage))
      const qs = group.questions || []
      const gLabel = group.type || `Nhóm ${gi + 1}`
      if (!qs.length) {
        errors.push(`Nhóm câu hỏi "${gLabel}" chưa có câu hỏi nào`)
        return
      }
      qs.forEach(q => {
        const { qNum, missing } = validateQuestionItem(q, group.type)
        if (missing.includes('answer')) missingAnswers.push(qNum)
        if (missing.includes('text')) missingTexts.push(qNum)
      })
    })
  }

  if (missingAnswers.length > 0) {
    errors.push(`Các câu hỏi chưa có đáp án đúng: Câu ${missingAnswers.join(', ')}`)
  }
  if (missingTexts.length > 0) {
    errors.push(`Các câu hỏi chưa có nội dung câu hỏi/phát biểu: Câu ${missingTexts.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    missingAnswers,
    missingTexts,
  }
}

/**
 * Validates Listening Practice form
 */
export function validatePracticeListening(form, { isForAI = false } = {}) {
  const errors = []
  const missingAnswers = []
  const missingTexts = []

  if (!String(form.title ?? '').trim()) {
    errors.push('Chưa nhập tên bài nghe')
  }

  if (!form.audioUrl && !form.audioFile) {
    errors.push('Chưa có file âm thanh (Audio) cho bài nghe')
  }

  if (isForAI && !String(form.transcript ?? '').trim() && !String(form.context ?? '').trim()) {
    errors.push('Bài nghe chưa có transcript. Vui lòng bấm "Phiên âm audio" hoặc nhập transcript để AI có ngữ cảnh giải thích.')
  }

  const groups = form.questionGroups || []
  if (!groups.length) {
    errors.push('Bài luyện tập phải có ít nhất một nhóm câu hỏi')
  } else {
    groups.forEach((group, gi) => {
      const qs = group.questions || []
      const gLabel = group.type || `Nhóm ${gi + 1}`
      if (!qs.length) {
        errors.push(`Nhóm câu hỏi "${gLabel}" chưa có câu hỏi nào`)
        return
      }
      qs.forEach(q => {
        const { qNum, missing } = validateQuestionItem(q, group.type)
        if (missing.includes('answer')) missingAnswers.push(qNum)
        if (missing.includes('text')) missingTexts.push(qNum)
      })
    })
  }

  if (missingAnswers.length > 0) {
    errors.push(`Các câu hỏi chưa có đáp án đúng: Câu ${missingAnswers.join(', ')}`)
  }
  if (missingTexts.length > 0) {
    errors.push(`Các câu hỏi chưa có nội dung câu hỏi: Câu ${missingTexts.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    missingAnswers,
    missingTexts,
  }
}

/**
 * Validates Reading Exam (Cambridge / Full Test) form
 */
export function validateExamReading(form, { isForAI = false } = {}) {
  const errors = []
  const missingAnswers = []
  const missingTexts = []

  if (!String(form.title ?? '').trim()) {
    errors.push('Chưa nhập tên đề thi')
  }

  const passages = form.passages || []
  if (!passages.length) {
    errors.push('Đề thi phải có ít nhất một đoạn văn (Passage)')
  } else {
    passages.forEach((p, pi) => {
      const pNum = p.number || (pi + 1)
      if (!String(p.title ?? '').trim() || !String(p.body ?? '').trim()) {
        errors.push(`Passage ${pNum}: chưa có tiêu đề hoặc nội dung bài đọc`)
      }
      const groups = p.questionGroups || []
      groups.forEach((group, gi) => {
        errors.push(...validateHeadingSource(group, p.body))
        const qs = group.questions || []
        const gLabel = group.type || `Nhóm ${gi + 1}`
        if (!qs.length) {
          errors.push(`Passage ${pNum}: nhóm "${gLabel}" chưa có câu hỏi nào`)
          return
        }
        qs.forEach(q => {
          const { qNum, missing } = validateQuestionItem(q, group.type)
          if (missing.includes('answer')) missingAnswers.push(qNum)
          if (missing.includes('text')) missingTexts.push(qNum)
        })
      })
    })
  }

  const totalQuestions = passages.reduce((acc, p) => acc + (p.questionGroups || []).reduce((qAcc, g) => qAcc + (g.questions || []).length, 0), 0)
  if (isForAI && totalQuestions === 0) {
    errors.push('Đề thi chưa có câu hỏi nào để tạo giải thích AI')
  }

  if (missingAnswers.length > 0) {
    errors.push(`Các câu hỏi chưa có đáp án đúng: Câu ${missingAnswers.join(', ')}`)
  }
  if (missingTexts.length > 0) {
    errors.push(`Các câu hỏi chưa có nội dung câu hỏi/phát biểu: Câu ${missingTexts.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    missingAnswers,
    missingTexts,
  }
}

/**
 * Validates Listening Exam (Cambridge / Full Test) form
 */
export function validateExamListening(form, { isForAI = false } = {}) {
  const errors = []
  const missingAnswers = []
  const missingTexts = []

  if (!String(form.title ?? '').trim()) {
    errors.push('Chưa nhập tên đề thi')
  }

  const sections = form.sections || []
  if (!sections.length) {
    errors.push('Đề thi phải có ít nhất một phần thi (Section)')
  } else {
    sections.forEach((s, si) => {
      const sNum = s.number || (si + 1)
      if (s.questionGroups?.length > 0 && !(s.audioUrl || '').trim() && !s.audioFile) {
        errors.push(`Section ${sNum}: có nhóm câu hỏi nhưng chưa có file audio`)
      }
      if (isForAI && !String(s.transcript ?? '').trim() && !String(s.context ?? '').trim()) {
        errors.push(`Section ${sNum}: chưa có transcript bài nghe để AI phân tích giải thích`)
      }
      const groups = s.questionGroups || []
      groups.forEach((group, gi) => {
        const qs = group.questions || []
        const gLabel = group.type || `Nhóm ${gi + 1}`
        if (!qs.length) {
          errors.push(`Section ${sNum}: nhóm "${gLabel}" chưa có câu hỏi nào`)
          return
        }
        qs.forEach(q => {
          const { qNum, missing } = validateQuestionItem(q, group.type)
          if (missing.includes('answer')) missingAnswers.push(qNum)
          if (missing.includes('text')) missingTexts.push(qNum)
        })
      })
    })
  }

  const totalQuestions = sections.reduce((acc, s) => acc + (s.questionGroups || []).reduce((qAcc, g) => qAcc + (g.questions || []).length, 0), 0)
  if (isForAI && totalQuestions === 0) {
    errors.push('Đề thi chưa có câu hỏi nào để tạo giải thích AI')
  }

  if (missingAnswers.length > 0) {
    errors.push(`Các câu hỏi chưa có đáp án đúng: Câu ${missingAnswers.join(', ')}`)
  }
  if (missingTexts.length > 0) {
    errors.push(`Các câu hỏi chưa có nội dung câu hỏi: Câu ${missingTexts.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    missingAnswers,
    missingTexts,
  }
}
