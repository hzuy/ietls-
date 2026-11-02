const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const { sendServerError } = require('../lib/httpErrors')
const router = express.Router()
const prisma = require('../lib/prisma')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { changePassword } = require('../lib/changePassword')
const { authLimiter, emailCodeLimiter, passwordChangeLimiters } = require('../middleware/rateLimiter')
const { issueVerificationCode, verifyCode, getCooldownSeconds, RESEND_COOLDOWN_MS } = require('../lib/emailVerification')
const {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  changePasswordInputSchema,
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
    { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    requirePasswordChange: user.requirePasswordChange === true && Boolean(user.password),
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
    sendServerError(res, error, 'Lỗi server')
  }
})

// Đăng nhập / đăng ký bằng Google (ID token hoặc OAuth2 access token)
router.post('/google', validate(googleAuthSchema), async (req, res) => {
  try {
    const { credential, accessToken } = req.body

    let payload
    if (credential) {
      try {
        const ticket = await getGoogleClient().verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        })
        payload = ticket.getPayload()
      } catch {
        return res.status(401).json({ message: 'Xác thực Google thất bại' })
      }
    } else if (accessToken) {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) {
          return res.status(401).json({ message: 'Xác thực Google thất bại' })
        }
        payload = await response.json()
      } catch {
        return res.status(401).json({ message: 'Xác thực Google thất bại' })
      }
    } else {
      return res.status(400).json({ message: 'Thiếu credential hoặc accessToken từ Google' })
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

    res.json(loginResponse(user))
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
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
    sendServerError(res, error, 'Lỗi server')
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
    sendServerError(res, error, 'Lỗi server')
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
    sendServerError(res, error, 'Lỗi server')
  }
})

// Đổi mật khẩu bắt buộc
router.put('/change-password', authMiddleware, ...passwordChangeLimiters, validate(changePasswordInputSchema), async (req, res) => {
  try {
    const { status, ...body } = await changePassword(req.user, req.body.oldPassword, req.body.newPassword)
    res.status(status).json(body)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// Lấy thông tin user hiện tại
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true, password: true, requirePasswordChange: true },
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    const { password, ...profile } = user
    res.json({ ...profile, hasPassword: Boolean(password) })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
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
    sendServerError(res, error, 'Lỗi server')
  }
})

module.exports = router
