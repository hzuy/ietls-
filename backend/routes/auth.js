const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const router = express.Router()
const prisma = require('../lib/prisma')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/authValidator')

// Đăng ký
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ message: 'Email đã được sử dụng' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name }
    })

    res.status(201).json({ message: 'Đăng ký thành công!', userId: user.id })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Đăng nhập
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu sai' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu sai' })
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

// Đổi mật khẩu bắt buộc
router.put('/change-password', authMiddleware, validate(changePasswordSchema), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
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