/**
 * Script đo thực tế 3 trường hợp xấu nhất theo yêu cầu Phần 3 (Mục 3.2):
 * (a) Lần gọi chậm 20s (19s call);
 * (b) Hai lần 429 liên tiếp kèm backoff rồi thành công;
 * (c) Lần gọi treo hoàn toàn (stub hung vĩnh viễn).
 *
 * Yêu cầu: Thời gian lớn nhất của một request cho từng ca phải < 55s (và < 50s).
 * Dữ liệu test có tiền tố [TEST] trên dev DB và được dọn sạch 100% sau khi đo.
 *
 * Chạy qua with-dev-db:
 *   node scripts/with-dev-db.js -- node scripts/measure-worst-case-timeout.js
 */

'use strict'

const prisma = require('../lib/prisma')

// Kiểm tra an toàn: script này CHỈ chạy trên DB dev
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('LỖI AN TOÀN: Script CHỈ được chạy trên DB dev (127.0.0.1:5433). Dừng ngay lập tức!')
  process.exit(1)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let activeStub = null
const genExpPath = require.resolve('./generate-explanations')
const originalGenExp = require(genExpPath)

require.cache[genExpPath] = {
  id: genExpPath,
  filename: genExpPath,
  loaded: true,
  exports: {
    ...originalGenExp,
    generateExplanation: (...args) => {
      if (activeStub) return activeStub(...args)
      return originalGenExp.generateExplanation(...args)
    },
  },
}

const { generateForExam } = require('../services/explanationGeneratorService')

async function cleanupTestData() {
  console.log('\n[CLEANUP] Bắt đầu dọn sạch toàn bộ dữ liệu test có tiền tố [TEST]...')
  const testExams = await prisma.exam.findMany({
    where: { title: { startsWith: '[TEST]' } },
    select: { id: true },
  })
  for (const e of testExams) {
    await prisma.question.deleteMany({ where: { group: { passage: { examId: e.id } } } })
    await prisma.questionGroup.deleteMany({ where: { passage: { examId: e.id } } })
    await prisma.passage.deleteMany({ where: { examId: e.id } })
    await prisma.exam.delete({ where: { id: e.id } })
  }

  const testPractice = await prisma.practiceExam.findMany({
    where: { title: { startsWith: '[TEST]' } },
    select: { id: true },
  })
  for (const pe of testPractice) {
    await prisma.practiceQuestion.deleteMany({ where: { examId: pe.id } })
    await prisma.practiceExam.delete({ where: { id: pe.id } })
  }

  const remExams = await prisma.exam.count({ where: { title: { startsWith: '[TEST]' } } })
  const remPractice = await prisma.practiceExam.count({ where: { title: { startsWith: '[TEST]' } } })
  console.log(`[CLEANUP] Hoàn tất: Còn lại ${remExams} Exam [TEST], ${remPractice} Practice [TEST] (bắt buộc = 0).`)
}

async function main() {
  console.log('================================================================================')
  console.log('ĐO THỰC TẾ 3 TRƯỜNG HỢP XẤU NHẤT (MỤC 3.2): GIỚI HẠN THỜI GIAN CỨNG < 55s')
  console.log('================================================================================')

  const results = []
  let createdExamId = null

  try {
    // Tạo 1 Exam test với 3 câu hỏi
    const exam = await prisma.exam.create({
      data: {
        title: '[TEST] Exam Worst Case Timeout Benchmark',
        skill: 'reading',
        passages: {
          create: [
            {
              number: 1,
              title: '[TEST] Passage 1',
              body: 'Early agriculture in ancient civilizations developed advanced irrigation methods.',
              questionGroups: {
                create: [
                  {
                    type: 'mcq',
                    instruction: 'Choose the correct answer',
                    questions: {
                      create: [
                        {
                          number: 1,
                          type: 'mcq',
                          questionText: 'Question 1 about agriculture',
                          options: JSON.stringify(['A. option 1', 'B. option 2', 'C. option 3', 'D. option 4']),
                          correctAnswer: 'A',
                        },
                        {
                          number: 2,
                          type: 'mcq',
                          questionText: 'Question 2 about irrigation',
                          options: JSON.stringify(['A. method 1', 'B. method 2', 'C. method 3', 'D. method 4']),
                          correctAnswer: 'B',
                        },
                        {
                          number: 3,
                          type: 'mcq',
                          questionText: 'Question 3 about civilizations',
                          options: JSON.stringify(['A. civ 1', 'B. civ 2', 'C. civ 3', 'D. civ 4']),
                          correctAnswer: 'C',
                        },
                      ],
                    },
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
            questionGroups: {
              include: { questions: true },
            },
          },
        },
      },
    })
    createdExamId = exam.id
    console.log(`Đã tạo Exam test #${createdExamId} với 3 câu hỏi.`)

    // ── CASE (A): LẦN GỌI CHẬM 19s (GẦN NGƯỠNG TRẦN CÂU) ───────────────────
    console.log('\n--- Đo Ca (a): Lần gọi AI chậm 19s (gần ngưỡng trần câu) ---')
    activeStub = async () => {
      console.log('   [STUB SLOW] Giả lập AI phản hồi chậm: sleep 19000ms...')
      await sleep(19000)
      return {
        answer: 'A',
        reasoning: 'Simulated slow response explanation',
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
      }
    }

    const startA = Date.now()
    const resA = await generateForExam(createdExamId, { force: true, timeBudgetMs: 40000 })
    const durA = (Date.now() - startA) / 1000
    console.log(`   Ca (a) kết thúc sau: ${durA.toFixed(2)}s | Đã sinh: ${resA.generatedCount} | Còn lại: ${resA.remainingQuestionNumbers?.length || 0}`)

    results.push({
      caseName: '(a) Lần gọi chậm 20s (19s call)',
      durationSec: `${durA.toFixed(2)}s`,
      maxLimit: '< 55s',
      passed: durA < 55 && durA < 50,
      generatedCount: resA.generatedCount,
      remainingCount: resA.remainingQuestionNumbers?.length || 0,
      note: 'Dừng an toàn trước khi vượt quá ngân sách request',
    })

    // ── CASE (B): HAI LẦN 429 LIÊN TIẾP RỒI THÀNH CÔNG ──────────────────────
    console.log('\n--- Đo Ca (b): Hai lần 429 liên tiếp kèm backoff rồi thành công ---')
    let attempts429 = 0
    activeStub = async () => {
      attempts429++
      if (attempts429 <= 2) {
        console.log(`   [STUB 429] Lần #${attempts429}: Giả lập 429 Too Many Requests -> sleep 3000ms backoff...`)
        await sleep(3000)
        const err = new Error('Gemini 429 Resource Exhausted')
        err.status = 429
        throw err
      }
      console.log('   [STUB 429 RESOLVED] Lần #3: AI thành công trả về kết quả!')
      return {
        answer: 'B',
        reasoning: 'Recovered after two 429 retries',
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
      }
    }

    const startB = Date.now()
    const resB = await generateForExam(createdExamId, { force: true, timeBudgetMs: 40000 })
    const durB = (Date.now() - startB) / 1000
    console.log(`   Ca (b) kết thúc sau: ${durB.toFixed(2)}s | Đã sinh: ${resB.generatedCount} | Còn lại: ${resB.remainingQuestionNumbers?.length || 0}`)

    results.push({
      caseName: '(b) Hai lần 429 liên tiếp rồi thành công',
      durationSec: `${durB.toFixed(2)}s`,
      maxLimit: '< 55s',
      passed: durB < 55 && durB < 50,
      generatedCount: resB.generatedCount,
      remainingCount: resB.remainingQuestionNumbers?.length || 0,
      note: 'Xử lý retry và backoff an toàn trong ngân sách',
    })

    // ── CASE (C): LẦN GỌI TREO HOÀN TOÀN (STUB HUNG) ────────────────────────
    console.log('\n--- Đo Ca (c): Lần gọi treo hoàn toàn (Promise không resolve) ---')
    activeStub = async () => {
      console.log('   [STUB HANG] Giả lập AI bị treo hoàn toàn không bao giờ phản hồi...')
      return new Promise(() => {}) // Treo vĩnh viễn
    }

    const startC = Date.now()
    const resC = await generateForExam(createdExamId, { force: true, timeBudgetMs: 40000 })
    const durC = (Date.now() - startC) / 1000
    console.log(`   Ca (c) kết thúc sau: ${durC.toFixed(2)}s | Đã sinh: ${resC.generatedCount} | Còn lại: ${resC.remainingQuestionNumbers?.length || 0}`)

    results.push({
      caseName: '(c) Lần gọi treo hoàn toàn (stub hung)',
      durationSec: `${durC.toFixed(2)}s`,
      maxLimit: '< 55s',
      passed: durC < 55 && durC < 50,
      generatedCount: resC.generatedCount,
      remainingCount: resC.remainingQuestionNumbers?.length || 0,
      note: 'Timeout cứng 20s ngắt ngay lập tức, câu treo coi như chưa xong',
    })

    activeStub = null

  } finally {
    await cleanupTestData()
  }

  console.log('\n================================================================================')
  console.log('BẢNG KẾT QUẢ ĐO THỰC TẾ 3 TRƯỜNG HỢP XẤU NHẤT (MỤC 3.2):')
  console.log('================================================================================')
  console.table(results)

  const allPassed = results.every(r => r.passed)
  console.log(`\nKết luận mục 3.2: Tất cả các ca thời gian lớn nhất < 55s (và < 50s): ${allPassed ? '✅ ĐẠT TUYỆT ĐỐI' : '❌ KHÔNG ĐẠT'}`)
  if (!allPassed) process.exit(1)
}

main()
  .catch(err => {
    console.error('Lỗi khi chạy đo trường hợp xấu nhất:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
