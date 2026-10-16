const prisma = require('../lib/prisma')
const {
  classifyFamily,
  buildContext,
  generateExplanation,
  normalizeText,
  SKIP_FAMILIES,
} = require('../scripts/generate-explanations')
const { practiceQuestionContext } = require('../scripts/import-practice-explanations')
const { invalidate } = require('../lib/swrCache')

function parseGroup(row) {
  try {
    return JSON.parse(row.content)
  } catch {
    return null
  }
}

/**
 * Compare two answer strings for equivalence (case-insensitive, trimmed, normalized quotes/spaces).
 */
function isAnswerMatch(a, b) {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (normA === normB) return true
  // Also check if one contains the other or matches slash alternatives (e.g. "center/centre")
  const partsA = normA.split(/[/|]/).map(s => s.trim())
  const partsB = normB.split(/[/|]/).map(s => s.trim())
  return partsA.some(pa => partsB.includes(pa))
}

/**
 * Generate explanations for a PracticeExam (Reading or Listening).
 *
 * @param {number} examId - PracticeExam ID
 * @param {object} options
 * @param {boolean} options.force - If true, regenerate even if explanation exists
 * @param {object} options.resolveChoices - Map of { [questionNumber]: 'ai' | 'input' }
 */
async function generateForPracticeExam(examId, { force = false, resolveChoices = {} } = {}) {
  const exam = await prisma.practiceExam.findUnique({
    where: { id: examId },
    include: { questions: { orderBy: { orderNum: 'asc' } } },
  })

  if (!exam) throw new Error(`Không tìm thấy bài luyện tập #${examId}`)

  // Kiểm tra đề bài (reading: passage, listening: transcript / passage)
  if (exam.skill === 'reading' && !String(exam.passage || '').trim()) {
    throw new Error('Bài đọc chưa có nội dung đề bài (Passage). Vui lòng cập nhật đề bài trước khi tạo giải thích bằng AI.')
  }
  if (exam.skill === 'listening' && !String(exam.transcript || '').trim() && !String(exam.passage || '').trim()) {
    throw new Error('Bài nghe chưa có transcript hoặc nội dung bài nghe. Vui lòng cập nhật transcript trước khi tạo giải thích bằng AI.')
  }

  // Quét trước để bắt buộc mọi câu hỏi phải có đáp án đúng
  const missingAnswerQuestions = []
  for (const row of exam.questions) {
    const group = parseGroup(row)
    if (!group || !Array.isArray(group.questions)) continue
    for (const qItem of group.questions) {
      const qNum = Number(qItem.number)
      if (!qNum) continue
      const ans = String(qItem.correctAnswer ?? '').trim()
      if (!ans) {
        missingAnswerQuestions.push(qNum)
      }
    }
  }

  if (missingAnswerQuestions.length > 0) {
    throw new Error(`Không thể tạo giải thích AI do các câu sau chưa có đáp án đúng: Câu ${missingAnswerQuestions.join(', ')}. Vui lòng điền đầy đủ đáp án đúng trước.`)
  }

  const conflicts = []
  const updatesByRow = new Map() // rowId -> { byNumber: {}, groupContent: modifiedGroup }
  let generatedCount = 0

  for (const row of exam.questions) {
    const group = parseGroup(row)
    if (!group || !Array.isArray(group.questions)) continue

    const currentExplanations = { ...(row.explanation?.byNumber || {}) }
    let groupModified = false

    for (const qItem of group.questions) {
      const qNum = Number(qItem.number)
      if (!qNum) continue

      // Skip if already has explanation and not force/resolving
      if (currentExplanations[qNum] && !force && !resolveChoices[qNum]) {
        continue
      }

      const qCtx = practiceQuestionContext(exam, group, qNum)
      if (!qCtx) continue

      const family = classifyFamily(qCtx.type)
      if (SKIP_FAMILIES.has(family)) continue

      const ctx = buildContext(qCtx, family)
      const explanation = await generateExplanation(qCtx, family, ctx)
      if (!explanation) continue

      generatedCount++

      const inputAnswer = String(qCtx.correctAnswer || '').trim()
      const aiAnswer = String(explanation.answer || '').trim()
      const match = isAnswerMatch(inputAnswer, aiAnswer)

      const choice = resolveChoices[qNum]

      if (!match && !choice) {
        // Record conflict
        conflicts.push({
          number: qNum,
          type: qCtx.type,
          questionText: qCtx.questionText,
          inputAnswer,
          aiAnswer,
          evidence: explanation.evidence?.parts?.[0]?.text || '',
          reasoning: explanation.reasoning,
          explanation,
        })
      } else {
        // Resolve or match
        if (choice === 'ai') {
          // Adopt AI answer into question
          qItem.correctAnswer = aiAnswer
          groupModified = true
          explanation.answer = aiAnswer
        } else if (choice === 'input') {
          explanation.answer = inputAnswer
        }

        currentExplanations[qNum] = explanation
      }
    }

    updatesByRow.set(row.id, {
      byNumber: currentExplanations,
      groupContent: groupModified ? JSON.stringify(group) : null,
    })
  }

  // If there are unresolved conflicts and no explicit resolveChoices, pause and return conflicts for confirmation
  if (conflicts.length > 0 && Object.keys(resolveChoices).length === 0) {
    return {
      ok: false,
      hasConflicts: true,
      conflicts,
      generatedCount,
      message: `Đã quét và phát hiện ${conflicts.length} câu có đáp án lệch so với bài đọc. Vui lòng duyệt trước khi lưu.`,
    }
  }

  // Save updates to database
  await prisma.$transaction(async (tx) => {
    for (const [rowId, { byNumber, groupContent }] of updatesByRow) {
      const data = { explanation: { byNumber } }
      if (groupContent) data.content = groupContent
      await tx.practiceQuestion.update({
        where: { id: rowId },
        data,
      })
    }
  })

  invalidate('practice:')

  return {
    ok: true,
    hasConflicts: false,
    generatedCount,
    message: `Đã tạo giải thích 4 bước thành công cho ${generatedCount} câu hỏi!`,
  }
}

/**
 * Generate explanations for an Exam (Reading or Listening Cambridge / Full Test Exam).
 *
 * @param {number} examId - Exam ID
 * @param {object} options
 * @param {boolean} options.force - If true, regenerate even if explanation exists
 * @param {object} options.resolveChoices - Map of { [questionNumber]: 'ai' | 'input' }
 */
async function generateForExam(examId, { force = false, resolveChoices = {} } = {}) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, skill: true },
  })

  if (!exam) throw new Error(`Không tìm thấy đề thi #${examId}`)

  const questions = await prisma.question.findMany({
    where: {
      OR: [
        { passage: { examId } },
        { listeningSection: { examId } },
        { group: { passage: { examId } } },
        { group: { section: { examId } } },
      ],
    },
    select: {
      id: true,
      number: true,
      type: true,
      questionText: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      passage: { select: { body: true } },
      listeningSection: { select: { transcript: true, context: true } },
      group: {
        select: {
          type: true,
          passage: { select: { body: true } },
          section: { select: { transcript: true, context: true } },
          matchingOptions: { select: { optionLetter: true, optionText: true }, orderBy: { sortOrder: 'asc' } },
          noteSections: {
            select: { lines: { select: { contentWithTokens: true }, orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { number: 'asc' },
  })

  const conflicts = []
  const updates = []
  let generatedCount = 0

  if (!questions.length) throw new Error(`Đề thi #${examId} chưa có câu hỏi nào`)

  // Pre-validate that all questions have correctAnswer
  const missingAnswerQuestions = []
  for (const q of questions) {
    const ans = String(q.correctAnswer ?? '').trim()
    if (!ans) {
      missingAnswerQuestions.push(q.number)
    }
  }

  if (missingAnswerQuestions.length > 0) {
    throw new Error(`Không thể tạo giải thích AI do các câu sau chưa có đáp án đúng: Câu ${missingAnswerQuestions.join(', ')}. Vui lòng điền đầy đủ đáp án đúng trước.`)
  }

  // Pre-validate that passage/transcript content exists for questions needing generation
  for (const q of questions) {
    if (q.explanation && !force && !resolveChoices[q.number]) {
      continue
    }
    const passage = q.passage || q.group?.passage
    const section = q.listeningSection || q.group?.section
    const content = passage?.body || section?.transcript || section?.context
    if (!content || !content.trim()) {
      const label = exam.skill === 'listening' ? 'transcript' : 'nội dung bài đọc (Passage)'
      throw new Error(`Đề thi chưa có ${label} cho câu ${q.number}. Vui lòng nhập đầy đủ nội dung trước khi tạo giải thích AI.`)
    }
  }

  for (const q of questions) {
    if (q.explanation && !force && !resolveChoices[q.number]) {
      continue
    }

    const family = classifyFamily(q.type)
    if (SKIP_FAMILIES.has(family)) continue

    const ctx = buildContext(q, family)
    const explanation = await generateExplanation(q, family, ctx)
    if (!explanation) continue

    generatedCount++

    const inputAnswer = String(q.correctAnswer || '').trim()
    const aiAnswer = String(explanation.answer || '').trim()
    const match = isAnswerMatch(inputAnswer, aiAnswer)
    const choice = resolveChoices[q.number]

    if (!match && !choice) {
      conflicts.push({
        number: q.number,
        type: q.type,
        questionText: q.questionText,
        inputAnswer,
        aiAnswer,
        evidence: explanation.evidence?.parts?.[0]?.text || '',
        reasoning: explanation.reasoning,
        explanation,
      })
    } else {
      let finalCorrectAnswer = inputAnswer
      if (choice === 'ai') {
        finalCorrectAnswer = aiAnswer
        explanation.answer = aiAnswer
      } else if (choice === 'input') {
        explanation.answer = inputAnswer
      }

      updates.push({
        id: q.id,
        correctAnswer: finalCorrectAnswer,
        explanation,
      })
    }
  }

  if (conflicts.length > 0 && Object.keys(resolveChoices).length === 0) {
    return {
      ok: false,
      hasConflicts: true,
      conflicts,
      generatedCount,
      message: `Đã quét và phát hiện ${conflicts.length} câu có đáp án lệch so với bài đọc/nghe. Vui lòng duyệt trước khi lưu.`,
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of updates) {
      await tx.question.update({
        where: { id: item.id },
        data: {
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        },
      })
    }
  })

  invalidate('exams:')
  invalidate('reading:')
  invalidate('listening:')

  return {
    ok: true,
    hasConflicts: false,
    generatedCount,
    message: `Đã tạo giải thích 4 bước thành công cho ${generatedCount} câu hỏi!`,
  }
}

module.exports = {
  isAnswerMatch,
  generateForPracticeExam,
  generateForExam,
}
