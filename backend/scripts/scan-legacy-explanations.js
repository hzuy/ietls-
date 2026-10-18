'use strict'

/**
 * Script quét dữ liệu lời giải (chỉ đọc, không sửa hay xóa dữ liệu).
 * Chạy qua with-dev-db.js: node scripts/with-dev-db.js -- node scripts/scan-legacy-explanations.js
 */

const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')
const {
  INTERNAL_JARGON_PHRASES,
  normalizeJargonText,
  containsInternalJargon,
  isAnswerMatch,
} = require('../services/explanationGeneratorService')

function parseGroup(content) {
  if (!content) return null
  if (typeof content === 'object') return content
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function findJargonMatches(explanation) {
  if (!explanation || typeof explanation !== 'object') return []
  const matches = []

  // Collect text fields
  const checkText = (text, fieldName) => {
    if (!text || typeof text !== 'string') return
    const norm = normalizeJargonText(text)
    for (const phrase of INTERNAL_JARGON_PHRASES) {
      if (norm.includes(normalizeJargonText(phrase))) {
        matches.push({ field: fieldName, phrase, snippet: text.slice(0, 100) })
      }
    }
  }

  checkText(explanation.reasoning, 'reasoning')
  checkText(explanation.predict, 'predict')
  if (explanation.locate) {
    if (typeof explanation.locate === 'string') checkText(explanation.locate, 'locate')
    else if (explanation.locate.note) checkText(explanation.locate.note, 'locate.note')
  }
  checkText(explanation.translation, 'translation')
  checkText(explanation.full_sentence, 'full_sentence')

  if (Array.isArray(explanation.distractors)) {
    explanation.distractors.forEach((d, idx) => {
      if (typeof d === 'string') checkText(d, `distractors[${idx}]`)
      else if (d && d.reason) checkText(d.reason, `distractors[${idx}].reason`)
    })
  }

  if (Array.isArray(explanation.paraphrase)) {
    explanation.paraphrase.forEach((p, idx) => {
      if (typeof p === 'string') checkText(p, `paraphrase[${idx}]`)
      else if (p) {
        checkText(p.note || p.question_word || p.original, `paraphrase[${idx}]`)
      }
    })
  }

  if (explanation.evidence) {
    if (typeof explanation.evidence === 'string') checkText(explanation.evidence, 'evidence')
    else if (Array.isArray(explanation.evidence.parts)) {
      explanation.evidence.parts.forEach((part, idx) => {
        checkText(part.text, `evidence.parts[${idx}].text`)
      })
    }
  }

  return matches
}

async function runScan() {
  console.log('='.repeat(80))
  console.log('BÁO CÁO QUÉT DỮ LIỆU LỜI GIẢI (CHỈ ĐỌC — SCAN ONLY)')
  console.log('='.repeat(80))

  printDbBanner('SCAN')

  // 1. Quét Question (Exam)
  console.log('\n[1/2] Đang quét bảng Question (Exam Cambridge & Full Test)...')
  const examQuestions = await prisma.question.findMany({
    where: { explanation: { not: null } },
    select: {
      id: true,
      number: true,
      type: true,
      correctAnswer: true,
      options: true,
      explanation: true,
      passage: { select: { examId: true } },
      listeningSection: { select: { examId: true } },
      group: {
        select: {
          type: true,
          passage: { select: { examId: true } },
          section: { select: { examId: true } },
          matchingOptions: { select: { optionLetter: true, optionText: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  console.log(`=> Tìm thấy ${examQuestions.length} câu hỏi Exam có explanation.`)

  const examStatsByStatus = {}
  const examJargonItems = []
  const examMismatchItems = []

  for (const q of examQuestions) {
    let exp = q.explanation
    if (typeof exp === 'string') {
      try { exp = JSON.parse(exp) } catch { exp = {} }
    }
    if (!exp || typeof exp !== 'object') continue

    const status = exp.status || 'legacy_no_status'
    examStatsByStatus[status] = (examStatsByStatus[status] || 0) + 1

    const jargonMatches = findJargonMatches(exp)
    const hasJargon = jargonMatches.length > 0 || containsInternalJargon(exp)

    const inputAnswer = String(q.correctAnswer ?? '').trim()
    const expAnswer = String(exp.answer ?? '').trim()
    const rawOptions = q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null)
    const qType = q.type || q.group?.type
    const isMatch = isAnswerMatch(inputAnswer, expAnswer, rawOptions, qType)

    const examId = q.passage?.examId || q.listeningSection?.examId || q.group?.passage?.examId || q.group?.section?.examId

    if (hasJargon) {
      examJargonItems.push({
        id: q.id,
        examId,
        number: q.number,
        status,
        matches: jargonMatches,
        reasoningSnippet: String(exp.reasoning || '').slice(0, 120),
      })
    }

    if (!isMatch) {
      examMismatchItems.push({
        id: q.id,
        examId,
        number: q.number,
        status,
        correctAnswer: inputAnswer,
        explanationAnswer: expAnswer,
      })
    }
  }

  // 2. Quét PracticeQuestion
  console.log('\n[2/2] Đang quét bảng PracticeQuestion (Reading & Listening Practice)...')
  const practiceRows = await prisma.practiceQuestion.findMany({
    where: { explanation: { not: null } },
    select: {
      id: true,
      examId: true,
      content: true,
      explanation: true,
    },
    orderBy: { id: 'asc' },
  })

  let totalPracticeQuestionsWithExp = 0
  const practiceStatsByStatus = {}
  const practiceJargonItems = []
  const practiceMismatchItems = []

  for (const row of practiceRows) {
    const group = parseGroup(row.content)
    const byNumber = (row.explanation && typeof row.explanation === 'object' && row.explanation.byNumber) || {}

    for (const [qNumStr, exp] of Object.entries(byNumber)) {
      if (!exp || typeof exp !== 'object') continue
      totalPracticeQuestionsWithExp++

      const qNum = Number(qNumStr)
      const status = exp.status || 'legacy_no_status'
      practiceStatsByStatus[status] = (practiceStatsByStatus[status] || 0) + 1

      const jargonMatches = findJargonMatches(exp)
      const hasJargon = jargonMatches.length > 0 || containsInternalJargon(exp)

      let qItem = null
      if (group && Array.isArray(group.questions)) {
        qItem = group.questions.find((q) => Number(q.number) === qNum)
      }

      const inputAnswer = String(qItem?.correctAnswer ?? '').trim()
      const expAnswer = String(exp.answer ?? '').trim()
      const rawOptions = qItem?.options || (group?.matchingOptions?.length ? group.matchingOptions : null)
      const qType = group?.type || qItem?.type
      const isMatch = isAnswerMatch(inputAnswer, expAnswer, rawOptions, qType)

      if (hasJargon) {
        practiceJargonItems.push({
          practiceQuestionId: row.id,
          practiceExamId: row.examId,
          number: qNum,
          status,
          matches: jargonMatches,
          reasoningSnippet: String(exp.reasoning || '').slice(0, 120),
        })
      }

      if (!isMatch) {
        practiceMismatchItems.push({
          practiceQuestionId: row.id,
          practiceExamId: row.examId,
          number: qNum,
          status,
          correctAnswer: inputAnswer,
          explanationAnswer: expAnswer,
        })
      }
    }
  }

  console.log(`=> Tìm thấy ${totalPracticeQuestionsWithExp} câu hỏi Practice có explanation.`);

  // In kết quả tổng hợp
  console.log('\n' + '='.repeat(80))
  console.log('TỔNG HỢP KẾT QUẢ QUÉT:')
  console.log('='.repeat(80))

  console.log('\n--- 1. Phân bố status của lời giải ---')
  console.log('Exam Questions:')
  console.table(examStatsByStatus)
  console.log('Practice Questions:')
  console.table(practiceStatsByStatus)

  console.log('\n--- 2. Lời giải chứa cụm từ nội bộ (Internal Jargon) ---')
  console.log(`- Exam: ${examJargonItems.length} câu`)
  if (examJargonItems.length > 0) {
    console.table(
      examJargonItems.map(item => ({
        id: item.id,
        examId: item.examId,
        câu: item.number,
        status: item.status,
        cụm: item.matches.map(m => m.phrase).join(', '),
        trường: item.matches.map(m => m.field).join(', '),
      }))
    )
  }

  console.log(`- Practice: ${practiceJargonItems.length} câu`)
  if (practiceJargonItems.length > 0) {
    console.table(
      practiceJargonItems.map(item => ({
        rowId: item.practiceQuestionId,
        practiceExamId: item.practiceExamId,
        câu: item.number,
        status: item.status,
        cụm: item.matches.map(m => m.phrase).join(', '),
        trường: item.matches.map(m => m.field).join(', '),
      }))
    )
  }

  console.log('\n--- 3. Lời giải có đáp án KHÔNG khớp đáp án chuẩn của câu hỏi ---')
  console.log(`- Exam: ${examMismatchItems.length} câu`)
  if (examMismatchItems.length > 0) {
    console.table(
      examMismatchItems.map(item => ({
        id: item.id,
        examId: item.examId,
        câu: item.number,
        status: item.status,
        correctAnswer: item.correctAnswer,
        explanationAnswer: item.explanationAnswer,
      }))
    )
  }

  console.log(`- Practice: ${practiceMismatchItems.length} câu`)
  if (practiceMismatchItems.length > 0) {
    console.table(
      practiceMismatchItems.map(item => ({
        rowId: item.practiceQuestionId,
        practiceExamId: item.practiceExamId,
        câu: item.number,
        status: item.status,
        correctAnswer: item.correctAnswer,
        explanationAnswer: item.explanationAnswer,
      }))
    )
  }

  console.log('\n' + '='.repeat(80))
  console.log('HOÀN TẤT QUÉT DỮ LIỆU CŨ.')
  console.log('='.repeat(80))

  return {
    examQuestionsCount: examQuestions.length,
    practiceQuestionsCount: totalPracticeQuestionsWithExp,
    examStatsByStatus,
    practiceStatsByStatus,
    examJargonItems,
    practiceJargonItems,
    examMismatchItems,
    practiceMismatchItems,
  }
}

if (require.main === module) {
  runScan()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Lỗi khi chạy scan:', err)
      process.exit(1)
    })
}

module.exports = { runScan, findJargonMatches }
