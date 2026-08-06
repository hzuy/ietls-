import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  answerLog: {
    groupBy: vi.fn(),
    count: vi.fn(),
  },
  writingCriterionLog: {
    findMany: vi.fn(),
  },
  speakingCriterionLog: {
    findMany: vi.fn(),
  },
  attempt: {
    findMany: vi.fn(),
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

class MockGroqClient {
  constructor() {
    this.chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  summary: 'Mock AI advice summary',
                  skills: {
                    reading_listening: { available: true, strengths: ['Good accuracy'], weaknesses: ['Speed'] },
                    writing: { available: true, strengths: ['Good vocab'], weaknesses: ['Grammar'] },
                    speaking: { available: true, strengths: ['Fluency'], weaknesses: ['Pronunciation'] },
                  },
                  actionItems: ['Practice Task 2', 'Listen to Section 4'],
                }),
              },
            },
          ],
        }),
      },
    }
  }
}

// 1. Mock via Vitest
vi.mock('groq-sdk', () => ({
  __esModule: true,
  default: MockGroqClient,
  Groq: MockGroqClient,
}))

// 2. Mock via Node CJS require.cache (100% bulletproof for require('groq-sdk'))
try {
  const groqPath = require.resolve('groq-sdk')
  require.cache[groqPath] = {
    id: groqPath,
    filename: groqPath,
    loaded: true,
    exports: MockGroqClient,
  }
} catch (e) {}

const app = require('../server')

describe('Stats Integration Routes (/api/stats)', () => {
  const makeToken = (userId = 1, role = 'user') =>
    jwt.sign({ userId, email: 'student@example.com', role }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/stats/error-breakdown
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/stats/error-breakdown', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).get('/api/stats/error-breakdown')
      expect(res.status).toBe(401)
    })

    it('returns error breakdown aggregated, distinguishing skipped vs wrong answers, sorted by errorRate DESC', async () => {
      prismaMock.answerLog.groupBy.mockResolvedValue([
        // matching_headings: 6 correct, 12 skipped (""), 3 wrong ("option_A") -> total 21
        { skillType: 'reading', questionType: 'matching_headings', isCorrect: false, userAnswer: '',         _count: { id: 12 } },
        { skillType: 'reading', questionType: 'matching_headings', isCorrect: false, userAnswer: 'option_A', _count: { id: 3 } },
        { skillType: 'reading', questionType: 'matching_headings', isCorrect: true,  userAnswer: 'option_B', _count: { id: 6 } },
        // mcq: 10 correct, 2 wrong ("B") -> total 12
        { skillType: 'reading', questionType: 'mcq',               isCorrect: true,  userAnswer: 'A',        _count: { id: 10 } },
        { skillType: 'reading', questionType: 'mcq',               isCorrect: false, userAnswer: 'B',        _count: { id: 2 } },
      ])

      const res = await request(app)
        .get('/api/stats/error-breakdown')
        .set('Authorization', `Bearer ${makeToken(1)}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(2)

      // First entry: matching_headings (15 incorrect: 12 skipped, 3 wrong out of 21 total)
      const item1 = res.body[0]
      expect(item1).toMatchObject({
        skillType: 'reading',
        questionType: 'matching_headings',
        total: 21,
        correct: 6,
        incorrect: 15,
        skipped: 12,
        wrong: 3,
        errorRate: 0.714,
        accuracyRate: 0.286,
      })

      // Invariant check: correct + skipped + wrong === total
      expect(item1.correct + item1.skipped + item1.wrong).toBe(item1.total)
      expect(item1.skipped + item1.wrong).toBe(item1.incorrect)

      // Second entry: mcq (2 incorrect: 0 skipped, 2 wrong out of 12 total)
      const item2 = res.body[1]
      expect(item2).toMatchObject({
        skillType: 'reading',
        questionType: 'mcq',
        total: 12,
        correct: 10,
        incorrect: 2,
        skipped: 0,
        wrong: 2,
        errorRate: 0.167,
        accuracyRate: 0.833,
      })

      expect(item2.correct + item2.skipped + item2.wrong).toBe(item2.total)
    })

    it('edge case: user with 0 logs returns empty array [] without 500 server error', async () => {
      prismaMock.answerLog.groupBy.mockResolvedValue([])

      const res = await request(app)
        .get('/api/stats/error-breakdown')
        .set('Authorization', `Bearer ${makeToken(999)}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('filters by skill query parameter when skill=reading', async () => {
      prismaMock.answerLog.groupBy.mockResolvedValue([])

      await request(app)
        .get('/api/stats/error-breakdown?skill=reading')
        .set('Authorization', `Bearer ${makeToken(1)}`)

      expect(prismaMock.answerLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 1,
            skillType: 'reading',
          }),
        })
      )
    })

    it('security: normal user requesting another userId gets 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/stats/error-breakdown?userId=888')
        .set('Authorization', `Bearer ${makeToken(1, 'user')}`)

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('Không có quyền')
    })

    it('security: admin requesting another userId succeeds', async () => {
      prismaMock.answerLog.groupBy.mockResolvedValue([])

      const res = await request(app)
        .get('/api/stats/error-breakdown?userId=888')
        .set('Authorization', `Bearer ${makeToken(1, 'admin')}`)

      expect(res.status).toBe(200)
      expect(prismaMock.answerLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 888,
          }),
        })
      )
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/stats/trend
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/stats/trend', () => {
    it('returns recent 10 attempts trend list in chronological order', async () => {
      const finishedAt1 = new Date('2026-08-01T10:00:00Z')
      const finishedAt2 = new Date('2026-08-02T10:00:00Z')

      prismaMock.attempt.findMany.mockResolvedValue([
        {
          id: 102,
          examId: 13,
          score: 7.0,
          finishedAt: finishedAt2,
          createdAt: finishedAt2,
          exam: { title: 'Cam 18 Test 2', skill: 'reading', bookNumber: 18, testNumber: 2 },
        },
        {
          id: 101,
          examId: 12,
          score: 6.0,
          finishedAt: finishedAt1,
          createdAt: finishedAt1,
          exam: { title: 'Cam 18 Test 1', skill: 'reading', bookNumber: 18, testNumber: 1 },
        },
      ])

      prismaMock.answerLog.groupBy.mockResolvedValue([
        { attemptId: 101, isCorrect: true,  _count: { id: 23 } },
        { attemptId: 101, isCorrect: false, _count: { id: 17 } },
        { attemptId: 102, isCorrect: true,  _count: { id: 30 } },
        { attemptId: 102, isCorrect: false, _count: { id: 10 } },
      ])

      const res = await request(app)
        .get('/api/stats/trend')
        .set('Authorization', `Bearer ${makeToken(1)}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)

      // Sorted chronologically (oldest attempt 101 first)
      expect(res.body[0].attemptId).toBe(101)
      expect(res.body[0].total).toBe(40)
      expect(res.body[0].correct).toBe(23)
      expect(res.body[0].incorrect).toBe(17)
      expect(res.body[0].accuracyRate).toBe(0.575)

      // Attempt 102 second
      expect(res.body[1].attemptId).toBe(102)
      expect(res.body[1].total).toBe(40)
      expect(res.body[1].correct).toBe(30)
      expect(res.body[1].incorrect).toBe(10)
      expect(res.body[1].accuracyRate).toBe(0.75)
    })

    it('edge case: user with 0 attempts returns empty array [] without 500 error', async () => {
      prismaMock.attempt.findMany.mockResolvedValue([])

      const res = await request(app)
        .get('/api/stats/trend')
        .set('Authorization', `Bearer ${makeToken(500)}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/stats/advice — Layer 3 AI Advisor
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/stats/advice', () => {
    it('returns insufficientData=true when user has NO data in any of the 4 skills', async () => {
      prismaMock.answerLog.count.mockResolvedValue(5) // Fewer than 10 questions
      prismaMock.writingCriterionLog.findMany.mockResolvedValue([])
      prismaMock.speakingCriterionLog.findMany.mockResolvedValue([])

      const res = await request(app)
        .post('/api/stats/advice')
        .set('Authorization', `Bearer ${makeToken(30)}`)

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        insufficientData: true,
        totalQuestions: 5,
      })
      expect(res.body.message).toContain('chưa có đủ dữ liệu')
    })

    it('processes AI advice successfully when user has data in skills (fallback when no API key)', async () => {
      prismaMock.answerLog.count.mockResolvedValue(38) // 38 questions
      prismaMock.answerLog.groupBy.mockResolvedValue([
        { skillType: 'reading', questionType: 'note_completion', isCorrect: false, userAnswer: '', _count: { id: 9 } },
        { skillType: 'reading', questionType: 'true_false_ng',   isCorrect: true,  userAnswer: 'true', _count: { id: 6 } },
      ])
      prismaMock.attempt.findMany.mockResolvedValue([])
      prismaMock.writingCriterionLog.findMany.mockResolvedValue([
        { criterion: 'task_achievement', score: 6.0, comment: 'Tốt', createdAt: new Date() },
      ])
      prismaMock.speakingCriterionLog.findMany.mockResolvedValue([
        { criterion: 'fluency', score: 6.5, comment: 'Trôi chảy', createdAt: new Date() },
      ])

      const res = await request(app)
        .post('/api/stats/advice')
        .set('Authorization', `Bearer ${makeToken(40)}`)

      expect(res.status).toBe(200)
      expect(res.body.insufficientData).toBe(false)
      expect(res.body.totalQuestions).toBe(38)
      expect(res.body.availableSkills).toEqual({
        reading_listening: true,
        writing: true,
        speaking: true,
      })
      expect(res.body.advice).toHaveProperty('summary')
      expect(res.body.advice).toHaveProperty('skills')
      expect(res.body.advice).toHaveProperty('actionItems')
    })

    it('enforces rate limiting (max 5 requests per user per day) and isolates quota per user', async () => {
      prismaMock.answerLog.count.mockResolvedValue(5) // Fast response with 5 questions
      prismaMock.writingCriterionLog.findMany.mockResolvedValue([])
      prismaMock.speakingCriterionLog.findMany.mockResolvedValue([])
      const user1Id = 777
      const tokenUser1 = makeToken(user1Id)

      // 5 requests for user 777 -> status 200
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/stats/advice')
          .set('Authorization', `Bearer ${tokenUser1}`)
        expect(res.status).toBe(200)
      }

      // 6th request for user 777 -> status 429 Too Many Requests
      const res6 = await request(app)
        .post('/api/stats/advice')
        .set('Authorization', `Bearer ${tokenUser1}`)

      expect(res6.status).toBe(429)
      expect(res6.body.message).toContain('giới hạn 5 lần')

      // User 888 calling for the first time -> status 200 (quota is isolated per user)
      const tokenUser2 = makeToken(888)
      const resUser2 = await request(app)
        .post('/api/stats/advice')
        .set('Authorization', `Bearer ${tokenUser2}`)

      expect(resUser2.status).toBe(200)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/stats/writing-criteria
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/stats/writing-criteria', () => {
    it('returns empty array [] when user has no writing criterion logs without 500 error', async () => {
      prismaMock.writingCriterionLog.findMany.mockResolvedValue([])

      const res = await request(app)
        .get('/api/stats/writing-criteria')
        .set('Authorization', `Bearer ${makeToken(101)}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('calculates average score, sample count, latest score, trend, and sorts by avgScore ASC', async () => {
      prismaMock.writingCriterionLog.findMany.mockResolvedValue([
        { criterion: 'task_achievement', score: 5.5, comment: 'Cần bổ sung chi tiết', createdAt: new Date('2026-08-01') },
        { criterion: 'task_achievement', score: 6.5, comment: 'Đã bổ sung chi tiết', createdAt: new Date('2026-08-02') },
        { criterion: 'grammatical_range', score: 5.0, comment: 'Lỗi ngữ pháp', createdAt: new Date('2026-08-01') },
        { criterion: 'grammatical_range', score: 5.0, comment: 'Vẫn còn lỗi ngữ pháp', createdAt: new Date('2026-08-02') },
      ])

      const res = await request(app)
        .get('/api/stats/writing-criteria')
        .set('Authorization', `Bearer ${makeToken(102)}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)

      // Weakest criterion first (grammatical_range: avg 5.0 < task_achievement: avg 6.0)
      expect(res.body[0].criterion).toBe('grammatical_range')
      expect(res.body[0].avgScore).toBe(5.0)
      expect(res.body[0].sampleCount).toBe(2)
      expect(res.body[0].trend).toBe('stable')

      expect(res.body[1].criterion).toBe('task_achievement')
      expect(res.body[1].avgScore).toBe(6.0)
      expect(res.body[1].latestScore).toBe(6.5)
      expect(res.body[1].trend).toBe('up')
    })

    it('rounds avgScore to nearest 0.5 IELTS band (e.g. 3.83 => 4.0)', async () => {
      prismaMock.writingCriterionLog.findMany.mockResolvedValue([
        { criterion: 'lexical_resource', score: 3.5, comment: 'Lỗi', createdAt: new Date('2026-08-01') },
        { criterion: 'lexical_resource', score: 4.0, comment: 'Tốt hơn', createdAt: new Date('2026-08-02') },
        { criterion: 'lexical_resource', score: 4.0, comment: 'Cải thiện', createdAt: new Date('2026-08-03') },
      ]) // raw avg = 11.5 / 3 = 3.8333 -> rounds to 4.0

      const res = await request(app)
        .get('/api/stats/writing-criteria')
        .set('Authorization', `Bearer ${makeToken(103)}`)

      expect(res.status).toBe(200)
      expect(res.body[0].avgScore).toBe(4.0)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/stats/speaking-criteria
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/stats/speaking-criteria', () => {
    it('returns empty array [] when user has no speaking criterion logs without 500 error', async () => {
      prismaMock.speakingCriterionLog.findMany.mockResolvedValue([])

      const res = await request(app)
        .get('/api/stats/speaking-criteria')
        .set('Authorization', `Bearer ${makeToken(201)}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns trend=insufficient_data when sampleCount = 1', async () => {
      prismaMock.speakingCriterionLog.findMany.mockResolvedValue([
        { criterion: 'fluency', score: 6.0, comment: 'Tạm ổn', createdAt: new Date('2026-08-01') },
      ])

      const res = await request(app)
        .get('/api/stats/speaking-criteria')
        .set('Authorization', `Bearer ${makeToken(202)}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].criterion).toBe('fluency')
      expect(res.body[0].avgScore).toBe(6.0)
      expect(res.body[0].sampleCount).toBe(1)
      expect(res.body[0].trend).toBe('insufficient_data')
    })
  })
})
