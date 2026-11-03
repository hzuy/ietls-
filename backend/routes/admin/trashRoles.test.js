import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

// Xoá vĩnh viễn (permanent/purge) không thể hoàn tác và xoá luôn bài làm của học
// sinh (hardDeleteExams xoá Attempt/Answer) → chỉ admin. Giáo viên vẫn xem thùng
// rác + khôi phục được.
const prismaMock = {
  practiceExam: { findMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  writingSample: { findMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  speakingSample: { findMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  examSeries: { findMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  bookCover: { findMany: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  exam: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
  attempt: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  writingTask: { findMany: vi.fn() },
  speakingPart: { findMany: vi.fn() },
  question: { findMany: vi.fn() },
  answerLog: { findMany: vi.fn(), deleteMany: vi.fn() },
  questionAnswer: { deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (callback) => callback(prismaMock)),
}

const prismaPath = require.resolve('../../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../../server')

const tokenFor = (role) =>
  jwt.sign({ userId: 1, email: `${role}@example.com`, role }, 'test_secret_key', { expiresIn: '1h' })

const send = (req, role) => req.set('Authorization', `Bearer ${tokenFor(role)}`)

describe('Thùng rác: purge chỉ dành cho admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({ id: 1 })
    prismaMock.practiceExam.findMany.mockResolvedValue([])
    prismaMock.writingSample.findMany.mockResolvedValue([])
    prismaMock.speakingSample.findMany.mockResolvedValue([])
    prismaMock.examSeries.findMany.mockResolvedValue([])
    prismaMock.bookCover.findMany.mockResolvedValue([])
    prismaMock.practiceExam.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.writingSample.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.speakingSample.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.examSeries.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.bookCover.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.exam.findMany.mockResolvedValue([])
    prismaMock.writingSample.findUnique.mockResolvedValue({ id: 5, title: 'Sample A', deletedAt: new Date('2020-01-01') })
    prismaMock.writingSample.update.mockResolvedValue({ title: 'Sample A' })
    prismaMock.writingSample.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('giáo viên gọi DELETE /trash/purge → 403 và KHÔNG xoá gì', async () => {
    const res = await send(request(app).delete('/api/admin/trash/purge'), 'teacher')

    expect(res.status).toBe(403)
    expect(prismaMock.practiceExam.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.writingSample.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.exam.findMany).not.toHaveBeenCalled()
  })

  it('học sinh gọi DELETE /trash/purge → 403', async () => {
    const res = await send(request(app).delete('/api/admin/trash/purge'), 'user')

    expect(res.status).toBe(403)
    expect(prismaMock.practiceExam.deleteMany).not.toHaveBeenCalled()
  })

  it('admin gọi DELETE /trash/purge → 200 và dọn sạch', async () => {
    const res = await send(request(app).delete('/api/admin/trash/purge'), 'admin')

    expect(res.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    expect(prismaMock.practiceExam.findMany).toHaveBeenCalled()
    expect(prismaMock.writingSample.findMany).toHaveBeenCalled()
    expect(prismaMock.exam.findMany).toHaveBeenCalled()
  })

  it('giáo viên gọi DELETE /trash/:type/:id/permanent → 403 và KHÔNG xoá', async () => {
    const res = await send(request(app).delete('/api/admin/trash/writing_sample/5/permanent'), 'teacher')

    expect(res.status).toBe(403)
    expect(prismaMock.writingSample.delete).not.toHaveBeenCalled()
    expect(prismaMock.writingSample.findUnique).not.toHaveBeenCalled()
  })

  it('admin gọi DELETE /trash/:type/:id/permanent → 200 và xoá', async () => {
    const res = await send(request(app).delete('/api/admin/trash/writing_sample/5/permanent'), 'admin')

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(prismaMock.writingSample.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [5] } } })
  })

  it('giáo viên vẫn khôi phục được (restore không bị chặn)', async () => {
    const res = await send(request(app).post('/api/admin/trash/writing_sample/5/restore'), 'teacher')

    expect(res.status).toBe(200)
    expect(prismaMock.writingSample.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { deletedAt: null },
      select: { title: true },
    })
  })
})
