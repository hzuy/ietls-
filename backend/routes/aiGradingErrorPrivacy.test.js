import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

// ─── Mock Prisma (chỉ những model mà 2 route chấm bài dùng) ───────────────────
const prismaMock = {
  setting: { findUnique: vi.fn() },
  writingTask: { findUnique: vi.fn(), findMany: vi.fn() },
  writingAnswer: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  writingCriterionLog: { createMany: vi.fn() },
  speakingPart: { findUnique: vi.fn(), findMany: vi.fn() },
  speakingAnswer: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  speakingCriterionLog: { createMany: vi.fn() },
  attempt: { count: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

// ─── Mock lớp gọi AI: chỉ thay requestGradingJson, giữ nguyên phần còn lại ────
const realGroqClient = require('../lib/groqClient')
const requestGradingJson = vi.fn()
const groqClientPath = require.resolve('../lib/groqClient')
require.cache[groqClientPath] = {
  id: groqClientPath,
  filename: groqClientPath,
  loaded: true,
  exports: { ...realGroqClient, requestGradingJson },
}

const app = require('../server')

const ESSAY = 'Nowadays, many people believe that living in a big city brings more opportunities than living in the countryside. '
  + 'In my opinion, both options have advantages, but cities offer better education and healthcare. '
  + 'However, the cost of living is higher and the environment is noisier. '
  + 'Therefore, each person should consider their own priorities before deciding where to live and work.'

const TRANSCRIPT = 'I live in a big city with many people and nice places to visit every day. '
  + 'There are lots of parks, restaurants and museums, so I never feel bored at the weekend.'

describe('Lỗi chấm bài AI không rò rỉ chi tiết hạ tầng (writing/speaking)', () => {
  const getToken = () => jwt.sign({ userId: 1, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })
  let consoleErrorSpy

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.writingAnswer.update.mockResolvedValue({})
    prismaMock.writingAnswer.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.writingCriterionLog.createMany.mockResolvedValue({ count: 0 })
    prismaMock.speakingAnswer.update.mockResolvedValue({})
    prismaMock.speakingAnswer.findUnique.mockResolvedValue(null)
    prismaMock.speakingCriterionLog.createMany.mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const findFailedUpdate = (model) => prismaMock[model][model === 'writingAnswer' ? 'updateMany' : 'update'].mock.calls
    .map(([args]) => args)
    .find((args) => args?.data?.status === 'failed')

  it('writing: lưu mã AI_RATE_LIMIT (không lưu message thô của provider)', async () => {
    prismaMock.writingTask.findUnique.mockResolvedValue({ id: 10, examId: 1, prompt: 'Task 2 prompt', number: 2 })
    prismaMock.writingAnswer.create.mockResolvedValue({ id: 50 })
    requestGradingJson.mockRejectedValue(
      Object.assign(new Error('Rate limit reached for model openai/gpt-oss-120b on requests per day'), { status: 429 })
    )

    const res = await request(app)
      .post('/api/writing/exams/1/submit')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ taskId: 10, essay: ESSAY })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')

    await vi.waitFor(() => {
      expect(findFailedUpdate('writingAnswer')).toBeTruthy()
    })

    const failed = findFailedUpdate('writingAnswer')
    expect(failed.data.error).toBe('AI_RATE_LIMIT')
    expect(JSON.stringify(failed)).not.toContain('Rate limit reached')
    expect(JSON.stringify(failed)).not.toContain('gpt-oss-120b')

    // Chi tiết vẫn được ghi log ở server để còn debug
    const logged = consoleErrorSpy.mock.calls.map((c) => JSON.stringify(c)).join('\n')
    expect(logged).toContain('[Writing AI Error]')
    expect(logged).toContain('Rate limit reached')
  })

  it('speaking: lưu mã AI_MODEL_ERROR (không lưu message thô của provider)', async () => {
    prismaMock.speakingPart.findUnique.mockResolvedValue({ id: 10, examId: 1, number: 1, questions: [] })
    prismaMock.speakingAnswer.findFirst.mockResolvedValue(null)
    prismaMock.speakingAnswer.create.mockResolvedValue({ id: 80 })
    requestGradingJson.mockRejectedValue(
      Object.assign(new Error('model_not_found: model `llama-3.3-70b-versatile` has been decommissioned'), { status: 404 })
    )

    const res = await request(app)
      .post('/api/speaking/exams/1/submit')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ partId: 10, transcript: TRANSCRIPT })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')

    await vi.waitFor(() => {
      expect(findFailedUpdate('speakingAnswer')).toBeTruthy()
    })

    const failed = findFailedUpdate('speakingAnswer')
    expect(failed.data.error).toBe('AI_MODEL_ERROR')
    expect(JSON.stringify(failed)).not.toContain('model_not_found')
    expect(JSON.stringify(failed)).not.toContain('llama-3.3-70b-versatile')

    const logged = consoleErrorSpy.mock.calls.map((c) => JSON.stringify(c)).join('\n')
    expect(logged).toContain('[Speaking AI Error]')
    expect(logged).toContain('model_not_found')
  })
})
