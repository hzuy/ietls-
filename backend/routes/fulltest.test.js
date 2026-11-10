import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'
process.env.GRADING_RECOVERY_INTERVAL_MS = '600000'

const prismaMock = {
  exam: { findUnique: vi.fn(), findMany: vi.fn() },
  examSeries: { findUnique: vi.fn() },
  attempt: { findFirst: vi.fn(), findMany: vi.fn() },
  writingAnswer: { findMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  speakingAnswer: { findMany: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

const token = () => jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

const exams = () => ([
  { id: 1, skill: 'reading', writingTasks: [], speakingParts: [] },
  { id: 2, skill: 'listening', writingTasks: [], speakingParts: [] },
  { id: 3, skill: 'writing', writingTasks: [{ id: 10, number: 1 }, { id: 11, number: 2 }], speakingParts: [] },
  { id: 4, skill: 'speaking', writingTasks: [], speakingParts: [{ id: 20, number: 1 }, { id: 21, number: 2 }, { id: 22, number: 3 }] },
])

const graded = (id, taskId, aiScore, createdAt = '2026-11-01T10:00:00.000Z') => ({
  id, taskId, aiScore, status: 'graded', createdAt: new Date(createdAt),
})

const speakingGraded = (id, partId, number, aiScore) => ({
  id, partId, aiScore, status: 'graded', createdAt: new Date('2026-11-01T10:00:00.000Z'), part: { number },
})

function mockStatusData({ writingAnswers, speakingAnswers }) {
  prismaMock.exam.findUnique.mockResolvedValue({ seriesId: 9, bookNumber: 1, testNumber: 1 })
  prismaMock.exam.findMany.mockResolvedValue(exams())
  prismaMock.attempt.findFirst
    .mockResolvedValueOnce({ score: 7 })   // reading
    .mockResolvedValueOnce({ score: 7.5 }) // listening
  prismaMock.writingAnswer.findMany.mockResolvedValue(writingAnswers)
  prismaMock.speakingAnswer.findMany.mockResolvedValue(speakingAnswers)
}

async function getStatus() {
  return request(app)
    .get('/api/full-test/status?examId=1')
    .set('Authorization', `Bearer ${token()}`)
}

describe('GET /api/full-test/status — TC-054 completion gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.writingAnswer.updateMany.mockResolvedValue({ count: 0 })
  })

  it('marks the test complete only when every Writing task and Speaking part is graded with a score', async () => {
    mockStatusData({
      writingAnswers: [graded(100, 10, 6), graded(101, 11, 7, '2026-11-01T12:00:00.000Z')],
      speakingAnswers: [speakingGraded(200, 20, 1, 6.5), speakingGraded(201, 21, 2, 7), speakingGraded(202, 22, 3, 7.5)],
    })

    const res = await getStatus()

    expect(res.status).toBe(200)
    expect(res.body.isComplete).toBe(true)
    expect(res.body.overallBand).not.toBeNull()
    // Writing Task 1:Task 2 = 1:2 → (6*1 + 7*2)/3 = 6.67 → 6.5
    expect(res.body.skills.writing).toMatchObject({ done: true, score: 6.5, status: 'done', graded: 2, total: 2 })
    expect(res.body.skills.speaking).toMatchObject({ done: true, status: 'done', graded: 3, total: 3 })
    // Reading/Listening giữ nguyên hành vi.
    expect(res.body.skills.reading).toMatchObject({ done: true, score: 7 })
    expect(res.body.skills.listening).toMatchObject({ done: true, score: 7.5 })
  })

  it('is not complete while Writing Task 2 is still pending', async () => {
    mockStatusData({
      writingAnswers: [
        graded(100, 10, 6),
        { id: 101, taskId: 11, aiScore: null, status: 'pending', createdAt: new Date('2026-11-01T12:00:00.000Z') },
      ],
      speakingAnswers: [speakingGraded(200, 20, 1, 6.5), speakingGraded(201, 21, 2, 7), speakingGraded(202, 22, 3, 7.5)],
    })

    const res = await getStatus()

    expect(res.body.isComplete).toBe(false)
    expect(res.body.overallBand).toBeNull()
    expect(res.body.skills.writing).toMatchObject({ done: false, score: null, status: 'pending', graded: 1, total: 2 })
  })

  it('distinguishes grading / failed / missing-score states', async () => {
    // grading
    mockStatusData({
      writingAnswers: [
        graded(100, 10, 6),
        { id: 101, taskId: 11, aiScore: null, status: 'grading', createdAt: new Date('2026-11-01T12:00:00.000Z') },
      ],
      speakingAnswers: [speakingGraded(200, 20, 1, 6.5), speakingGraded(201, 21, 2, 7), speakingGraded(202, 22, 3, 7.5)],
    })
    let res = await getStatus()
    expect(res.body.isComplete).toBe(false)
    expect(res.body.skills.writing).toMatchObject({ done: false, status: 'grading' })

    // failed
    vi.clearAllMocks()
    prismaMock.writingAnswer.updateMany.mockResolvedValue({ count: 0 })
    mockStatusData({
      writingAnswers: [
        graded(100, 10, 6),
        { id: 101, taskId: 11, aiScore: null, status: 'failed', createdAt: new Date('2026-11-01T12:00:00.000Z') },
      ],
      speakingAnswers: [speakingGraded(200, 20, 1, 6.5), speakingGraded(201, 21, 2, 7), speakingGraded(202, 22, 3, 7.5)],
    })
    res = await getStatus()
    expect(res.body.isComplete).toBe(false)
    expect(res.body.skills.writing).toMatchObject({ done: false, status: 'failed' })

    // graded nhưng thiếu aiScore (dữ liệu lỗi) → vẫn chưa hoàn tất
    vi.clearAllMocks()
    prismaMock.writingAnswer.updateMany.mockResolvedValue({ count: 0 })
    mockStatusData({
      writingAnswers: [
        graded(100, 10, 6),
        { id: 101, taskId: 11, aiScore: null, status: 'graded', createdAt: new Date('2026-11-01T12:00:00.000Z') },
      ],
      speakingAnswers: [speakingGraded(200, 20, 1, 6.5), speakingGraded(201, 21, 2, 7), speakingGraded(202, 22, 3, 7.5)],
    })
    res = await getStatus()
    expect(res.body.isComplete).toBe(false)
    expect(res.body.skills.writing).toMatchObject({ done: false, status: 'in_progress', graded: 1, total: 2 })
  })

  it('does not complete the test when a Speaking part is still grading', async () => {
    mockStatusData({
      writingAnswers: [graded(100, 10, 6), graded(101, 11, 7, '2026-11-01T12:00:00.000Z')],
      speakingAnswers: [
        speakingGraded(200, 20, 1, 6.5),
        { id: 201, partId: 21, aiScore: null, status: 'grading', createdAt: new Date('2026-11-01T12:00:00.000Z'), part: { number: 2 } },
        speakingGraded(202, 22, 3, 7.5),
      ],
    })

    const res = await getStatus()

    expect(res.body.isComplete).toBe(false)
    expect(res.body.overallBand).toBeNull()
    expect(res.body.skills.speaking).toMatchObject({ done: false, score: null, status: 'grading', graded: 2, total: 3 })
  })
})

describe('GET /api/full-test/user-progress — TC-054', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.writingAnswer.updateMany.mockResolvedValue({ count: 0 })
  })

  it('applies the same completion gating and Writing 1:2 weighting', async () => {
    prismaMock.exam.findMany.mockResolvedValue([
      { id: 1, skill: 'reading', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [], speakingParts: [] },
      { id: 2, skill: 'listening', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [], speakingParts: [] },
      { id: 3, skill: 'writing', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [{ id: 10, number: 1 }, { id: 11, number: 2 }], speakingParts: [] },
      { id: 4, skill: 'speaking', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [], speakingParts: [{ id: 20 }] },
    ])
    prismaMock.attempt.findMany.mockResolvedValue([{ examId: 1, score: 7 }, { examId: 2, score: 7.5 }])
    prismaMock.writingAnswer.findMany.mockResolvedValue([
      { ...graded(100, 10, 6), task: { examId: 3 } },
      { ...graded(101, 11, 7, '2026-11-01T12:00:00.000Z'), task: { examId: 3 } },
    ])
    prismaMock.speakingAnswer.findMany.mockResolvedValue([
      { id: 200, partId: 20, aiScore: 6.5, status: 'graded', createdAt: new Date('2026-11-01T10:00:00.000Z'), part: { examId: 4, number: 1 } },
    ])

    const res = await request(app)
      .get('/api/full-test/user-progress')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].isComplete).toBe(true)
    expect(res.body[0].skills.writing).toMatchObject({ done: true, score: 6.5, status: 'done', graded: 2, total: 2 })
    expect(res.body[0].skills.speaking).toMatchObject({ done: true, status: 'done', graded: 1, total: 1 })
  })

  it('keeps isComplete false while a Writing task is pending', async () => {
    prismaMock.exam.findMany.mockResolvedValue([
      { id: 1, skill: 'reading', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [], speakingParts: [] },
      { id: 2, skill: 'listening', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [], speakingParts: [] },
      { id: 3, skill: 'writing', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [{ id: 10, number: 1 }, { id: 11, number: 2 }], speakingParts: [] },
      { id: 4, skill: 'speaking', seriesId: 9, bookNumber: 1, testNumber: 1, writingTasks: [], speakingParts: [{ id: 20 }] },
    ])
    prismaMock.attempt.findMany.mockResolvedValue([{ examId: 1, score: 7 }, { examId: 2, score: 7.5 }])
    prismaMock.writingAnswer.findMany.mockResolvedValue([
      { ...graded(100, 10, 6), task: { examId: 3 } },
      { id: 101, taskId: 11, aiScore: null, status: 'pending', createdAt: new Date('2026-11-01T12:00:00.000Z'), task: { examId: 3 } },
    ])
    prismaMock.speakingAnswer.findMany.mockResolvedValue([
      { id: 200, partId: 20, aiScore: 6.5, status: 'graded', createdAt: new Date('2026-11-01T10:00:00.000Z'), part: { examId: 4, number: 1 } },
    ])

    const res = await request(app)
      .get('/api/full-test/user-progress')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body[0].isComplete).toBe(false)
    expect(res.body[0].overallBand).toBeNull()
    expect(res.body[0].skills.writing).toMatchObject({ done: false, score: null, status: 'pending', graded: 1, total: 2 })
  })
})
