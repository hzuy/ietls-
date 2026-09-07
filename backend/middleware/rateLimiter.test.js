import { describe, it, expect, vi, beforeEach } from 'vitest'
const express = require('express')
const request = require('supertest')
const {
  createSubmitRateLimiter,
  objectiveSubmitLimiter,
  aiSubmitLimiter,
  defaultKeyGenerator,
  DEFAULT_OBJECTIVE_MAX,
  DEFAULT_AI_MAX,
} = require('./rateLimiter')

describe('Rate Limiter Middleware', () => {
  describe('defaultKeyGenerator', () => {
    it('returns user_<id> when req.user.userId is present', () => {
      const req = { user: { userId: 42 }, ip: '127.0.0.1' }
      expect(defaultKeyGenerator(req)).toBe('user_42')
    })

    it('falls back to req.ip when req.user is absent', () => {
      const req = { ip: '192.168.1.5' }
      expect(defaultKeyGenerator(req)).toBe('192.168.1.5')
    })

    it('falls back to socket remoteAddress when req.ip is absent', () => {
      const req = { socket: { remoteAddress: '10.0.0.1' } }
      expect(defaultKeyGenerator(req)).toBe('10.0.0.1')
    })
  })

  describe('createSubmitRateLimiter behavior', () => {
    it('allows requests within limit and returns 429 when limit is exceeded', async () => {
      const app = express()
      const testLimiter = createSubmitRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        message: 'Quá giới hạn thử nghiệm.',
        skip: () => false, // never skip in this unit test
      })

      app.use((req, res, next) => {
        req.user = { userId: 101 }
        next()
      })
      app.post('/test-submit', testLimiter, (req, res) => {
        res.json({ ok: true })
      })

      // 1st request -> 200
      const res1 = await request(app).post('/test-submit')
      expect(res1.status).toBe(200)
      expect(res1.body).toEqual({ ok: true })

      // 2nd request -> 200
      const res2 = await request(app).post('/test-submit')
      expect(res2.status).toBe(200)

      // 3rd request -> 429 Too Many Requests
      const res3 = await request(app).post('/test-submit')
      expect(res3.status).toBe(429)
      expect(res3.body).toEqual({ message: 'Quá giới hạn thử nghiệm.' })
      expect(res3.headers['ratelimit-limit']).toBe('2')
    })

    it('isolates quota between different users', async () => {
      const app = express()
      const testLimiter = createSubmitRateLimiter({
        windowMs: 60 * 1000,
        max: 1,
        message: 'Hết lượt.',
        skip: () => false,
      })

      app.post('/test-user-submit', (req, res, next) => {
        const userId = req.headers['x-user-id']
        if (userId) req.user = { userId: parseInt(userId) }
        next()
      }, testLimiter, (req, res) => {
        res.json({ success: true, userId: req.user?.userId })
      })

      // User 1 first request -> OK
      const resUser1_1 = await request(app)
        .post('/test-user-submit')
        .set('x-user-id', '1')
      expect(resUser1_1.status).toBe(200)

      // User 1 second request -> 429
      const resUser1_2 = await request(app)
        .post('/test-user-submit')
        .set('x-user-id', '1')
      expect(resUser1_2.status).toBe(429)

      // User 2 first request -> should NOT be blocked by User 1!
      const resUser2_1 = await request(app)
        .post('/test-user-submit')
        .set('x-user-id', '2')
      expect(resUser2_1.status).toBe(200)
      expect(resUser2_1.body.userId).toBe(2)
    })
  })

  describe('Exported Pre-configured Limiters', () => {
    it('objectiveSubmitLimiter has default limit 20 and Vietnamese message', () => {
      expect(DEFAULT_OBJECTIVE_MAX).toBe(20)
      expect(typeof objectiveSubmitLimiter).toBe('function')
    })

    it('aiSubmitLimiter has default limit 10 and Vietnamese message', () => {
      expect(DEFAULT_AI_MAX).toBe(10)
      expect(typeof aiSubmitLimiter).toBe('function')
    })

    it('responds with friendly Vietnamese message on 429 for objectiveSubmitLimiter', async () => {
      const app = express()
      // Custom instance with small limit to verify message
      const limiter = createSubmitRateLimiter({
        max: 1,
        message: 'Bạn đã nộp bài quá nhiều lần. Vui lòng thử lại sau 15 phút.',
        skip: () => false,
      })
      app.post('/reading-submit', limiter, (req, res) => res.json({ ok: true }))

      await request(app).post('/reading-submit')
      const blocked = await request(app).post('/reading-submit')
      expect(blocked.status).toBe(429)
      expect(blocked.body.message).toContain('Bạn đã nộp bài quá nhiều lần')
    })

    it('responds with friendly Vietnamese message on 429 for aiSubmitLimiter', async () => {
      const app = express()
      const limiter = createSubmitRateLimiter({
        max: 1,
        message: 'Bạn đã gửi yêu cầu chấm điểm AI quá giới hạn. Vui lòng thử lại sau 15 phút.',
        skip: () => false,
      })
      app.post('/writing-submit', limiter, (req, res) => res.json({ ok: true }))

      await request(app).post('/writing-submit')
      const blocked = await request(app).post('/writing-submit')
      expect(blocked.status).toBe(429)
      expect(blocked.body.message).toContain('Bạn đã gửi yêu cầu chấm điểm AI quá giới hạn')
    })
  })
})
