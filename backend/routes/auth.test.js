import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  user: {
    findUnique: vi.fn(),
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

describe('Auth Integration Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
  })

  describe('POST /api/auth/register', () => {
    it('registers user successfully when email is available', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({ id: 101, email: 'newuser@example.com', name: 'New User' })

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123', name: 'New User' })

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Đăng ký thành công!')
      expect(res.body.userId).toBe(101)
    })

    it('returns 400 when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad-email', password: 'password123', name: 'New User' })

      expect(res.status).toBe(400)
      expect(res.body.errors[0].field).toBe('email')
    })

    it('returns 400 when email already exists in DB', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'existing@example.com' })

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'password123', name: 'Existing User' })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe('Email đã được sử dụng')
    })
  })

  describe('POST /api/auth/login', () => {
    it('logins successfully with correct credentials and returns JWT token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password: hashedPassword,
        name: 'User',
        role: 'user',
        isLocked: false
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })

      expect(res.status).toBe(200)
      expect(res.body.token).toBeDefined()
      expect(res.body.user.email).toBe('user@example.com')
    })

    it('returns 400 when password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password: hashedPassword,
        isLocked: false
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'wrongpassword' })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe('Email hoặc mật khẩu sai')
    })

    it('returns 403 when user account is locked', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'locked@example.com',
        password: hashedPassword,
        isLocked: true
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'locked@example.com', password: 'password123' })

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('bị khóa')
    })
  })
})
