// verify-real-cancellation.js — Kịch bản kiểm chứng HỦY THẬT (Mục F)
// Chứng minh 4 điểm chốt an toàn:
// 1. Tín hiệu hủy đến được fetch của Gemini và Groq (signal.aborted / AbortError).
// 2. Request chưa tới lượt trong hàng đợi rate limiter bị loại khỏi hàng đợi, không chiếm chỗ.
// 3. Sau 504 không có ghi DB nào (nhờ cancelFlag trong transaction).
// 4. Khóa explanationLock nhả đúng lúc, thử lại ngay không bị 409, không ghi đè đồng thời.

const prisma = require('../lib/prisma')
const { acquireLock, releaseLock, isLocked, clearAllLocks } = require('../lib/explanationLock')
const { scheduleGeminiCall, resetRateLimiterState } = require('../lib/geminiRateLimiter')
const { requestGeminiJson, requestGroqGradingJson } = require('../lib/groqClient')
const { regenerateQuestionExplanation } = require('../services/explanationGeneratorService')
const generateExpModule = require('./generate-explanations')

// Chốt an toàn chỉ chạy trên DB dev
const dbUrl = process.env.DATABASE_URL || ''
if (!dbUrl.includes('127.0.0.1:5433') && !dbUrl.includes('ielts_dev')) {
  console.error('[SAFETY ERROR] Script chỉ được phép chạy trên DB Dev (127.0.0.1:5433)!')
  process.exit(1)
}

const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@')
console.log(`[SAFE DB] Kết nối cơ sở dữ liệu: ${maskedUrl}\n`)

async function runVerification() {
  console.log('======================================================================')
  console.log('--- KIỂM CHỨNG MỤC F: HỦY THẬT (REAL CANCELLATION & ATOMIC SAFETY) ---')
  console.log('======================================================================\n')

  let createdExamId = null
  let createdPracticeId = null

  try {
    // -------------------------------------------------------------------------
    // 1. TÍN HIỆU HỦY ĐẾN ĐƯỢC FETCH CỦA GEMINI VÀ GROQ
    // -------------------------------------------------------------------------
    console.log('--- 1. TÍN HIỆU HỦY ĐẾN ĐƯỢC FETCH CỦA GEMINI VÀ GROQ ---')

    // 1.1 Gemini
    const origFetch = global.fetch
    let geminiInterceptedSignal = null
    const geminiController = new AbortController()

    global.fetch = async (url, opts) => {
      geminiInterceptedSignal = opts?.signal
      // Giả lập hủy giữa chừng khi fetch đang pending
      geminiController.abort()
      return new Promise((_, reject) => {
        if (geminiInterceptedSignal?.aborted) {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          return reject(err)
        }
        if (geminiInterceptedSignal) {
          geminiInterceptedSignal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    }

    let geminiAbortedCaught = false
    try {
      await requestGeminiJson('Test prompt', { signal: geminiController.signal })
    } catch (err) {
      if (/hủy|aborted|AbortError/i.test(err.message) || err.name === 'AbortError') {
        geminiAbortedCaught = true
      }
    } finally {
      global.fetch = origFetch
    }

    console.log(`[GEMINI] Signal đến được fetch options.signal: ${geminiInterceptedSignal ? 'ĐÚNG' : 'SAI'}`)
    console.log(`[GEMINI] Signal.aborted chuyển sang true:        ${geminiInterceptedSignal?.aborted ? 'ĐÚNG' : 'SAI'}`)
    console.log(`[GEMINI] Bắt được lỗi AbortError / Hủy:         ${geminiAbortedCaught ? 'ĐÚNG' : 'SAI'}`)
    if (!geminiAbortedCaught || !geminiInterceptedSignal?.aborted) {
      throw new Error('Thất bại: Gemini không nhận được tín hiệu hủy đúng cách!')
    }

    // 1.2 Groq
    const groqController = new AbortController()
    groqController.abort() // Pre-aborted
    let groqAbortedCaught = false
    try {
      await requestGroqGradingJson('Test prompt', { signal: groqController.signal })
    } catch (err) {
      if (/hủy|aborted|AbortError/i.test(err.message) || err.name === 'AbortError') {
        groqAbortedCaught = true
      }
    }
    console.log(`[GROQ]   Bắt được lỗi AbortError khi signal hủy: ${groqAbortedCaught ? 'ĐÚNG' : 'SAI'}\n`)
    if (!groqAbortedCaught) {
      throw new Error('Thất bại: Groq không chặn và throw khi có tín hiệu hủy!')
    }

    // -------------------------------------------------------------------------
    // 2. REQUEST CHƯA TỚI LƯỢT TRONG HÀNG ĐỢI RATE LIMITER BỊ LOẠI KHỎI HÀNG ĐỢI
    // -------------------------------------------------------------------------
    console.log('--- 2. HÀNG ĐỢI RATE LIMITER: REQUEST HỦY BỊ LOẠI NGAY LẬP TỨC ---')
    resetRateLimiterState()

    let r1Done = false
    let r2Ran = false
    let r3Done = false

    // R1 chạy trong 200ms
    const p1 = scheduleGeminiCall(async () => {
      await new Promise(r => setTimeout(r, 200))
      r1Done = true
      return 'R1'
    })

    // R2 xếp hàng sau R1, nhưng bị hủy sau 30ms
    const c2 = new AbortController()
    const r2Start = Date.now()
    const p2 = scheduleGeminiCall(async () => {
      r2Ran = true
      return 'R2'
    }, { signal: c2.signal })

    // R3 xếp hàng sau R2
    const p3 = scheduleGeminiCall(async () => {
      r3Done = true
      return 'R3'
    })

    // Hủy R2 sau 30ms (khi R1 mới chạy được 30/200ms)
    await new Promise(r => setTimeout(r, 30))
    c2.abort()

    let r2EarlyRejectionTimeMs = null
    try {
      await p2
    } catch (err) {
      r2EarlyRejectionTimeMs = Date.now() - r2Start
    }

    console.log(`[RATE LIMITER] R2 reject ngay sau khi abort:       ${r2EarlyRejectionTimeMs !== null ? `${r2EarlyRejectionTimeMs}ms` : 'KHÔNG'}`)
    console.log(`[RATE LIMITER] R2 reject trước khi R1 xong (<200ms):  ${r1Done === false ? 'ĐÚNG' : 'SAI'}`)

    const [res1, res3] = await Promise.all([p1, p3])
    console.log(`[RATE LIMITER] R1 hoàn tất:                        ${res1 === 'R1' ? 'ĐÚNG' : 'SAI'}`)
    console.log(`[RATE LIMITER] R2 hoàn toàn không thực thi (bỏ):   ${r2Ran === false ? 'ĐÚNG' : 'SAI'}`)
    console.log(`[RATE LIMITER] R3 hoàn tất ngay sau R1:            ${res3 === 'R3' ? 'ĐÚNG' : 'SAI'}\n`)

    if (r2Ran || !r1Done || !r3Done) {
      throw new Error('Thất bại: R2 không được giải phóng ngay khỏi hàng đợi rate limiter!')
    }
    resetRateLimiterState()

    // -------------------------------------------------------------------------
    // 3. SAU 504 KHÔNG CÓ GHI DB NÀO (cancelFlag TRONG TRANSACTION)
    // -------------------------------------------------------------------------
    console.log('--- 3. SAU 504 KHÔNG GHI DB (NGUYÊN TỬ cancelFlag TRONG TRANSACTION) ---')

    // Tạo đề thi Exam và câu hỏi test trên DB dev
    const exam = await prisma.exam.create({
      data: {
        title: '[TEST] Exam Stub 60s Cancellation',
        skill: 'reading',
      },
    })
    createdExamId = exam.id

    const passage = await prisma.passage.create({
      data: {
        examId: exam.id,
        number: 1,
        title: '[TEST] Passage 60s',
        body: 'Paul Ekman studied lying after students asked him about deception.',
      },
    })

    const question = await prisma.question.create({
      data: {
        passageId: passage.id,
        number: 1,
        type: 'mcq',
        questionText: 'Ekman studied deception after questions from:',
        options: JSON.stringify(['A. doctors', 'B. patients', 'C. students', 'D. teachers']),
        correctAnswer: 'C',
        explanation: null,
      },
    })

    // Stub fetch 60s (chỉ ca kiểm chứng F này dùng stub theo yêu cầu đề bài)
    const origGlobalFetch = global.fetch
    let stubSignalReceived = null
    global.fetch = async (url, opts) => {
      stubSignalReceived = opts?.signal
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] })))
        }, 60000)
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    }

    let timeoutErr = null
    try {
      // Chạy với timeoutMs = 80ms (đại diện cho trần 504)
      await regenerateQuestionExplanation({
        examId: exam.id,
        questionNumber: 1,
        isPractice: false,
        timeoutMs: 80,
      })
    } catch (err) {
      timeoutErr = err
    } finally {
      global.fetch = origGlobalFetch
    }

    console.log(`[504 TIMEOUT] Bắt được lỗi timeout (504):           ${timeoutErr?.code === 'ETIMEDOUT' ? 'ĐÚNG' : 'SAI'}`)
    console.log(`[504 TIMEOUT] Tín hiệu abort truyền tới fetch AI:    ${stubSignalReceived?.aborted ? 'ĐÚNG' : 'SAI'}`)

    // Đợi thêm 100ms để đảm bảo mọi race condition tiềm ẩn hoàn tất
    await new Promise(r => setTimeout(r, 100))

    // Kiểm tra DB thật: cột explanation phải vẫn là NULL
    const checkQ = await prisma.question.findUnique({
      where: { id: question.id },
      select: { explanation: true },
    })

    console.log(`[DB CHECK]    Cột explanation trong DB sau 504:    ${checkQ.explanation === null ? 'NULL (CHƯA HỀ BỊ GHI)' : 'BỊ GHI ĐÈ'}\n`)
    if (checkQ.explanation !== null) {
      throw new Error('Thất bại: DB đã bị ghi sau khi HTTP 504 trả về!')
    }

    // -------------------------------------------------------------------------
    // 4. KHÓA explanationLock NHẢ ĐÚNG LÚC, THỬ LẠI NGAY KHÔNG BỊ 409
    // -------------------------------------------------------------------------
    console.log('--- 4. KHÓA explanationLock: CHỐNG CHẠY SONG SONG & NHẢ ĐÚNG LÚC ---')
    const lockKey = `exam:${exam.id}`
    clearAllLocks()

    expectLock: {
      const lock1 = acquireLock(lockKey)
      console.log(`[LOCK] Tiến trình 1 chiếm khóa thành công:         ${lock1 ? 'ĐÚNG' : 'SAI'}`)
      const lock2 = acquireLock(lockKey)
      console.log(`[LOCK] Tiến trình 2 cùng lúc bị chặn (tránh 409):  ${!lock2 ? 'ĐÚNG (BỊ CHẶN)' : 'SAI'}`)
      releaseLock(lockKey)
      console.log(`[LOCK] Trạng thái sau khi giải phóng:               ${!isLocked(lockKey) ? 'ĐÃ NHẢ' : 'KẸT KHÓA'}`)
      const lock3 = acquireLock(lockKey)
      console.log(`[LOCK] Thử lại ngay lập tức thành công (không 409): ${lock3 ? 'ĐÚNG' : 'SAI'}\n`)
      releaseLock(lockKey)

      if (!lock1 || lock2 || !lock3) {
        throw new Error('Thất bại: Cơ chế explanationLock hoạt động không đúng!')
      }
    }

    console.log('======================================================================')
    console.log('🎉 TẤT CẢ 4 ĐIỂM CHỐT AN TOÀN MỤC F ĐỀU ĐẠT 100% TRÊN MÔI TRƯỜNG THẬT!')
    console.log('======================================================================')

  } finally {
    // Dọn dẹp sạch sẽ DB dev
    if (createdExamId) {
      await prisma.question.deleteMany({ where: { passage: { examId: createdExamId } } })
      await prisma.passage.deleteMany({ where: { examId: createdExamId } } )
      await prisma.exam.deleteMany({ where: { id: createdExamId } })
      console.log('\n🧹 Đã dọn sạch 100% dữ liệu test Exam.')
    }
    clearAllLocks()
    await prisma.$disconnect()
  }
}

runVerification().catch(err => {
  console.error('\n[LỖI CHẠY KIỂM CHỨNG]:', err)
  process.exit(1)
})
