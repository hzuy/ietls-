import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

// Mock generate-explanations
const generateExpModulePath = require.resolve('../scripts/generate-explanations')
const originalGenerateExpModule = require(generateExpModulePath)
const generateExplanationMock = vi.fn()

require.cache[generateExpModulePath] = {
  id: generateExpModulePath,
  filename: generateExpModulePath,
  loaded: true,
  exports: {
    ...originalGenerateExpModule,
    generateExplanation: generateExplanationMock,
  },
}

const { generateForExam } = require('./explanationGeneratorService')

describe('Batch 3 - Group Level Generation and Concurrency (Requirements 3.4 & 3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters by groupId when provided to generateForExam', async () => {
    const dummyExam = { id: 10, title: 'Cambridge 19 Test 1', skill: 'reading' }
    prismaMock.exam.findUnique.mockResolvedValue(dummyExam)

    const groupQuestions = [
      {
        id: 101,
        number: 1,
        type: 'fill_blank',
        questionText: 'Question 1',
        correctAnswer: 'answer1',
        explanation: null,
        passage: { body: 'Sample passage text for group 1' },
      },
      {
        id: 102,
        number: 2,
        type: 'fill_blank',
        questionText: 'Question 2',
        correctAnswer: 'answer2',
        explanation: null,
        passage: { body: 'Sample passage text for group 1' },
      }
    ]

    prismaMock.question.findMany.mockResolvedValue(groupQuestions)
    generateExplanationMock
      .mockResolvedValueOnce({ answer: 'answer1', reasoning: 'Explanation 1' })
      .mockResolvedValueOnce({ answer: 'answer2', reasoning: 'Explanation 2' })

    const res = await generateForExam(10, { force: true, groupId: 55 })

    // Verify Prisma queried specifically with groupId: 55
    expect(prismaMock.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupId: 55,
        })
      })
    )

    expect(res.ok).toBe(true)
    expect(res.generatedCount).toBe(2)
    expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
  })

  it('throws error when specified groupId has no questions in exam', async () => {
    const dummyExam = { id: 10, title: 'Cambridge 19 Test 1', skill: 'reading' }
    prismaMock.exam.findUnique.mockResolvedValue(dummyExam)
    prismaMock.question.findMany.mockResolvedValue([])

    await expect(generateForExam(10, { groupId: 999 })).rejects.toThrow(
      'Nhóm câu hỏi #999 không có câu hỏi nào trong đề thi #10'
    )
  })

  it('re-uses conflict detection and partial save for group-level generation', async () => {
    const dummyExam = { id: 10, title: 'Cambridge 19 Test 1', skill: 'reading' }
    prismaMock.exam.findUnique.mockResolvedValue(dummyExam)

    const groupQuestions = [
      {
        id: 201,
        number: 5,
        type: 'mcq',
        questionText: 'Question 5',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        explanation: null,
        passage: { body: 'Sample passage' },
      }
    ]

    prismaMock.question.findMany.mockResolvedValue(groupQuestions)
    // AI predicts B instead of teacher's A
    generateExplanationMock.mockResolvedValueOnce({ answer: 'B', reasoning: 'AI thinks B' })

    const res = await generateForExam(10, { force: true, groupId: 77 })

    expect(res.ok).toBe(false)
    expect(res.hasConflicts).toBe(true)
    expect(res.conflicts).toHaveLength(1)
    expect(res.conflicts[0].number).toBe(5)
    expect(res.conflicts[0].aiAnswer).toBe('B')
    expect(res.conflicts[0].inputAnswer).toBe('A')

    // Partial save: question was still saved with conflict_pending!
    expect(prismaMock.question.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 201 },
        data: expect.objectContaining({
          explanation: expect.objectContaining({
            status: 'conflict_pending',
            aiAnswer: 'B'
          })
        })
      })
    )
  })
})
