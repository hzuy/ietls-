/**
 * Script đo thời gian thực tế theo ngân sách 40 giây cho Exam và Practice trên dev DB.
 * Chạy qua with-dev-db:
 *   node scripts/with-dev-db.js -- node backend/scripts/measure-time-budget.js
 */

'use strict'

const prisma = require('../lib/prisma')
const { generateForPracticeExam, generateForExam } = require('../services/explanationGeneratorService')
const genExp = require('./generate-explanations')

// Kiểm tra tuyệt đối không chạy trên DB production
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('LỖI AN TOÀN: Script này CHỈ được chạy trên DB dev (127.0.0.1:5433). Dừng ngay lập tức!')
  process.exit(1)
}

const SAMPLE_PASSAGE = `
The History of Glassmaking

The discovery of glassmaking dates back at least to 2500 BC in Mesopotamia and Egypt. Early glass was not transparent, but rather an opaque, coloured substance used for beads, amulets, and small vessels. The raw materials used were silica (usually quartz sand), alkali (plant ash or mineral natron), and lime (calcium oxide), which was often introduced unintentionally as an impurity in the sand or shell fragments.

During the Roman Empire, glassmaking underwent a revolutionary transformation with the invention of glassblowing around the 1st century BC on the Syro-Palestinian coast. This breakthrough allowed craftsmen to produce hollow glass vessels quickly, thinly, and in a wide range of shapes. For the first time, glass became a commonplace household material rather than a luxury reserved solely for the elite.

In the centuries that followed, the techniques spread throughout the Mediterranean and Europe. By the Middle Ages, the Venetian island of Murano had emerged as the preeminent centre of European glass production, celebrated for its exquisite crystalline glass, mirrors, and chandeliers.
`

async function main() {
  console.log('=== BẮT ĐẦU ĐO THỰC TẾ: NGÂN SÁCH THỜI GIAN 40 GIÂY (PHẦN 2) ===\n')

  const measurementResults = []

  let createdPracticeId = null
  let createdExamId = null

  try {
    // ── 1. ĐO BÀI PRACTICE 14 CÂU ──────────────────────────────────────────────
    console.log('[1/3] Tạo dữ liệu test: Bài Practice 14 câu (Reading)...')
    const practiceQuestions = []
    for (let i = 1; i <= 14; i++) {
      practiceQuestions.push({
        number: i,
        question: `Question ${i}: According to the passage, which statement accurately reflects glassmaking fact #${i}?`,
        options: ['A. In Mesopotamia', 'B. In Murano', 'C. In Rome', 'D. In Egypt'],
        correctAnswer: i % 2 === 0 ? 'A' : 'B',
      })
    }

    const practiceExam = await prisma.practiceExam.create({
      data: {
        title: '[TEST] Practice 14 Questions Benchmark',
        skill: 'reading',
        passage: SAMPLE_PASSAGE,
        questions: {
          create: [
            {
              orderNum: 1,
              type: 'mcq',
              content: JSON.stringify({
                type: 'mcq',
                instruction: 'Choose the correct letter A, B, C or D.',
                questions: practiceQuestions,
              }),
            },
          ],
        },
      },
    })
    createdPracticeId = practiceExam.id
    console.log(`Đã tạo Practice #${createdPracticeId} với 14 câu hỏi.`)

    console.log('Bắt đầu chuỗi request đo thời gian cho Practice 14 câu...')
    let remainingPracticeQ = null
    let practiceReqNum = 1
    let practiceTotalElapsed = 0

    while (true) {
      const reqStart = Date.now()
      console.log(`  -> Request #${practiceReqNum} gửi với questionNumbers: ${JSON.stringify(remainingPracticeQ || 'ALL')}...`)

      const res = await generateForPracticeExam(createdPracticeId, {
        force: true,
        questionNumbers: remainingPracticeQ,
        timeBudgetMs: 40000,
      })

      const reqDuration = (Date.now() - reqStart) / 1000
      practiceTotalElapsed += reqDuration
      console.log(`     Xong Request #${practiceReqNum}: ${reqDuration.toFixed(2)}s | Đã sinh: ${res.generatedCount} câu | Còn lại: ${res.remainingQuestionNumbers?.length || 0} câu`)
      if (res.errors && res.errors.length > 0) {
        console.warn(`     [LỖI CÂU]: ${JSON.stringify(res.errors)}`)
      }

      measurementResults.push({
        type: 'Practice (14 câu)',
        request: `Request #${practiceReqNum}`,
        durationSec: reqDuration.toFixed(2),
        generatedCount: res.generatedCount,
        remainingCount: res.remainingQuestionNumbers?.length || 0,
        under50s: reqDuration < 50,
      })

      if (!res.remainingQuestionNumbers || res.remainingQuestionNumbers.length === 0) {
        break
      }
      remainingPracticeQ = res.remainingQuestionNumbers
      practiceReqNum++
    }

    console.log(`Tổng thời gian Practice 14 câu: ${practiceTotalElapsed.toFixed(2)}s (${practiceReqNum} requests)\n`)

    // ── 2. ĐO NHÓM EXAM 13 CÂU ────────────────────────────────────────────────
    console.log('[2/3] Tạo dữ liệu test: Nhóm Exam 13 câu (Reading)...')
    const exam = await prisma.exam.create({
      data: {
        title: '[TEST] Exam 13 Questions Benchmark',
        skill: 'reading',
      },
    })
    createdExamId = exam.id

    const passage = await prisma.passage.create({
      data: {
        examId: exam.id,
        number: 1,
        title: 'Passage 1',
        body: SAMPLE_PASSAGE,
      },
    })

    const group = await prisma.questionGroup.create({
      data: {
        passageId: passage.id,
        type: 'mcq',
        qNumberStart: 1,
        qNumberEnd: 13,
        instruction: 'Choose the correct letter A, B, C or D.',
      },
    })

    const examQuestionsData = []
    for (let i = 1; i <= 13; i++) {
      examQuestionsData.push({
        groupId: group.id,
        number: i,
        type: 'mcq',
        questionText: `Question ${i}: The historical event described in paragraph indicates statement #${i}:`,
        options: JSON.stringify(['A. First point', 'B. Second point', 'C. Third point', 'D. Fourth point']),
        correctAnswer: 'A',
      })
    }
    await prisma.question.createMany({ data: examQuestionsData })
    console.log(`Đã tạo Exam #${createdExamId}, Group #${group.id} với 13 câu hỏi.`)

    console.log('Bắt đầu chuỗi request đo thời gian cho Exam Group 13 câu...')
    let remainingExamQ = null
    let examReqNum = 1
    let examTotalElapsed = 0

    while (true) {
      const reqStart = Date.now()
      console.log(`  -> Request #${examReqNum} gửi với questionNumbers: ${JSON.stringify(remainingExamQ || 'ALL')}...`)

      const res = await generateForExam(createdExamId, {
        force: true,
        groupId: group.id,
        questionNumbers: remainingExamQ,
        timeBudgetMs: 40000,
      })

      const reqDuration = (Date.now() - reqStart) / 1000
      examTotalElapsed += reqDuration
      console.log(`     Xong Request #${examReqNum}: ${reqDuration.toFixed(2)}s | Đã sinh: ${res.generatedCount} câu | Còn lại: ${res.remainingQuestionNumbers?.length || 0} câu`)

      measurementResults.push({
        type: 'Exam Group (13 câu)',
        request: `Request #${examReqNum}`,
        durationSec: reqDuration.toFixed(2),
        generatedCount: res.generatedCount,
        remainingCount: res.remainingQuestionNumbers?.length || 0,
        under50s: reqDuration < 50,
      })

      if (!res.remainingQuestionNumbers || res.remainingQuestionNumbers.length === 0) {
        break
      }
      remainingExamQ = res.remainingQuestionNumbers
      examReqNum++
    }

    console.log(`Tổng thời gian Exam Group 13 câu: ${examTotalElapsed.toFixed(2)}s (${examReqNum} requests)\n`)

    // ── 3. GIẢ LẬP 429 BACKOFF (CHỨNG MINH NGÂN SÁCH TÍNH CẢ BACKOFF) ─────────
    console.log('[3/3] Giả lập 429 backoff: Inject delay 5000ms vào giữa chu kỳ gọi AI...')
    const originalGenerateExplanation = genExp.generateExplanation
    let backoffInjected = false

    genExp.generateExplanation = async (...args) => {
      if (!backoffInjected) {
        console.log('       [SIMULATED 429] Giả lập nhận 429 Too Many Requests -> Sleep 5000ms backoff...')
        await new Promise((r) => setTimeout(r, 5000))
        backoffInjected = true
      }
      return originalGenerateExplanation(...args)
    }

    const simStart = Date.now()
    const simRes = await generateForExam(createdExamId, {
      force: true,
      groupId: group.id,
      timeBudgetMs: 40000,
    })
    const simDuration = (Date.now() - simStart) / 1000

    // Restore original function
    genExp.generateExplanation = originalGenerateExplanation

    console.log(`     Request có giả lập 429 kết thúc sau: ${simDuration.toFixed(2)}s (ngân sách 40s đã bao gồm 5s backoff)`)
    console.log(`     Đã sinh: ${simRes.generatedCount} câu | Còn lại: ${simRes.remainingQuestionNumbers?.length || 0} câu | < 50s: ${simDuration < 50}`)

    measurementResults.push({
      type: 'Exam Group (Simulate 429)',
      request: 'Request #1 (w/ 5s backoff)',
      durationSec: simDuration.toFixed(2),
      generatedCount: simRes.generatedCount,
      remainingCount: simRes.remainingQuestionNumbers?.length || 0,
      under50s: simDuration < 50,
    })

  } finally {
    // ── 4. DỌN SẠCH DỮ LIỆU TEST TRÊN DEV DB ──────────────────────────────────
    console.log('\n[CLEANUP] Bắt đầu dọn sạch toàn bộ dữ liệu test có tiền tố [TEST]...')
    if (createdPracticeId) {
      await prisma.practiceQuestion.deleteMany({ where: { examId: createdPracticeId } })
      await prisma.practiceExam.delete({ where: { id: createdPracticeId } })
      console.log(`  Đã xóa PracticeExam #${createdPracticeId}`)
    }
    if (createdExamId) {
      await prisma.question.deleteMany({ where: { group: { passage: { examId: createdExamId } } } })
      await prisma.questionGroup.deleteMany({ where: { passage: { examId: createdExamId } } })
      await prisma.passage.deleteMany({ where: { examId: createdExamId } })
      await prisma.exam.delete({ where: { id: createdExamId } })
      console.log(`  Đã xóa Exam #${createdExamId}`)
    }

    // Quét bổ sung để đảm bảo không còn bất kỳ bản ghi [TEST] nào
    const remainingExams = await prisma.exam.count({ where: { title: { startsWith: '[TEST]' } } })
    const remainingPractice = await prisma.practiceExam.count({ where: { title: { startsWith: '[TEST]' } } })
    console.log(`[CLEANUP] Kiểm tra lại DB dev: Còn lại ${remainingExams} Exam [TEST], ${remainingPractice} Practice [TEST] (bắt buộc = 0).`)
  }

  console.log('\n=== BẢNG KẾT QUẢ ĐO THỰC TẾ (MỖI REQUEST PHẢI < 50s) ===')
  console.table(measurementResults)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Lỗi khi chạy đo thời gian:', err)
    process.exit(1)
  })
