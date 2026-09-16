import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

process.env.JWT_SECRET = 'test_secret_key'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'

// ─── Mock google-auth-library — kiểm soát payload trả về từ verifyIdToken để
// test các nhánh xử lý tài khoản đã soft-delete ở POST /api/auth/google mà
// không cần ID token Google thật.
const verifyIdTokenMock = vi.fn()
class MockOAuth2Client {
  verifyIdToken(...args) {
    return verifyIdTokenMock(...args)
  }
}
const googleLibPath = require.resolve('google-auth-library')
require.cache[googleLibPath] = {
  id: googleLibPath,
  filename: googleLibPath,
  loaded: true,
  exports: { OAuth2Client: MockOAuth2Client }
}

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
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

function mockGooglePayload({ googleId = 'google-sub-1', email = 'student@example.com', name = 'Student' } = {}) {
  verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => ({ sub: googleId, email, name }) })
}

describe('POST /api/auth/google — soft-delete guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('từ chối khi tài khoản được tìm thấy trực tiếp theo googleId đã soft-delete', async () => {
    mockGooglePayload({ googleId: 'google-sub-deleted' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'deleted@example.com', role: 'user', isLocked: false, deletedAt: new Date()
    })

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-id-token' })
      .expect(403)

    expect(res.body.message).toContain('đã bị xóa')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('từ chối khi auto-link theo email trúng tài khoản đã soft-delete, KHÔNG update/create (tránh crash trùng email)', async () => {
    mockGooglePayload({ email: 'deleted@example.com' })
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // không có ai khớp googleId
      .mockResolvedValueOnce({ id: 2, email: 'deleted@example.com', role: 'user', isLocked: false, deletedAt: new Date() }) // khớp email

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-id-token' })
      .expect(403)

    expect(res.body.message).toContain('đã bị xóa')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('vẫn đăng nhập bình thường khi tài khoản khớp googleId chưa bị xóa', async () => {
    mockGooglePayload({ googleId: 'google-sub-active' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 3, name: 'Active User', email: 'active@example.com', role: 'user', isLocked: false, deletedAt: null, requirePasswordChange: false
    })

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-id-token' })
      .expect(200)

    expect(res.body.token).toBeTruthy()
    expect(res.body.user.email).toBe('active@example.com')
  })
})
