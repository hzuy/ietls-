import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
}

const emailVerificationMock = {
  issueVerificationCode: vi.fn(),
  verifyCode: vi.fn(),
  getCooldownSeconds: vi.fn(),
  RESEND_COOLDOWN_MS: 60000,
}
const emailVerificationPath = require.resolve('../lib/emailVerification')
require.cache[emailVerificationPath] = {
  id: emailVerificationPath,
  filename: emailVerificationPath,
  loaded: true,
  exports: emailVerificationMock,
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
    emailVerificationMock.getCooldownSeconds.mockResolvedValue(0)
    emailVerificationMock.issueVerificationCode.mockResolvedValue(undefined)
  })

  describe('POST /api/auth/register', () => {
    it('creates an unverified user and sends a verification code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({ id: 101, email: 'newuser@example.com', name: 'New User' })

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123', name: 'New User' })

      expect(res.status).toBe(201)
      expect(res.body.userId).toBe(101)
      expect(res.body.needsVerification).toBe(true)
      expect(res.body.mailSent).toBe(true)
      expect(res.body.token).toBeUndefined()
      expect(prismaMock.user.create.mock.calls[0][0].data.emailVerified).toBe(false)
      expect(emailVerificationMock.issueVerificationCode).toHaveBeenCalledWith(expect.objectContaining({ id: 101 }))
    })

    it('still returns 201 with mailSent=false when sending the code fails', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({ id: 102, email: 'a@example.com', name: 'A' })
      emailVerificationMock.issueVerificationCode.mockRejectedValue(new Error('SMTP down'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'a@example.com', password: 'password123', name: 'A' })

      spy.mockRestore()
      expect(res.status).toBe(201)
      expect(res.body.mailSent).toBe(false)
    })

    it('lets a pending unverified account re-register and resends the code', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 7, email: 'p@example.com', password: 'old', emailVerified: false, deletedAt: null })
      prismaMock.user.update.mockResolvedValue({ id: 7, email: 'p@example.com', name: 'New Name' })

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'p@example.com', password: 'password123', name: 'New Name' })

      expect(res.status).toBe(201)
      expect(prismaMock.user.create).not.toHaveBeenCalled()
      expect(prismaMock.user.update.mock.calls[0][0].data.name).toBe('New Name')
      expect(emailVerificationMock.issueVerificationCode).toHaveBeenCalled()
    })

    it('does not send a new code during the resend cooldown', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 7, email: 'p@example.com', password: 'old', emailVerified: false, deletedAt: null })
      prismaMock.user.update.mockResolvedValue({ id: 7, email: 'p@example.com', name: 'P' })
      emailVerificationMock.getCooldownSeconds.mockResolvedValue(30)

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'p@example.com', password: 'password123', name: 'P' })

      expect(res.status).toBe(201)
      expect(res.body.mailSent).toBe(true)
      expect(emailVerificationMock.issueVerificationCode).not.toHaveBeenCalled()
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

    it('returns 403 EMAIL_NOT_VERIFIED without a token for an unverified account', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)
      prismaMock.user.findUnique.mockResolvedValue({
        id: 5,
        email: 'pending@example.com',
        password: hashedPassword,
        name: 'Pending',
        role: 'user',
        isLocked: false,
        emailVerified: false,
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pending@example.com', password: 'password123' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED')
      expect(res.body.email).toBe('pending@example.com')
      expect(res.body.token).toBeUndefined()
      expect(emailVerificationMock.issueVerificationCode).toHaveBeenCalled()
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

  describe('POST /api/auth/verify-email', () => {
    const pending = { id: 5, email: 'pending@example.com', name: 'Pending', role: 'user', isLocked: false, emailVerified: false, deletedAt: null }

    it('verifies the code and returns a login token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending)
      emailVerificationMock.verifyCode.mockResolvedValue({ ok: true })

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'pending@example.com', code: '123456' })

      expect(res.status).toBe(200)
      expect(res.body.token).toBeDefined()
      expect(res.body.user.email).toBe('pending@example.com')
      expect(emailVerificationMock.verifyCode).toHaveBeenCalledWith(5, '123456')
    })

    it('returns 400 with remaining attempts when the code is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending)
      emailVerificationMock.verifyCode.mockResolvedValue({ ok: false, reason: 'invalid', remaining: 3 })

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'pending@example.com', code: '000000' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('INVALID_CODE')
      expect(res.body.message).toContain('3 lần')
      expect(res.body.token).toBeUndefined()
    })

    it('rejects a code that is not 6 digits', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'pending@example.com', code: '12ab' })

      expect(res.status).toBe(400)
      expect(emailVerificationMock.verifyCode).not.toHaveBeenCalled()
    })

    it('returns ALREADY_VERIFIED for an account that is already verified', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...pending, emailVerified: true })

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'pending@example.com', code: '123456' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('ALREADY_VERIFIED')
      expect(emailVerificationMock.verifyCode).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/auth/resend-verification', () => {
    const pending = { id: 5, email: 'pending@example.com', name: 'Pending', emailVerified: false, deletedAt: null }

    it('sends a new code for a pending account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending)

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'pending@example.com' })

      expect(res.status).toBe(200)
      expect(res.body.retryAfter).toBe(60)
      expect(emailVerificationMock.issueVerificationCode).toHaveBeenCalledWith(pending)
    })

    it('returns 429 during the cooldown', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending)
      emailVerificationMock.getCooldownSeconds.mockResolvedValue(42)

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'pending@example.com' })

      expect(res.status).toBe(429)
      expect(res.body.retryAfter).toBe(42)
      expect(emailVerificationMock.issueVerificationCode).not.toHaveBeenCalled()
    })

    it('returns 502 when the mail cannot be sent', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending)
      emailVerificationMock.issueVerificationCode.mockRejectedValue(new Error('SMTP down'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'pending@example.com' })

      spy.mockRestore()
      expect(res.status).toBe(502)
    })

    it('answers generically for unknown or verified emails without sending', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@example.com' })

      expect(res.status).toBe(200)
      expect(emailVerificationMock.issueVerificationCode).not.toHaveBeenCalled()
    })
  })
})
