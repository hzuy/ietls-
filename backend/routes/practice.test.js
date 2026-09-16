import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import { AUDIT_ACTIONS } from '../lib/auditActions'

process.env.JWT_SECRET = 'test_secret_key'

// ─── Audit log wiring for routes/practice.js ────────────────────────────────
// This router mounts at /api/practice (outside /api/admin) with a locally
// defined teacherOrAdmin guard — the logAuditEvent() calls are explicit per
// handler, not middleware, so these tests verify each call site directly.

const prismaMock = {
  practiceExam: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([])
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({})
  },
  $transaction: vi.fn()
}
prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }

const storageMock = {
  uploadOptimizedCover: vi.fn(async (file) => {
    try { fs.unlinkSync(file.path) } catch { /* already gone */ }
    return { url: '/uploads/thumbnails/fake-thumb.webp' }
  }),
  uploadAudio: vi.fn(async (file) => {
    try { fs.unlinkSync(file.path) } catch { /* already gone */ }
    return { url: '/uploads/audio/fake-audio.mp3' }
  })
}
const storagePath = require.resolve('../services/storageService')
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: storageMock }

const app = require('../server')

describe('routes/practice.js — audit log wiring', () => {
  const token = jwt.sign({ userId: 3, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

  it('POST /admin/reading logs practice.create with skill + questionCount', async () => {
    prismaMock.practiceExam.create.mockResolvedValueOnce({ id: 100, title: 'New Reading Practice' })

    await request(app)
      .post('/api/practice/admin/reading')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Reading Practice', questions: [{ correctAnswer: 'A' }, { correctAnswer: 'B' }] })
      .expect(201)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'user',
        actorUserId: 3,
        action: AUDIT_ACTIONS.PRACTICE_CREATE,
        entityType: 'PracticeExam',
        entityId: 100,
        entityLabel: 'New Reading Practice',
        metadata: { skill: 'reading', questionCount: 2 }
      })
    })
  })

  it('PUT /admin/reading/:id logs practice.update with total questionCount after replace (no diff)', async () => {
    prismaMock.practiceExam.update.mockResolvedValueOnce({
      id: 100,
      title: 'Updated title',
      questions: [{ id: 1 }, { id: 2 }, { id: 3 }]
    })

    await request(app)
      .put('/api/practice/admin/reading/100')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title', questions: [{ correctAnswer: 'A' }, { correctAnswer: 'B' }, { correctAnswer: 'C' }] })
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.PRACTICE_UPDATE,
        entityType: 'PracticeExam',
        entityId: 100,
        entityLabel: 'Updated title',
        metadata: { skill: 'reading', questionCount: 3 }
      })
    })
  })

  it('DELETE /admin/reading/:id reads the title before soft-delete and logs practice.delete with that snapshot', async () => {
    prismaMock.practiceExam.findUnique.mockResolvedValueOnce({ title: 'Đề luyện sắp bị xóa' })
    prismaMock.practiceExam.update.mockResolvedValueOnce({})

    await request(app)
      .delete('/api/practice/admin/reading/55')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(prismaMock.practiceExam.findUnique).toHaveBeenCalledWith({ where: { id: 55 }, select: { title: true } })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.PRACTICE_DELETE,
        entityType: 'PracticeExam',
        entityId: 55,
        entityLabel: 'Đề luyện sắp bị xóa'
      })
    })
  })

  it('POST /admin/reading/upload-thumbnail logs practice.update with entityId null (no record touched) and no URL in metadata', async () => {
    await request(app)
      .post('/api/practice/admin/reading/upload-thumbnail')
      .set('Authorization', `Bearer ${token}`)
      .attach('thumbnail', Buffer.from([0, 1, 2, 3]), 'cover.png')
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.PRACTICE_UPDATE,
        entityType: 'PracticeExam',
        entityId: null,
        metadata: { resource: 'thumbnail' }
      })
    })
    const loggedMetadata = prismaMock.auditLog.create.mock.calls[0][0].data.metadata
    expect(JSON.stringify(loggedMetadata)).not.toContain('/uploads/')
  })

  it('POST /admin/listening/upload-audio logs practice.update with entityId null and resource "audio"', async () => {
    await request(app)
      .post('/api/practice/admin/listening/upload-audio')
      .set('Authorization', `Bearer ${token}`)
      .attach('audio', Buffer.from([0, 1, 2, 3]), 'clip.mp3')
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.PRACTICE_UPDATE,
        entityType: 'PracticeExam',
        entityId: null,
        metadata: { resource: 'audio' }
      })
    })
  })

  it('POST /admin/reading/:id/thumbnail logs practice.update with the record entityId', async () => {
    prismaMock.practiceExam.update.mockResolvedValueOnce({ id: 100, thumbnailUrl: '/uploads/thumbnails/fake-thumb.webp' })

    await request(app)
      .post('/api/practice/admin/reading/100/thumbnail')
      .set('Authorization', `Bearer ${token}`)
      .attach('thumbnail', Buffer.from([0, 1, 2, 3]), 'cover.png')
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.PRACTICE_UPDATE,
        entityType: 'PracticeExam',
        entityId: 100,
        metadata: { resource: 'thumbnail' }
      })
    })
  })

  it('POST /admin/listening/:id/audio logs practice.update with the record entityId and resource "audio"', async () => {
    prismaMock.practiceExam.update.mockResolvedValueOnce({ id: 100, audioUrl: '/uploads/audio/fake-audio.mp3' })

    await request(app)
      .post('/api/practice/admin/listening/100/audio')
      .set('Authorization', `Bearer ${token}`)
      .attach('audio', Buffer.from([0, 1, 2, 3]), 'clip.mp3')
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.PRACTICE_UPDATE,
        entityType: 'PracticeExam',
        entityId: 100,
        metadata: { resource: 'audio' }
      })
    })
  })
})
