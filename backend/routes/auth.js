const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// Đăng ký
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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

    const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.role }, // thêm role vào đây
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
)

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router