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

module.exports = {
  isAnswerMatch,
  generateForPracticeExam,
}
