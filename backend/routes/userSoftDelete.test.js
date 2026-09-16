import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// ─── Soft-delete enforcement — INTEGRATION test (postgres-dev) ─────────────
// Xác nhận tài khoản đã soft-delete (User.deletedAt != null) thực sự bị loại
// khỏi: đăng nhập (email/password), danh sách người dùng + số liệu thống kê
// (/admin/users), danh sách nhân sự (/admin/accounts), và card "Tổng người
// dùng" ở Dashboard (/admin/dashboard). Gọi thẳng DB thật nên CHỈ chạy khi
// DATABASE_URL trỏ postgres-dev local — chạy qua `npm run test:dev-db`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key'

const IS_DEV_DB = (process.env.DATABASE_URL || '').includes('127.0.0.1:5433')
const describeIntegration = IS_DEV_DB ? describe : describe.skip

if (!IS_DEV_DB) {
  console.warn('[routes/userSoftDelete.test.js] Bỏ qua — DATABASE_URL không trỏ postgres-dev. Chạy `npm run test:dev-db` để thực thi.')
}

const prisma = require('../lib/prisma')
const app = require('../server')

const MARKER = '[SOFTDEL-TEST]'
let uniqueCounter = 0
function uniqueEmail(tag) {
  uniqueCounter += 1
  return `softdel-test-${tag}-${Date.now()}-${uniqueCounter}@example.test`
}

async function cleanupUser(id) {
  await prisma.auditLog.deleteMany({ where: { entityType: 'User', entityId: id } })
  await prisma.user.deleteMany({ where: { id } })
}

describeIntegration('Soft-delete User — bị loại khỏi đăng nhập/danh sách/thống kê (postgres-dev integration)', () => {
  let adminToken
  let adminUserId

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: { name: `${MARKER} admin-actor`, email: uniqueEmail('admin-actor'), password: 'x', role: 'admin' }
    })
    adminUserId = admin.id
    adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  })

  afterAll(async () => {
    await cleanupUser(adminUserId)
    const leftover = await prisma.user.findMany({ where: { name: { startsWith: MARKER } }, select: { id: true } })
    for (const u of leftover) await cleanupUser(u.id)
  })

  it('không đăng nhập được bằng email/password sau khi soft-delete', async () => {
    const password = 'Password123!'
    const target = await prisma.user.create({
      data: { name: `${MARKER} login`, email: uniqueEmail('login'), password: await bcrypt.hash(password, 10), role: 'user' }
    })
    try {
      // Đăng nhập được bình thường TRƯỚC khi xóa — xác nhận baseline
      const before = await request(app).post('/api/auth/login').send({ email: target.email, password })
      expect(before.status).toBe(200)

      await request(app)
        .delete(`/api/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const after = await request(app).post('/api/auth/login').send({ email: target.email, password })
      expect(after.status).toBe(400)
      expect(after.body.message).toBe('Email hoặc mật khẩu sai')
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('không xuất hiện trong GET /admin/users và không tính vào totalActive/totalLocked sau khi soft-delete', async () => {
    const target = await prisma.user.create({
      data: { name: `${MARKER} list`, email: uniqueEmail('list'), password: 'x', role: 'user' }
    })
    try {
      const beforeList = await request(app)
        .get('/api/admin/users')
        .query({ search: target.email })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(beforeList.body.users.some(u => u.id === target.id)).toBe(true)
      const activeBefore = beforeList.body.totalActive

      await request(app)
        .delete(`/api/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const afterList = await request(app)
        .get('/api/admin/users')
        .query({ search: target.email })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(afterList.body.users.some(u => u.id === target.id)).toBe(false)
      expect(afterList.body.total).toBe(0)
      // DELETE /users/:id cũng set isLocked:true — trước đó user không bị khóa,
      // nên nếu còn bị đếm thì totalLocked sẽ tăng thay vì totalActive giảm.
      // Soft-delete phải loại khỏi CẢ HAI, không chỉ chuyển nhóm.
      expect(afterList.body.totalActive).toBe(activeBefore - 1)
      expect(afterList.body.totalLocked).toBe(0)
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('không xuất hiện trong GET /admin/accounts và /admin/staff sau khi soft-delete (tài khoản staff)', async () => {
    const target = await prisma.user.create({
      data: { name: `${MARKER} staff`, email: uniqueEmail('staff'), password: 'x', role: 'teacher' }
    })
    try {
      const beforeAccounts = await request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${adminToken}`).expect(200)
      expect(beforeAccounts.body.some(u => u.id === target.id)).toBe(true)

      await prisma.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } })

      const afterAccounts = await request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${adminToken}`).expect(200)
      expect(afterAccounts.body.some(u => u.id === target.id)).toBe(false)

      const afterStaff = await request(app).get('/api/admin/staff').set('Authorization', `Bearer ${adminToken}`).expect(200)
      expect(afterStaff.body.some(u => u.id === target.id)).toBe(false)
    } finally {
      await cleanupUser(target.id)
    }
  })

  it('không tính vào card "Tổng người dùng" ở Dashboard sau khi soft-delete', async () => {
    const target = await prisma.user.create({
      data: { name: `${MARKER} dash`, email: uniqueEmail('dash'), password: 'x', role: 'user' }
    })
    try {
      const before = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`).expect(200)
      const totalBefore = before.body.stats.totalUsers

      await prisma.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } })
      // Dashboard dùng SWR cache (swrCache) theo key 'dashboard_overview' — không có
      // route invalidate riêng cho thay đổi User, nên đọc cache trực tiếp qua
      // fetchDashboardOverviewData thay vì gọi lại endpoint (tránh flaky vì cache).
      const { invalidate } = require('../lib/swrCache')
      invalidate('dashboard_overview')

      const after = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`).expect(200)
      expect(after.body.stats.totalUsers).toBe(totalBefore - 1)
    } finally {
      await cleanupUser(target.id)
      require('../lib/swrCache').invalidate('dashboard_overview')
    }
  })

  // ─── "Giữ lượt thi, đánh dấu tài khoản đã xóa" — quyết định đã xác nhận cho
  // các nơi hiển thị thông tin học viên (không ẩn lượt thi, chỉ gắn cờ deletedAt/
  // marker để phân biệt học viên đã bị xóa) ─────────────────────────────────
  describe('Hiển thị học viên đã xóa — giữ dữ liệu, gắn cờ/marker (không ẩn)', () => {
    let student
    let exam

    beforeAll(async () => {
      student = await prisma.user.create({
        data: { name: `${MARKER} student`, email: uniqueEmail('student'), password: 'x', role: 'user' }
      })
      exam = await prisma.exam.create({ data: { title: `${MARKER} exam`, skill: 'reading' } })
      await prisma.attempt.create({
        data: { userId: student.id, examId: exam.id, score: 9.0, finishedAt: new Date() }
      })
      await prisma.user.update({ where: { id: student.id }, data: { deletedAt: new Date() } })
      require('../lib/swrCache').invalidate('dashboard_overview')
    })

    afterAll(async () => {
      await prisma.attempt.deleteMany({ where: { examId: exam.id } })
      await prisma.exam.deleteMany({ where: { id: exam.id } })
      await cleanupUser(student.id)
      require('../lib/swrCache').invalidate('dashboard_overview')
    })

    it('GET /admin/users/:id vẫn trả về học viên đã xóa kèm deletedAt (không 404)', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${student.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.user.id).toBe(student.id)
      expect(res.body.user.deletedAt).not.toBeNull()
      expect(res.body.totalAttempts).toBeGreaterThanOrEqual(1)
    })

    it('GET /admin/attempts vẫn liệt kê lượt thi của học viên đã xóa, kèm user.deletedAt', async () => {
      const res = await request(app)
        .get('/api/admin/attempts')
        .query({ search: student.email })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const row = res.body.attempts.find(a => a.user?.id === student.id)
      expect(row).toBeTruthy()
      expect(row.user.deletedAt).not.toBeNull()
    })

    it('GET /admin/dashboard đánh dấu "(đã xóa)" trong recentAttempts/systemLogs', async () => {
      const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`).expect(200)
      const row = res.body.recentAttempts.find(a => a.user?.id === student.id)
      expect(row).toBeTruthy()
      expect(row.user.deletedAt).not.toBeNull()
      // systemLogs chỉ lấy 2 attempt mới nhất toàn hệ thống nên không đảm bảo
      // chứa đúng attempt của student — chỉ kiểm tra format marker nếu có mặt.
      const logHit = res.body.systemLogs.find(l => l.user.includes(student.name))
      if (logHit) expect(logHit.user).toContain('(đã xóa)')
    })

    it('GET /admin/analytics topUsers vẫn giữ học viên đã xóa trong bảng xếp hạng, kèm deletedAt', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .query({ period: 'all' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const row = res.body.topUsers.find(u => u.id === student.id)
      expect(row).toBeTruthy()
      expect(row.deletedAt).not.toBeNull()
    })

    it('POST /admin/attempts/export đánh dấu "(đã xóa)" trong cột Người dùng', async () => {
      const attempt = await prisma.attempt.findFirst({ where: { userId: student.id, examId: exam.id } })
      const res = await request(app)
        .post('/api/admin/attempts/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attemptIds: [attempt.id] })
        .expect(200)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = []
          response.on('data', chunk => chunks.push(chunk))
          response.on('end', () => callback(null, Buffer.concat(chunks)))
        })

      const ExcelJS = require('exceljs')
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(res.body)
      const worksheet = workbook.worksheets[0]
      const dataRow = worksheet.getRow(2)
      expect(dataRow.getCell(1).value).toContain('(đã xóa)')
    })
  })
})
