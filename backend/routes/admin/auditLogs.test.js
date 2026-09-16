import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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

    it('lọc theo khoảng from/to (UTC-anchored) chỉ lấy log trong khoảng', async () => {
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
})
