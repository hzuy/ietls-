const express = require('express')
const bcrypt = require('bcryptjs')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { roundBand } = require('../../lib/scoreUtils')
const { adminOnly, teacherOrAdmin } = require('../../lib/roles')
const {
  adminChangePasswordSchema,
  createAccountSchema,
  updateAccountSchema,
  userIdSchema,
  updateSettingsSchema,
} = require('../../validators/authValidator')

// ─── MAKE ADMIN ──────────────────────────────────────────────────────────────
router.post('/make-admin', authMiddleware, adminOnly, validate(userIdSchema), async (req, res) => {
  try {
    const targetId = req.body.userId
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role: 'admin' },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json({ message: 'Đã nâng quyền admin!', user })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── USERS ───────────────────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20, status = '', sort = 'newest' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const baseWhere = { role: 'user' }

    // Apply status filter
    if (status === 'active') baseWhere.isLocked = false
    if (status === 'locked') baseWhere.isLocked = true

    const where = search ? {
      ...baseWhere,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : baseWhere

    // Determine orderBy (band sort is done post-query)
    let orderBy = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    else if (sort === 'az') orderBy = { name: 'asc' }

    const [users, total, totalActive, totalLocked] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy,
        select: {
          id: true, name: true, email: true, role: true,
          isLocked: true, createdAt: true,
          _count: { select: { attempts: true } }
        }
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { role: 'user', isLocked: false } }),
      prisma.user.count({ where: { role: 'user', isLocked: true } }),
    ])

    const userIds = users.map(u => u.id)
    const [avgScores, lastAttempts] = await Promise.all([
      prisma.attempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, score: { not: null } },
        _avg: { score: true }
      }),
      prisma.attempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _max: { createdAt: true }
      })
    ])
    const avgMap = Object.fromEntries(avgScores.map(a => [a.userId, roundBand(a._avg.score)]))
    const lastMap = Object.fromEntries(lastAttempts.map(a => [a.userId, a._max.createdAt]))

    let mergedUsers = users.map(u => ({
      ...u,
      avgScore: avgMap[u.id] ?? null,
      lastAttemptAt: lastMap[u.id] ?? null,
    }))

    // Band sort: sort merged array by avgScore descending
    if (sort === 'band') {
      mergedUsers.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))
    }

    res.json({
      users: mergedUsers,
      total,
      totalActive,
      totalLocked,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })

    const [attempts, skillAvg, totalAttemptsCount] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { exam: { select: { title: true, skill: true } } }
      }),
      prisma.attempt.groupBy({
        by: ['examId'],
        where: { userId: id, score: { not: null } },
        _avg: { score: true }
      }),
      prisma.attempt.count({ where: { userId: id } }),
    ])

    // Build skill lookup from already-fetched attempts — no extra DB query needed
    const skillLookup = Object.fromEntries(
      attempts.filter(a => a.exam).map(a => [a.examId, a.exam.skill])
    )
    const bySkill = { reading: [], listening: [], writing: [], speaking: [] }
    skillAvg.forEach(a => {
      const s = skillLookup[a.examId]
      if (s && s in bySkill) bySkill[s].push(a._avg.score)
    })
    const skillStats = Object.fromEntries(
      Object.entries(bySkill).map(([s, scores]) => [
        s, scores.length > 0 ? roundBand(scores.reduce((a,b) => a+b, 0) / scores.length) : null
      ])
    )

    res.json({ user, attempts, skillStats, totalAttempts: totalAttemptsCount, shownAttempts: attempts.length })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/users/:id/toggle-lock', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findUnique({ where: { id }, select: { isLocked: true } })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })
    const updated = await prisma.user.update({ where: { id }, data: { isLocked: !user.isLocked } })
    res.json({ isLocked: updated.isLocked })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Không thể xóa tài khoản đang dùng' })
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isLocked: true } })
    res.json({ message: 'Đã xóa user (soft delete)' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── PROFILE (CURRENT USER) ──────────────────────────────────────────────────
router.get('/me', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/me/password', authMiddleware, teacherOrAdmin, validate(adminChangePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.userId }, data: { password: hashed } })
    res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── ACCOUNTS (ADMIN/TEACHER) ────────────────────────────────────────────────
router.get('/accounts', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      const account = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
      })
      return res.json(account ? [account] : [])
    }
    const accounts = await prisma.user.findMany({
      where: { role: { in: ['admin', 'teacher'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(accounts)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/accounts', authMiddleware, adminOnly, validate(createAccountSchema), async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ message: 'Email đã tồn tại' })
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.status(201).json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/accounts/:id', authMiddleware, teacherOrAdmin, validate(updateAccountSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (req.user.role === 'teacher' && id !== req.user.userId) {
      return res.status(403).json({ message: 'Không có quyền truy cập' })
    }
    const { name, role, isLocked, password } = req.body
    if (req.user.role !== 'admin' && role !== undefined) {
      return res.status(403).json({ message: 'Chỉ admin mới có thể thay đổi role' })
    }
    const data = {}
    if (name) data.name = name
    if (password && password.trim()) {
      data.password = await bcrypt.hash(password.trim(), 10)
    }
    if (req.user.role === 'admin') {
      if (role) data.role = role
      if (isLocked !== undefined) data.isLocked = isLocked
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/accounts/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Không thể xóa tài khoản đang dùng' })
    await prisma.user.delete({ where: { id } })
    res.json({ message: 'Đã xóa tài khoản' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── SETTINGS ────────────────────────────────────────────────────────────────
router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany()
    const obj = Object.fromEntries(settings.map(s => [s.key, s.value]))
    res.json(obj)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/settings', authMiddleware, adminOnly, validate(updateSettingsSchema), async (req, res) => {
  try {
    const entries = Object.entries(req.body)
    await Promise.all(entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    ))
    res.json({ message: 'Đã lưu cài đặt' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── STAFF MANAGEMENT ────────────────────────────────────────────────────────
router.get('/staff', authMiddleware, adminOnly, async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['admin', 'teacher'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(staff)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/make-teacher', authMiddleware, adminOnly, validate(userIdSchema), async (req, res) => {
  try {
    const { userId } = req.body
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'teacher' },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json({ message: 'Đã nâng quyền teacher!', user })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/remove-staff', authMiddleware, adminOnly, validate(userIdSchema), async (req, res) => {
  try {
    const { userId } = req.body
    if (userId === req.user.userId) return res.status(400).json({ message: 'Không thể tự xóa quyền của mình' })
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'user' },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json({ message: 'Đã xóa quyền staff', user })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
router.post('/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })

    // Generate 8-char password: uppercase + lowercase + digits (no ambiguous chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]

    const hashed = await bcrypt.hash(pwd, 10)
    await prisma.user.update({ where: { id }, data: { password: hashed } })

    // Return plaintext ONCE — never log it
    res.json({ newPassword: pwd })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
