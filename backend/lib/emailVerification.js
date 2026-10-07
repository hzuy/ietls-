'use strict'
const crypto = require('crypto')
const prisma = require('./prisma')
const { sendMail } = require('./mailer')

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_ATTEMPTS = 5

function hashCode(userId, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET || '').update(`${userId}:${code}`).digest('hex')
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function buildMail(name, code) {
  const minutes = CODE_TTL_MS / 60000
  const text = `Xin chào ${name},\n\nMã xác thực email IELTS Pro của bạn là: ${code}\nMã có hiệu lực trong ${minutes} phút.\n\nNếu bạn không đăng ký tài khoản, hãy bỏ qua email này.`
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18181b">
  <h2 style="margin:0 0 16px">Xác thực email IELTS Pro</h2>
  <p>Xin chào ${escapeHtml(name)},</p>
  <p>Mã xác thực của bạn là:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
  <p>Mã có hiệu lực trong ${minutes} phút.</p>
  <p style="color:#71717a;font-size:13px">Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>
</div>`
  return { subject: `${code} là mã xác thực IELTS Pro của bạn`, text, html }
}

async function getCooldownSeconds(userId) {
  const latest = await prisma.emailVerificationCode.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!latest) return 0
  const elapsed = Date.now() - new Date(latest.createdAt).getTime()
  return elapsed < RESEND_COOLDOWN_MS ? Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) : 0
}

async function issueVerificationCode(user) {
  const code = generateCode()
  await prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } })
  const record = await prisma.emailVerificationCode.create({
    data: { userId: user.id, codeHash: hashCode(user.id, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  })
  try {
    await sendMail({ to: user.email, ...buildMail(user.name, code) })
  } catch (err) {
    await prisma.emailVerificationCode.deleteMany({ where: { id: record.id } })
    throw err
  }
}

async function verifyCode(userId, code) {
  const record = await prisma.emailVerificationCode.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  if (!record || new Date(record.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many' }

  const expected = Buffer.from(record.codeHash, 'hex')
  const actual = Buffer.from(hashCode(userId, code), 'hex')
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    const updated = await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    })
    const remaining = Math.max(0, MAX_ATTEMPTS - updated.attempts)
    return { ok: false, reason: remaining === 0 ? 'too_many' : 'invalid', remaining }
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { emailVerified: true } }),
    prisma.emailVerificationCode.deleteMany({ where: { userId } }),
  ])
  return { ok: true }
}

module.exports = {
  issueVerificationCode,
  verifyCode,
  getCooldownSeconds,
  hashCode,
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
}
