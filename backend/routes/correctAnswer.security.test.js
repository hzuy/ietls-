/**
 * Test suite: correctAnswer security fix (Đợt 1)
 *
 * Kiểm tra:
 * 1. GET /api/reading/exams/:id      → KHÔNG có correctAnswer (student)
 * 2. GET /api/reading/exams/:id?withAnswers=true  → CÓ correctAnswer (admin)
 * 3. GET /api/reading/exams/:id?withAnswers=true  → 403 nếu không phải staff
 * 4. GET /api/listening/exams/:id    → KHÔNG có correctAnswer (student)
 * 5. GET /api/listening/exams/:id?withAnswers=true → CÓ correctAnswer (admin)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ── Helpers to generate tokens ──────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

function makeToken(role = 'student', userId = 999) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' })
}

// ── Mock Prisma ────────────────────────────────────────────────────────────
vi.mock('../lib/prisma', () => {
  const mockExamReading = {
    id: 1,
    title: 'Test Reading Exam',
    skill: 'reading',
    deletedAt: null,
    passages: [
      {
        id: 10, number: 1, title: 'Passage A', body: 'Lorem ipsum', subtitle: null, letteredParagraphs: false,
        questions: [
          {
            id: 101, passageId: 10, listeningSectionId: null, groupId: null,
            number: 1, type: 'tf_ng', questionText: 'Is this true?',
            options: null, imageUrl: null,
            correctAnswer: 'TRUE'
          }
        ],
        questionGroups: []
      }
    ]
  }

  const mockExamListening = {
    id: 2,
    title: 'Test Listening Exam',
    skill: 'listening',
    deletedAt: null,
    listeningSections: [
      {
        id: 20, number: 1, audioUrl: null, transcript: null,
        questions: [
          {
            id: 201, passageId: null, listeningSectionId: 20, groupId: null,
            number: 1, type: 'fill_blank', questionText: 'Fill in ___',
            options: null, imageUrl: null,
            correctAnswer: 'ANSWER'
          }
        ],
        questionGroups: []
      }
    ]
  }

  return {
    default: {
      exam: {
        findUnique: vi.fn(({ where, include }) => {
          if (where.id === 1) {
            const questionSelectApplied = include?.passages?.include?.questions?.select
            if (questionSelectApplied) {
              return Promise.resolve({
                ...mockExamReading,
                passages: mockExamReading.passages.map(p => ({
                  ...p,
                  questions: p.questions.map(q => {
                    const { correctAnswer, ...rest } = q
                    return rest
                  })
                }))
              })
            }
            return Promise.resolve(mockExamReading)
          }
          if (where.id === 2) {
            const questionSelectApplied = include?.listeningSections?.include?.questions?.select
            if (questionSelectApplied) {
              return Promise.resolve({
                ...mockExamListening,
                listeningSections: mockExamListening.listeningSections.map(s => ({
                  ...s,
                  questions: s.questions.map(q => {
                    const { correctAnswer, ...rest } = q
                    return rest
                  })
                }))
              })
            }
            return Promise.resolve(mockExamListening)
          }
          return Promise.resolve(null)
        }),
        findMany: vi.fn(() => Promise.resolve([])),
        count: vi.fn(() => Promise.resolve(0))
      },
      setting: {
        findUnique: vi.fn(() => Promise.resolve(null))
      },
      attempt: {
        count: vi.fn(() => Promise.resolve(0)),
        findMany: vi.fn(() => Promise.resolve([])),
        create: vi.fn(() => Promise.resolve({ id: 1 }))
      }
    }
  }
})

let app
beforeAll(async () => {
  const appModule = await import('../server.js')
  app = appModule.default
})

// ─────────────────────────────────────────────────────────────────────────────
// READING EXAM TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/reading/exams/:id — correctAnswer security', () => {

  it('TC-R-01: Student request → KHÔNG có correctAnswer trong response', async () => {
    const token = makeToken('student')
    const res = await request(app)
      .get('/api/reading/exams/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const allQuestions = (res.body.passages || []).flatMap(p => [
      ...(p.questions || []),
      ...(p.questionGroups || []).flatMap(g => g.questions || [])
    ])
    expect(allQuestions.length).toBeGreaterThan(0)
    for (const q of allQuestions) {
      expect(q, `Question id=${q.id} còn correctAnswer!`).not.toHaveProperty('correctAnswer')
    }
  })

  it('TC-R-02: Admin + ?withAnswers=true → CÓ correctAnswer', async () => {
    const token = makeToken('admin')
    const res = await request(app)
      .get('/api/reading/exams/1?withAnswers=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const allQuestions = (res.body.passages || []).flatMap(p => [
      ...(p.questions || []),
      ...(p.questionGroups || []).flatMap(g => g.questions || [])
    ])
    expect(allQuestions.some(q => 'correctAnswer' in q)).toBe(true)
  })

  it('TC-R-03: Teacher + ?withAnswers=true → CÓ correctAnswer', async () => {
    const token = makeToken('teacher')
    const res = await request(app)
      .get('/api/reading/exams/1?withAnswers=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const allQuestions = (res.body.passages || []).flatMap(p => [
      ...(p.questions || []),
      ...(p.questionGroups || []).flatMap(g => g.questions || [])
    ])
    expect(allQuestions.some(q => 'correctAnswer' in q)).toBe(true)
  })

  it('TC-R-04: Student + ?withAnswers=true → 403 Forbidden', async () => {
    const token = makeToken('student')
    const res = await request(app)
      .get('/api/reading/exams/1?withAnswers=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('TC-R-05: Không có token → 401 Unauthorized', async () => {
    const res = await request(app).get('/api/reading/exams/1')
    expect(res.status).toBe(401)
  })

  it('TC-R-06: ID không tồn tại → 404', async () => {
    const token = makeToken('student')
    const res = await request(app)
      .get('/api/reading/exams/9999')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LISTENING EXAM TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/listening/exams/:id — correctAnswer security', () => {

  it('TC-L-01: Student request → KHÔNG có correctAnswer trong response', async () => {
    const token = makeToken('student')
    const res = await request(app)
      .get('/api/listening/exams/2')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const allQuestions = (res.body.listeningSections || []).flatMap(s => [
      ...(s.questions || []),
      ...(s.questionGroups || []).flatMap(g => g.questions || [])
    ])
    expect(allQuestions.length).toBeGreaterThan(0)
    for (const q of allQuestions) {
      expect(q, `Question id=${q.id} còn correctAnswer trong Listening!`).not.toHaveProperty('correctAnswer')
    }
  })

  it('TC-L-02: Admin + ?withAnswers=true → CÓ correctAnswer', async () => {
    const token = makeToken('admin')
    const res = await request(app)
      .get('/api/listening/exams/2?withAnswers=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const allQuestions = (res.body.listeningSections || []).flatMap(s => [
      ...(s.questions || []),
      ...(s.questionGroups || []).flatMap(g => g.questions || [])
    ])
    expect(allQuestions.some(q => 'correctAnswer' in q)).toBe(true)
  })

  it('TC-L-03: Student + ?withAnswers=true → 403 Forbidden', async () => {
    const token = makeToken('student')
    const res = await request(app)
      .get('/api/listening/exams/2?withAnswers=true')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('TC-L-04: Không có token → 401', async () => {
    const res = await request(app).get('/api/listening/exams/2')
    expect(res.status).toBe(401)
  })
})
