import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  exam: {
    groupBy: vi.fn().mockResolvedValue([
      { skill: 'reading', _count: { id: 10 } },
      { skill: 'listening', _count: { id: 8 } }
    ]),
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        title: 'Cambridge 19 Reading Test 1',
        skill: 'reading',
        bookNumber: 19,
        testNumber: 1,
        seriesId: 1,
        createdAt: '2026-07-23T00:00:00.000Z',
        passages: [],
        listeningSections: [],
        writingTasks: [],
        speakingParts: [],
        _count: { attempts: 5 }
      }
    ]),
    count: vi.fn().mockResolvedValue(1)
  },
  attempt: {
    groupBy: vi.fn().mockResolvedValue([
      { examId: 1, _avg: { score: 7.5 } }
    ]),
    aggregate: vi.fn().mockResolvedValue({
      _count: { _all: 42 },
      _avg: { score: 6.8 }
    })
  }
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock
}

const app = require('../server')

describe('Admin Exams Router & Pagination', () => {
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/admin/exams/counts returns skill count mapping', async () => {
    const res = await request(app)
      .get('/api/admin/exams/counts')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('reading', 10)
    expect(res.body).toHaveProperty('listening', 8)
    expect(res.body).toHaveProperty('writing', 0)
    expect(res.body).toHaveProperty('speaking', 0)
  })

  it('GET /api/admin/exams returns paginated exam payload with questionCount and avgScore', async () => {
    const res = await request(app)
      .get('/api/admin/exams?skill=reading&page=1&limit=10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('exams')
    expect(res.body).toHaveProperty('total', 1)
    expect(res.body).toHaveProperty('page', 1)
    expect(res.body).toHaveProperty('pages', 1)
    expect(res.body.exams.length).toBe(1)
    expect(res.body.exams[0].avgScore).toBe(7.5)
  })

  it('GET /api/admin/exams returns global stats (not page-scoped) when skill is given', async () => {
    const res = await request(app)
      .get('/api/admin/exams?skill=reading')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body.stats).toEqual({
      totalExams: 1,
      noQuestionsCount: 1,
      totalAttempts: 42,
      avgBand: 6.8
    })
  })

  it('GET /api/admin/exams applies status=no_questions and sortBy=attempts to the Prisma query', async () => {
    await request(app)
      .get('/api/admin/exams?skill=reading&status=no_questions&sortBy=attempts&sortOrder=asc')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.exam.findMany.mock.calls.at(-1)[0]
    expect(call.where).toHaveProperty('NOT')
    expect(call.orderBy).toEqual({ attempts: { _count: 'asc' } })
  })
})
