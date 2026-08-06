import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  user: {
    count: vi.fn().mockResolvedValue(100),
    findMany: vi.fn().mockResolvedValue([])
  },
  attempt: {
    count: vi.fn().mockResolvedValue(50),
    aggregate: vi.fn().mockResolvedValue({ _avg: { score: 6.5 } }),
    groupBy: vi.fn().mockResolvedValue([]),
    findMany: vi.fn().mockResolvedValue([])
  },
  exam: {
    count: vi.fn().mockResolvedValue(20),
    findMany: vi.fn().mockResolvedValue([])
  },
  $queryRaw: vi.fn().mockImplementation(() => {
    return Promise.resolve([
      { c0: 2, c1: 5, c2: 10, c3: 15, c4: 12, c5: 6, date: '2026-03-26', count: 5 }
    ])
  })
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock
}

const app = require('../server')

describe('Dashboard Router & Optimizations', () => {
  const adminToken = jwt.sign({ userId: 1, email: 'admin@example.com', role: 'admin' }, 'test_secret_key', { expiresIn: '1h' })
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/admin/dashboard returns valid aggregated statistics with SWR & Raw SQL', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('stats')
    expect(res.body.stats.totalUsers).toBe(100)
    expect(res.body.stats.totalExams).toBe(20)
    expect(res.body).toHaveProperty('bandDistribution')
    expect(Array.isArray(res.body.bandDistribution)).toBe(true)
    expect(res.body.bandDistribution.length).toBe(6)
    expect(res.body).toHaveProperty('registrationsByDay')
    expect(res.body).toHaveProperty('attemptsByDay')
  })

  it('GET /api/admin/analytics returns valid analytics data with SWR & Raw SQL', async () => {
    const res = await request(app)
      .get('/api/admin/analytics?period=week')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('overview')
    expect(res.body).toHaveProperty('bandDistribution')
    expect(res.body).toHaveProperty('attemptsByDay')
  })

  it('GET /api/admin/attempts rejects invalid scoreMin string "e" with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/admin/attempts?scoreMin=e')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(400)

    expect(res.body).toHaveProperty('message')
    expect(res.body.message).toBe('Dữ liệu không hợp lệ')
  })
})
