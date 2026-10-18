import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn(), update: vi.fn() },
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

const generateExplanationsPath = require.resolve('../scripts/generate-explanations')
const originalGenerateExplanations = require(generateExplanationsPath)
const generateExplanationMock = vi.fn()

require.cache[generateExplanationsPath] = {
  id: generateExplanationsPath,
  filename: generateExplanationsPath,
  loaded: true,
  exports: {
    ...originalGenerateExplanations,
    generateExplanation: generateExplanationMock,
  },
}

const {
  generateForExam,
  generateForPracticeExam,
} = require('./explanationGeneratorService')
const { carryOverExplanations } = require('../routes/practice')

describe('B.5 Race Condition & Resilience Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Race condition fix: regenerate Q7 while generating entire exam', () => {
    it('Exam: does not overwrite question 7 if question 7 was updated after generation started', async () => {
      const q6 = { id: 60, number: 6, type: 'mcq', correctAnswer: 'A', passage: { body: 'text' } }
      const q7 = { id: 70, number: 7, type: 'mcq', correctAnswer: 'B', passage: { body: 'text' } }
      const q8 = { id: 80, number: 8, type: 'mcq', correctAnswer: 'C', passage: { body: 'text' } }

      prismaMock.exam.findUnique.mockResolvedValue({
        id: 1,
        skill: 'reading',
        passages: [{ id: 1, body: 'Passage body' }],
      })
      prismaMock.question.findMany.mockResolvedValue([q6, q7, q8])

      generateExplanationMock.mockImplementation(async (q) => ({
        v: 2,
        answer: q.correctAnswer,
        reasoning: `Reason for ${q.number}`,
      }))

      // Inside transaction: mock findUnique for each question
      // Question 7 has been updated concurrently with a newer updatedAt!
      const now = new Date()
      const futureDate = new Date(now.getTime() + 10000).toISOString() // 10s after generation started

      prismaMock.question.findUnique.mockImplementation(async ({ where }) => {
        if (where.id === 70) {
          return {
            id: 70,
            updatedAt: futureDate,
            explanation: {
              v: 2,
              answer: 'B',
              status: 'teacher_edited',
              reasoning: 'Gia tri moi do teacher sua rieng trong luc sinh',
              updatedAt: futureDate,
            },
          }
        }
        return {
          id: where.id,
          updatedAt: new Date(now.getTime() - 5000).toISOString(),
          explanation: null,
        }
      })

      prismaMock.question.update.mockResolvedValue({})

      const result = await generateForExam(1, { force: true })
      expect(result.ok).toBe(true)
      expect(result.generatedCount).toBe(3)

      // Verify updates called on tx.question: should update q6 and q8, but NOT q7!
      const updateCalls = prismaMock.question.update.mock.calls
      const updatedQuestionIds = updateCalls.map((call) => call[0].where.id)
      expect(updatedQuestionIds).toContain(60)
      expect(updatedQuestionIds).toContain(80)
      expect(updatedQuestionIds).not.toContain(70)
    })

    it('Practice: does not overwrite question 7 if question 7 was updated during batch generation', async () => {
      const rowId = 500
      const now = new Date()
      const futureDate = new Date(now.getTime() + 10000).toISOString()

      const initialGroup = {
        type: 'mcq',
        questions: [
          { number: 6, correctAnswer: 'A' },
          { number: 7, correctAnswer: 'B' },
          { number: 8, correctAnswer: 'C' },
        ],
      }

      prismaMock.practiceExam.findUnique.mockResolvedValue({
        id: 10,
        skill: 'reading',
        passage: 'Passage text',
        questions: [
          {
            id: rowId,
            content: JSON.stringify(initialGroup),
            explanation: { byNumber: {} },
          },
        ],
      })

      generateExplanationMock.mockImplementation(async (qCtx) => ({
        v: 2,
        answer: qCtx.correctAnswer,
        reasoning: `AI reason for ${qCtx.number}`,
      }))

      // Inside transaction: mock findUnique returning row where question 7 was updated concurrently
      prismaMock.practiceQuestion.findUnique.mockResolvedValue({
        id: rowId,
        content: JSON.stringify(initialGroup),
        explanation: {
          byNumber: {
            7: {
              v: 2,
              answer: 'B',
              status: 'teacher_reviewed',
              reasoning: 'Teacher reviewed concurrently',
              updatedAt: futureDate,
            },
          },
        },
      })

      prismaMock.practiceQuestion.update.mockResolvedValue({})

      const result = await generateForPracticeExam(10, { force: true })
      expect(result.ok).toBe(true)

      const updateCall = prismaMock.practiceQuestion.update.mock.calls[0][0]
      const savedByNumber = updateCall.data.explanation.byNumber

      // Q6 and Q8 should have new AI explanations
      expect(savedByNumber[6]).toBeDefined()
      expect(savedByNumber[6].reasoning).toBe('AI reason for 6')
      expect(savedByNumber[8]).toBeDefined()
      expect(savedByNumber[8].reasoning).toBe('AI reason for 8')

      // Q7 should KEEP the concurrently updated explanation!
      expect(savedByNumber[7].reasoning).toBe('Teacher reviewed concurrently')
      expect(savedByNumber[7].status).toBe('teacher_reviewed')
    })
  })

  describe('Resilience (a): Single question error does not fail entire request and saves completed questions', () => {
    it('saves completed questions and reports error for failed question in Exam', async () => {
      const q1 = { id: 11, number: 1, type: 'mcq', correctAnswer: 'A', passage: { body: 'text' } }
      const q2 = { id: 12, number: 2, type: 'mcq', correctAnswer: 'B', passage: { body: 'text' } }
      const q3 = { id: 13, number: 3, type: 'mcq', correctAnswer: 'C', passage: { body: 'text' } }

      prismaMock.exam.findUnique.mockResolvedValue({
        id: 2,
        skill: 'reading',
        passages: [{ id: 1, body: 'Passage body' }],
      })
      prismaMock.question.findMany.mockResolvedValue([q1, q2, q3])

      generateExplanationMock.mockImplementation(async (q) => {
        if (q.number === 2) {
          throw new Error('EVIDENCE_NOT_FOUND: Trích dẫn không khớp')
        }
        return {
          v: 2,
          answer: q.correctAnswer,
          reasoning: `Reason for ${q.number}`,
        }
      })

      prismaMock.question.findUnique.mockImplementation(async ({ where }) => ({
        id: where.id,
        explanation: null,
      }))
      prismaMock.question.update.mockResolvedValue({})

      const result = await generateForExam(2, { force: true })

      expect(result.ok).toBe(true)
      expect(result.generatedCount).toBe(2)
      expect(result.errors).toBeDefined()
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].number).toBe(2)
      expect(result.errors[0].message).toContain('EVIDENCE_NOT_FOUND')

      // Questions 1 and 3 should be saved in DB
      const updateCalls = prismaMock.question.update.mock.calls
      const updatedIds = updateCalls.map((c) => c[0].where.id)
      expect(updatedIds).toEqual([11, 13])
    })

    it('saves completed questions and reports error for failed question in Practice', async () => {
      const rowId = 600
      const group = {
        type: 'mcq',
        questions: [
          { number: 1, correctAnswer: 'A' },
          { number: 2, correctAnswer: 'B' },
        ],
      }

      prismaMock.practiceExam.findUnique.mockResolvedValue({
        id: 20,
        skill: 'reading',
        passage: 'Passage text',
        questions: [{ id: rowId, content: JSON.stringify(group), explanation: null }],
      })

      generateExplanationMock.mockImplementation(async (qCtx) => {
        if (qCtx.number === 2) {
          throw new Error('Rate limit exceeded')
        }
        return {
          v: 2,
          answer: qCtx.correctAnswer,
          reasoning: 'Reason for 1',
        }
      })

      prismaMock.practiceQuestion.findUnique.mockResolvedValue({
        id: rowId,
        content: JSON.stringify(group),
        explanation: null,
      })
      prismaMock.practiceQuestion.update.mockResolvedValue({})

      const result = await generateForPracticeExam(20, { force: true })

      expect(result.ok).toBe(true)
      expect(result.generatedCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].number).toBe(2)

      // Q1 saved in DB
      const updateCall = prismaMock.practiceQuestion.update.mock.calls[0][0]
      expect(updateCall.data.explanation.byNumber[1]).toBeDefined()
      expect(updateCall.data.explanation.byNumber[2]).toBeUndefined()
    })
  })

  describe('Practice Save Exam (b): carryOverExplanations retains existing explanations on recreate', () => {
    it('retains explanations when saving practice exam with unchanged question content', () => {
      const oldRows = [
        {
          content: JSON.stringify({
            questions: [
              { number: 1, questionText: 'Q1', correctAnswer: 'A', options: ['A', 'B'] },
              { number: 2, questionText: 'Q2', correctAnswer: 'B', options: ['A', 'B'] },
            ],
          }),
          explanation: {
            byNumber: {
              1: { v: 2, status: 'ai_generated', reasoning: 'Exp 1' },
              2: { v: 2, status: 'teacher_reviewed', reasoning: 'Exp 2' },
            },
          },
        },
      ]

      const newGroups = [
        {
          questions: [
            { number: 1, questionText: 'Q1', correctAnswer: 'A', options: ['A', 'B'] },
            { number: 2, questionText: 'Q2', correctAnswer: 'B', options: ['A', 'B'] },
          ],
        },
      ]

      const kept = carryOverExplanations(oldRows, newGroups)
      expect(kept).toHaveLength(1)
      expect(kept[0].byNumber[1]).toEqual({ v: 2, status: 'ai_generated', reasoning: 'Exp 1' })
      expect(kept[0].byNumber[2]).toEqual({ v: 2, status: 'teacher_reviewed', reasoning: 'Exp 2' })
    })

    it('marks explanation as possibly_stale rather than dropping it if answer or text changes', () => {
      const oldRows = [
        {
          content: JSON.stringify({
            questions: [
              { number: 1, questionText: 'Old text', correctAnswer: 'A' },
            ],
          }),
          explanation: {
            byNumber: {
              1: { v: 2, status: 'ai_generated', reasoning: 'Exp 1' },
            },
          },
        },
      ]

      const newGroups = [
        {
          questions: [
            { number: 1, questionText: 'New text', correctAnswer: 'A' },
          ],
        },
      ]

      const kept = carryOverExplanations(oldRows, newGroups)
      expect(kept[0].byNumber[1].status).toBe('possibly_stale')
      expect(kept[0].byNumber[1].staleReason).toBe('Nội dung câu hỏi đã thay đổi')
      expect(kept[0].byNumber[1].reasoning).toBe('Exp 1')
    })
  })
})
