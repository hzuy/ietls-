import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  setting: { findUnique: vi.fn() },
  attempt: { count: vi.fn(), create: vi.fn() },
  listeningSection: { findMany: vi.fn() },
  questionAnswer: { createMany: vi.fn() },
  answerLog: { createMany: vi.fn() },
  $transaction: vi.fn(),
}

prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

describe('Listening Submission Routes', () => {
  const getTestToken = (userId = 1) =>
    jwt.sign({ userId, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

  describe('POST /api/listening/exams/:id/submit', () => {
    it('submits exam successfully, calculates correct band score, saves attempt and creates AnswerLog with skillType=listening', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.listeningSection.findMany.mockResolvedValue([
        {
          id: 1,
          questions: [
            { id: 201, number: 1, type: 'fill_blank', questionText: 'L1', correctAnswer: 'london', groupId: null },
          ],
          questionGroups: [],
        },
      ])
      prismaMock.attempt.create.mockResolvedValue({ id: 88 })
      prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
      prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

      const res = await request(app)
        .post('/api/listening/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken(10)}`)
        .send({ answers: { '201': 'London' } })

      expect(res.status).toBe(200)
      expect(res.body.correct).toBe(1)
      expect(res.body.score).toBe(0) // 1 correct is 0 band in Listening
      expect(res.body.attemptId).toBe(88)

      // Verify AnswerLog creation
      expect(prismaMock.answerLog.createMany).toHaveBeenCalledTimes(1)
      const logs = prismaMock.answerLog.createMany.mock.calls[0][0].data
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        userId: 10,
        attemptId: 88,
        questionId: 201,
        skillType: 'listening',
        questionType: 'fill_blank',
        isCorrect: true,
        userAnswer: 'London',
        correctAnswer: 'london',
      })
    })

    it('handles unanswered question safely (blank input) without crashing and saves empty string in AnswerLog', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.listeningSection.findMany.mockResolvedValue([
        {
          id: 1,
          questions: [
            { id: 202, number: 2, type: 'mcq', questionText: 'L2', correctAnswer: 'A', groupId: null },
          ],
          questionGroups: [],
        },
      ])
      prismaMock.attempt.create.mockResolvedValue({ id: 89 })
      prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
      prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

      // Blank submission for question 202
      const res = await request(app)
        .post('/api/listening/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken(10)}`)
        .send({ answers: {} })

      expect(res.status).toBe(200)
      expect(res.body.correct).toBe(0)
      expect(res.body.attemptId).toBe(89)

      const logs = prismaMock.answerLog.createMany.mock.calls[0][0].data
      expect(logs[0]).toMatchObject({
        userId: 10,
        attemptId: 89,
        questionId: 202,
        skillType: 'listening',
        questionType: 'mcq',
        isCorrect: false,
        userAnswer: '',
        correctAnswer: 'A',
      })
    })

    it('returns 400 when answers is not an object', async () => {
      const res = await request(app)
        .post('/api/listening/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: null })

      expect(res.status).toBe(400)
      expect(res.body.errors[0].field).toBe('answers')
    })
  })
})
