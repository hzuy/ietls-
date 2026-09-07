import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
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

describe('Admin Users & Accounts Role Guards (BUG-21)', () => {
  const adminToken = jwt.sign(
    { userId: 1, email: 'admin@example.com', role: 'admin' },
    'test_secret_key',
    { expiresIn: '1h' }
  )
  const teacherToken = jwt.sign(
    { userId: 2, email: 'teacher@example.com', role: 'teacher' },
    'test_secret_key',
    { expiresIn: '1h' }
  )
  const userToken = jwt.sign(
    { userId: 3, email: 'user@example.com', role: 'user' },
    'test_secret_key',
    { expiresIn: '1h' }
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PUT /api/admin/accounts/:id - Role Change Security Guard', () => {
    it('allows admin to change another user role to admin or teacher', async () => {
      prismaMock.user.update.mockResolvedValueOnce({
        id: 2,
        name: 'Teacher Minh',
        email: 'teacher@example.com',
        role: 'admin',
        isLocked: false,
        createdAt: '2026-01-01'
      })

      const res = await request(app)
        .put('/api/admin/accounts/2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200)

      expect(res.body.role).toBe('admin')
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: expect.objectContaining({ role: 'admin' }),
        select: expect.any(Object)
      })
    })

    it('blocks teacher from changing role of their own account (403 Forbidden)', async () => {
      const res = await request(app)
        .put('/api/admin/accounts/2')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ role: 'admin' })
        .expect(403)

      expect(res.body.message).toBe('Chỉ admin mới có thể thay đổi role')
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('blocks teacher from editing another account altogether (403 Forbidden)', async () => {
      const res = await request(app)
        .put('/api/admin/accounts/1')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403)

      expect(res.body.message).toBe('Không có quyền truy cập')
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('blocks student (role user) from accessing account updates (403 Forbidden)', async () => {
      await request(app)
        .put('/api/admin/accounts/3')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Student Name' })
        .expect(403)

      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/admin/accounts - Creation Guard', () => {
    it('blocks teacher from creating accounts (403 Forbidden)', async () => {
      await request(app)
        .post('/api/admin/accounts')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'New Staff',
          email: 'staff@example.com',
          password: 'password123',
          role: 'teacher'
        })
        .expect(403)

      expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('allows admin to create account with teacher role', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null)
      prismaMock.user.create.mockResolvedValueOnce({
        id: 10,
        name: 'New Teacher',
        email: 'newteacher@example.com',
        role: 'teacher',
        isLocked: false,
        createdAt: '2026-01-01'
      })

      const res = await request(app)
        .post('/api/admin/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Teacher',
          email: 'newteacher@example.com',
          password: 'password123',
          role: 'teacher'
        })
        .expect(201)

      expect(res.body.role).toBe('teacher')
    })
  })

  describe('POST /api/admin/make-admin & /make-teacher', () => {
    it('blocks teacher from calling make-admin (403 Forbidden)', async () => {
      await request(app)
        .post('/api/admin/make-admin')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ userId: 5 })
        .expect(403)

      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('blocks teacher from calling make-teacher (403 Forbidden)', async () => {
      await request(app)
        .post('/api/admin/make-teacher')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ userId: 5 })
        .expect(403)

      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('allows admin to promote user to teacher', async () => {
      prismaMock.user.update.mockResolvedValueOnce({
        id: 5,
        name: 'Student To Teacher',
        email: 'student@example.com',
        role: 'teacher'
      })

      const res = await request(app)
        .post('/api/admin/make-teacher')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 5 })
        .expect(200)

      expect(res.body.message).toContain('Đã nâng quyền teacher!')
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { role: 'teacher' },
        select: expect.any(Object)
      })
    })
  })
})
