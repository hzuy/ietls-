import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── GET /admin/audit-logs + /admin/audit-logs/filters — INTEGRATION test ───
// Đọc thẳng DB thật (postgres-dev) vì route dựa vào index/relation thật (join
// actorUser, ON DELETE SET NULL của FK actorUserId) — mock prisma sẽ không bắt
// được các hành vi đó. CHỈ chạy khi DATABASE_URL trỏ postgres-dev local
// (127.0.0.1:5433), qua `npm run test:dev-db`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key'

const IS_DEV_DB = (process.env.DATABASE_URL || '').includes('127.0.0.1:5433')
const describeIntegration = IS_DEV_DB ? describe : describe.skip

if (!IS_DEV_DB) {
  console.warn('[routes/admin/auditLogs.test.js] Bỏ qua — DATABASE_URL không trỏ postgres-dev. Chạy `npm run test:dev-db` để thực thi test tích hợp.')
}

const prisma = require('../../lib/prisma')
const app = require('../../server')
const { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } = require('../../lib/auditActions')
const { AUDIT_LOG_RETENTION_DAYS, LAST_PURGE_SETTING_KEY } = require('../../lib/auditLogRetention')

async function pollFor(check, { timeoutMs = 3000, intervalMs = 100 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const result = await check()
    if (result) return result
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return null
}

// Chờ 1 khoảng ngắn KHÔNG poll điều kiện gì — dùng khi cần xác nhận một việc
// KHÔNG xảy ra (vd "không sinh log mới") sau khi tác vụ fire-and-forget đã có
// đủ thời gian chạy xong.
async function settle(ms = 800) {
  await new Promise(r => setTimeout(r, ms))
}

const MARKER = `[AUDIT-TEST-auditLogs-${Date.now()}]`
let uniqueCounter = 0
function uniqueEmail(tag) {
  uniqueCounter += 1
  return `audit-test-${tag}-${Date.now()}-${uniqueCounter}@example.test`
}
function label(tag) {
  return `${MARKER} ${tag}`
}

async function createActor(role, tag) {
  return prisma.user.create({
    data: { name: `${MARKER} ${tag}`, email: uniqueEmail(tag), password: 'x', role }
  })
}

async function sweepLeftovers() {
  await prisma.auditLog.deleteMany({ where: { entityLabel: { startsWith: MARKER } } })
  await prisma.user.deleteMany({ where: { name: { startsWith: MARKER } } })
}

describeIntegration('routes/admin/auditLogs.js (postgres-dev integration)', () => {
  let adminToken
  let teacherToken
  let adminUserId
  let teacherUserId

  beforeAll(async () => {
    const admin = await createActor('admin', 'admin-actor')
    adminUserId = admin.id
    adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })

    const teacher = await createActor('teacher', 'teacher-actor')
    teacherUserId = teacher.id
    teacherToken = jwt.sign({ userId: teacher.id, email: teacher.email, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, teacherUserId] } } })
    await sweepLeftovers()
  })

  describe('quyền truy cập', () => {
    it('GET /audit-logs — teacher bị từ chối (403)', async () => {
      await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403)
    })

    it('GET /audit-logs/filters — teacher bị từ chối (403)', async () => {
      await request(app)
        .get('/api/admin/audit-logs/filters')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403)
    })

    it('GET /audit-logs — admin truy cập được (200)', async () => {
      await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    })

    it('GET /audit-logs — không có token thì 401', async () => {
      await request(app).get('/api/admin/audit-logs').expect(401)
    })
  })

  describe('danh sách + bộ lọc', () => {
    let actorA
    let actorDeleted
    let logExamCreate, logExamUpdate, logExamOtherId, logPracticeCreate, logSystemPurge, logDeletedActor, logActorNameHit

    beforeAll(async () => {
      actorA = await createActor('teacher', 'filter-actor-alive')
      actorDeleted = await createActor('teacher', 'filter-actor-deleted')

      logExamCreate = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorA.id, actorEmail: actorA.email, actorRole: actorA.role,
          action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam', entityId: 9001,
          entityLabel: label('Exam Alpha'), createdAt: new Date('2026-01-05T10:00:00.000Z'),
        }
      })
      logExamUpdate = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorA.id, actorEmail: actorA.email, actorRole: actorA.role,
          action: AUDIT_ACTIONS.EXAM_UPDATE, entityType: 'Exam', entityId: 9001,
          entityLabel: label('Exam Alpha'), createdAt: new Date('2026-01-15T10:00:00.000Z'),
        }
      })
      logPracticeCreate = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorA.id, actorEmail: actorA.email, actorRole: actorA.role,
          action: AUDIT_ACTIONS.PRACTICE_CREATE, entityType: 'PracticeExam', entityId: 9002,
          entityLabel: label('Practice Beta'), createdAt: new Date('2026-02-01T10:00:00.000Z'),
        }
      })
      // entityType trùng 'Exam' nhưng entityId khác — dùng để xác nhận filter
      // entityType+entityId loại đúng bản ghi không cùng entityId. Actor 'system'
      // (không actorUserId), action EXAM_DELETE và createdAt ngoài mọi khoảng
      // from/to dùng ở các test khác — để không ảnh hưởng các test đã có ở trên.
      logExamOtherId = await prisma.auditLog.create({
        data: {
          actorType: 'system', actorUserId: null, actorEmail: null, actorRole: null,
          action: AUDIT_ACTIONS.EXAM_DELETE, entityType: 'Exam', entityId: 9099,
          entityLabel: label('Exam Other'), createdAt: new Date('2026-03-01T10:00:00.000Z'),
        }
      })
      logSystemPurge = await prisma.auditLog.create({
        data: {
          actorType: 'system', actorUserId: null, actorEmail: null, actorRole: null,
          action: AUDIT_ACTIONS.TRASH_AUTO_PURGE, entityType: 'Trash', entityId: null,
          entityLabel: label('auto purge batch'), metadata: { writingSample: 2 },
          createdAt: new Date('2026-02-10T10:00:00.000Z'),
        }
      })
      logDeletedActor = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorDeleted.id, actorEmail: actorDeleted.email, actorRole: actorDeleted.role,
          action: AUDIT_ACTIONS.SAMPLE_DELETE, entityType: 'WritingSample', entityId: 9003,
          entityLabel: label('Sample Gamma'), createdAt: new Date('2026-02-15T10:00:00.000Z'),
        }
      })
      // Bản ghi legacy giả lập: metadata có khóa nhạy cảm lọt qua lớp sanitize lúc
      // ghi (bỏ qua logAuditEvent, ghi thẳng để mô phỏng dữ liệu cũ trước khi có
      // SENSITIVE_KEY_PATTERN) — tầng đọc phải tự lọc lại.
      logActorNameHit = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorA.id, actorEmail: actorA.email, actorRole: actorA.role,
          actorName: `${MARKER} ZzyxUniqueActorName`,
          action: AUDIT_ACTIONS.SETTING_UPDATE, entityType: 'Setting', entityId: null,
          entityLabel: label('Setting tweak'), metadata: { note: 'ok', password: 'leaked123', apiSecret: 'sek' },
          createdAt: new Date('2026-02-20T10:00:00.000Z'),
        }
      })

      // Hard-delete actor sau khi log đã tồn tại — FK actorUserId có ON DELETE
      // SET NULL nên logDeletedActor.actorUserId sẽ tự về null, actorEmail giữ nguyên.
      await prisma.user.delete({ where: { id: actorDeleted.id } })
    })

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { entityLabel: { startsWith: MARKER } } })
      await prisma.user.deleteMany({ where: { id: actorA.id } })
    })

    it('lọc theo actorUserId trả đúng các log của actor đó', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ actorUserId: actorA.id, search: MARKER, limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const ids = res.body.logs.map(l => l.id)
      expect(ids).toEqual(expect.arrayContaining([logExamCreate.id, logExamUpdate.id, logPracticeCreate.id, logActorNameHit.id]))
      expect(ids).not.toContain(logSystemPurge.id)
      expect(ids).not.toContain(logDeletedActor.id)
      res.body.logs.forEach(l => expect(l.actorDisplayName).toBe(actorA.name))
    })

    it('lọc theo 1 action trả đúng 1 log', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ action: AUDIT_ACTIONS.EXAM_CREATE, search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logExamCreate.id])
      expect(res.body.logs[0].actionLabel).toBe(AUDIT_ACTION_LABELS[AUDIT_ACTIONS.EXAM_CREATE])
    })

    it('lọc theo nhiều action (chuỗi phân tách dấu phẩy) trả đúng nhiều loại action', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ action: `${AUDIT_ACTIONS.EXAM_CREATE},${AUDIT_ACTIONS.EXAM_UPDATE}`, search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const ids = res.body.logs.map(l => l.id)
      expect(ids).toEqual([logExamUpdate.id, logExamCreate.id]) // mới nhất trước
    })

    it('lọc theo entityType trả đúng nhóm đối tượng', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityType: 'PracticeExam', search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logPracticeCreate.id])
    })

    it('lọc theo entityType+entityId chỉ trả log của đúng entityId đó', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityType: 'Exam', entityId: 9001, search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const ids = res.body.logs.map(l => l.id)
      expect(ids).toEqual([logExamUpdate.id, logExamCreate.id]) // mới nhất trước
      expect(ids).not.toContain(logExamOtherId.id)
    })

    it('truyền entityId mà không kèm entityType — trả lỗi validate 400', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityId: 9001 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)

      expect(res.body.message).toBe('Dữ liệu không hợp lệ')
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'entityType' })
      ]))
    })

    it('lọc theo khoảng from/to (ngày lịch Việt Nam, xem lib/vnDate.js) chỉ lấy log trong khoảng', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ from: '2026-01-10', to: '2026-01-31', search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logExamUpdate.id])
    })

    it('kết hợp nhiều bộ lọc cùng lúc (actorUserId + entityType + date range)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ actorUserId: actorA.id, entityType: 'Exam', from: '2026-01-01', to: '2026-01-10', search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logExamCreate.id])
    })

    it('search khớp entityLabel', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ search: label('Practice Beta') })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logPracticeCreate.id])
    })

    it('search khớp actorEmail', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ search: actorDeleted.email })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logDeletedActor.id])
    })

    it('search khớp actorName', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ search: 'ZzyxUniqueActorName' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([logActorNameHit.id])
    })

    it('phân trang trả đúng total/page/pages', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ actorUserId: actorA.id, search: MARKER, limit: 2, page: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.length).toBe(2)
      expect(res.body.total).toBe(4)
      expect(res.body.page).toBe(1)
      expect(res.body.pages).toBe(2)
    })

    it('bản ghi actorType "system" (actorUserId null) trả về đúng, không crash', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityType: 'Trash', search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs).toHaveLength(1)
      const log = res.body.logs[0]
      expect(log.id).toBe(logSystemPurge.id)
      expect(log.actorType).toBe('system')
      expect(log.actorUserId).toBeNull()
      expect(log.actorDisplayName).toBeNull()
      expect(log.metadata).toEqual({ writingSample: 2 })
    })

    it('bản ghi mà tài khoản actor đã bị xóa vẫn đọc được đầy đủ, rơi về actorEmail snapshot', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityType: 'WritingSample', search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs).toHaveLength(1)
      const log = res.body.logs[0]
      expect(log.id).toBe(logDeletedActor.id)
      expect(log.actorUserId).toBeNull() // FK ON DELETE SET NULL
      expect(log.actorEmail).toBe(actorDeleted.email) // snapshot giữ nguyên
      expect(log.actorRole).toBe('teacher') // snapshot giữ nguyên
      expect(log.actorDisplayName).toBe(actorDeleted.email) // rơi về actorEmail vì actorUser không còn
    })

    it('lọc lại metadata ở tầng đọc — không trả khóa nhạy cảm dù lọt qua lúc ghi', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityType: 'Setting', search: MARKER })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs).toHaveLength(1)
      const log = res.body.logs[0]
      expect(log.metadata).toEqual({ note: 'ok' })
      expect(log.metadata).not.toHaveProperty('password')
      expect(log.metadata).not.toHaveProperty('apiSecret')
    })

    it('GET /audit-logs/filters trả đủ danh sách action/entityType/actor', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/filters')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.actions.length).toBe(Object.keys(AUDIT_ACTION_LABELS).length)
      expect(res.body.actions).toEqual(expect.arrayContaining([
        { value: AUDIT_ACTIONS.EXAM_CREATE, label: AUDIT_ACTION_LABELS[AUDIT_ACTIONS.EXAM_CREATE] }
      ]))
      expect(res.body.entityTypes).toEqual(expect.arrayContaining(['Exam', 'PracticeExam', 'Trash', 'WritingSample', 'Setting']))
      expect(res.body.actors).toEqual(expect.arrayContaining([
        { id: actorA.id, email: actorA.email, name: actorA.name }
      ]))
      // Actor đã bị hard-delete không còn actorUserId nên không xuất hiện trong dropdown lọc theo actor
      expect(res.body.actors.some(a => a.email === actorDeleted.email)).toBe(false)
    })
  })

  describe('biên múi giờ Việt Nam (lib/vnDate.js) — dữ liệu thật, không mock prisma', () => {
    let actorB
    let logAt0000, logAt0659, logAt0701, logAt2359

    beforeAll(async () => {
      actorB = await createActor('teacher', 'vn-boundary-actor')

      // 4 mốc biên cho CÙNG 1 ngày lịch VN 2026-09-16 — xem lib/vnDate.test.js
      // cho cùng bộ mốc này ở tầng unit. Trước khi sửa (UTC-anchored), bộ lọc
      // from=to=2026-09-16 bỏ sót 2 bản ghi 00:00 và 06:59 (đã xác nhận thật
      // trên postgres-dev trong phiên khảo sát).
      logAt0000 = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorB.id, actorEmail: actorB.email, actorRole: actorB.role,
          action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam', entityId: 9101,
          entityLabel: label('vn-boundary-0000'), createdAt: new Date('2026-09-15T17:00:00.000Z'), // VN 00:00
        }
      })
      logAt0659 = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorB.id, actorEmail: actorB.email, actorRole: actorB.role,
          action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam', entityId: 9102,
          entityLabel: label('vn-boundary-0659'), createdAt: new Date('2026-09-15T23:59:00.000Z'), // VN 06:59
        }
      })
      logAt0701 = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorB.id, actorEmail: actorB.email, actorRole: actorB.role,
          action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam', entityId: 9103,
          entityLabel: label('vn-boundary-0701'), createdAt: new Date('2026-09-16T00:01:00.000Z'), // VN 07:01
        }
      })
      logAt2359 = await prisma.auditLog.create({
        data: {
          actorType: 'user', actorUserId: actorB.id, actorEmail: actorB.email, actorRole: actorB.role,
          action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam', entityId: 9104,
          entityLabel: label('vn-boundary-2359'), createdAt: new Date('2026-09-16T16:59:00.000Z'), // VN 23:59
        }
      })
    })

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { entityLabel: { startsWith: MARKER } } })
      await prisma.user.deleteMany({ where: { id: actorB.id } })
    })

    it('from=to=2026-09-16 trả đủ CẢ 4 bản ghi biên (00:00, 06:59, 07:01, 23:59 giờ VN)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ from: '2026-09-16', to: '2026-09-16', search: MARKER, limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const ids = res.body.logs.map(l => l.id)
      expect(ids).toEqual(expect.arrayContaining([
        logAt0000.id, logAt0659.id, logAt0701.id, logAt2359.id,
      ]))
      expect(ids).toHaveLength(4)
    })

    it('from=to=2026-09-15 (ngày trước đó) KHÔNG lẫn bản ghi VN 00:00/06:59 của 16/09', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .query({ from: '2026-09-15', to: '2026-09-15', search: MARKER, limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.logs.map(l => l.id)).toEqual([])
    })
  })

  describe('auto-purge retention (lib/auditLogRetention.js kích hoạt qua GET /audit-logs)', () => {
    const RETENTION_MS = AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000

    async function latestAutoPurgeId() {
      const row = await prisma.auditLog.findFirst({
        where: { action: AUDIT_ACTIONS.AUDIT_LOG_AUTO_PURGE },
        orderBy: { id: 'desc' },
      })
      return row?.id ?? 0
    }

    beforeEach(async () => {
      // Mỗi test bắt đầu từ trạng thái "chưa từng dọn" — không phụ thuộc Setting
      // do các request GET /audit-logs ở describe khác để lại.
      await prisma.setting.deleteMany({ where: { key: LAST_PURGE_SETTING_KEY } })
    })

    afterEach(async () => {
      await prisma.setting.deleteMany({ where: { key: LAST_PURGE_SETTING_KEY } })
      await prisma.auditLog.deleteMany({ where: { entityLabel: { startsWith: MARKER } } })
    })

    it('xóa đúng bản ghi AuditLog quá hạn lưu giữ, giữ nguyên bản ghi còn trong hạn, và tự ghi log auditlog.auto_purge', async () => {
      const expiredAt = new Date(Date.now() - RETENTION_MS - 24 * 60 * 60 * 1000) // hết hạn 1 ngày
      const freshAt = new Date(Date.now() - 24 * 60 * 60 * 1000) // mới 1 ngày, còn trong hạn

      const expiredLog = await prisma.auditLog.create({
        data: {
          actorType: 'user', action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam',
          entityLabel: label('retention-expired'), createdAt: expiredAt,
        }
      })
      const freshLog = await prisma.auditLog.create({
        data: {
          actorType: 'user', action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam',
          entityLabel: label('retention-fresh'), createdAt: freshAt,
        }
      })
      const baselineId = await latestAutoPurgeId()

      try {
        await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        // Route không await purgeOldAuditLogs (fire-and-forget) — chờ tới khi
        // bản ghi hết hạn thực sự biến mất rồi mới kiểm tra audit log tương ứng.
        const purged = await pollFor(async () => (await prisma.auditLog.findUnique({ where: { id: expiredLog.id } })) === null)
        expect(purged).not.toBeNull()

        const stillFresh = await prisma.auditLog.findUnique({ where: { id: freshLog.id } })
        expect(stillFresh).not.toBeNull()

        const purgeLog = await pollFor(() => prisma.auditLog.findFirst({
          where: { action: AUDIT_ACTIONS.AUDIT_LOG_AUTO_PURGE, id: { gt: baselineId } },
          orderBy: { id: 'desc' },
        }))
        expect(purgeLog).toBeTruthy()
        expect(purgeLog.actorType).toBe('system')
        expect(purgeLog.actorUserId).toBeNull()
        expect(purgeLog.entityType).toBe('AuditLog')
        expect(purgeLog.metadata.deletedCount).toBeGreaterThanOrEqual(1)
        expect(typeof purgeLog.metadata.cutoff).toBe('string')

        await prisma.auditLog.deleteMany({ where: { id: purgeLog.id } })
      } finally {
        await prisma.auditLog.deleteMany({ where: { id: { in: [expiredLog.id, freshLog.id] } } })
      }
    })

    it('chống chạy trùng: khi vừa dọn gần đây (Setting còn "tươi"), lần gọi kế tiếp KHÔNG dọn tiếp dù có bản ghi hết hạn', async () => {
      await prisma.setting.create({ data: { key: LAST_PURGE_SETTING_KEY, value: new Date().toISOString() } })

      const expiredAt = new Date(Date.now() - RETENTION_MS - 24 * 60 * 60 * 1000)
      const expiredLog = await prisma.auditLog.create({
        data: {
          actorType: 'user', action: AUDIT_ACTIONS.EXAM_CREATE, entityType: 'Exam',
          entityLabel: label('retention-blocked'), createdAt: expiredAt,
        }
      })
      const baselineId = await latestAutoPurgeId()

      try {
        await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        await settle()

        const stillThere = await prisma.auditLog.findUnique({ where: { id: expiredLog.id } })
        expect(stillThere).not.toBeNull() // claim bị chặn → không dọn gì cả

        const newPurgeLog = await prisma.auditLog.findFirst({
          where: { action: AUDIT_ACTIONS.AUDIT_LOG_AUTO_PURGE, id: { gt: baselineId } },
        })
        expect(newPurgeLog).toBeNull()
      } finally {
        await prisma.auditLog.deleteMany({ where: { id: expiredLog.id } })
      }
    })

    it('không có gì để dọn thì không sinh audit log rác', async () => {
      // Quét trước mọi bản ghi (nếu có) đã quá hạn lưu giữ trên DB dev, đảm bảo
      // "không có gì để dọn" là đúng thực tế trước khi assert.
      const cutoff = new Date(Date.now() - RETENTION_MS)
      await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })

      const baselineId = await latestAutoPurgeId()

      await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      await settle()

      const newPurgeLog = await prisma.auditLog.findFirst({
        where: { action: AUDIT_ACTIONS.AUDIT_LOG_AUTO_PURGE, id: { gt: baselineId } },
      })
      expect(newPurgeLog).toBeNull()
    })
  })
})
