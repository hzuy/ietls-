import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  setting: { findUnique: vi.fn() },
  attempt: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
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

    // ─── BUG-26: max_attempts_per_exam tests ──────────────────────────────
    it('allows submission when attempts count is below max_attempts_per_exam', async () => {
      prismaMock.setting.findUnique.mockResolvedValue({ key: 'max_attempts_per_exam', value: '3' })
      prismaMock.attempt.count.mockResolvedValue(2)
      prismaMock.passage.findMany.mockResolvedValue([
        {
          id: 1,
          questions: [{ id: 101, questionText: 'Q1', correctAnswer: 'true', groupId: null }],
          questionGroups: []
        }
      ])
      prismaMock.attempt.create.mockResolvedValue({ id: 100 })

      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: { "101": "true" } })

      expect(res.status).toBe(200)
      expect(res.body.attemptId).toBe(100)
    })

    it('blocks submission with 429 when user reaches max_attempts_per_exam', async () => {
      prismaMock.setting.findUnique.mockResolvedValue({ key: 'max_attempts_per_exam', value: '3' })
      prismaMock.attempt.count.mockResolvedValue(3)

      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: { "101": "true" } })

      expect(res.status).toBe(429)
      expect(res.body.message).toBe('Bạn đã đạt giới hạn 3 lượt thi cho đề này.')
      expect(prismaMock.attempt.create).not.toHaveBeenCalled()
    })

    // ─── TC-042: idempotent submit theo submissionKey ─────────────────────
    it('persists submissionKey on the created attempt (TC-042)', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.passage.findMany.mockResolvedValue([
        { id: 1, questions: [{ id: 101, questionText: 'Q1', correctAnswer: 'true', groupId: null }], questionGroups: [] }
      ])
      prismaMock.attempt.findUnique.mockResolvedValue(null)
      prismaMock.attempt.create.mockResolvedValue({ id: 101 })

      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: { '101': 'true' }, submissionKey: 'mount-abc' })

      expect(res.status).toBe(200)
      expect(prismaMock.attempt.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ submissionKey: 'mount-abc' }) })
      )
    })

    it('returns the existing attempt for a repeated submissionKey without creating a new row (TC-042)', async () => {
      prismaMock.passage.findMany.mockResolvedValue([
        { id: 1, questions: [{ id: 101, questionText: 'Q1', correctAnswer: 'true', groupId: null }], questionGroups: [] }
      ])
      prismaMock.attempt.findUnique.mockResolvedValue({
        id: 500, score: 6.5, correctCount: 30, totalCount: 40, answers: '{"101":"true"}',
      })
      // Max attempts đã đạt — retry cùng key vẫn phải trả Attempt cũ, không 429.
      prismaMock.setting.findUnique.mockResolvedValue({ key: 'max_attempts_per_exam', value: '1' })
      prismaMock.attempt.count.mockResolvedValue(1)

      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: { '101': 'true' }, submissionKey: 'mount-abc' })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ attemptId: 500, idempotent: true, score: 6.5, correct: 30, total: 40 })
      expect(prismaMock.attempt.create).not.toHaveBeenCalled()
    })

    it('recovers from a concurrent P2002 race by reading the winning attempt (TC-042)', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.passage.findMany.mockResolvedValue([
        { id: 1, questions: [{ id: 101, questionText: 'Q1', correctAnswer: 'true', groupId: null }], questionGroups: [] }
      ])
      prismaMock.attempt.findUnique
        .mockResolvedValueOnce(null) // lookup trước khi tạo
        .mockResolvedValueOnce({ id: 777, score: 7, correctCount: 32, totalCount: 40, answers: '{"101":"true"}' }) // sau P2002
      prismaMock.attempt.create.mockRejectedValue({ code: 'P2002' })

      const res = await request(app)
        .post('/api/reading/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ answers: { '101': 'true' }, submissionKey: 'mount-race' })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ attemptId: 777, idempotent: true })
    })
  })
})
