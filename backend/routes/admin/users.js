const express = require('express')
const bcrypt = require('bcryptjs')
const { randomInt } = require('node:crypto')
const { changePassword } = require('../../lib/changePassword')
const { passwordChangeLimiters } = require('../../middleware/rateLimiter')
const { sendServerError } = require('../../lib/httpErrors')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { loadSubmissionsByUser, bandSummary } = require('../../lib/currentBand')
const { adminOnly, teacherOrAdmin } = require('../../lib/roles')
const {
  adminChangePasswordInputSchema,
  createAccountSchema,
  updateAccountSchema,
  userIdSchema,
  updateSettingsSchema,
} = require('../../validators/authValidator')
const { logAuditEvent } = require('../../lib/auditLog')
const { AUDIT_ACTIONS } = require('../../lib/auditActions')

async function countOtherActiveAdmins(id) {
  return prisma.user.count({ where: { id: { not: id }, role: 'admin', isLocked: false, deletedAt: null } })
}
router.param('id', (req, res, next, value) => {
  if (!/^[1-9]\d*$/.test(value)) return res.status(400).json({ message: 'ID không hợp lệ' })
  next()
})

// ─── MAKE ADMIN ──────────────────────────────────────────────────────────────
router.post('/make-admin', authMiddleware, adminOnly, validate(userIdSchema), async (req, res) => {
  try {
    const targetId = req.body.userId
    const before = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } })
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role: 'admin' },
      select: { id: true, name: true, email: true, role: true }
    })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      metadata: { from: before?.role ?? null, to: user.role }
    })
    res.json({ message: 'Đã nâng quyền admin!', user })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// ─── USERS ───────────────────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search = '', status = '', sort = 'newest' } = req.query
    const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum
    const baseWhere = { role: 'user', deletedAt: null }

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

    const [fetchedUsers, total, totalActive, totalLocked] = await Promise.all([
      prisma.user.findMany({
        where,
        ...(sort === 'band' ? {} : { skip, take: limitNum }),
        orderBy,
        select: {
          id: true, name: true, email: true, role: true,
          isLocked: true, createdAt: true,
          _count: { select: { attempts: true } }
        }
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { role: 'user', isLocked: false, deletedAt: null } }),
      prisma.user.count({ where: { role: 'user', isLocked: true, deletedAt: null } }),
    ])

    const submissionsByUser = await loadSubmissionsByUser(prisma, fetchedUsers.map(u => u.id))

    let mergedUsers = fetchedUsers.map(u => {
      const summary = bandSummary(submissionsByUser[u.id] || [])
      return {
        ...u,
        avgScore: summary.avgBand,
        bandBySkill: summary.bandBySkill,
        submissionCount: summary.submissionCount,
        lastAttemptAt: summary.lastSubmittedAt,
      }
    })

    // Band sort: sort merged array by avgScore descending
    if (sort === 'band') {
      mergedUsers.sort((a, b) =>
        (b.avgScore ?? -1) - (a.avgScore ?? -1) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'vi') || a.id - b.id
      )
      mergedUsers = mergedUsers.slice(skip, skip + limitNum)
    }

    res.json({
      users: mergedUsers,
      total,
      totalActive,
      totalLocked,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.get('/users/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true, deletedAt: true }
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })

    const [attempts, submissionsByUser, totalAttemptsCount] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { exam: { select: { title: true, skill: true } } }
      }),
      loadSubmissionsByUser(prisma, [id]),
      prisma.attempt.count({ where: { userId: id } }),
    ])
    const summary = bandSummary(submissionsByUser[id] || [])
    const skillStats = summary.bandBySkill

    res.json({ user, attempts, skillStats, avgBand: summary.avgBand, submissionCount: summary.submissionCount, totalAttempts: totalAttemptsCount, shownAttempts: attempts.length })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.put('/users/:id/toggle-lock', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findFirst({ where: { id, role: 'user', deletedAt: null }, select: { isLocked: true, email: true, role: true } })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })
    if (!user.isLocked && id === req.user.userId) return res.status(400).json({ message: 'Không thể khóa tài khoản đang đăng nhập' })
    const updated = await prisma.user.update({ where: { id }, data: { isLocked: !user.isLocked } })
    await logAuditEvent(req, {
      action: updated.isLocked ? AUDIT_ACTIONS.USER_LOCK : AUDIT_ACTIONS.USER_UNLOCK,
      entityType: 'User',
      entityId: id,
      entityLabel: user.email
    })
    res.json({ isLocked: updated.isLocked })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Không thể xóa tài khoản đang dùng' })
    const existing = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true, isLocked: true, deletedAt: true } })
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    if (existing.role === 'admin' && !existing.isLocked && !existing.deletedAt && await countOtherActiveAdmins(id) === 0) {
      return res.status(409).json({ message: 'Không thể xóa quản trị viên hoạt động cuối cùng' })
    }
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isLocked: true } })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.USER_DELETE,
      entityType: 'User',
      entityId: id,
      entityLabel: existing?.email ?? null
    })
    res.json({ message: 'Đã xóa user (soft delete)' })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// ─── PROFILE (CURRENT USER) ──────────────────────────────────────────────────
router.get('/me', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true, password: true, requirePasswordChange: true }
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    const { password, ...profile } = user
    res.json({ ...profile, hasPassword: Boolean(password) })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.put('/me/password', authMiddleware, teacherOrAdmin, ...passwordChangeLimiters, validate(adminChangePasswordInputSchema), async (req, res) => {
  try {
    const { status, ...body } = await changePassword(req.user, req.body.currentPassword, req.body.newPassword)
    res.status(status).json(body)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
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
      where: { role: { in: ['admin', 'teacher'] }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(accounts)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.post('/accounts', authMiddleware, adminOnly, validate(createAccountSchema), async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ message: 'Email đã tồn tại' })
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, requirePasswordChange: true },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.STAFF_CREATE,
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email
    })
    res.status(201).json(user)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
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
    if (password) {
      if (id === req.user.userId) {
        return res.status(400).json({ message: 'Vui lòng đổi mật khẩu tại trang hồ sơ và nhập mật khẩu hiện tại.' })
      }
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có thể đặt lại mật khẩu tài khoản khác.' })
      data.password = await bcrypt.hash(password, 10)
      data.requirePasswordChange = true
      data.tokenVersion = { increment: 1 }
    }
    if (req.user.role === 'admin') {
      if (role) data.role = role
      if (isLocked !== undefined) data.isLocked = isLocked
    }
    if (id === req.user.userId && data.isLocked === true) {
      return res.status(400).json({ message: 'Không thể khóa tài khoản đang đăng nhập' })
    }
    if (id === req.user.userId && data.role !== undefined && data.role !== 'admin') {
      return res.status(400).json({ message: 'Không thể tự hạ quyền tài khoản đang đăng nhập' })
    }
    const existingAccount = await prisma.user.findUnique({ where: { id }, select: { role: true, isLocked: true, deletedAt: true } })
    if (!existingAccount) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    const deactivatesLastAdmin = existingAccount.role === 'admin' && !existingAccount.isLocked && !existingAccount.deletedAt &&
      ((data.role !== undefined && data.role !== 'admin') || data.isLocked === true)
    if (deactivatesLastAdmin && await countOtherActiveAdmins(id) === 0) {
      return res.status(409).json({ message: 'Không thể vô hiệu hóa quản trị viên hoạt động cuối cùng' })
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    const changedFields = {}
    if (data.role !== undefined) changedFields.role = data.role
    if (data.isLocked !== undefined) changedFields.isLocked = data.isLocked
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.STAFF_UPDATE,
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      metadata: Object.keys(changedFields).length ? changedFields : null
    })
    res.json(user)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.delete('/accounts/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Không thể xóa tài khoản đang dùng' })
    const existing = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true, isLocked: true, deletedAt: true } })
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    if (existing.role === 'admin' && !existing.isLocked && !existing.deletedAt && await countOtherActiveAdmins(id) === 0) {
      return res.status(409).json({ message: 'Không thể xóa quản trị viên hoạt động cuối cùng' })
    }
    await prisma.user.delete({ where: { id } })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.STAFF_DELETE,
      entityType: 'User',
      entityId: id,
      entityLabel: existing?.email ?? null
    })
    res.json({ message: 'Đã xóa tài khoản' })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// ─── SETTINGS ────────────────────────────────────────────────────────────────
const DISALLOWED_SETTINGS_KEYS = new Set([
  'writing_prompt_template',
  'speaking_prompt_template',
  'ai_prompt',
  'prompt_template',
])

router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: { notIn: Array.from(DISALLOWED_SETTINGS_KEYS) },
      },
    })
    const obj = Object.fromEntries(settings.map(s => [s.key, s.value]))
    res.json(obj)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.put('/settings', authMiddleware, adminOnly, validate(updateSettingsSchema), async (req, res) => {
  try {
    const entries = Object.entries(req.body).filter(([key]) => !DISALLOWED_SETTINGS_KEYS.has(key))
    await Promise.all(entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    ))
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SETTING_UPDATE,
      entityType: 'Setting',
      metadata: { keys: entries.map(([key]) => key) }
    })
    res.json({ message: 'Đã lưu cài đặt' })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// ─── STAFF MANAGEMENT ────────────────────────────────────────────────────────
router.get('/staff', authMiddleware, adminOnly, async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['admin', 'teacher'] }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(staff)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.post('/make-teacher', authMiddleware, adminOnly, validate(userIdSchema), async (req, res) => {
  try {
    const { userId } = req.body
    if (userId === req.user.userId) return res.status(400).json({ message: 'Không thể tự hạ quyền tài khoản đang đăng nhập' })
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!before) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isLocked: true, deletedAt: true } })
    if (before.role === 'admin' && !target.isLocked && !target.deletedAt && await countOtherActiveAdmins(userId) === 0) {
      return res.status(409).json({ message: 'Không thể hạ quyền quản trị viên hoạt động cuối cùng' })
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'teacher' },
      select: { id: true, name: true, email: true, role: true }
    })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      metadata: { from: before?.role ?? null, to: user.role }
    })
    res.json({ message: 'Đã nâng quyền teacher!', user })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

router.post('/remove-staff', authMiddleware, adminOnly, validate(userIdSchema), async (req, res) => {
  try {
    const { userId } = req.body
    if (userId === req.user.userId) return res.status(400).json({ message: 'Không thể tự xóa quyền của mình' })
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!before) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isLocked: true, deletedAt: true } })
    if (before.role === 'admin' && !target.isLocked && !target.deletedAt && await countOtherActiveAdmins(userId) === 0) {
      return res.status(409).json({ message: 'Không thể hạ quyền quản trị viên hoạt động cuối cùng' })
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'user' },
      select: { id: true, name: true, email: true, role: true }
    })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      metadata: { from: before?.role ?? null, to: user.role }
    })
    res.json({ message: 'Đã xóa quyền staff', user })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
router.post('/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Vui lòng đổi mật khẩu tại trang hồ sơ và nhập mật khẩu hiện tại.' })
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })

    // Generate 12-char password: uppercase + lowercase + digits (no ambiguous chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 12; i++) pwd += chars[randomInt(chars.length)]

    const hashed = await bcrypt.hash(pwd, 10)
    await prisma.user.update({ where: { id }, data: { password: hashed, requirePasswordChange: true, tokenVersion: { increment: 1 } } })

    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entityType: 'User',
      entityId: id,
      entityLabel: user.email
    })

    // Return plaintext ONCE — never log it
    res.json({ newPassword: pwd })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

module.exports = router
