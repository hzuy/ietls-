import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'
// Phải set TRƯỚC khi server (và middleware/rateLimiter) được require.
process.env.RATE_LIMIT_AI_EXPLANATION_MAX = '1'

const app = require('../server')
const { acquireLock, releaseLock } = require('../lib/explanationLock')

// Test này chốt việc 5 endpoint SINH giải thích bằng AI đều đi qua
// aiExplanationLimiter (30 lượt/15 phút/user, override qua env):
//   - request 1: vào tới handler (ở đây handler trả 409 vì đang có lock) — chứng
//     tỏ chưa bị chặn;
//   - request 2: 429 từ rate limiter, KHÔNG vào handler.
// Mỗi endpoint dùng 1 user riêng vì limiter chia quota theo user.
// Lock của đề/bài luyện tập được giữ sẵn để handler thoát sớm, không chạm DB/AI.

const EXAM_ID = 900001
const PRACTICE_ID = 900001

const token = (userId) =>
  jwt.sign({ userId, email: `teacher${userId}@example.com`, role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

const post = (path, userId) =>
  request(app)
    .post(path)
    .set('Authorization', `Bearer ${token(userId)}`)
    .set('x-test-rate-limit', 'true')
    .send({})

describe('Rate limit riêng cho endpoint sinh giải thích AI (admin exam + practice)', () => {
  beforeAll(() => {
    expect(acquireLock(`exam:${EXAM_ID}`)).toBe(true)
    expect(acquireLock(`practice:${PRACTICE_ID}`)).toBe(true)
  })

  afterAll(() => {
    releaseLock(`exam:${EXAM_ID}`)
    releaseLock(`practice:${PRACTICE_ID}`)
  })

  const endpoints = [
    ['sinh giải thích cho cả đề', `/api/admin/exams/${EXAM_ID}/generate-explanations`],
    ['sinh giải thích theo nhóm câu', `/api/admin/exams/${EXAM_ID}/groups/2/generate-explanations`],
    ['tạo lại 1 câu (exam)', `/api/admin/exams/${EXAM_ID}/questions/5/regenerate-explanation`],
    ['sinh giải thích practice', `/api/practice/admin/reading/${PRACTICE_ID}/generate-explanations`],
    ['tạo lại 1 câu (practice)', `/api/practice/admin/reading/${PRACTICE_ID}/questions/5/regenerate-explanation`],
  ]

  endpoints.forEach(([label, path], index) => {
    it(`${label}: request đầu đi qua, request thứ 2 bị 429`, async () => {
      const userId = 700 + index

      const first = await post(path, userId)
      expect(first.status).not.toBe(429)
      expect(first.status).toBe(409) // handler đã chạy → lock đang bận

      const second = await post(path, userId)
      expect(second.status).toBe(429)
      expect(second.body.message).toContain('AI giải thích')
    })
  })

  it('trong môi trường test, request không kèm x-test-rate-limit vẫn được bỏ qua (không phá các suite khác)', async () => {
    const userId = 799
    const req = () => request(app)
      .post(`/api/admin/exams/${EXAM_ID}/generate-explanations`)
      .set('Authorization', `Bearer ${token(userId)}`)
      .send({})

    expect((await req()).status).toBe(409)
    expect((await req()).status).toBe(409)
    expect((await req()).status).toBe(409)
  })
})
