import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  setting: { findUnique: vi.fn() },
  writingTask: { findUnique: vi.fn() },
  writingAnswer: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
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
})
