import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const mockTranscribe = vi.fn().mockResolvedValue({ text: 'Hello world transcription' })

const prismaMock = {
  setting: { findUnique: vi.fn() },
  speakingPart: { findUnique: vi.fn() },
  speakingAnswer: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  speakingCriterionLog: { createMany: vi.fn() },
  attempt: { count: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

// Mock Groq SDK for Speaking AI tests & Transcribe
class MockGroq {
  constructor() {
    this.audio = {
      transcriptions: {
        create: mockTranscribe,
      },
    }
    this.chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  overall: 6.5,
                  criteria: {
                    fluency: { score: 6.0, comment: 'Tốt' },
                    vocabulary: { score: 6.5, comment: 'Đa dạng' },
                    grammar: { score: 6.0, comment: 'Đúng cấu trúc' },
                    pronunciation: { score: 7.0, comment: 'Rõ ràng' },
                  },
                  strengths: 'Phát âm tốt',
                  improvements: 'Cần trôi chảy hơn',
                }),
              },
            },
          ],
        }),
      },
    }
  }
}

vi.mock('groq-sdk', () => ({
  __esModule: true,
  default: MockGroq,
  Groq: MockGroq,
}))

try {
  const groqPath = require.resolve('groq-sdk')
  require.cache[groqPath] = {
    id: groqPath,
    filename: groqPath,
    loaded: true,
    exports: MockGroq,
  }
} catch (e) {}

const app = require('../server')

describe('Speaking Routes & AI Criterion Logging', () => {
  const getTestToken = () =>
    jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

  const sampleTranscript = 'I live in a big city with many people and nice places to visit every day.'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
  })

  describe('POST /api/speaking/transcribe', () => {
    it('transcribes uploaded audio file via Groq client without throwing "groq is not defined"', async () => {
      const res = await request(app)
        .post('/api/speaking/transcribe')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .attach('audio', Buffer.from('fake audio bytes'), 'test.webm')

      expect(res.status).toBe(200)
      expect(res.body.transcript).toBe('Hello world transcription')
      expect(mockTranscribe).toHaveBeenCalled()
    })
  })

  describe('POST /api/speaking/exams/:id/submit', () => {
    it('submits speaking exam, returns pending status immediately without blocking', async () => {
      prismaMock.speakingPart.findUnique.mockResolvedValue({
        id: 10,
        examId: 1,
        number: 1,
        questions: [{ text: 'Tell me about your hometown.' }],
      })
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.speakingAnswer.create.mockResolvedValue({ id: 80, status: 'pending', userId: 1 })
      prismaMock.speakingAnswer.findUnique.mockResolvedValue({ id: 80, userId: 1 })
      prismaMock.speakingAnswer.update.mockResolvedValue({ id: 80, status: 'graded' })
      prismaMock.speakingCriterionLog.createMany.mockResolvedValue({ count: 4 })

      const res = await request(app)
        .post('/api/speaking/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ partId: 10, transcript: sampleTranscript })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('pending')
      expect(res.body.answerId).toBe(80)
    })

    it('creates 4 SpeakingCriterionLog entries (fluency, vocabulary, grammar, pronunciation) upon AI grading', async () => {
      prismaMock.speakingPart.findUnique.mockResolvedValue({
        id: 10,
        examId: 1,
        number: 1,
        questions: [{ text: 'Describe a trip.' }],
      })
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.speakingAnswer.create.mockResolvedValue({ id: 81, status: 'pending', userId: 1 })
      prismaMock.speakingAnswer.findUnique.mockResolvedValue({ id: 81, userId: 1 })
      prismaMock.speakingAnswer.update.mockResolvedValue({ id: 81, status: 'graded' })
      prismaMock.speakingCriterionLog.createMany.mockResolvedValue({ count: 4 })

      const res = await request(app)
        .post('/api/speaking/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ partId: 10, transcript: sampleTranscript })

      expect(res.status).toBe(200)
    })

    it('non-fatal resilience: if speakingCriterionLog.createMany throws DB error, status remains graded and job does not fail', async () => {
      prismaMock.speakingPart.findUnique.mockResolvedValue({
        id: 10,
        examId: 1,
        number: 1,
        questions: [{ text: 'Talk about music.' }],
      })
      prismaMock.setting.findUnique.mockResolvedValue(null)
      prismaMock.speakingAnswer.create.mockResolvedValue({ id: 82, status: 'pending', userId: 1 })
      prismaMock.speakingAnswer.findUnique.mockResolvedValue({ id: 82, userId: 1 })
      prismaMock.speakingAnswer.update.mockResolvedValue({ id: 82, status: 'graded' })
      prismaMock.speakingCriterionLog.createMany.mockRejectedValue(new Error('Table public.SpeakingCriterionLog does not exist'))

      const res = await request(app)
        .post('/api/speaking/exams/1/submit')
        .set('Authorization', `Bearer ${getTestToken()}`)
        .send({ partId: 10, transcript: sampleTranscript })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('pending')
    })
  })
})
