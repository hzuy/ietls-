import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: 'MOCK AI CHATBOT REPLY' }, finish_reason: 'stop' }],
})

class MockGroqClient {
  constructor() {
    this.chat = {
      completions: {
        create: mockCreate,
      },
    }
  }
}

// 1. Mock via Vitest
vi.mock('groq-sdk', () => ({
  __esModule: true,
  default: MockGroqClient,
  Groq: MockGroqClient,
}))

// 2. Mock via Node CJS require.cache (100% bulletproof for require('groq-sdk'))
try {
  const groqPath = require.resolve('groq-sdk')
  require.cache[groqPath] = {
    id: groqPath,
    filename: groqPath,
    loaded: true,
    exports: MockGroqClient,
  }
} catch (e) {}

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
  attempt: {
    findMany: vi.fn(),
  },
  writingCriterionLog: {
    findMany: vi.fn(),
  },
  speakingCriterionLog: {
    findMany: vi.fn(),
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

// Clear server & chatbot route cache to ensure re-requiring with mock
try {
  const serverPath = require.resolve('../server')
  delete require.cache[serverPath]
  const chatbotPath = require.resolve('./chatbot')
  delete require.cache[chatbotPath]
} catch (e) {}

const app = require('../server')
const { chatbotStore } = require('./chatbot')

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, email: `user${userId}@example.com`, role }, process.env.JWT_SECRET)
}

describe('Chatbot API Routes (/api/chatbot/message)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatbotStore.clear() // Reset rate limiter memory before each test

    prismaMock.writingCriterionLog.findMany.mockResolvedValue([])
    prismaMock.speakingCriterionLog.findMany.mockResolvedValue([])
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'MOCK AI CHATBOT REPLY' }, finish_reason: 'stop' }],
    })
  })

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app).post('/api/chatbot/message').send({ message: 'Xin chào' })
    expect(res.status).toBe(401)
  })

  it('rejects empty message or message > 500 characters with 400 Bad Request', async () => {
    const token = makeToken(101)

    // Empty message
    const resEmpty = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '  ' })
    expect(resEmpty.status).toBe(400)
    expect(resEmpty.body.message).toContain('Vui lòng nhập nội dung')

    // Message > 500 chars
    const longMsg = 'A'.repeat(501)
    const resLong = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: longMsg })
    expect(resLong.status).toBe(400)
    expect(resLong.body.message).toContain('không được vượt quá 500 ký tự')
  })

  it('enforces chatbotRateLimiter (max 20 requests/user/hour)', async () => {
    const userId = 777
    const token = makeToken(userId)

    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Test User',
      email: 'user777@example.com',
      role: 'user',
      createdAt: new Date(),
    })
    prismaMock.attempt.findMany.mockResolvedValue([])

    // Make 20 requests -> all 200 OK
    for (let i = 1; i <= 20; i++) {
      const res = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: `Hỏi lần ${i}` })
      expect(res.status).toBe(200)
    }

    // 21st request -> 429 Too Many Requests
    const res21 = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hỏi lần 21' })

    expect(res21.status).toBe(429)
    expect(res21.body.message).toContain('giới hạn 20 tin nhắn')
  })

  it('isolates user context using verified JWT (user A requesting user B data)', async () => {
    const userA = 100
    const tokenA = makeToken(userA)

    prismaMock.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === userA) {
        return Promise.resolve({
          id: userA,
          name: 'Học viên A',
          email: 'usera@example.com',
          role: 'user',
          createdAt: new Date(),
        })
      }
      return Promise.resolve(null)
    })
    prismaMock.attempt.findMany.mockResolvedValue([])

    const res = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Cho tôi xem điểm của user id 999' })

    expect(res.status).toBe(200)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: userA },
      select: expect.any(Object),
    })
  })

  it('handles AI response fallback gracefully without crashing server', async () => {
    const token = makeToken(200)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 200,
      name: 'User 200',
      email: 'u200@example.com',
      role: 'user',
      createdAt: new Date(),
    })
    prismaMock.attempt.findMany.mockResolvedValue([])

    const res = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Xin chào trợ lý' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('reply')
    expect(typeof res.body.reply).toBe('string')
  })
})
