import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  exam: {
    findFirst: vi.fn(),
  },
  question: {
    findMany: vi.fn(),
  },
  practiceExam: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const authUserMock = {
  verifySession: vi.fn().mockResolvedValue(null),
}
const authUserPath = require.resolve('../lib/authUser')
require.cache[authUserPath] = {
  id: authUserPath,
  filename: authUserPath,
  loaded: true,
  exports: authUserMock,
}

const { acquireLock, releaseLock, clearAllLocks } = require('../lib/explanationLock')
const { draftEnvelope } = require('../lib/explanationWorkflow')
const app = require('../server')

const makeToken = role => jwt.sign({ userId: 99, email: `${role}@example.com`, role }, process.env.JWT_SECRET)

describe('GET /explanation-status (Exam & Practice read-only endpoints)', () => {
  const teacherToken = makeToken('teacher')
  const learnerToken = makeToken('learner')

  beforeEach(() => {
    clearAllLocks()
    vi.clearAllMocks()
    authUserMock.verifySession.mockResolvedValue(null)
  })

  it.each(['exam', 'practice'])('counts wrong-blank drafts consistently with the admin editor for %s', async kind => {
    const g = { type: 'note_completion', noteSections: [{ lines: [{ contentWithTokens: 'The [Q:1] of London increased rapidly.' }, { contentWithTokens: 'Articles appeared in the [Q:5].' }] }], questions: [{ number: 1, correctAnswer: 'press' }] }
    const raw = draftEnvelope(null, { v: 2, answer: 'press', reasoning: 'Other question', full_sentence: 'Articles appeared in the press.' }, 'source')
    if (kind === 'exam') {
      prismaMock.exam.findFirst.mockResolvedValue({ id: 10, skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([{ id: 1, number: 1, type: 'fill_blank', correctAnswer: 'press', group: g, explanation: raw }])
    } else prismaMock.practiceExam.findFirst.mockResolvedValue({ id: 10, skill: 'reading', questions: [{ content: JSON.stringify(g), explanation: { byNumber: { 1: raw } } }] })
    const path = kind === 'exam' ? '/api/admin/exams/10/explanation-status' : '/api/practice/admin/reading/10/explanation-status'
    const res = await request(app).get(path).set('Authorization', `Bearer ${teacherToken}`).expect(200)
    expect(res.body.statusCounts.needs_regeneration).toBe(1)
    expect(res.body.statusCounts.draft_ready).toBe(0)
    expect(JSON.stringify(res.body)).not.toContain('Other question')
  })

  it.each(['exam', 'practice'])('counts v3 drafts, publications and stale content for %s without exposing payloads', async kind => {
    const payload = { answer: 'A', reasoning: 'PRIVATE_REASONING' }
    const explanations = [
      draftEnvelope(null, payload, 'source'),
      { workflowVersion: 3, published: { ...payload, status: 'teacher_reviewed' }, draft: null },
      { ...draftEnvelope(null, payload, 'source'), status: 'possibly_stale' },
      null,
    ]
    const rows = explanations.map((explanation, index) => ({ id: index + 1, number: index + 1, explanation }))
    if (kind === 'exam') {
      prismaMock.exam.findFirst.mockResolvedValue({ id: 10, skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue(rows)
    } else prismaMock.practiceExam.findFirst.mockResolvedValue({ id: 10, skill: 'reading', questions: [{
      id: 201, content: JSON.stringify({ questions: rows.map(row => ({ number: row.number })) }),
      explanation: { byNumber: Object.fromEntries(rows.map(row => [row.number, row.explanation])) },
    }] })
    const path = kind === 'exam' ? '/api/admin/exams/10/explanation-status' : '/api/practice/admin/reading/10/explanation-status'
    const result = await request(app).get(path).set('Authorization', `Bearer ${teacherToken}`).expect(200)
    expect(result.body).toMatchObject({ totalQuestions: 4, generatedCount: 3, unprocessedCount: 1,
      unprocessedQuestionNumbers: [4], statusCounts: { draft_ready: 1, published: 1, possibly_stale: 1, none: 1 } })
    expect(JSON.stringify(result.body)).not.toContain('PRIVATE_REASONING')
    expect(JSON.stringify(result.body)).not.toContain('source')
  })

  describe('GET /api/admin/exams/:id/explanation-status', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/admin/exams/1/explanation-status')
      expect(res.status).toBe(401)
    })

    it('returns 403 when user is a learner', async () => {
      const res = await request(app)
        .get('/api/admin/exams/1/explanation-status')
        .set('Authorization', `Bearer ${learnerToken}`)
      expect(res.status).toBe(403)
    })

    it('returns 400 when exam id is invalid', async () => {
      const res = await request(app)
        .get('/api/admin/exams/abc/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 404 when exam is not found', async () => {
      prismaMock.exam.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/admin/exams/9999/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(res.status).toBe(404)
      expect(res.body.message).toContain('Không tìm thấy đề thi')
    })

    it('returns correct aggregated status and reflects lock state without leaking explanation content', async () => {
      prismaMock.exam.findFirst.mockResolvedValue({ id: 10, skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 101,
          number: 1,
          explanation: {
            steps: { predict: 'p1', locate: 'l1' },
            status: 'ai_generated',
            answer: 'A',
          },
        },
        {
          id: 102,
          number: 2,
          explanation: {
            steps: { predict: 'p2' },
            status: 'teacher_reviewed',
            answer: 'B',
          },
        },
        {
          id: 103,
          number: 3,
          explanation: null, // Chưa có giải thích
        },
        {
          id: 104,
          number: 4,
          explanation: {
            status: 'conflict_pending',
          },
        },
      ])

      // Trước khi lock
      const res1 = await request(app)
        .get('/api/admin/exams/10/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(res1.status).toBe(200)
      expect(res1.body).toEqual({
        isLocked: false,
        totalQuestions: 4,
        generatedCount: 3,
        unprocessedCount: 1,
        unprocessedQuestionNumbers: [3],
        statusCounts: {
          draft_ready: 0, published: 0, possibly_stale: 0,
          ai_generated: 1,
          teacher_reviewed: 1,
          teacher_edited: 0,
          conflict_pending: 1,
          needs_regeneration: 0,
          none: 1,
        },
      })

      // Đảm bảo không lộ chi tiết đáp án hay các bước giải thích
      expect(res1.body.steps).toBeUndefined()
      expect(res1.body.answer).toBeUndefined()
      expect(res1.body.questions).toBeUndefined()

      // Sau khi lock được giữ bởi tiến trình AI
      acquireLock('exam:10')
      const res2 = await request(app)
        .get('/api/admin/exams/10/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(res2.status).toBe(200)
      expect(res2.body.isLocked).toBe(true)

      // Nhả lock
      releaseLock('exam:10')
      const res3 = await request(app)
        .get('/api/admin/exams/10/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(res3.status).toBe(200)
      expect(res3.body.isLocked).toBe(false)
    })
  })

  describe('GET /api/practice/admin/:skill/:id/explanation-status', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/practice/admin/reading/1/explanation-status')
      expect(res.status).toBe(401)
    })

    it('returns 403 when user is a learner', async () => {
      const res = await request(app)
        .get('/api/practice/admin/reading/1/explanation-status')
        .set('Authorization', `Bearer ${learnerToken}`)
      expect(res.status).toBe(403)
    })

    it('returns 400 when skill is invalid', async () => {
      const res = await request(app)
        .get('/api/practice/admin/writing/1/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 400 when practice id is invalid', async () => {
      const res = await request(app)
        .get('/api/practice/admin/reading/xyz/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 404 when practice exam is not found', async () => {
      prismaMock.practiceExam.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/practice/admin/reading/999/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(res.status).toBe(404)
    })

    it('returns correct aggregated status and reflects lock state without leaking explanation content', async () => {
      prismaMock.practiceExam.findFirst.mockResolvedValue({
        id: 5,
        skill: 'reading',
        questions: [
          {
            id: 201,
            content: JSON.stringify({
              questions: [
                { number: 1, correctAnswer: 'TRUE' },
                { number: 2, correctAnswer: 'FALSE' },
              ],
            }),
            explanation: {
              byNumber: {
                1: {
                  steps: { predict: 'p1' },
                  status: 'ai_generated',
                  answer: 'TRUE',
                },
              },
            },
          },
          {
            id: 202,
            content: JSON.stringify({
              questions: [
                { number: 3, correctAnswer: 'NOT GIVEN' },
              ],
            }),
            explanation: null,
          },
        ],
      })

      const res = await request(app)
        .get('/api/practice/admin/reading/5/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        isLocked: false,
        totalQuestions: 3,
        generatedCount: 1,
        unprocessedCount: 2,
        unprocessedQuestionNumbers: [2, 3],
        statusCounts: {
          draft_ready: 0, published: 0, possibly_stale: 0,
          ai_generated: 1,
          teacher_reviewed: 0,
          teacher_edited: 0,
          conflict_pending: 0,
          needs_regeneration: 0,
          none: 2,
        },
      })

      // Kiểm tra lock
      acquireLock('practice:5')
      const resLocked = await request(app)
        .get('/api/practice/admin/reading/5/explanation-status')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(resLocked.body.isLocked).toBe(true)

      releaseLock('practice:5')
    })
  })
})
