import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import { AUDIT_ACTIONS } from '../lib/auditActions'

process.env.JWT_SECRET = 'test_secret_key'

// ─── Audit log wiring for routes/samples.js ─────────────────────────────────
// This router mounts at /api/samples (outside /api/admin) with a locally
// defined teacherOrAdmin guard — the logAuditEvent() calls are explicit per
// handler, not middleware, so these tests verify each call site directly.

const prismaMock = {
  writingSample: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  speakingSample: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({})
  }
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }

const storageMock = {
  uploadOptimizedCover: vi.fn(async (file) => {
    try { fs.unlinkSync(file.path) } catch { /* already gone */ }
    return { url: '/uploads/thumbnails/fake-thumb.webp' }
  })
}
const storagePath = require.resolve('../services/storageService')
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: storageMock }

const app = require('../server')
const { clearAll: clearSWRCache } = require('../lib/swrCache')

describe('routes/samples.js — audit log wiring', () => {
  const token = jwt.sign({ userId: 4, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    clearSWRCache()
  })

  it('GET /writing supports bounded server-side search, filters, sorting, and pagination', async () => {
    prismaMock.writingSample.findMany.mockImplementation(async args => args.distinct
      ? [{ examType: 'Opinion essay' }]
      : [{ id: 18, title: 'Education', level: 'task2', examType: 'Opinion essay', tags: null }])
    prismaMock.writingSample.count.mockResolvedValue(1)

    const response = await request(app)
      .get('/api/samples/writing')
      .query({ page: 2, pageSize: 999, search: 'education', level: 'task2', type: 'Opinion essay', sort: 'title-asc' })
      .expect(200)

    expect(response.body.items).toHaveLength(1)
    expect(response.body.pagination).toEqual({ page: 2, pageSize: 24, total: 1, totalPages: 1 })
    const pageQuery = prismaMock.writingSample.findMany.mock.calls.find(([args]) => !args.distinct)[0]
    expect(pageQuery.where).toEqual({
      deletedAt: null,
      level: 'task2',
      examType: 'Opinion essay',
      title: { contains: 'education', mode: 'insensitive' },
    })
    expect(pageQuery.skip).toBe(24)
  })

  it('POST /admin/writing logs sample.create for WritingSample', async () => {
    prismaMock.writingSample.create.mockResolvedValueOnce({ id: 10, title: 'New Writing Sample', tags: null })

    await request(app)
      .post('/api/samples/admin/writing')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Writing Sample' })
      .expect(201)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'user',
        actorUserId: 4,
        action: AUDIT_ACTIONS.SAMPLE_CREATE,
        entityType: 'WritingSample',
        entityId: 10,
        entityLabel: 'New Writing Sample'
      })
    })
  })

  it('POST /admin/speaking logs sample.create for SpeakingSample', async () => {
    prismaMock.speakingSample.create.mockResolvedValueOnce({ id: 20, title: 'New Speaking Sample', tags: null })

    await request(app)
      .post('/api/samples/admin/speaking')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Speaking Sample' })
      .expect(201)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_CREATE,
        entityType: 'SpeakingSample',
        entityId: 20,
        entityLabel: 'New Speaking Sample'
      })
    })
  })

  it('PUT /admin/writing/:id logs sample.update with the updated title', async () => {
    prismaMock.writingSample.update.mockResolvedValueOnce({ id: 10, title: 'Renamed', tags: null })

    await request(app)
      .put('/api/samples/admin/writing/10')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed' })
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_UPDATE,
        entityType: 'WritingSample',
        entityId: 10,
        entityLabel: 'Renamed'
      })
    })
  })

  it('PUT /admin/speaking/:id logs sample.update with the updated title', async () => {
    prismaMock.speakingSample.update.mockResolvedValueOnce({ id: 20, title: 'Renamed Speaking', tags: null })

    await request(app)
      .put('/api/samples/admin/speaking/20')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed Speaking' })
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_UPDATE,
        entityType: 'SpeakingSample',
        entityId: 20,
        entityLabel: 'Renamed Speaking'
      })
    })
  })

  it('POST /admin/writing/:id/thumbnail logs sample.update with resource "thumbnail"', async () => {
    prismaMock.writingSample.update.mockResolvedValueOnce({ id: 10, thumbnailUrl: '/uploads/thumbnails/fake-thumb.webp' })

    await request(app)
      .post('/api/samples/admin/writing/10/thumbnail')
      .set('Authorization', `Bearer ${token}`)
      .attach('thumbnail', Buffer.from([0, 1, 2, 3]), 'cover.png')
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_UPDATE,
        entityType: 'WritingSample',
        entityId: 10,
        metadata: { resource: 'thumbnail' }
      })
    })
  })

  it('POST /admin/speaking/:id/thumbnail logs sample.update with resource "thumbnail"', async () => {
    prismaMock.speakingSample.update.mockResolvedValueOnce({ id: 20, thumbnailUrl: '/uploads/thumbnails/fake-thumb.webp' })

    await request(app)
      .post('/api/samples/admin/speaking/20/thumbnail')
      .set('Authorization', `Bearer ${token}`)
      .attach('thumbnail', Buffer.from([0, 1, 2, 3]), 'cover.png')
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_UPDATE,
        entityType: 'SpeakingSample',
        entityId: 20,
        metadata: { resource: 'thumbnail' }
      })
    })
  })

  it('DELETE /admin/writing/:id reads the title before soft-delete and logs sample.delete', async () => {
    prismaMock.writingSample.findUnique.mockResolvedValueOnce({ title: 'Bài mẫu sắp bị xóa' })
    prismaMock.writingSample.update.mockResolvedValueOnce({})

    await request(app)
      .delete('/api/samples/admin/writing/10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(prismaMock.writingSample.findUnique).toHaveBeenCalledWith({ where: { id: 10 }, select: { title: true } })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_DELETE,
        entityType: 'WritingSample',
        entityId: 10,
        entityLabel: 'Bài mẫu sắp bị xóa'
      })
    })
  })

  it('DELETE /admin/speaking/:id reads the title before soft-delete and logs sample.delete', async () => {
    prismaMock.speakingSample.findUnique.mockResolvedValueOnce({ title: 'Bài mẫu Speaking sắp bị xóa' })
    prismaMock.speakingSample.update.mockResolvedValueOnce({})

    await request(app)
      .delete('/api/samples/admin/speaking/20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(prismaMock.speakingSample.findUnique).toHaveBeenCalledWith({ where: { id: 20 }, select: { title: true } })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.SAMPLE_DELETE,
        entityType: 'SpeakingSample',
        entityId: 20,
        entityLabel: 'Bài mẫu Speaking sắp bị xóa'
      })
    })
  })

  // ─── TC-036: nested Speaking Part/Question graph ──────────────────────────
  describe('Speaking sample nested parts (TC-036)', () => {
    it('creates a sample with nested parts/questions in one Prisma write', async () => {
      prismaMock.speakingSample.create.mockResolvedValueOnce({
        id: 21, title: 'Speaking with parts', tags: '[]',
        parts: [{ id: 1, partNumber: 1, questions: [{ id: 1, orderNum: 1, questionText: 'Hello?' }] }],
      })

      const res = await request(app)
        .post('/api/samples/admin/speaking')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Speaking with parts',
          parts: [
            { number: 1, title: 'Part 1', questions: [{ questionText: 'Hello?' }] },
          ],
        })

      expect(res.status).toBe(201)
      const createArg = prismaMock.speakingSample.create.mock.calls[0][0]
      expect(createArg.data.parts).toEqual({
        create: [{
          partNumber: 1,
          title: 'Part 1',
          description: null,
          questions: { create: [{ orderNum: 1, questionText: 'Hello?' }] },
        }],
      })
      expect(createArg.include).toBeDefined()
      expect(res.body.parts).toHaveLength(1)
    })

    it('rejects duplicate part numbers before touching the database', async () => {
      const res = await request(app)
        .post('/api/samples/admin/speaking')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Duplicate parts',
          parts: [
            { partNumber: 1, questions: [{ questionText: 'A' }] },
            { partNumber: 1, questions: [{ questionText: 'B' }] },
          ],
        })

      expect(res.status).toBe(400)
      expect(prismaMock.speakingSample.create).not.toHaveBeenCalled()
    })

    it('replaces the whole graph atomically on update when parts are supplied', async () => {
      prismaMock.speakingSample.update.mockResolvedValueOnce({ id: 21, title: 'Renamed', parts: [] })

      const res = await request(app)
        .put('/api/samples/admin/speaking/21')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Renamed',
          parts: [{ partNumber: 2, questions: [{ orderNum: 1, questionText: 'New question' }] }],
        })

      expect(res.status).toBe(200)
      const updateArg = prismaMock.speakingSample.update.mock.calls[0][0]
      expect(updateArg.data.parts.deleteMany).toEqual({})
      expect(updateArg.data.parts.create).toEqual([{
        partNumber: 2,
        title: null,
        description: null,
        questions: { create: [{ orderNum: 1, questionText: 'New question' }] },
      }])
    })

    it('clears the graph when parts is an empty array', async () => {
      prismaMock.speakingSample.update.mockResolvedValueOnce({ id: 21, title: 'Renamed', parts: [] })

      const res = await request(app)
        .put('/api/samples/admin/speaking/21')
        .set('Authorization', `Bearer ${token}`)
        .send({ parts: [] })

      expect(res.status).toBe(200)
      const updateArg = prismaMock.speakingSample.update.mock.calls[0][0]
      expect(updateArg.data.parts).toEqual({ deleteMany: {} })
    })

    it('leaves the existing graph untouched when parts is omitted', async () => {
      prismaMock.speakingSample.update.mockResolvedValueOnce({ id: 21, title: 'Renamed', parts: [] })

      await request(app)
        .put('/api/samples/admin/speaking/21')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Renamed' })
        .expect(200)

      const updateArg = prismaMock.speakingSample.update.mock.calls[0][0]
      expect(updateArg.data.parts).toBeUndefined()
    })
  })
})
