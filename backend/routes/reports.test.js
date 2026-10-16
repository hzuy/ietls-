import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  errorReport: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
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

const app = require('../server')

describe('ErrorReport API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUserMock.verifySession.mockResolvedValue(null)
  })

  it('rejects POST /api/reports when description is empty', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ description: '   ', issueType: 'ui_bug' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/mô tả/i)
  })

  it('creates an error report successfully via POST /api/reports', async () => {
    prismaMock.errorReport.create.mockResolvedValue({
      id: 1,
      issueType: 'content_wrong',
      description: 'Đáp án câu 1 bị sai',
      location: 'Reading Test 1 · Câu 1',
      status: 'pending',
    })

    const res = await request(app)
      .post('/api/reports')
      .send({
        issueType: 'content_wrong',
        description: 'Đáp án câu 1 bị sai',
        location: 'Reading Test 1 · Câu 1',
        skill: 'reading',
      })

    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(res.body.reportId).toBe(1)
    expect(prismaMock.errorReport.create).toHaveBeenCalled()
  })

  it('blocks unauthenticated user from GET /api/reports/admin', async () => {
    const res = await request(app).get('/api/reports/admin')
    expect(res.status).toBe(401)
  })

  it('allows teacher/admin to fetch reports list', async () => {
    const token = jwt.sign({ userId: 1, email: 'teacher@test.com', role: 'teacher' }, process.env.JWT_SECRET)
    prismaMock.errorReport.count.mockResolvedValue(1)
    prismaMock.errorReport.findMany.mockResolvedValue([
      {
        id: 1,
        issueType: 'content_wrong',
        description: 'Lỗi',
        status: 'pending',
        user: { id: 2, name: 'Học viên', email: 'student@test.com' },
      },
    ])

    const res = await request(app)
      .get('/api/reports/admin')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.reports).toHaveLength(1)
  })

  it('allows admin/teacher to update report status via PATCH /api/reports/admin/:id', async () => {
    const token = jwt.sign({ userId: 1, email: 'admin@test.com', role: 'admin' }, process.env.JWT_SECRET)
    prismaMock.errorReport.update.mockResolvedValue({
      id: 1,
      status: 'resolved',
      adminNote: 'Đã sửa đáp án',
    })

    const res = await request(app)
      .patch('/api/reports/admin/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', adminNote: 'Đã sửa đáp án' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.report.status).toBe('resolved')
  })
})
