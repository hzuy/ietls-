import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  practiceExam: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  practiceAttempt: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
}
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }

const app = require('../server')

const learner = jwt.sign({ userId: 7, email: 'u@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })
const teacher = jwt.sign({ userId: 3, email: 't@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })
const at = new Date('2026-10-12T01:00:00Z')

describe('practice attempts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves an attempt for the logged-in learner', async () => {
    prismaMock.practiceExam.findFirst.mockResolvedValue({ id: 16 })
    prismaMock.practiceAttempt.create.mockResolvedValue({ id: 5, practiceExamId: 16, correct: 4, total: 13, createdAt: at })

    const res = await request(app)
      .post('/api/practice/attempts/reading/16')
      .set('Authorization', `Bearer ${learner}`)
      .send({ answers: { 1: 'FALSE', 7: 'bulbs' }, correct: 4, total: 13 })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ attemptId: 5, examId: 16, correct: 4, total: 13 })
    expect(prismaMock.practiceAttempt.create.mock.calls[0][0].data).toMatchObject({ userId: 7, practiceExamId: 16 })
    expect(prismaMock.practiceExam.findFirst.mock.calls[0][0].where).toMatchObject({ id: 16, skill: 'reading', deletedAt: null })
  })

  it('rejects invalid payloads and unknown exams', async () => {
    const bad = await request(app)
      .post('/api/practice/attempts/reading/16')
      .set('Authorization', `Bearer ${learner}`)
      .send({ answers: {}, correct: 5, total: 2 })
    expect(bad.status).toBe(400)

    prismaMock.practiceExam.findFirst.mockResolvedValue(null)
    const missing = await request(app)
      .post('/api/practice/attempts/listening/99')
      .set('Authorization', `Bearer ${learner}`)
      .send({ answers: {}, correct: 0, total: 10 })
    expect(missing.status).toBe(404)
    expect(prismaMock.practiceAttempt.create).not.toHaveBeenCalled()
  })

  it('lists attempts grouped by exam, newest first', async () => {
    prismaMock.practiceAttempt.findMany.mockResolvedValue([
      { id: 9, practiceExamId: 16, correct: 10, total: 13, createdAt: at },
      { id: 5, practiceExamId: 16, correct: 4, total: 13, createdAt: at },
      { id: 6, practiceExamId: 19, correct: 7, total: 10, createdAt: at },
    ])

    const res = await request(app).get('/api/practice/attempts/reading').set('Authorization', `Bearer ${learner}`)

    expect(res.status).toBe(200)
    expect(res.body['16'].map(a => a.attemptId)).toEqual([9, 5])
    expect(res.body['19'][0]).toMatchObject({ correct: 7, total: 10, skill: 'reading' })
    expect(prismaMock.practiceAttempt.findMany.mock.calls[0][0].where).toMatchObject({ userId: 7, practiceExam: { skill: 'reading' } })
  })

  it('returns one attempt with its answers only to its owner', async () => {
    prismaMock.practiceAttempt.findFirst.mockResolvedValue({ id: 5, practiceExamId: 16, correct: 4, total: 13, createdAt: at, answers: { 1: 'FALSE' } })
    const ok = await request(app).get('/api/practice/attempts/reading/16/5').set('Authorization', `Bearer ${learner}`)
    expect(ok.status).toBe(200)
    expect(ok.body.answers).toEqual({ 1: 'FALSE' })
    expect(prismaMock.practiceAttempt.findFirst.mock.calls[0][0].where).toEqual({ id: 5, practiceExamId: 16, userId: 7 })

    prismaMock.practiceAttempt.findFirst.mockResolvedValue(null)
    const other = await request(app).get('/api/practice/attempts/reading/16/6').set('Authorization', `Bearer ${learner}`)
    expect(other.status).toBe(404)
  })

  it('requires login, a learner role and a valid skill', async () => {
    expect((await request(app).get('/api/practice/attempts/reading')).status).toBe(401)
    expect((await request(app).get('/api/practice/attempts/reading').set('Authorization', `Bearer ${teacher}`)).status).toBe(403)
    expect((await request(app).get('/api/practice/attempts/writing').set('Authorization', `Bearer ${learner}`)).status).toBe(400)
  })
})
