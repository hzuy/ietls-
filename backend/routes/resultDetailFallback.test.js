import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  attempt: { findFirst: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

describe('Result Detail Fallback on P2022 (Missing explanation column)', () => {
  const getTestToken = (userId = 1) =>
    jwt.sign({ userId, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
  })

  describe('GET /api/listening/exams/:id/result-detail', () => {
    it('returns 200 and falls back safely when Prisma throws P2022 (explanation column does not exist)', async () => {
      const p2022Error = new Error('The column Question.explanation does not exist in the current database.')
      p2022Error.code = 'P2022'

      const mockExamWithoutExplanation = {
        title: 'Cambridge 18 Test 1 Listening',
        seriesId: 1,
        bookNumber: 18,
        testNumber: 1,
        series: { name: 'Cambridge' },
        listeningSections: [
          {
            id: 1,
            number: 1,
            questions: [
              { id: 101, number: 1, type: 'fill_blank', questionText: 'Q1', correctAnswer: 'london' }
            ],
            questionGroups: []
          }
        ]
      }

      // First call fails with P2022 (with explanation: true), second call succeeds (without explanation)
      prismaMock.exam.findUnique
        .mockRejectedValueOnce(p2022Error)
        .mockResolvedValueOnce(mockExamWithoutExplanation)

      prismaMock.attempt.findFirst.mockResolvedValue({
        id: 370,
        score: 6.5,
        questionAnswers: [
          { questionId: 101, userAnswer: 'london', isCorrect: true }
        ]
      })

      const res = await request(app)
        .get('/api/listening/exams/17/result-detail?attemptId=370')
        .set('Authorization', `Bearer ${getTestToken(1)}`)

      expect(res.status).toBe(200)
      expect(res.body.bookName).toBe('Cambridge')
      expect(res.body.testNumber).toBe(1)
      expect(res.body.bandScore).toBe(6.5)
      expect(res.body.correct).toBe(1)
      expect(res.body.wrong).toBe(0)
      expect(res.body.missed).toBe(0)
      expect(res.body.sections).toHaveLength(1)
      expect(res.body.sections[0].questions[0].explanation).toBeNull()
      expect(prismaMock.exam.findUnique).toHaveBeenCalledTimes(2)
    })
  })

  describe('GET /api/reading/exams/:id/result-detail', () => {
    it('returns 200 and falls back safely when Prisma throws P2022 on reading exam', async () => {
      const p2022Error = new Error('The column Question.explanation does not exist in the current database.')
      p2022Error.code = 'P2022'

      const mockExamWithoutExplanation = {
        title: 'Cambridge 18 Test 1 Reading',
        seriesId: 1,
        bookNumber: 18,
        testNumber: 1,
        series: { name: 'Cambridge' },
        passages: [
          {
            id: 1,
            number: 1,
            questions: [
              { id: 201, number: 1, type: 'true_false_ng', questionText: 'Q1', correctAnswer: 'TRUE' }
            ],
            questionGroups: []
          }
        ]
      }

      prismaMock.exam.findUnique
        .mockRejectedValueOnce(p2022Error)
        .mockResolvedValueOnce(mockExamWithoutExplanation)

      prismaMock.attempt.findFirst.mockResolvedValue({
        id: 369,
        score: 7.0,
        questionAnswers: [
          { questionId: 201, userAnswer: 'FALSE', isCorrect: false }
        ]
      })

      const res = await request(app)
        .get('/api/reading/exams/13/result-detail?attemptId=369')
        .set('Authorization', `Bearer ${getTestToken(1)}`)

      expect(res.status).toBe(200)
      expect(res.body.bookName).toBe('Cambridge')
      expect(res.body.bandScore).toBe(7.0)
      expect(res.body.correct).toBe(0)
      expect(res.body.wrong).toBe(1)
      expect(res.body.missed).toBe(0)
      expect(res.body.sections).toHaveLength(1)
      expect(prismaMock.exam.findUnique).toHaveBeenCalledTimes(2)
    })
  })
})
