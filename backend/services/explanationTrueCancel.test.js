import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const generateExpModulePath = require.resolve('../scripts/generate-explanations')
const originalGenerateExpModule = require(generateExpModulePath)
const generateExplanationMock = vi.fn()

require.cache[generateExpModulePath] = {
  id: generateExpModulePath,
  filename: generateExpModulePath,
  loaded: true,
  exports: {
    ...originalGenerateExpModule,
    generateExplanation: generateExplanationMock,
  },
}

const {
  regenerateQuestionExplanation,
  updatePracticeQuestionExplanationTx,
} = require('./explanationGeneratorService')
const { acquireLock, releaseLock, clearAllLocks, isLocked } = require('../lib/explanationLock')

describe('MỤC B: XEM LẠI BẢN VÁ HỦY (afe48ff) & ATOMIC CANCEL FLAG & 60s SLOW STUB', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAllLocks()
  })

  it('B.1 & B.2 STUB CHẬM 60s (Giả lập): Truyền AbortSignal xuống Gemini, hủy khi timeout, không ghi DB sau 504 (Exam)', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 501,
      number: 1,
      type: 'mcq',
      questionText: 'Test question',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: null,
      passage: { body: 'Passage body text' },
    })

    let receivedSignal = null
    let signalAbortedFired = false

    // STUB GỌI CHẬM 60s (chỉ ca kiểm chứng B này dùng stub theo yêu cầu đề bài)
    generateExplanationMock.mockImplementation((q, family, ctx, options = {}) => {
      receivedSignal = options.signal
      if (receivedSignal) {
        receivedSignal.addEventListener('abort', () => {
          signalAbortedFired = true
        })
      }
      return new Promise((resolve) => {
        // Giả lập Gemini phản hồi chậm 60 giây (60000ms)
        const timer = setTimeout(() => {
          resolve({
            v: 2,
            answer: 'A',
            reasoning: 'AI reasoning completed after 60s delay',
          })
        }, 60000)
        if (receivedSignal) {
          receivedSignal.addEventListener('abort', () => {
            clearTimeout(timer)
          })
        }
      })
    })

    const lockKey = 'exam:50'
    expect(acquireLock(lockKey)).toBe(true)

    // Chạy với timeoutMs ngắn (40ms) đại diện cho ngưỡng trần timeout (504)
    let timedOutErr = null
    try {
      await regenerateQuestionExplanation({
        examId: 50,
        questionNumber: 1,
        isPractice: false,
        timeoutMs: 40,
      })
    } catch (err) {
      timedOutErr = err
    } finally {
      releaseLock(lockKey)
    }

    // 1. Phải ném lỗi timeout (HTTP 504)
    expect(timedOutErr).toBeTruthy()
    expect(timedOutErr.code).toBe('ETIMEDOUT')
    expect(timedOutErr.isTimeout).toBe(true)

    // 2. AbortSignal phải được truyền xuống và đã kích hoạt abort()
    expect(receivedSignal).toBeTruthy()
    expect(receivedSignal.aborted).toBe(true)
    expect(signalAbortedFired).toBe(true)

    // 3. Đợi một khoảng thời gian để đảm bảo nếu có race condition thì DB vẫn không bị ghi
    await new Promise((r) => setTimeout(r, 60))

    // 4. Không có bất kỳ lệnh ghi DB nào vào Question (True Cancel nguyên tử)
    expect(prismaMock.question.update).not.toHaveBeenCalled()

    // 5. Thử lại ngay không bị 409 vô lý vì lock đã được release trong finally
    expect(isLocked(lockKey)).toBe(false)
    expect(acquireLock(lockKey)).toBe(true)
    releaseLock(lockKey)
  })

  it('B.1 & B.2 STUB CHẬM 60s (Giả lập): Hủy nguyên tử trong transaction cho Practice Question', async () => {
    prismaMock.practiceExam.findUnique.mockResolvedValue({
      id: 80,
      skill: 'reading',
      questions: [
        {
          id: 801,
          orderNum: 1,
          content: JSON.stringify({
            type: 'mcq',
            questions: [{ number: 1, question: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }],
          }),
        },
      ],
    })

    prismaMock.practiceQuestion.findUnique.mockResolvedValue({
      id: 801,
      content: JSON.stringify({
        type: 'mcq',
        questions: [{ number: 1, question: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }],
      }),
      explanation: null,
    })

    let receivedSignal = null
    generateExplanationMock.mockImplementation((q, family, ctx, options = {}) => {
      receivedSignal = options.signal
      return new Promise((resolve) => {
        // Giả lập Gemini phản hồi sau 60s
        const timer = setTimeout(() => {
          resolve({
            v: 2,
            answer: 'A',
            reasoning: 'Late reasoning',
          })
        }, 60000)
        if (receivedSignal) {
          receivedSignal.addEventListener('abort', () => clearTimeout(timer))
        }
      })
    })

    const lockKey = 'practice:80'
    expect(acquireLock(lockKey)).toBe(true)

    let timedOutErr = null
    try {
      await regenerateQuestionExplanation({
        examId: 80,
        questionNumber: 1,
        isPractice: true,
        timeoutMs: 40,
      })
    } catch (err) {
      timedOutErr = err
    } finally {
      releaseLock(lockKey)
    }

    expect(timedOutErr).toBeTruthy()
    expect(timedOutErr.code).toBe('ETIMEDOUT')
    expect(receivedSignal.aborted).toBe(true)

    // Chờ race condition tiềm tàng
    await new Promise((r) => setTimeout(r, 60))

    // DB không được cập nhật
    expect(prismaMock.practiceQuestion.update).not.toHaveBeenCalled()

    // Lock nhả thành công, retry ngay không 409
    expect(acquireLock(lockKey)).toBe(true)
    releaseLock(lockKey)
  })

  it('B.3 & B.4: Kiểm tra tính nguyên tử của cancelFlag trong transaction updatePracticeQuestionExplanationTx', async () => {
    prismaMock.practiceQuestion.findUnique.mockResolvedValue({
      id: 999,
      explanation: { byNumber: {} },
      content: '{}',
    })

    const cancelFlag = { cancelled: true } // Đã bị hủy trước khi commit transaction

    const res = await updatePracticeQuestionExplanationTx(
      999,
      (byNumber) => {
        byNumber[1] = { v: 2, answer: 'A' }
        return byNumber
      },
      { cancelFlag }
    )

    // Vì cancelFlag.cancelled = true, hàm thoát ngay không update
    expect(res).toBeNull()
    expect(prismaMock.practiceQuestion.update).not.toHaveBeenCalled()
  })

  it('B.4: Đảm bảo không có hai tiến trình cùng chạy đồng thời (Khóa tác vụ acquireLock)', () => {
    const lockKey = 'exam:123'
    expect(acquireLock(lockKey)).toBe(true)
    // Tiến trình thứ hai thử acquire cùng lúc -> bị từ chối (tránh 2 tiến trình cùng ghi)
    expect(acquireLock(lockKey)).toBe(false)

    // Nhả khóa
    releaseLock(lockKey)
    expect(acquireLock(lockKey)).toBe(true)
    releaseLock(lockKey)
  })

  it('F.1 Tín hiệu hủy đến được fetch của Gemini (signal.aborted / AbortError)', async () => {
    const { requestGeminiJson } = require('../lib/groqClient')
    const originalFetch = global.fetch
    const originalKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'test-fake-key'
    let interceptedSignal = null

    const controller = new AbortController()

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      interceptedSignal = opts?.signal
      // Giả lập fetch đang diễn ra thì người dùng bấm Hủy
      controller.abort()
      return new Promise((resolve, reject) => {
        if (interceptedSignal?.aborted) {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          return reject(err)
        }
        if (interceptedSignal) {
          interceptedSignal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    })

    const promise = requestGeminiJson('Test prompt', { signal: controller.signal })

    await expect(promise).rejects.toThrow(/hủy|aborted|AbortError/i)
    expect(interceptedSignal).toBeTruthy()
    expect(interceptedSignal.aborted).toBe(true)

    global.fetch = originalFetch
    process.env.GEMINI_API_KEY = originalKey
  })

  it('F.1 Tín hiệu hủy đến được Groq API (signal.aborted / AbortError)', async () => {
    const { requestGroqGradingJson } = require('../lib/groqClient')
    const controller = new AbortController()
    controller.abort()

    // SDK initialization requires a key even for a pre-aborted request.
    // Use a dummy only for this test; no API call should be made.
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    try {
      await expect(
        requestGroqGradingJson('Test prompt', { signal: controller.signal })
      ).rejects.toThrow(/hủy|aborted|AbortError/i)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('F.2 Request chưa tới lượt trong hàng đợi rate limiter bị loại khỏi hàng đợi, không chiếm chỗ', async () => {
    const { scheduleGeminiCall, resetRateLimiterState } = require('../lib/geminiRateLimiter')
    resetRateLimiterState()

    let req1Finished = false
    let req2Ran = false
    let req3Ran = false

    // Request 1: Giả lập chạy chậm 120ms
    const p1 = scheduleGeminiCall(async () => {
      await new Promise(r => setTimeout(r, 120))
      req1Finished = true
      return 'REQ1_OK'
    })

    // Request 2: Được xếp hàng sau Request 1, nhưng bị hủy sớm sau 20ms
    const controller2 = new AbortController()
    const p2 = scheduleGeminiCall(async () => {
      req2Ran = true
      return 'REQ2_OK'
    }, { signal: controller2.signal })

    // Request 3: Xếp sau Request 2
    const p3 = scheduleGeminiCall(async () => {
      req3Ran = true
      return 'REQ3_OK'
    })

    // Hủy Request 2 sau 20ms (khi Req 1 vẫn đang chạy)
    await new Promise(r => setTimeout(r, 20))
    controller2.abort()

    // Request 2 phải reject NGAY LẬP TỨC với AbortError mà KHÔNG chờ Req 1 chạy hết
    await expect(p2).rejects.toThrow(/hủy|AbortError/i)
    expect(req1Finished).toBe(false) // Req 1 vẫn chưa xong

    // Chờ tất cả xong
    const [res1, res3] = await Promise.all([p1, p3])
    expect(res1).toBe('REQ1_OK')
    expect(res3).toBe('REQ3_OK')
    expect(req2Ran).toBe(false) // Request 2 bị loại khỏi hàng đợi, hoàn toàn không được thực thi
    resetRateLimiterState()
  })
})
