/**
 * Test suite: AnswerLog integration với Reading & Listening submit
 *
 * Mục tiêu:
 * 1. Kiểm tra AnswerLog được ghi đúng khi submit Reading
 * 2. Kiểm tra AnswerLog được ghi đúng khi submit Listening
 * 3. Kiểm tra userId trong AnswerLog khớp với user đang đăng nhập (bảo mật)
 * 4. Kiểm tra logic chấm điểm band score không bị thay đổi
 * 5. Kiểm tra AnswerLog KHÔNG được ghi nếu không có câu trả lời
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

// ── Mock Prisma ───────────────────────────────────────────────────────────────
const prismaMock = {
  setting:        { findUnique: vi.fn() },
  attempt:        { count: vi.fn(), create: vi.fn() },
  passage:        { findMany: vi.fn() },
  listeningSection: { findMany: vi.fn() },
  questionAnswer: { createMany: vi.fn() },
  answerLog:      { createMany: vi.fn() },
  $transaction:   vi.fn(),
}

prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeToken = (userId = 1) =>
  jwt.sign({ userId, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

// ── Reading ───────────────────────────────────────────────────────────────────
describe('AnswerLog — Reading submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

  it('ghi AnswerLog với đúng skillType=reading và userId từ JWT', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.passage.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 101, number: 1, type: 'true_false_ng', questionText: 'Q1', correctAnswer: 'true', groupId: null },
          { id: 102, number: 2, type: 'mcq',           questionText: 'Q2', correctAnswer: 'B', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 99 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 2 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/reading/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(42)}`)
      .send({ answers: { '101': 'TRUE', '102': 'B' } })

    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(2)
    expect(res.body.attemptId).toBe(99)

    // Kiểm tra answerLog.createMany được gọi 1 lần
    expect(prismaMock.answerLog.createMany).toHaveBeenCalledTimes(1)

    const answerLogCall = prismaMock.answerLog.createMany.mock.calls[0][0]
    const logs = answerLogCall.data

    // Phải có đúng 2 log
    expect(logs).toHaveLength(2)

    // Log đầu tiên
    expect(logs[0]).toMatchObject({
      userId:        42,
      attemptId:     99,
      questionId:    101,
      skillType:     'reading',
      questionType:  'true_false_ng',
      isCorrect:     true,
      userAnswer:    'TRUE',
      correctAnswer: 'true',
    })

    // Log thứ hai
    expect(logs[1]).toMatchObject({
      userId:        42,
      attemptId:     99,
      questionId:    102,
      skillType:     'reading',
      questionType:  'mcq',
      isCorrect:     true,
      userAnswer:    'B',
      correctAnswer: 'B',
    })
  })

  it('userId trong AnswerLog phải khớp với userId trong JWT (bảo mật)', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.passage.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 101, number: 1, type: 'mcq', questionText: 'Q1', correctAnswer: 'A', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 55 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

    // Giả sử userId = 7 (khác với 1)
    const res = await request(app)
      .post('/api/reading/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(7)}`)
      .send({ answers: { '101': 'A' } })

    expect(res.status).toBe(200)

    const logs = prismaMock.answerLog.createMany.mock.calls[0][0].data
    // userId phải là 7 (từ JWT), không phải giá trị khác
    expect(logs[0].userId).toBe(7)
    // Không được phép ghi userId tùy ý từ body
    expect(logs[0].userId).not.toBe(1)
  })

  it('KHÔNG ghi AnswerLog nếu không có câu trả lời nào trong result', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.passage.findMany.mockResolvedValue([]) // Không có passage
    prismaMock.attempt.create.mockResolvedValue({ id: 88 })

    const res = await request(app)
      .post('/api/reading/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ answers: {} })

    expect(res.status).toBe(200)
    // answerLog.createMany không được gọi khi result rỗng
    expect(prismaMock.answerLog.createMany).not.toHaveBeenCalled()
  })

  it('band score không bị thay đổi sau khi thêm AnswerLog (regression)', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    // 23 câu đúng → band 6.0
    const questions = Array.from({ length: 23 }, (_, i) => ({
      id: 100 + i, number: i + 1, type: 'fill_blank',
      questionText: `Q${i + 1}`, correctAnswer: 'answer', groupId: null,
    }))
    prismaMock.passage.findMany.mockResolvedValue([
      { id: 1, questions, questionGroups: [] },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 77 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 23 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 23 })

    const answers = {}
    questions.forEach(q => { answers[q.id] = 'answer' })

    const res = await request(app)
      .post('/api/reading/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ answers })

    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(23)
    expect(res.body.score).toBe(6.0) // getReadingBand(23) = 6.0
  })

  it('questionAnswer.createMany vẫn được gọi đồng thời với answerLog.createMany', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.passage.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 101, number: 1, type: 'mcq', questionText: 'Q1', correctAnswer: 'A', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 10 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

    await request(app)
      .post('/api/reading/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ answers: { '101': 'A' } })

    // Cả hai bảng phải được ghi
    expect(prismaMock.questionAnswer.createMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.answerLog.createMany).toHaveBeenCalledTimes(1)
  })
})

// ── Listening ─────────────────────────────────────────────────────────────────
describe('AnswerLog — Listening submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

  it('ghi AnswerLog với đúng skillType=listening và userId từ JWT', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.listeningSection.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 201, number: 1, type: 'fill_blank', questionText: 'L1', correctAnswer: 'doctor', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 66 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/listening/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(15)}`)
      .send({ answers: { '201': 'doctor' } })

    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(1)

    const logs = prismaMock.answerLog.createMany.mock.calls[0][0].data
    expect(logs[0]).toMatchObject({
      userId:        15,
      attemptId:     66,
      questionId:    201,
      skillType:     'listening',
      questionType:  'fill_blank',
      isCorrect:     true,
      userAnswer:    'doctor',
      correctAnswer: 'doctor',
    })
  })

  it('câu trả lời sai phải ghi isCorrect=false trong AnswerLog', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.listeningSection.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 201, number: 1, type: 'fill_blank', questionText: 'L1', correctAnswer: 'doctor', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 66 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/listening/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ answers: { '201': 'nurse' } }) // Sai đáp án

    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(0)

    const logs = prismaMock.answerLog.createMany.mock.calls[0][0].data
    expect(logs[0].isCorrect).toBe(false)
    expect(logs[0].userAnswer).toBe('nurse')
    expect(logs[0].correctAnswer).toBe('doctor')
  })

  it('xử lý an toàn khi học viên bỏ trống câu hỏi (không nhập câu trả lời)', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.listeningSection.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 201, number: 1, type: 'fill_blank', questionText: 'L1', correctAnswer: 'doctor', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 67 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
    prismaMock.answerLog.createMany.mockResolvedValue({ count: 1 })

    // Payload không chứa key '201' (bỏ trống câu 201)
    const res = await request(app)
      .post('/api/listening/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ answers: {} })

    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(0)

    const logs = prismaMock.answerLog.createMany.mock.calls[0][0].data
    expect(logs[0].isCorrect).toBe(false)
    expect(logs[0].userAnswer).toBe('') // Không throw lỗi, lưu chuỗi rỗng ""
    expect(logs[0].correctAnswer).toBe('doctor')
  })

  it('không làm hỏng/treo luồng nộp bài của học viên khi answerLog.createMany xảy ra lỗi DB (table missing/error resilience)', async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.listeningSection.findMany.mockResolvedValue([
      {
        id: 1,
        questions: [
          { id: 201, number: 1, type: 'fill_blank', questionText: 'L1', correctAnswer: 'doctor', groupId: null },
        ],
        questionGroups: [],
      },
    ])
    prismaMock.attempt.create.mockResolvedValue({ id: 999 })
    prismaMock.questionAnswer.createMany.mockResolvedValue({ count: 1 })
    // Giả lập DB quăng lỗi bảng AnswerLog chưa exist
    prismaMock.answerLog.createMany.mockRejectedValue(new Error('Table public.AnswerLog does not exist'))

    const res = await request(app)
      .post('/api/listening/exams/1/submit')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ answers: { '201': 'doctor' } })

    // Đảm bảo nộp bài vẫn thành công 200, trả về attemptId và score bình thường
    expect(res.status).toBe(200)
    expect(res.body.attemptId).toBe(999)
    expect(res.body.correct).toBe(1)
  })
})
