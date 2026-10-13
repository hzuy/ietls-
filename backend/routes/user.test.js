import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  attempt: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  writingAnswer: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  speakingAnswer: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

describe('GET /api/user/stats — streak theo ngày lịch Việt Nam', () => {
  // expiresIn dài để không bị ảnh hưởng bởi vi.setSystemTime (jsonwebtoken dùng
  // Date.now() để kiểm tra exp — fake timers nhảy tới các mốc giờ khác real-time
  // ký token sẽ khiến token "hết hạn" nếu dùng expiresIn ngắn như các file test khác).
  const token = jwt.sign({ userId: 7, email: 'user@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '100y' })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.attempt.count.mockResolvedValue(0)
    prismaMock.attempt.findMany.mockResolvedValue([])
    prismaMock.writingAnswer.findMany.mockResolvedValue([])
    prismaMock.speakingAnswer.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('bài hoàn thành lúc VN 00:30 được tính vào streak "hôm nay" (không phải hôm qua)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T02:00:00.000Z')) // VN 2026-09-16 09:00

    prismaMock.attempt.findMany.mockImplementation((args) => {
      // Query đầu (select score+exam) trả rỗng; query streak (select finishedAt) trả 1 bản ghi.
      if (args?.select?.finishedAt) {
        return Promise.resolve([{ finishedAt: new Date('2026-09-15T17:30:00.000Z') }]) // VN 16/09 00:30
      }
      return Promise.resolve([])
    })

    const res = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.streak).toBe(1)
  })

  it('4 mốc biên VN 00:00/06:59/07:01/23:59 của cùng 1 ngày chỉ tính 1 ngày streak', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T20:00:00.000Z')) // VN 2026-09-17 03:00

    prismaMock.attempt.findMany.mockImplementation((args) => {
      if (args?.select?.finishedAt) {
        return Promise.resolve([
          { finishedAt: new Date('2026-09-15T17:00:00.000Z') }, // VN 16/09 00:00
          { finishedAt: new Date('2026-09-15T23:59:00.000Z') }, // VN 16/09 06:59
          { finishedAt: new Date('2026-09-16T00:01:00.000Z') }, // VN 16/09 07:01
          { finishedAt: new Date('2026-09-16T16:59:00.000Z') }, // VN 16/09 23:59
        ])
      }
      return Promise.resolve([])
    })

    const res = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.streak).toBe(1)
  })

  it('không có bài nào hôm nay/hôm qua (giờ VN) → streak 0', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T08:00:00.000Z')) // VN 16/09 15:00

    prismaMock.attempt.findMany.mockImplementation((args) => {
      if (args?.select?.finishedAt) {
        return Promise.resolve([{ finishedAt: new Date('2026-09-13T10:00:00.000Z') }])
      }
      return Promise.resolve([])
    })

    const res = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.streak).toBe(0)
  })

  it('tính band và streak từ bài thi writing & speaking', async () => {
    prismaMock.writingAnswer.findMany.mockResolvedValue([
      { id: 1, taskId: 1, aiScore: 6.5, status: 'graded', createdAt: new Date('2026-09-16T02:00:00.000Z'), task: { examId: 10, exam: { _count: { writingTasks: 1 } } } }
    ])
    prismaMock.speakingAnswer.findMany.mockResolvedValue([
      { id: 2, partId: 1, aiScore: 5.5, status: 'graded', createdAt: new Date('2026-09-16T03:00:00.000Z'), part: { examId: 20, number: 1, exam: { _count: { speakingParts: 1 } } } }
    ])

    const res = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.bandBySkill.writing).toBe(6.5)
    expect(res.body.bandBySkill.speaking).toBe(5.5)
    expect(res.body.avgBand).toBe(6.0)
    expect(res.body.totalAttempts).toBe(2)
  })
})
