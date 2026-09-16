import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── Audit log wiring for routes/admin/users.js — INTEGRATION test ─────────
// Khác với các test khác trong repo (mock prisma), file này gọi thẳng DB thật
// để xác nhận AuditLog thực sự được ghi đúng (action/entityType/entityLabel/
// metadata). Vì vậy CHỈ chạy khi DATABASE_URL trỏ postgres-dev local
// (127.0.0.1:5433) — chạy qua `npm run test:dev-db`. Khi chạy `npm test` bình
// thường (DATABASE_URL trỏ Supabase prod), toàn bộ suite này tự skip để không
// bao giờ đụng DB thật.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key'

const IS_DEV_DB = (process.env.DATABASE_URL || '').includes('127.0.0.1:5433')
const describeIntegration = IS_DEV_DB ? describe : describe.skip

if (!IS_DEV_DB) {
  console.warn('[routes/admin/users.test.js] Bỏ qua — DATABASE_URL không trỏ postgres-dev. Chạy `npm run test:dev-db` để thực thi test tích hợp audit log.')
}

const prisma = require('../../lib/prisma')
const app = require('../../server')

const MARKER = '[AUDIT-TEST-users]'
let uniqueCounter = 0
function uniqueEmail(tag) {
  uniqueCounter += 1
  return `audit-test-${tag}-${Date.now()}-${uniqueCounter}@example.test`
}

async function createUser(role, tag = 'target') {
  return prisma.user.create({
    data: { name: `${MARKER} ${tag}`, email: uniqueEmail(tag), password: 'x', role }
  })
}

async function cleanupUser(id) {
  await prisma.auditLog.deleteMany({ where: { entityType: 'User', entityId: id } })
  await prisma.user.deleteMany({ where: { id } })
}

describeIntegration('routes/admin/users.js — audit log (postgres-dev integration)', () => {
  let adminToken
  let adminUserId

  beforeAll(async () => {
    const admin = await createUser('admin', 'admin-actor')
    adminUserId = admin.id
    adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  })

  afterAll(async () => {
    await cleanupUser(adminUserId)
    // Lưới an toàn cuối cùng — dọn bất kỳ user/log nào lỡ sót lại theo marker.
    const leftover = await prisma.user.findMany({ where: { name: { startsWith: MARKER } }, select: { id: true } })
    for (const u of leftover) await cleanupUser(u.id)
  })

  it('POST /make-admin logs user.role_change với role cũ/mới và entityLabel là email', async () => {
    const target = await createUser('user')
    try {
      const res = await request(app)
        .post('/api/admin/make-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: target.id })
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'user.role_change', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(res.body.user.email)
      expect(log.metadata).toEqual({ from: 'user', to: 'admin' })
      expect(log.actorType).toBe('user')
      expect(log.actorUserId).toBe(adminUserId)
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('POST /make-teacher logs user.role_change', async () => {
    const target = await createUser('user')
    try {
      const res = await request(app)
        .post('/api/admin/make-teacher')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: target.id })
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'user.role_change', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(res.body.user.email)
      expect(log.metadata).toEqual({ from: 'user', to: 'teacher' })
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('POST /remove-staff logs user.role_change về "user"', async () => {
    const target = await createUser('teacher')
    try {
      const res = await request(app)
        .post('/api/admin/remove-staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: target.id })
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'user.role_change', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(res.body.user.email)
      expect(log.metadata).toEqual({ from: 'teacher', to: 'user' })
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('DELETE /users/:id (soft-delete) đọc email TRƯỚC khi xóa và logs user.delete', async () => {
    const target = await createUser('user')
    try {
      await request(app)
        .delete(`/api/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'user.delete', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(target.email)

      const softDeleted = await prisma.user.findUnique({ where: { id: target.id } })
      expect(softDeleted.deletedAt).not.toBeNull()
      expect(softDeleted.isLocked).toBe(true)
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('PUT /users/:id/toggle-lock logs user.lock khi khóa và user.unlock khi mở khóa', async () => {
    const target = await createUser('user')
    try {
      const lockRes = await request(app)
        .put(`/api/admin/users/${target.id}/toggle-lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(lockRes.body.isLocked).toBe(true)

      const lockLog = await prisma.auditLog.findFirst({ where: { action: 'user.lock', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(lockLog).toBeTruthy()
      expect(lockLog.entityType).toBe('User')
      expect(lockLog.entityLabel).toBe(target.email)

      const unlockRes = await request(app)
        .put(`/api/admin/users/${target.id}/toggle-lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(unlockRes.body.isLocked).toBe(false)

      const unlockLog = await prisma.auditLog.findFirst({ where: { action: 'user.unlock', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(unlockLog).toBeTruthy()
      expect(unlockLog.entityLabel).toBe(target.email)
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('POST /users/:id/reset-password logs user.password_reset mà KHÔNG ghi mật khẩu mới vào metadata', async () => {
    const target = await createUser('user')
    try {
      const res = await request(app)
        .post(`/api/admin/users/${target.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.newPassword).toBeTruthy()

      const log = await prisma.auditLog.findFirst({ where: { action: 'user.password_reset', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(target.email)
      // Không được rò rỉ mật khẩu mới (hay bất kỳ giá trị nhạy cảm nào) vào metadata
      const serialized = JSON.stringify(log.metadata ?? {})
      expect(serialized).not.toContain(res.body.newPassword)
      expect(serialized.toLowerCase()).not.toMatch(/password|token|secret/)
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('POST /accounts logs staff.create với entityLabel là email tài khoản mới', async () => {
    const email = uniqueEmail('staff-create')
    let createdId = null
    try {
      const res = await request(app)
        .post('/api/admin/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `${MARKER} staff`, email, password: 'Password123!', role: 'teacher' })
        .expect(201)
      createdId = res.body.id

      const log = await prisma.auditLog.findFirst({ where: { action: 'staff.create', entityId: createdId }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(email)
    } finally {
      if (createdId) await cleanupUser(createdId)
    }
  })

  it('PUT /accounts/:id logs staff.update chỉ với các trường role/isLocked thực sự đổi', async () => {
    const target = await createUser('teacher')
    try {
      // Chỉ đổi name — metadata phải rỗng/null (name không nằm trong danh sách được log)
      await request(app)
        .put(`/api/admin/accounts/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `${MARKER} renamed` })
        .expect(200)
      const nameOnlyLog = await prisma.auditLog.findFirst({ where: { action: 'staff.update', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(nameOnlyLog).toBeTruthy()
      expect(nameOnlyLog.metadata).toBeNull()

      // Đổi role + isLocked — metadata phải phản ánh đúng 2 trường này, không có name
      const res = await request(app)
        .put(`/api/admin/accounts/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin', isLocked: true })
        .expect(200)
      const roleLog = await prisma.auditLog.findFirst({ where: { action: 'staff.update', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(roleLog.entityType).toBe('User')
      expect(roleLog.entityLabel).toBe(res.body.email)
      expect(roleLog.metadata).toEqual({ role: 'admin', isLocked: true })
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('DELETE /accounts/:id đọc email TRƯỚC khi xóa và logs staff.delete', async () => {
    const target = await createUser('teacher')
    try {
      await request(app)
        .delete(`/api/admin/accounts/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'staff.delete', entityId: target.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('User')
      expect(log.entityLabel).toBe(target.email)

      const stillExists = await prisma.user.findUnique({ where: { id: target.id } })
      expect(stillExists).toBeNull()
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('PUT /settings logs setting.update chỉ với DANH SÁCH TÊN key, không ghi giá trị', async () => {
    const key = `audit_test_${Date.now()}`
    let logId = null
    try {
      await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ [key]: 'super-secret-value-should-not-leak' })
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'setting.update' }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      logId = log.id
      expect(log.entityType).toBe('Setting')
      expect(log.metadata).toEqual({ keys: [key] })
      const serialized = JSON.stringify(log.metadata)
      expect(serialized).not.toContain('super-secret-value-should-not-leak')
    } finally {
      await prisma.setting.deleteMany({ where: { key } })
      if (logId) await prisma.auditLog.deleteMany({ where: { id: logId } })
    }
  })

  it('PUT /me/password KHÔNG ghi audit log (tự đổi mật khẩu của chính mình)', async () => {
    const bcrypt = require('bcryptjs')
    const password = 'Password123!'
    const self = await prisma.user.create({
      data: { name: `${MARKER} self`, email: uniqueEmail('self'), password: await bcrypt.hash(password, 10), role: 'teacher' }
    })
    const selfToken = jwt.sign({ userId: self.id, email: self.email, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    try {
      await request(app)
        .put('/api/admin/me/password')
        .set('Authorization', `Bearer ${selfToken}`)
        .send({ currentPassword: password, newPassword: 'NewPassword123!' })
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { entityType: 'User', entityId: self.id }, orderBy: { id: 'desc' } })
      expect(log).toBeNull()
    } finally {
      await cleanupUser(self.id)
    }
  })
})
