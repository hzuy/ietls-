import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  setting: { findUnique: vi.fn() },
  writingTask: { findUnique: vi.fn(), findMany: vi.fn() },
  writingAnswer: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  writingCriterionLog: { createMany: vi.fn() },
  attempt: { count: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock
}

// Mock groq-sdk to prevent real AI network calls
vi.mock('groq-sdk', () => {
  return {
    default: class MockGroq {
      constructor() {
        this.chat = {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify({ overall: 6.5, criteria: {} }) } }]
            })
          }
        }
      }
    }
  }
})

const app = require('../server')

describe('Writing Submission Routes', () => {
  const getTestToken = () => jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })
  const sampleEssay = 'Word '.repeat(60) // 60 words essay

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
  })

  describe('POST /api/writing/exams/:id/submit', () => {
    it('returns IMMEDIATELY with status pending and does not block for AI', async () => {
      prismaMock.writingTask.findUnique.mockResolvedValue({ id: 10, examId: 1, prompt: 'Task 1 prompt', number: 1 })
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.writingAnswer.create.mockResolvedValue({ id: 50, status: 'pending' })

      const res = await request(app)
        .post('/api/writing/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ taskId: 10, essay: sampleEssay })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('pending')
      expect(res.body.answerId).toBe(50)
      expect(res.body.wordCount).toBe(60)
    })

    it('returns 400 when taskId does NOT belong to examId on URL', async () => {
      // Task 10 belongs to examId 99, but URL is examId 1
      prismaMock.writingTask.findUnique.mockResolvedValue({ id: 10, examId: 99, prompt: 'Task 1 prompt', number: 1 })

      const res = await request(app)
        .post('/api/writing/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ taskId: 10, essay: sampleEssay })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe('Task không thuộc đề thi này')
    })

    it('returns 400 when essay is shorter than 50 words', async () => {
      prismaMock.writingTask.findUnique.mockResolvedValue({ id: 10, examId: 1, prompt: 'Task 1 prompt', number: 1 })
      prismaMock.setting.findUnique.mockResolvedValue(null)

      const shortEssay = 'This essay is too short.' // 5 words
      const res = await request(app)
        .post('/api/writing/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ taskId: 10, essay: shortEssay })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe('Bài viết quá ngắn!')
    })

    it('creates WritingCriterionLog entries for the 4 IELTS criteria upon AI grading completion', async () => {
      prismaMock.writingTask.findUnique.mockResolvedValue({ id: 10, examId: 1, prompt: 'Task 1 prompt', number: 1 })
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.writingAnswer.create.mockResolvedValue({ id: 50, status: 'pending', userId: 1 })
      prismaMock.writingAnswer.findUnique.mockResolvedValue({ id: 50, userId: 1 })
      prismaMock.writingAnswer.update.mockResolvedValue({ id: 50, status: 'graded' })
      prismaMock.writingCriterionLog.createMany.mockResolvedValue({ count: 4 })

      const res = await request(app)
        .post('/api/writing/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ taskId: 10, essay: sampleEssay })

      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/writing/exams/:id/my-results (Tầng 4 — khôi phục kết quả đã chấm)', () => {
    const fb = (overall) => JSON.stringify({
      overall,
      criteria: { task_achievement: { score: overall, comment: 'x' } },
      strengths: 'ok', improvements: 'more',
    })

    it('returns the LATEST graded answer per task when a task was submitted multiple times', async () => {
      prismaMock.writingTask.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }])
      // route queries orderBy createdAt desc → newest first
      prismaMock.writingAnswer.findMany.mockResolvedValue([
        { id: 502, taskId: 10, status: 'graded', wordCount: 260, aiFeedback: fb(7) },
        { id: 501, taskId: 10, status: 'graded', wordCount: 200, aiFeedback: fb(5.5) },
        { id: 511, taskId: 11, status: 'graded', wordCount: 170, aiFeedback: fb(6) },
      ])

      const res = await request(app)
        .get('/api/writing/exams/1/my-results')
        .set('Authorization', `Bearer ${getTestToken()}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      const t10 = res.body.find(r => r.taskId === 10)
      expect(t10.answerId).toBe(502)
      expect(t10.overall).toBe(7)
      expect(t10.wordCount).toBe(260)
      expect(t10.status).toBe('graded')
    })

    it('scopes the answer query to the authenticated user (userId in where clause)', async () => {
      prismaMock.writingTask.findMany.mockResolvedValue([{ id: 10 }])
      prismaMock.writingAnswer.findMany.mockResolvedValue([])

      await request(app)
        .get('/api/writing/exams/1/my-results')
        .set('Authorization', `Bearer ${getTestToken()}`)

      expect(prismaMock.writingAnswer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 1, taskId: { in: [10] } }),
        })
      )
    })

    it('skips pending / failed answers — only graded entries appear', async () => {
      prismaMock.writingTask.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }])
      prismaMock.writingAnswer.findMany.mockResolvedValue([
        { id: 601, taskId: 10, status: 'graded', wordCount: 250, aiFeedback: fb(6) },
        { id: 602, taskId: 11, status: 'pending', wordCount: 10, aiFeedback: null },
        { id: 603, taskId: 12, status: 'failed', wordCount: 250, aiFeedback: null },
      ])

      const res = await request(app)
        .get('/api/writing/exams/1/my-results')
        .set('Authorization', `Bearer ${getTestToken()}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].taskId).toBe(10)
    })

    it('omits tasks that were never submitted', async () => {
      prismaMock.writingTask.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }])
      prismaMock.writingAnswer.findMany.mockResolvedValue([
        { id: 701, taskId: 10, status: 'graded', wordCount: 250, aiFeedback: fb(6) },
      ])

      const res = await request(app)
        .get('/api/writing/exams/1/my-results')
        .set('Authorization', `Bearer ${getTestToken()}`)

      expect(res.body.map(r => r.taskId)).toEqual([10])
    })

    it('a corrupt aiFeedback JSON is skipped, the rest of the response still returns', async () => {
      prismaMock.writingTask.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }])
      prismaMock.writingAnswer.findMany.mockResolvedValue([
        { id: 801, taskId: 10, status: 'graded', wordCount: 250, aiFeedback: '{ not valid json' },
        { id: 802, taskId: 11, status: 'graded', wordCount: 240, aiFeedback: fb(6.5) },
      ])

      const res = await request(app)
        .get('/api/writing/exams/1/my-results')
        .set('Authorization', `Bearer ${getTestToken()}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].taskId).toBe(11)
    })

    it('returns [] when the exam has no writing tasks', async () => {
      prismaMock.writingTask.findMany.mockResolvedValue([])

      const res = await request(app)
        .get('/api/writing/exams/999/my-results')
        .set('Authorization', `Bearer ${getTestToken()}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
      expect(prismaMock.writingAnswer.findMany).not.toHaveBeenCalled()
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/writing/exams/1/my-results')
      expect(res.status).toBe(401)
    })
  })
})
