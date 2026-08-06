import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  setting: { findUnique: vi.fn() },
  attempt: { count: vi.fn(), create: vi.fn() },
  passage: { findMany: vi.fn() },
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
  exports: prismaMock
}

const app = require('../server')

describe('Reading Submission Routes', () => {
  const getTestToken = () => jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

  describe('POST /api/reading/exams/:id/submit', () => {
    it('submits exam successfully, calculates correct band score, and saves attempt', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.passage.findMany.mockResolvedValue([
        {
          id: 1,
          questions: [
            { id: 101, questionText: 'Q1', correctAnswer: 'true', groupId: null }
          ],
          questionGroups: []
        }
      ])
      prismaMock.attempt.create.mockResolvedValue({ id: 99 })

      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: { "101": "TRUE" } })

      expect(res.status).toBe(200)
      expect(res.body.correct).toBe(1)
      expect(res.body.score).toBe(0) // 1 correct out of 40 is 0 band
      expect(res.body.attemptId).toBe(99)
    })

    it('returns 400 when answers is not an object', async () => {
      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: null })

      expect(res.status).toBe(400)
      expect(res.body.errors[0].field).toBe('answers')
    })
  })
})
