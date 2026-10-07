import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  emailVerificationCode: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { update: vi.fn() },
  $transaction: vi.fn(),
}
const prismaPath = require.resolve('./prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }

const mailerMock = { sendMail: vi.fn() }
const mailerPath = require.resolve('./mailer')
require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true, exports: mailerMock }

const {
  issueVerificationCode,
  verifyCode,
  getCooldownSeconds,
  hashCode,
  MAX_ATTEMPTS,
} = require('./emailVerification')

describe('emailVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.emailVerificationCode.create.mockResolvedValue({ id: 9 })
    mailerMock.sendMail.mockResolvedValue({ skipped: false })
  })

  it('issues a 6-digit code, stores only its hash and mails it', async () => {
    await issueVerificationCode({ id: 3, email: 'u@example.com', name: 'U' })

    expect(prismaMock.emailVerificationCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 3 } })
    const stored = prismaMock.emailVerificationCode.create.mock.calls[0][0].data
    const mail = mailerMock.sendMail.mock.calls[0][0]
    const code = mail.subject.match(/^(\d{6}) /)[1]
    expect(mail.to).toBe('u@example.com')
    expect(mail.text).toContain(code)
    expect(stored.codeHash).toBe(hashCode(3, code))
    expect(stored.codeHash).not.toContain(code)
    expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('removes the stored code when the mail fails', async () => {
    mailerMock.sendMail.mockRejectedValue(new Error('SMTP down'))

    await expect(issueVerificationCode({ id: 3, email: 'u@example.com', name: 'U' })).rejects.toThrow('SMTP down')
    expect(prismaMock.emailVerificationCode.deleteMany).toHaveBeenLastCalledWith({ where: { id: 9 } })
  })

  it('escapes the user name in the html body', async () => {
    await issueVerificationCode({ id: 3, email: 'u@example.com', name: '<script>' })
    expect(mailerMock.sendMail.mock.calls[0][0].html).toContain('&lt;script&gt;')
  })

  it('accepts the right code and marks the user verified', async () => {
    prismaMock.emailVerificationCode.findFirst.mockResolvedValue({ id: 1, codeHash: hashCode(3, '123456'), attempts: 0, expiresAt: new Date(Date.now() + 60000) })

    expect(await verifyCode(3, '123456')).toEqual({ ok: true })
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { emailVerified: true } })
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('counts a wrong code and reports remaining attempts', async () => {
    prismaMock.emailVerificationCode.findFirst.mockResolvedValue({ id: 1, codeHash: hashCode(3, '123456'), attempts: 1, expiresAt: new Date(Date.now() + 60000) })
    prismaMock.emailVerificationCode.update.mockResolvedValue({ attempts: 2 })

    expect(await verifyCode(3, '654321')).toEqual({ ok: false, reason: 'invalid', remaining: MAX_ATTEMPTS - 2 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('locks the code after too many attempts even if the code is right', async () => {
    prismaMock.emailVerificationCode.findFirst.mockResolvedValue({ id: 1, codeHash: hashCode(3, '123456'), attempts: MAX_ATTEMPTS, expiresAt: new Date(Date.now() + 60000) })

    expect(await verifyCode(3, '123456')).toEqual({ ok: false, reason: 'too_many' })
  })

  it('rejects an expired or missing code', async () => {
    prismaMock.emailVerificationCode.findFirst.mockResolvedValue({ id: 1, codeHash: hashCode(3, '123456'), attempts: 0, expiresAt: new Date(Date.now() - 1000) })
    expect(await verifyCode(3, '123456')).toEqual({ ok: false, reason: 'expired' })

    prismaMock.emailVerificationCode.findFirst.mockResolvedValue(null)
    expect(await verifyCode(3, '123456')).toEqual({ ok: false, reason: 'expired' })
  })

  it('computes the resend cooldown from the latest code', async () => {
    prismaMock.emailVerificationCode.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 20000) })
    const wait = await getCooldownSeconds(3)
    expect(wait).toBeGreaterThan(35)
    expect(wait).toBeLessThanOrEqual(40)

    prismaMock.emailVerificationCode.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 120000) })
    expect(await getCooldownSeconds(3)).toBe(0)

    prismaMock.emailVerificationCode.findFirst.mockResolvedValue(null)
    expect(await getCooldownSeconds(3)).toBe(0)
  })
})
