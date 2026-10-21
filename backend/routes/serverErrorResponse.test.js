import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

// Lỗi giả lập giống lỗi Prisma thật: có tên bảng/cột và câu SQL — loại nội dung
// KHÔNG được phép lộ ra cho client.
const INTERNAL_DETAIL =
  'Raw query failed. Code: "42703". Message: "column Exam.secretInternalColumn does not exist"'
const internalError = new Error(INTERNAL_DETAIL)

const prismaMock = {
  exam: { findMany: vi.fn() },
  setting: { findUnique: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

const userToken = () =>
  jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

describe('Phản hồi lỗi 500 — không lộ chi tiết nội bộ', () => {
  let consoleErrorSpy

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.setting.findUnique.mockResolvedValue(null)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('GET /api/reading/exams — Prisma lỗi: client chỉ nhận { message }, chi tiết vào log server', async () => {
    prismaMock.exam.findMany.mockRejectedValue(internalError)

    const res = await request(app)
      .get('/api/reading/exams')
      .set('Authorization', `Bearer ${userToken()}`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Lỗi server')
    expect(res.body).not.toHaveProperty('error')
    expect(JSON.stringify(res.body)).not.toContain('secretInternalColumn')
    expect(JSON.stringify(res.body)).not.toContain('Raw query failed')

    // Log server vẫn giữ đủ chi tiết để debug.
    const logged = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toContain('[SERVER_ERROR]')
    expect(logged).toContain(INTERNAL_DETAIL)
  })

  it('GET /api/reading/exams — lỗi thường (không phải Prisma) cũng không lộ nội dung lỗi', async () => {
    prismaMock.exam.findMany.mockRejectedValue(new Error('ENOENT: no such file or directory, open C:\\secret\\path'))

    const res = await request(app)
      .get('/api/reading/exams')
      .set('Authorization', `Bearer ${userToken()}`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Lỗi server')
    expect(JSON.stringify(res.body)).not.toContain('C:\\\\secret\\\\path')
  })
})
