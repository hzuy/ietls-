import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── Audit log wiring for routes/admin/trash.js — INTEGRATION test ─────────
// Gọi thẳng DB thật (postgres-dev) để xác nhận AuditLog được ghi đúng cho
// restore/purge_one/purge_all/auto_purge. CHỈ chạy khi DATABASE_URL trỏ
// postgres-dev local (127.0.0.1:5433) — chạy qua `npm run test:dev-db`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key'

const IS_DEV_DB = (process.env.DATABASE_URL || '').includes('127.0.0.1:5433')
const describeIntegration = IS_DEV_DB ? describe : describe.skip

if (!IS_DEV_DB) {
  console.warn('[routes/admin/trash.test.js] Bỏ qua — DATABASE_URL không trỏ postgres-dev. Chạy `npm run test:dev-db` để thực thi test tích hợp audit log.')
}

const prisma = require('../../lib/prisma')
const app = require('../../server')

const MARKER = '[AUDIT-TEST-trash]'
let uniqueCounter = 0
function uniqueTitle(tag) {
  uniqueCounter += 1
  return `${MARKER} ${tag} ${Date.now()}-${uniqueCounter}`
}

async function pollFor(check, { timeoutMs = 3000, intervalMs = 100 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const result = await check()
    if (result) return result
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return null
}

describeIntegration('routes/admin/trash.js — audit log (postgres-dev integration)', () => {
  let adminToken
  let adminUserId

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: { name: `${MARKER} admin-actor`, email: `audit-test-trash-admin-${Date.now()}@example.test`, password: 'x', role: 'admin' }
    })
    adminUserId = admin.id
    adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: adminUserId } })
    await prisma.user.deleteMany({ where: { id: adminUserId } })
    // Lưới an toàn — dọn nốt bất kỳ dữ liệu test nào lỡ sót theo marker.
    await prisma.writingSample.deleteMany({ where: { title: { startsWith: MARKER } } })
    await prisma.speakingSample.deleteMany({ where: { title: { startsWith: MARKER } } })
    await prisma.exam.deleteMany({ where: { title: { startsWith: MARKER } } })
    await prisma.examSeries.deleteMany({ where: { name: { startsWith: MARKER } } })
  })

  it('POST /trash/writing_sample/:id/restore logs trash.restore với entityLabel là title', async () => {
    const title = uniqueTitle('restore-writing')
    const sample = await prisma.writingSample.create({ data: { title, deletedAt: new Date() } })
    try {
      await request(app)
        .post(`/api/admin/trash/writing_sample/${sample.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'trash.restore', entityId: sample.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('WritingSample')
      expect(log.entityLabel).toBe(title)
      expect(log.metadata).toMatchObject({ type: 'writing_sample' })

      const restored = await prisma.writingSample.findUnique({ where: { id: sample.id } })
      expect(restored.deletedAt).toBeNull()
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'WritingSample', entityId: sample.id } })
      await prisma.writingSample.deleteMany({ where: { id: sample.id } })
    }
  })

  it('POST /trash/book/:id/restore khôi phục cả nhóm exam cùng deletedAt và ghi metadata.restoredExamsCount', async () => {
    const seriesName = uniqueTitle('series')
    const series = await prisma.examSeries.create({ data: { name: seriesName } })
    const deletedAt = new Date()
    const book = await prisma.bookCover.create({ data: { seriesId: series.id, bookNumber: 1, deletedAt } })
    const examA = await prisma.exam.create({ data: { title: uniqueTitle('exam-a'), skill: 'reading', seriesId: series.id, bookNumber: 1, deletedAt } })
    const examB = await prisma.exam.create({ data: { title: uniqueTitle('exam-b'), skill: 'listening', seriesId: series.id, bookNumber: 1, deletedAt } })
    try {
      await request(app)
        .post(`/api/admin/trash/book/${book.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'trash.restore', entityId: book.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('BookCover')
      expect(log.entityLabel).toBe(`Cuốn 1 — ${seriesName}`)
      expect(log.metadata).toMatchObject({ type: 'book', restoredExamsCount: 2 })

      const [restoredA, restoredB] = await Promise.all([
        prisma.exam.findUnique({ where: { id: examA.id } }),
        prisma.exam.findUnique({ where: { id: examB.id } }),
      ])
      expect(restoredA.deletedAt).toBeNull()
      expect(restoredB.deletedAt).toBeNull()
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'BookCover', entityId: book.id } })
      await prisma.exam.deleteMany({ where: { id: { in: [examA.id, examB.id] } } })
      await prisma.bookCover.deleteMany({ where: { id: book.id } })
      await prisma.examSeries.deleteMany({ where: { id: series.id } })
    }
  })

  it('DELETE /trash/writing_sample/:id/permanent đọc title TRƯỚC khi xóa và logs trash.purge_one', async () => {
    const title = uniqueTitle('purge-one')
    const sample = await prisma.writingSample.create({ data: { title, deletedAt: new Date() } })
    try {
      await request(app)
        .delete(`/api/admin/trash/writing_sample/${sample.id}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'trash.purge_one', entityId: sample.id }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      expect(log.entityType).toBe('WritingSample')
      expect(log.entityLabel).toBe(title)

      const gone = await prisma.writingSample.findUnique({ where: { id: sample.id } })
      expect(gone).toBeNull()
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'WritingSample', entityId: sample.id } })
      await prisma.writingSample.deleteMany({ where: { id: sample.id } })
    }
  })

  it('DELETE /trash/purge logs trash.purge_all với số lượng bản ghi bị xóa phân theo loại', async () => {
    const title = uniqueTitle('purge-all')
    const sample = await prisma.writingSample.create({ data: { title, deletedAt: new Date() } })
    let logId = null
    try {
      await request(app)
        .delete('/api/admin/trash/purge')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const log = await prisma.auditLog.findFirst({ where: { action: 'trash.purge_all' }, orderBy: { id: 'desc' } })
      expect(log).toBeTruthy()
      logId = log.id
      expect(log.entityType).toBe('Trash')
      expect(log.entityId).toBeNull()
      expect(log.metadata).toHaveProperty('writingSample')
      expect(log.metadata.writingSample).toBeGreaterThanOrEqual(1)

      const gone = await prisma.writingSample.findUnique({ where: { id: sample.id } })
      expect(gone).toBeNull()
    } finally {
      await prisma.writingSample.deleteMany({ where: { id: sample.id } })
      if (logId) await prisma.auditLog.deleteMany({ where: { id: logId } })
    }
  })

  it('GET /trash tự động dọn mục quá hạn và logs trash.auto_purge với actorType "system" (actorUserId null)', async () => {
    const title = uniqueTitle('auto-purge')
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
    const sample = await prisma.writingSample.create({ data: { title, deletedAt: fortyDaysAgo } })
    let logId = null
    try {
      await request(app)
        .get('/api/admin/trash')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // Route không await tác vụ auto-purge (fire-and-forget) — chờ tới khi
      // bản ghi thực sự biến mất rồi mới kiểm tra audit log tương ứng.
      const purged = await pollFor(async () => {
        const still = await prisma.writingSample.findUnique({ where: { id: sample.id } })
        return still === null
      })
      expect(purged).not.toBeNull()

      const log = await pollFor(() =>
        prisma.auditLog.findFirst({ where: { action: 'trash.auto_purge' }, orderBy: { id: 'desc' } })
      )
      expect(log).toBeTruthy()
      logId = log.id
      expect(log.actorType).toBe('system')
      expect(log.actorUserId).toBeNull()
      expect(log.entityType).toBe('Trash')
      expect(log.metadata.writingSample).toBeGreaterThanOrEqual(1)
    } finally {
      await prisma.writingSample.deleteMany({ where: { id: sample.id } })
      if (logId) await prisma.auditLog.deleteMany({ where: { id: logId } })
    }
  })
})
