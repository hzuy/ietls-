import { getExplanationAttention } from './explanationPresentation'
import { activeRunFailure, redactRunTechnical } from './explanationRunReport'

/** Union saved quality issues and this visit's failures by question number. */
export function collectExplanationIssues({ sections = [], groups = [], report = null } = {}) {
  const questions = new Map(), saved = new Map()
  for (const group of [...groups, ...sections.flatMap(section => section.questionGroups || [])]) {
    for (const question of group.questions || []) {
      const number = Number(question.number)
      let explanation = question.explanation || group.explanations?.[number]
      if (typeof explanation === 'string') { try { explanation = JSON.parse(explanation) } catch { explanation = null } }
      saved.set(number, explanation)
      const attention = getExplanationAttention(explanation)
      if (number > 0 && attention) questions.set(number, { number, groupId: group.id ?? group._id, message: attention.reason })
    }
  }
  const current = row => activeRunFailure(saved.get(Number(row.number)), 'error', { ...row, failedAt: row.failedAt || report?.finishedAt })
  const rows = (report?.rows || []).filter(current)
  const needsRetry = (report?.needsRetry || []).filter(current)
  for (const row of [...needsRetry, ...rows]) {
    const number = Number(row.number)
    if (!Number.isInteger(number) || number <= 0) continue
    const previous = questions.get(number)
    questions.set(number, { ...previous, ...row, number, groupId: previous?.groupId ?? row.groupId,
      message: redactRunTechnical(row.message || previous?.message || 'Cần kiểm tra lời giải.') })
  }
  return { questions: [...questions.values()].sort((a, b) => a.number - b.number),
    general: rows.filter(row => !Number.isInteger(Number(row.number)) || Number(row.number) <= 0),
    report: report ? { ...report, rows, needsRetry } : null }
}
