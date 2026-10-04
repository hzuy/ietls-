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
    findFirst: vi.fn(),
  },
  questionAnswer: {
    groupBy: vi.fn(),
  },
  answerLog: {
    groupBy: vi.fn(),
  },
  exam: {
    findMany: vi.fn(),
  },
  practiceExam: {
    groupBy: vi.fn(),
  },
  writingSample: {
    count: vi.fn(),
  },
  speakingSample: {
    count: vi.fn(),
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
    prismaMock.questionAnswer.groupBy.mockResolvedValue([])
    prismaMock.answerLog.groupBy.mockResolvedValue([])
    prismaMock.attempt.findFirst.mockResolvedValue(null)
    prismaMock.exam.findMany.mockResolvedValue([])
    prismaMock.practiceExam.groupBy.mockResolvedValue([])
    prismaMock.writingSample.count.mockResolvedValue(0)
    prismaMock.speakingSample.count.mockResolvedValue(0)
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'MOCK AI CHATBOT REPLY' }, finish_reason: 'stop' }],
    })
  })

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app).post('/api/chatbot/message').send({ message: 'Xin chào' })
    expect(res.status).toBe(401)
  })

  it('rejects empty message or message > 1000 characters with 400 Bad Request', async () => {
    const token = makeToken(101)

    // Empty message
    const resEmpty = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '  ' })
    expect(resEmpty.status).toBe(400)
    expect(resEmpty.body.message).toContain('Vui lòng nhập nội dung')

    const longMsg = 'A'.repeat(1001)
    const resLong = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: longMsg })
    expect(resLong.status).toBe(400)
    expect(resLong.body.message).toContain('không được vượt quá 1000 ký tự')
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

  it('includes strict academic IELTS guardrail in the system prompt sent to Groq', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    const token = makeToken(300)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 300,
      name: 'User 300',
      email: 'u300@example.com',
      role: 'user',
      createdAt: new Date(),
    })
    prismaMock.attempt.findMany.mockResolvedValue([])

    await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Giải thích giúp mình tiêu chí Task Achievement' })

    expect(mockCreate).toHaveBeenCalled()
    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages.find(m => m.role === 'system')
    expect(systemMessage.content).toContain('IELTS AI Tutor')
    expect(systemMessage.content).toContain('Từ chối lịch sự các chủ đề không liên quan')
    expect(systemMessage.content).toContain('TUYỆT ĐỐI KHÔNG bịa nội dung đề thi')
    expect(systemMessage.content).toContain('không nêu tên model')
  })

  it('includes short-reply and no-heading/table formatting guardrail in the system prompt', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    const token = makeToken(301)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 301,
      name: 'User 301',
      email: 'u301@example.com',
      role: 'user',
      createdAt: new Date(),
    })
    prismaMock.attempt.findMany.mockResolvedValue([])

    await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Xin chào' })

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages.find(m => m.role === 'system')
    expect(systemMessage.content).toContain('Ngắn gọn')
    expect(systemMessage.content).toContain('Không dùng heading markdown, không dùng bảng')
  })

  it('rounds avgBand/bandBySkill to valid IELTS 0.5 steps instead of raw toFixed(2) decimals (regression: was producing values like 0.81)', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    const token = makeToken(302)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 302,
      name: 'User 302',
      email: 'u302@example.com',
      role: 'user',
      createdAt: new Date(),
    })
    // Reading avg raw = (5 + 6.5) / 2 = 5.75 (không phải bước 0.5) -> phải làm tròn thành 6.0
    // Listening = 7 (đã hợp lệ). Overall (ieltsOverall[6, 7]) = 6.5 -> hợp lệ.
    // Trước fix: bandBySkill.reading = 5.75 (toFixed(2)), avgBand = (5.75+7)/2 = 6.38 — cả 2 đều sai IELTS.
    prismaMock.attempt.findMany.mockResolvedValue([
      { score: 5, finishedAt: new Date(), exam: { skill: 'reading' } },
      { score: 6.5, finishedAt: new Date(), exam: { skill: 'reading' } },
      { score: 7, finishedAt: new Date(), exam: { skill: 'listening' } },
    ])

    const res = await request(app)
      .post('/api/chatbot/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Điểm trung bình band của tôi là bao nhiêu?' })

    expect(res.status).toBe(200)
    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages.find(m => m.role === 'system')

    expect(systemMessage.content).toContain('Band trung bình theo kỹ năng: Reading 6.0, Listening 7.0, Writing chưa có, Speaking chưa có')
    expect(systemMessage.content).toContain('Overall (chỉ tính kỹ năng đã có điểm): 6.5')
    expect(systemMessage.content).not.toMatch(/5\.75|6\.38/)
    expect(systemMessage.content).toContain('Band IELTS chỉ có bước 0.5')
  })

  function mockUser(id) {
    prismaMock.user.findUnique.mockResolvedValue({ id, name: `User ${id}`, createdAt: new Date('2026-01-01') })
  }

  async function sendAndGetSystem(token, body) {
    const res = await request(app).post('/api/chatbot/message').set('Authorization', `Bearer ${token}`).send(body)
    const callArgs = mockCreate.mock.calls[0]?.[0]
    return { res, callArgs, system: callArgs?.messages.find(m => m.role === 'system')?.content || '' }
  }

  it('lists recent attempts with exam name, band and correct count — and never sends email to the AI', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    mockUser(400)
    prismaMock.attempt.findMany.mockResolvedValue([
      { id: 91, score: 5.5, finishedAt: new Date('2026-09-20T03:00:00Z'), exam: { skill: 'reading', title: 'x', bookNumber: 19, testNumber: 2, series: { name: 'IELTS Cambridge Academic' } } },
    ])
    prismaMock.questionAnswer.groupBy
      .mockResolvedValueOnce([{ attemptId: 91, _count: { _all: 40 } }])
      .mockResolvedValueOnce([{ attemptId: 91, _count: { _all: 21 } }])

    const { res, system } = await sendAndGetSystem(makeToken(400), { message: 'Cho mình thông tin các bài mình đã làm' })

    expect(res.status).toBe(200)
    expect(system).toContain('IELTS Cambridge Academic 19 – Test 2 · band 5.5, đúng 21/40 câu')
    expect(system).not.toContain('@')
  })

  it('does not send the current message twice when the client also puts it in conversationHistory', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    mockUser(401)
    prismaMock.attempt.findMany.mockResolvedValue([])

    const { callArgs } = await sendAndGetSystem(makeToken(401), {
      message: 'Câu hỏi mới',
      conversationHistory: [
        { role: 'user', content: 'Câu cũ' },
        { role: 'assistant', content: 'Trả lời cũ' },
        { role: 'user', content: 'Câu hỏi mới' },
      ],
    })

    const userTurns = callArgs.messages.filter(m => m.role === 'user').map(m => m.content)
    expect(userTurns).toEqual(['Câu cũ', 'Câu hỏi mới'])
  })

  it('on a review page loads only the current user attempt and grounds the mentioned question with its stored explanation', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    mockUser(402)
    prismaMock.attempt.findMany.mockResolvedValue([])
    prismaMock.attempt.findFirst.mockResolvedValue({
      id: 52, score: 3, finishedAt: new Date(), exam: { skill: 'reading', title: 'x', bookNumber: 19, testNumber: 1, series: { name: 'IELTS Cambridge Academic' } },
      questionAnswers: [
        { userAnswer: 'TRUE', isCorrect: false, question: { number: 5, type: 'true_false_ng', questionText: 'Fischer designed the racket.', correctAnswer: 'NOT GIVEN', explanation: { v: 2, reasoning: 'Bài không nói ai thiết kế.', evidence: { parts: [{ text: 'Fischer started playing with it.' }] } } } },
        { userAnswer: 'A', isCorrect: true, question: { number: 6, type: 'mcq', questionText: 'q6', correctAnswer: 'A', explanation: null } },
      ],
    })

    const { system } = await sendAndGetSystem(makeToken(402), {
      message: 'Giải thích câu 5 giúp mình',
      pageContext: { path: '/reading/13/explanation', search: '?attemptId=52', title: 'Cambridge 19 Test 1' },
    })

    expect(prismaMock.attempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 402, examId: 13, id: 52 }),
    }))
    expect(system).toContain('Câu 5 (True/False/Not Given): học viên "TRUE", đáp án đúng "NOT GIVEN"')
    expect(system).toContain('Bài không nói ai thiết kế.')
  })

  it('keeps the prompt small: no exam catalog and only 3 recent attempts for a pure knowledge question', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    mockUser(404)
    const attempt = n => ({ id: n, score: 5, finishedAt: new Date(2026, 8, n), exam: { skill: 'reading', title: `Đề ${n}`, bookNumber: null, testNumber: null, series: null } })
    prismaMock.attempt.findMany.mockResolvedValue([1, 2, 3, 4, 5, 6].map(attempt))

    const { system } = await sendAndGetSystem(makeToken(404), { message: 'Phân biệt Not Given và False' })

    expect(prismaMock.exam.findMany).not.toHaveBeenCalled()
    expect(system).toContain('3 lượt làm gần nhất')
    expect(system).toContain('còn 3 lượt cũ hơn không liệt kê')
  })

  it('includes the real exam catalog when the learner asks what the website has', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    mockUser(405)
    prismaMock.attempt.findMany.mockResolvedValue([])
    prismaMock.exam.findMany.mockResolvedValue([
      { skill: 'listening', bookNumber: 18, testNumber: 1, series: { name: 'IELTS Cambridge Academic' } },
    ])

    const { system } = await sendAndGetSystem(makeToken(405), { message: 'Web có đề Cambridge 18 không?' })

    expect(system).toContain('- IELTS Cambridge Academic 18: Listening (Test 1)')
  })

  it('uses low reasoning effort and retries once when the model spends the whole budget on reasoning', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key'
    mockUser(403)
    prismaMock.attempt.findMany.mockResolvedValue([])
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: '' }, finish_reason: 'length' }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Câu trả lời ngắn' }, finish_reason: 'stop' }] })

    const { res, callArgs } = await sendAndGetSystem(makeToken(403), { message: 'Mẹo làm Matching Headings?' })

    expect(callArgs.max_tokens).toBeGreaterThanOrEqual(1000)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(res.body.reply).toBe('Câu trả lời ngắn')
  })
})
