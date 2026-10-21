import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

// Nội dung đã xóa mềm (deletedAt != null) không được trả cho học sinh qua các
// route chi tiết. Test này chốt 2 điều cho từng route:
//   1. truy vấn CÓ điều kiện deletedAt: null (không chỉ lọc theo id),
//   2. xóa mềm (truy vấn trả null) → 404 chứ không trả nội dung.
const prismaMock = {
  exam: { findFirst: vi.fn() },
  practiceExam: { findFirst: vi.fn() },
  writingSample: { findFirst: vi.fn() },
  speakingSample: { findFirst: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

const userToken = () =>
  jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

const auth = (req) => req.set('Authorization', `Bearer ${userToken()}`)

describe('Nội dung xóa mềm không lọt ra phía học sinh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Đề Reading/Listening (exam)', () => {
    it('GET /api/reading/exams/:id — lọc deletedAt và 404 khi đề đã xóa', async () => {
      prismaMock.exam.findFirst.mockResolvedValue(null)

      const res = await auth(request(app).get('/api/reading/exams/9001'))

      expect(res.status).toBe(404)
      expect(prismaMock.exam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9001, deletedAt: null } })
      )
    })

    it('GET /api/reading/exams/:id — vẫn trả nội dung khi đề chưa xóa', async () => {
      prismaMock.exam.findFirst.mockResolvedValue({
        id: 9002,
        title: 'Đề Reading còn hiệu lực',
        skill: 'reading',
        passages: [],
      })

      const res = await auth(request(app).get('/api/reading/exams/9002'))

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Đề Reading còn hiệu lực')
    })

    it('GET /api/listening/exams/:id — lọc deletedAt và 404 khi đề đã xóa', async () => {
      prismaMock.exam.findFirst.mockResolvedValue(null)

      const res = await auth(request(app).get('/api/listening/exams/9003'))

      expect(res.status).toBe(404)
      expect(prismaMock.exam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9003, deletedAt: null } })
      )
    })
  })

  describe('Bài luyện tập lẻ (practiceExam)', () => {
    it('GET /api/practice/reading/:id — lọc deletedAt và 404 khi bài đã xóa', async () => {
      prismaMock.practiceExam.findFirst.mockResolvedValue(null)

      const res = await auth(request(app).get('/api/practice/reading/9004'))

      expect(res.status).toBe(404)
      expect(prismaMock.practiceExam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9004, deletedAt: null } })
      )
    })

    it('GET /api/practice/reading/:id — vẫn trả nội dung khi bài chưa xóa', async () => {
      prismaMock.practiceExam.findFirst.mockResolvedValue({
        id: 9005,
        title: 'Bài luyện Reading',
        skill: 'reading',
        questions: [],
      })

      const res = await auth(request(app).get('/api/practice/reading/9005'))

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Bài luyện Reading')
    })

    it('GET /api/practice/listening/:id — lọc deletedAt và 404 khi bài đã xóa', async () => {
      prismaMock.practiceExam.findFirst.mockResolvedValue(null)

      const res = await auth(request(app).get('/api/practice/listening/9006'))

      expect(res.status).toBe(404)
      expect(prismaMock.practiceExam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9006, deletedAt: null } })
      )
    })
  })

  describe('Bài mẫu công khai (sample)', () => {
    it('GET /api/samples/writing/:id — lọc deletedAt và 404 khi bài mẫu đã xóa', async () => {
      prismaMock.writingSample.findFirst.mockResolvedValue(null)

      const res = await request(app).get('/api/samples/writing/9007')

      expect(res.status).toBe(404)
      expect(prismaMock.writingSample.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9007, deletedAt: null } })
      )
    })

    it('GET /api/samples/writing/:id — vẫn trả nội dung khi bài mẫu chưa xóa', async () => {
      prismaMock.writingSample.findFirst.mockResolvedValue({
        id: 9008,
        title: 'Bài mẫu Writing',
        content: 'Nội dung',
        tags: null,
      })

      const res = await request(app).get('/api/samples/writing/9008')

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Bài mẫu Writing')
      expect(res.body.tags).toEqual([])
    })

    it('GET /api/samples/speaking/:id — lọc deletedAt và 404 khi bài mẫu đã xóa', async () => {
      prismaMock.speakingSample.findFirst.mockResolvedValue(null)

      const res = await request(app).get('/api/samples/speaking/9009')

      expect(res.status).toBe(404)
      expect(prismaMock.speakingSample.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9009, deletedAt: null } })
      )
    })
  })
})
