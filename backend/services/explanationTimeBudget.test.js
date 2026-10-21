import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

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

const {
  generateForExam,
  generateForPracticeExam,
  regenerateQuestionExplanation,
} = require('./explanationGeneratorService')

describe('PHẦN 2: TIMEOUT THEO NGÂN SÁCH THỜI GIAN (40s Time Budget Loop)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateForExam with time budget', () => {
    it('saves completed questions and returns remainingQuestionNumbers when budget is exceeded', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 10, title: 'Exam 10', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 101,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
        {
          id: 102,
          number: 2,
          type: 'mcq',
          questionText: 'Q2',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
        {
          id: 103,
          number: 3,
          type: 'mcq',
          questionText: 'Q3',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'C',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
      ])

      // Simulate a small delay for Q1 so that timeBudgetMs = 1 is exceeded after Q1
      generateExplanationMock.mockImplementation(async (q) => {
        await new Promise((r) => setTimeout(r, 10))
        return {
          v: 2,
          answer: q.correctAnswer,
          reasoning: `Explanation for ${q.number}`,
        }
      })

      // Run with timeBudgetMs = 5ms -> Q1 completes, loop checks elapsed >= budget and breaks
      const res = await generateForExam(10, { force: true, timeBudgetMs: 5 })

      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(1)
      expect(res.remainingQuestionNumbers).toEqual([2, 3])
      expect(res.totalQuestions).toBe(3)

      // Q1 was saved in DB
      expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
          data: expect.objectContaining({
            correctAnswer: 'A',
            explanation: expect.objectContaining({ status: 'ai_generated' }),
          }),
        })
      )
    })

    it('processes remaining questions in second request when passing questionNumbers', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 10, title: 'Exam 10', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 101,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: { status: 'ai_generated' },
          passage: { body: 'Passage body text' },
        },
        {
          id: 102,
          number: 2,
          type: 'mcq',
          questionText: 'Q2',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
        {
          id: 103,
          number: 3,
          type: 'mcq',
          questionText: 'Q3',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'C',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
      ])

      generateExplanationMock.mockImplementation(async (q) => ({
        v: 2,
        answer: q.correctAnswer,
        reasoning: `Explanation for ${q.number}`,
      }))

      // Request only remaining questions [2, 3] with ample time budget
      const res = await generateForExam(10, { force: true, questionNumbers: [2, 3], timeBudgetMs: 40000 })

      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(2)
      expect(res.remainingQuestionNumbers).toEqual([])
      expect(res.totalQuestions).toBe(2)

      expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
    })

    it('isolates question errors: failure on one question does not cancel or discard others', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 10, title: 'Exam 10', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 101,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
        {
          id: 102,
          number: 2,
          type: 'mcq',
          questionText: 'Q2',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: null,
          passage: { body: 'Passage body text' },
        },
      ])

      generateExplanationMock.mockImplementation(async (q) => {
        if (q.number === 1) throw new Error('API Rate limit exceeded or timeout on Q1')
        return {
          v: 2,
          answer: q.correctAnswer,
          reasoning: 'OK',
        }
      })

      const res = await generateForExam(10, { force: true })

      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(1)
      expect(res.errors).toHaveLength(1)
      expect(res.errors[0].number).toBe(1)
      // Q2 was still saved
      expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 102 } })
      )
    })
  })

  describe('generateForPracticeExam with time budget', () => {
    it('saves completed questions and returns remainingQuestionNumbers when budget is exceeded', async () => {
      prismaMock.practiceExam.findUnique.mockResolvedValue({
        id: 20,
        skill: 'reading',
        passage: 'Sample passage text for practice',
        questions: [
          {
            id: 201,
            orderNum: 1,
            content: JSON.stringify({
              type: 'mcq',
              questions: [
                { number: 1, question: 'Q1', options: ['A', 'B'], correctAnswer: 'A' },
                { number: 2, question: 'Q2', options: ['A', 'B'], correctAnswer: 'B' },
              ],
            }),
            explanation: null,
          },
        ],
      })
      prismaMock.practiceQuestion.findUnique.mockResolvedValue({
        id: 201,
        content: JSON.stringify({
          type: 'mcq',
          questions: [
            { number: 1, question: 'Q1', options: ['A', 'B'], correctAnswer: 'A' },
            { number: 2, question: 'Q2', options: ['A', 'B'], correctAnswer: 'B' },
          ],
        }),
        explanation: null,
      })

      generateExplanationMock.mockImplementation(async (q) => {
        await new Promise((r) => setTimeout(r, 10))
        return {
          v: 2,
          answer: q.correctAnswer,
          reasoning: `Explanation for ${q.number}`,
        }
      })

      const res = await generateForPracticeExam(20, { force: true, timeBudgetMs: 5 })

      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(1)
      expect(res.remainingQuestionNumbers).toEqual([2])
      expect(res.totalQuestions).toBe(2)

      expect(prismaMock.practiceQuestion.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('regenerateQuestionExplanation hard timeout ceiling', () => {
    it('aborts with ETIMEDOUT when execution exceeds timeoutMs', async () => {
      prismaMock.practiceExam.findUnique.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 60))
        return {
          id: 30,
          skill: 'reading',
          questions: [
            {
              id: 301,
              orderNum: 1,
              content: JSON.stringify({
                type: 'mcq',
                questions: [{ number: 1, question: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }],
              }),
            },
          ],
        }
      })

      const timeoutPromise = regenerateQuestionExplanation({
        examId: 30,
        questionNumber: 1,
        isPractice: true,
        timeoutMs: 15,
      })

      await expect(timeoutPromise).rejects.toThrow(/Hết thời gian xử lý AI/)
      await expect(timeoutPromise).rejects.toHaveProperty('code', 'ETIMEDOUT')
      await expect(timeoutPromise).rejects.toHaveProperty('isTimeout', true)
    })
  })
})
