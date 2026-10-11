import { describe, it, expect } from 'vitest'

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} }
const { practiceGroupsWithExplanations, carryOverExplanations } = require('./practice')

const group = (start, answers) => ({
  type: 'true_false_ng',
  qNumberStart: start,
  questions: answers.map((a, i) => ({ number: start + i, correctAnswer: a })),
})
const row = (g, byNumber) => ({ content: JSON.stringify(g), explanation: byNumber ? { byNumber } : null })

describe('practice explanations', () => {
  it('attaches explanations by question number to each group', () => {
    const groups = practiceGroupsWithExplanations([row(group(1, ['TRUE']), { 1: { v: 2, answer: 'TRUE' } }), row(group(2, ['FALSE']))])
    expect(groups[0].explanations).toEqual({ 1: { v: 2, answer: 'TRUE' } })
    expect(groups[1].explanations).toBeUndefined()
  })

  it('keeps explanations when an admin saves without changing the answer', () => {
    const oldRows = [row(group(1, ['TRUE', 'FALSE']), { 1: { v: 2, answer: 'TRUE' }, 2: { v: 2, answer: 'FALSE' } })]
    const kept = carryOverExplanations(oldRows, [group(1, ['TRUE', 'NOT GIVEN'])])
    expect(kept).toEqual([{ byNumber: { 1: { v: 2, answer: 'TRUE' } } }])
  })

  it('handles string payloads and groups without explanations', () => {
    expect(carryOverExplanations([], [JSON.stringify(group(1, ['TRUE']))])).toEqual([null])
    expect(carryOverExplanations([row(group(1, ['TRUE']))], [group(1, ['TRUE'])])).toEqual([null])
  })
})
