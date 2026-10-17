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

  it('isolated stale check (3.4): changing spelling or options of question 1 does NOT affect question 2', () => {
    const oldGroup = {
      type: 'multiple_choice',
      qNumberStart: 1,
      questions: [
        { number: 1, questionText: 'What is color?', options: ['Red', 'Blue'], correctAnswer: 'A' },
        { number: 2, questionText: 'What is shape?', options: ['Circle', 'Square'], correctAnswer: 'B' },
      ],
    }
    const oldRows = [
      row(oldGroup, {
        1: { v: 2, answer: 'A', status: 'teacher_reviewed' },
        2: { v: 2, answer: 'B', status: 'teacher_reviewed' },
      }),
    ]

    // 1. Sửa chính tả câu 1: chỉ câu 1 bị possibly_stale, câu 2 giữ nguyên teacher_reviewed
    const typoGroup = {
      type: 'multiple_choice',
      qNumberStart: 1,
      questions: [
        { number: 1, questionText: 'What is colour?', options: ['Red', 'Blue'], correctAnswer: 'A' },
        { number: 2, questionText: 'What is shape?', options: ['Circle', 'Square'], correctAnswer: 'B' },
      ],
    }
    const resTypo = carryOverExplanations(oldRows, [typoGroup])
    expect(resTypo[0].byNumber[1].status).toBe('possibly_stale')
    expect(resTypo[0].byNumber[1].staleReason).toBe('Nội dung câu hỏi đã thay đổi')
    expect(resTypo[0].byNumber[2].status).toBe('teacher_reviewed')

    // 2. Sửa options câu 1: chỉ câu 1 bị possibly_stale, câu 2 giữ nguyên teacher_reviewed
    const optionsGroup = {
      type: 'multiple_choice',
      qNumberStart: 1,
      questions: [
        { number: 1, questionText: 'What is color?', options: ['Red', 'Green'], correctAnswer: 'A' },
        { number: 2, questionText: 'What is shape?', options: ['Circle', 'Square'], correctAnswer: 'B' },
      ],
    }
    const resOptions = carryOverExplanations(oldRows, [optionsGroup])
    expect(resOptions[0].byNumber[1].status).toBe('possibly_stale')
    expect(resOptions[0].byNumber[1].staleReason).toBe('Các lựa chọn đã thay đổi')
    expect(resOptions[0].byNumber[2].status).toBe('teacher_reviewed')

    // 3. Lưu đề mà không thay đổi gì: cả 2 câu giữ nguyên teacher_reviewed
    const resNoChange = carryOverExplanations(oldRows, [oldGroup])
    expect(resNoChange[0].byNumber[1].status).toBe('teacher_reviewed')
    expect(resNoChange[0].byNumber[2].status).toBe('teacher_reviewed')
  })

  it('planQuestionDiff for Cambridge exams (3.4): changing spelling or options of question 1 does NOT affect question 2', () => {
    const { planQuestionDiff } = require('./admin/exams/core')
    const existing = [
      { id: 101, number: 1, questionText: 'Who was first?', options: '["A","B"]', correctAnswer: 'A', explanation: { v: 2, status: 'teacher_reviewed' } },
      { id: 102, number: 2, questionText: 'Who was second?', options: '["C","D"]', correctAnswer: 'C', explanation: { v: 2, status: 'teacher_reviewed' } },
    ]

    // 1. Chỉ sửa câu 1
    const submitted1 = [
      { id: 101, number: 1, questionText: 'Who was 1st?', options: '["A","B"]', correctAnswer: 'A' },
      { id: 102, number: 2, questionText: 'Who was second?', options: '["C","D"]', correctAnswer: 'C' },
    ]
    const plan1 = planQuestionDiff(existing, submitted1, q => ({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }))
    expect(plan1.toUpdate).toHaveLength(2)
    // Câu 1 có patch explanation possibly_stale
    const u1 = plan1.toUpdate.find(u => u.id === 101)
    expect(u1.data.explanation.status).toBe('possibly_stale')
    expect(u1.data.explanation.staleReason).toBe('Nội dung câu hỏi đã thay đổi')
    // Câu 2 không có patch explanation (giữ nguyên trong DB)
    const u2 = plan1.toUpdate.find(u => u.id === 102)
    expect(u2.data.explanation).toBeUndefined()

    // 2. Không đổi gì cả
    const planNoChange = planQuestionDiff(existing, existing, q => ({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }))
    expect(planNoChange.toUpdate.every(u => u.data.explanation === undefined)).toBe(true)
  })

  it('handles string payloads and groups without explanations', () => {
    expect(carryOverExplanations([], [JSON.stringify(group(1, ['TRUE']))])).toEqual([null])
    expect(carryOverExplanations([row(group(1, ['TRUE']))], [group(1, ['TRUE'])])).toEqual([null])
  })
})
