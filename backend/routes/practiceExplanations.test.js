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
  it('attaches explanations by question number to each group for admin', () => {
    const groups = practiceGroupsWithExplanations(
      [
        row(group(1, ['TRUE', 'FALSE', 'NOT GIVEN']), {
          1: { v: 2, answer: 'TRUE', status: 'ai_generated' },
          2: { v: 2, answer: 'FALSE', status: 'conflict_pending' },
          3: { v: 2, answer: 'NOT GIVEN' }, // legacy without status
        }),
      ],
      { forAdmin: true }
    )
    expect(groups[0].explanations).toEqual({
      1: { v: 2, answer: 'TRUE', status: 'ai_generated' },
      2: { v: 2, answer: 'FALSE', status: 'conflict_pending' },
      3: { v: 2, answer: 'NOT GIVEN' },
    })
  })

  it('filters out conflict_pending and possibly_stale for learners (3.1 & 3.2)', () => {
    const groups = practiceGroupsWithExplanations(
      [
        row(group(1, ['TRUE', 'FALSE', 'NOT GIVEN', 'TRUE']), {
          1: { v: 2, answer: 'TRUE', status: 'ai_generated' },
          2: { v: 2, answer: 'FALSE', status: 'conflict_pending' },
          3: { v: 2, answer: 'NOT GIVEN' }, // legacy: should show
          4: { v: 2, answer: 'TRUE', status: 'possibly_stale' }, // stale: should hide
        }),
      ],
      { forAdmin: false }
    )
    expect(groups[0].explanations).toEqual({
      1: { v: 2, answer: 'TRUE', status: 'ai_generated' },
      3: { v: 2, answer: 'NOT GIVEN' },
    })
  })

  it('preserves explanations when admin edits exam, marking changed answers as possibly_stale (3.8)', () => {
    const oldRows = [row(group(1, ['TRUE', 'FALSE']), { 1: { v: 2, answer: 'TRUE' }, 2: { v: 2, answer: 'FALSE' } })]
    const kept = carryOverExplanations(oldRows, [group(1, ['TRUE', 'NOT GIVEN'])])
    expect(kept[0].byNumber[1]).toEqual({ v: 2, answer: 'TRUE' })
    expect(kept[0].byNumber[2]).toMatchObject({
      v: 2,
      answer: 'FALSE',
      status: 'possibly_stale',
      staleReason: 'Đáp án đã thay đổi',
    })
    expect(kept[0].byNumber[2].staleAt).toBeDefined()
  })

  it('handles string payloads and groups without explanations', () => {
    expect(carryOverExplanations([], [JSON.stringify(group(1, ['TRUE']))])).toEqual([null])
    expect(carryOverExplanations([row(group(1, ['TRUE']))], [group(1, ['TRUE'])])).toEqual([null])
  })
})
