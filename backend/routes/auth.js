const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const router = express.Router()
const prisma = require('../lib/prisma')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { authLimiter, emailCodeLimiter } = require('../middleware/rateLimiter')
const { issueVerificationCode, verifyCode, getCooldownSeconds, RESEND_COOLDOWN_MS } = require('../lib/emailVerification')
const {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/authValidator')

// Lazy init giống lib/groqClient.js — tránh throw khi GOOGLE_CLIENT_ID chưa set lúc load module
let googleClient = null
function getGoogleClient() {
  if (!googleClient) {
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  }
  return googleClient
}

function loginResponse(user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    requirePasswordChange: user.requirePasswordChange === true,
  }
}

async function sendCodeIfAllowed(user) {
  try {
    if (await getCooldownSeconds(user.id)) return true
    await issueVerificationCode(user)
    return true
  } catch (error) {
    console.error('[auth] Gửi mã xác thực thất bại:', error.message)
    return false
  }
}

const VERIFY_FAIL_MESSAGES = {
  expired: 'Mã xác thực đã hết hạn. Vui lòng bấm "Gửi lại mã".',
  too_many: 'Bạn đã nhập sai quá nhiều lần. Vui lòng bấm "Gửi lại mã" để nhận mã mới.',
}

// Đăng ký
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    const pendingVerification = existing && existing.emailVerified === false && !existing.deletedAt && existing.password
    if (existing && !pendingVerification) {
      return res.status(400).json({ message: 'Email đã được sử dụng' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { name, password: hashedPassword } })
      : await prisma.user.create({ data: { email, password: hashedPassword, name, emailVerified: false } })

    const mailSent = await sendCodeIfAllowed(user)

    res.status(201).json({
      message: mailSent
        ? 'Đăng ký thành công! Vui lòng nhập mã xác thực đã gửi tới email của bạn.'
        : 'Đăng ký thành công nhưng chưa gửi được email xác thực. Vui lòng bấm "Gửi lại mã".',
      userId: user.id,
      email: user.email,
      needsVerification: true,
      mailSent,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Đăng nhập / đăng ký bằng Google Identity Services (ID token do frontend lấy được)
router.post('/google', validate(googleAuthSchema), async (req, res) => {
  try {
    const { credential } = req.body

    let payload
    try {
      const ticket = await getGoogleClient().verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload()
    } catch {
      return res.status(401).json({ message: 'Xác thực Google thất bại' })
    }

    const { sub: googleId, email, name } = payload
    if (!email) {
      return res.status(400).json({ message: 'Tài khoản Google không có email' })
    }

    let user = await prisma.user.findUnique({ where: { googleId } })

    if (!user) {
      // Chưa từng đăng nhập Google — tìm theo email để auto-link vào tài khoản local đã có
      const existingByEmail = await prisma.user.findUnique({ where: { email } })
      if (existingByEmail) {
        // Tài khoản đã soft-delete vẫn giữ email (unique) — không auto-link/tạo lại,
        // nếu không prisma.user.create bên dưới sẽ crash do trùng email.
        if (existingByEmail.deletedAt) {
          return res.status(403).json({ message: 'Tài khoản đã bị xóa. Vui lòng liên hệ quản trị viên.' })
        }
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId, emailVerified: true },
        })
      } else {
        user = await prisma.user.create({
          data: { email, name: name || email.split('@')[0], googleId, password: null },
        })
      }
    } else if (user.deletedAt) {
      return res.status(403).json({ message: 'Tài khoản đã bị xóa. Vui lòng liên hệ quản trị viên.' })
    }

    if (user.isLocked) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' })
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      requirePasswordChange: user.requirePasswordChange === true,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Đăng nhập
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu sai' })
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Tài khoản này đăng nhập bằng Google, vui lòng dùng nút "Đăng nhập với Google"' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu sai' })
    }

    if (user.isLocked) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' })
    }

    if (user.emailVerified === false) {
      const mailSent = await sendCodeIfAllowed(user)
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        mailSent,
        message: mailSent
          ? 'Email chưa được xác thực. Vui lòng nhập mã đã gửi tới email của bạn.'
          : 'Email chưa được xác thực và chưa gửi được mã. Vui lòng bấm "Gửi lại mã".',
      })
    }

    res.json(loginResponse(user))
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/verify-email', emailCodeLimiter, validate(verifyEmailSchema), async (req, res) => {
  try {
    const { email, code } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt) {
      return res.status(400).json({ message: 'Mã xác thực không đúng hoặc đã hết hạn' })
    }
    if (user.emailVerified !== false) {
      return res.status(400).json({ code: 'ALREADY_VERIFIED', message: 'Email này đã được xác thực, vui lòng đăng nhập.' })
    }

    const result = await verifyCode(user.id, code)
    if (!result.ok) {
      const message = VERIFY_FAIL_MESSAGES[result.reason] || `Mã xác thực không đúng. Bạn còn ${result.remaining} lần thử.`
      return res.status(400).json({ code: 'INVALID_CODE', reason: result.reason, message })
    }

    if (user.isLocked) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' })
    }

    res.json(loginResponse(user))
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/resend-verification', emailCodeLimiter, validate(resendVerificationSchema), async (req, res) => {
  try {
    const { email } = req.body
    const generic = { message: 'Nếu email cần xác thực, mã mới đã được gửi.', retryAfter: RESEND_COOLDOWN_MS / 1000 }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt || user.emailVerified !== false) {
      return res.json(generic)
    }

    const wait = await getCooldownSeconds(user.id)
    if (wait) {
      return res.status(429).json({ message: `Vui lòng đợi ${wait} giây trước khi gửi lại mã.`, retryAfter: wait })
    }

    try {
      await issueVerificationCode(user)
    } catch (error) {
      console.error('[auth] Gửi lại mã xác thực thất bại:', error.message)
      return res.status(502).json({ message: 'Không gửi được email xác thực. Vui lòng thử lại sau.' })
    }

    res.json({ message: 'Đã gửi mã xác thực mới tới email của bạn.', retryAfter: RESEND_COOLDOWN_MS / 1000 })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Đổi mật khẩu bắt buộc
router.put('/change-password', authMiddleware, validate(changePasswordSchema), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user.password) {
      return res.status(400).json({ message: 'Tài khoản này đăng nhập bằng Google, chưa có mật khẩu để đổi' })
    }
    const valid = await bcrypt.compare(oldPassword, user.password)
    if (!valid) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' })
    }
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashed, requirePasswordChange: false },
    })
    res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Lấy thông tin user hiện tại
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Cập nhật tên user
router.put('/profile', authMiddleware, validate(updateProfileSchema), async (req, res) => {
  try {
    const { name } = req.body

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name },
      select: { id: true, name: true, email: true, role: true },
    })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router