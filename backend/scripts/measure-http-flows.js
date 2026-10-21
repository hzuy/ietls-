'use strict'

/**
 * Script đo thời gian gọi route THẬT qua HTTP cho Luồng X, Y, Z trên Practice và Exam
 * Phục vụ Mục A: Đo thời gian (chưa sửa)
 * Chạy qua with-dev-db:
 *   node scripts/with-dev-db.js -- node backend/scripts/measure-http-flows.js
 */

const http = require('http')
const jwt = require('jsonwebtoken')
const app = require('../server')
const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')
const {
  addGeminiTelemetryListener,
  removeGeminiTelemetryListener,
  resetRateLimiterState,
} = require('../lib/geminiRateLimiter')

// ─── CHỐT AN TOÀN BẮT BUỘC: CHỈ CHẠY TRÊN DEV DB (127.0.0.1:5433) ─────────────
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('\n❌ LỖI AN TOÀN BẮT BUỘC: DATABASE_URL phải trỏ vào 127.0.0.1:5433')
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const EKMAN_PASSAGE = `Paul Ekman became interested in lying after a question from his students. Clinical observations showed that patients frequently concealed symptoms, but it was his students who asked whether deceptive facial expressions could be systematically detected.`

function p95(arr) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil(0.95 * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function mean(arr) {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

async function main() {
  printDbBanner('measure-http-flows.js')
  console.log('\n=== MỤC A: BẮT ĐẦU ĐO THỜI GIAN ROUTE HTTP THẬT (LUỒNG X, Y, Z) ===\n')

  let testUser = null
  let testExam = null
  let testQuestion = null
  let testPracticeExam = null
  let testPracticeQuestion = null
  let server = null
  let baseUrl = ''

  // Mảng lưu log telemetry của Gemini trong từng lượt gọi
  let activeTelemetry = []
  const telemetryHandler = (event) => {
    activeTelemetry.push(event)
  }
  addGeminiTelemetryListener(telemetryHandler)

  try {
    // 1. Tạo User Admin test
    testUser = await prisma.user.upsert({
      where: { email: 'test_admin_measure@example.com' },
      update: { role: 'teacher', isLocked: false, deletedAt: null },
      create: {
        email: 'test_admin_measure@example.com',
        name: '[TEST] Admin Measure',
        password: 'hashed_password_123',
        role: 'teacher',
      },
    })

    const token = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: 'teacher' },
      process.env.JWT_SECRET || 'test-jwt-secret-key-12345',
      { expiresIn: '1h' }
    )

    // 2. Tạo Exam test (Reading)
    testExam = await prisma.exam.create({
      data: {
        title: '[TEST] Exam HTTP Flow Measurement',
        skill: 'reading',
        passages: {
          create: [
            {
              number: 1,
              title: 'Passage 1',
              body: EKMAN_PASSAGE,
              questions: {
                create: [
                  {
                    number: 1,
                    type: 'mcq',
                    questionText: 'According to the writer, Ekman became interested in lying after a question from his:',
                    options: JSON.stringify(['A. peers', 'B. patients', 'C. students', 'D. teachers']),
                    correctAnswer: 'students',
                    explanation: null,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        passages: {
          include: {
            questions: true,
          },
        },
      },
    })
    testQuestion = testExam.passages[0].questions[0]

    // 3. Tạo PracticeExam test (Reading)
    testPracticeExam = await prisma.practiceExam.create({
      data: {
        title: '[TEST] Practice HTTP Flow Measurement',
        skill: 'reading',
        passage: EKMAN_PASSAGE,
        questions: {
          create: [
            {
              orderNum: 1,
              type: 'mcq',
              content: JSON.stringify({
                type: 'mcq',
                questions: [
                  {
                    number: 1,
                    question: 'According to the writer, Ekman became interested in lying after a question from his:',
                    options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
                    correctAnswer: 'students',
                  },
                ],
              }),
            },
          ],
        },
      },
      include: {
        questions: true,
      },
    })
    testPracticeQuestion = testPracticeExam.questions[0]

    console.log(`[SETUP] Đã tạo Test Exam #${testExam.id} (Question #${testQuestion.id}) và Practice #${testPracticeExam.id}`)

    // 4. Khởi động HTTP server trên port động
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`
    console.log(`[SETUP] HTTP Server đang lắng nghe tại: ${baseUrl}\n`)

    // Helper gọi HTTP route
    async function makeRegenerateRequest(targetType, payload) {
      activeTelemetry = []
      const url = targetType === 'practice'
        ? `${baseUrl}/api/practice/admin/reading/${testPracticeExam.id}/questions/1/regenerate-explanation`
        : `${baseUrl}/api/admin/exams/${testExam.id}/questions/${testQuestion.id}/regenerate-explanation`

      const startTime = Date.now()
      let status = 0
      let data = null
      let error = null

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        status = res.status
        data = await res.json()
      } catch (err) {
        error = err.message
      }

      const totalMs = Date.now() - startTime

      // Phân tích telemetry Gemini
      const geminiCalls = activeTelemetry.filter((t) => t.type === 'call')
      const cooldowns = activeTelemetry.filter((t) => t.type === 'cooldown')

      const totalQueueWaitMs = geminiCalls.reduce((sum, c) => sum + (c.queueWaitMs || 0), 0)
      const totalApiMs = geminiCalls.reduce((sum, c) => sum + (c.apiMs || 0), 0)
      const totalBackoffMs = cooldowns.reduce((sum, c) => sum + (c.waitMs || 0), 0)
      const callCount = geminiCalls.length

      return {
        targetType,
        status,
        ok: status === 200,
        totalMs,
        callCount,
        totalQueueWaitMs,
        totalApiMs,
        totalBackoffMs,
        geminiCalls: geminiCalls.map((c) => ({ queueWaitMs: c.queueWaitMs, apiMs: c.apiMs, ok: c.ok })),
        error: error || (status !== 200 ? data?.message || data?.error : null),
        resultStatus: data?.status || (data?.requiresConfirmation ? 'requires_confirmation' : (data?.conflict ? 'conflict' : 'unknown')),
      }
    }

    // ─── ĐỢT 1: HÀNG ĐỢI RẢNH (IDLE QUEUE) ──────────────────────────────────
    console.log('───────────────────────────────────────────────────────────────────────────')
    console.log(' ĐỢT 1: ĐO THỜI GIAN KHI HÀNG ĐỢI RẢNH (IDLE QUEUE) — 10 LẦN MỖI LUỒNG')
    console.log('───────────────────────────────────────────────────────────────────────────\n')

    const runs = []

    // 1.1 LUỒNG X: Góp ý bằng chữ -> AI giải mù -> Khớp thì sinh giải thích giàu
    console.log('>>> [1/3] BẮT ĐẦU ĐO LUỒNG X (10 LẦN: 5 Practice + 5 Exam)...')
    for (let i = 1; i <= 10; i++) {
      const targetType = i <= 5 ? 'practice' : 'exam'
      // Đặt lại correctAnswer là 'students'
      if (targetType === 'exam') {
        await prisma.question.update({ where: { id: testQuestion.id }, data: { correctAnswer: 'students' } })
      } else {
        await prisma.practiceQuestion.update({
          where: { id: testPracticeQuestion.id },
          data: {
            content: JSON.stringify({
              type: 'mcq',
              questions: [{ number: 1, question: 'Question 1', options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'], correctAnswer: 'students' }],
            }),
          },
        })
      }

      const res = await makeRegenerateRequest(targetType, {
        teacherFeedback: `Lần ${i}: Vui lòng phân tích thêm các vi biểu cảm của Ekman`,
      })
      runs.push({ flow: 'X', index: i, ...res })
      console.log(`   [X-#${i.toString().padStart(2)}] ${targetType.toUpperCase()}: status=${res.status} | total=${(res.totalMs / 1000).toFixed(2)}s | calls=${res.callCount} (queue=${res.totalQueueWaitMs}ms, api=${res.totalApiMs}ms, backoff=${res.totalBackoffMs}ms) | result=${res.resultStatus}`)
      await sleep(1500) // nghỉ nhẹ giữa các lượt
    }

    // 1.2 LUỒNG Y: Admin đề xuất đáp án đúng -> AI giải mù khớp -> Hỏi xác nhận
    console.log('\n>>> [2/3] BẮT ĐẦU ĐO LUỒNG Y (10 LẦN: 5 Practice + 5 Exam)...')
    for (let i = 1; i <= 10; i++) {
      const targetType = i <= 5 ? 'practice' : 'exam'
      // Để storedAnswer là 'peers' (sai), proposedAnswer là 'students' (đúng)
      if (targetType === 'exam') {
        await prisma.question.update({ where: { id: testQuestion.id }, data: { correctAnswer: 'peers' } })
      } else {
        await prisma.practiceQuestion.update({
          where: { id: testPracticeQuestion.id },
          data: {
            content: JSON.stringify({
              type: 'mcq',
              questions: [{ number: 1, question: 'Question 1', options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'], correctAnswer: 'peers' }],
            }),
          },
        })
      }

      const res = await makeRegenerateRequest(targetType, {
        proposedAnswer: 'students',
        confirmChangeAnswer: false,
      })
      runs.push({ flow: 'Y', index: i, ...res })
      console.log(`   [Y-#${i.toString().padStart(2)}] ${targetType.toUpperCase()}: status=${res.status} | total=${(res.totalMs / 1000).toFixed(2)}s | calls=${res.callCount} (queue=${res.totalQueueWaitMs}ms, api=${res.totalApiMs}ms, backoff=${res.totalBackoffMs}ms) | result=${res.resultStatus}`)
      await sleep(1500)
    }

    // 1.3 LUỒNG Z: Admin đề xuất đáp án sai -> AI giải mù ra đáp án đúng khác -> Bác bỏ
    console.log('\n>>> [3/3] BẮT ĐẦU ĐO LUỒNG Z (10 LẦN: 5 Practice + 5 Exam)...')
    for (let i = 1; i <= 10; i++) {
      const targetType = i <= 5 ? 'practice' : 'exam'
      // storedAnswer là 'students', proposedAnswer là 'peers' (sai)
      if (targetType === 'exam') {
        await prisma.question.update({ where: { id: testQuestion.id }, data: { correctAnswer: 'students' } })
      } else {
        await prisma.practiceQuestion.update({
          where: { id: testPracticeQuestion.id },
          data: {
            content: JSON.stringify({
              type: 'mcq',
              questions: [{ number: 1, question: 'Question 1', options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'], correctAnswer: 'students' }],
            }),
          },
        })
      }

      const res = await makeRegenerateRequest(targetType, {
        proposedAnswer: 'peers',
        confirmChangeAnswer: false,
      })
      runs.push({ flow: 'Z', index: i, ...res })
      console.log(`   [Z-#${i.toString().padStart(2)}] ${targetType.toUpperCase()}: status=${res.status} | total=${(res.totalMs / 1000).toFixed(2)}s | calls=${res.callCount} (queue=${res.totalQueueWaitMs}ms, api=${res.totalApiMs}ms, backoff=${res.totalBackoffMs}ms) | result=${res.resultStatus}`)
      await sleep(1500)
    }

    // ─── ĐỢT 2: HÀNG ĐỢI BẬN (BUSY QUEUE) ───────────────────────────────────
    console.log('\n───────────────────────────────────────────────────────────────────────────')
    console.log(' ĐỢT 2: ĐO THỜI GIAN KHI HÀNG ĐỢI BẬN (BUSY QUEUE) — 3 LUỒNG')
    console.log('───────────────────────────────────────────────────────────────────────────\n')

    const busyRuns = []
    const { scheduleGeminiCall } = require('../lib/geminiRateLimiter')

    for (const flowType of ['X', 'Y', 'Z']) {
      // Giả lập hàng đợi bận: lên lịch 2 tác vụ giả trước
      scheduleGeminiCall(async () => { await sleep(4000); return {} })
      scheduleGeminiCall(async () => { await sleep(4000); return {} })

      let payload = {}
      if (flowType === 'X') {
        payload = { teacherFeedback: 'Phân tích thêm về biểu cảm khi hàng đợi đang bận' }
      } else if (flowType === 'Y') {
        payload = { proposedAnswer: 'students', confirmChangeAnswer: false }
      } else {
        payload = { proposedAnswer: 'peers', confirmChangeAnswer: false }
      }

      const res = await makeRegenerateRequest('exam', payload)
      busyRuns.push({ flow: flowType, condition: 'busy', ...res })
      console.log(`   [BUSY-${flowType}] EXAM: status=${res.status} | total=${(res.totalMs / 1000).toFixed(2)}s | queueWait=${res.totalQueueWaitMs}ms | api=${res.totalApiMs}ms | result=${res.resultStatus}`)
      await sleep(2000)
    }

    // ─── TỔNG HỢP VÀ TÍNH TOÁN CHỈ SỐ ──────────────────────────────────────
    console.log('\n===========================================================================')
    console.log(' BẢNG THỐNG KÊ CHI TIẾT TỪNG LẦN GỌI (MỤC A)')
    console.log('===========================================================================')

    console.log('| Luồng | Lần | Loại | Status | Tổng thời gian (s) | QueueWait (ms) | ApiMs (ms) | Backoff (ms) | Số lần Gemini | Kết quả |')
    console.log('|---|---|---|---|---|---|---|---|---|---|')
    for (const r of runs) {
      console.log(`| Luồng ${r.flow} | #${r.index} | ${r.targetType} | ${r.status} | ${(r.totalMs / 1000).toFixed(2)}s | ${r.totalQueueWaitMs}ms | ${r.totalApiMs}ms | ${r.totalBackoffMs}ms | ${r.callCount} | ${r.resultStatus} |`)
    }

    console.log('\n===========================================================================')
    console.log(' BẢNG TỔNG HỢP THEO LUỒNG (HÀNG ĐỢI RẢNH)')
    console.log('===========================================================================')
    console.log('| Luồng | Số lần | Trung bình (s) | p95 (s) | Max (s) | Mean QueueWait (ms) | Mean ApiMs (ms) | Tỷ lệ thành công |')
    console.log('|---|---|---|---|---|---|---|---|')

    for (const fl of ['X', 'Y', 'Z']) {
      const flRuns = runs.filter((r) => r.flow === fl)
      const times = flRuns.map((r) => r.totalMs / 1000)
      const queues = flRuns.map((r) => r.totalQueueWaitMs)
      const apis = flRuns.map((r) => r.totalApiMs)
      const successCount = flRuns.filter((r) => r.ok).length

      console.log(`| Luồng ${fl} | ${flRuns.length} | ${mean(times).toFixed(2)}s | ${p95(times).toFixed(2)}s | ${Math.max(...times).toFixed(2)}s | ${mean(queues).toFixed(0)}ms | ${mean(apis).toFixed(0)}ms | ${((successCount / flRuns.length) * 100).toFixed(0)}% |`)
    }

    console.log('\n===========================================================================')
    console.log(' KẾT QUẢ KHI HÀNG ĐỢI BẬN')
    console.log('===========================================================================')
    for (const b of busyRuns) {
      console.log(`- Luồng ${b.flow} (Bận): Tổng = ${(b.totalMs / 1000).toFixed(2)}s (QueueWait = ${b.totalQueueWaitMs}ms, ApiMs = ${b.totalApiMs}ms, Status = ${b.status})`)
    }

  } catch (err) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH ĐO THỜI GIAN:', err)
  } finally {
    // DỌN DẸP SẠCH SẼ DỮ LIỆU [TEST]
    console.log('\n[CLEANUP] Đang dọn sạch dữ liệu test tiền tố [TEST]...')
    try {
      if (testExam) {
        await prisma.question.deleteMany({ where: { passage: { examId: testExam.id } } })
        await prisma.passage.deleteMany({ where: { examId: testExam.id } })
        await prisma.exam.delete({ where: { id: testExam.id } })
      }
      if (testPracticeExam) {
        await prisma.practiceQuestion.deleteMany({ where: { examId: testPracticeExam.id } })
        await prisma.practiceExam.delete({ where: { id: testPracticeExam.id } })
      }
      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } })
      }
      console.log('[CLEANUP] Dọn dẹp thành công 100% dữ liệu [TEST].')
    } catch (cleanupErr) {
      console.warn('[CLEANUP] Cảnh báo dọn dẹp:', cleanupErr.message)
    }

    if (server) {
      server.close()
    }
    removeGeminiTelemetryListener(telemetryHandler)
    await prisma.$disconnect()
    console.log('\n=== HOÀN TẤT ĐO THỜI GIAN MỤC A ===\n')
  }
}

main()
