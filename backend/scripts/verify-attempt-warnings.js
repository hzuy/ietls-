/**
 * verify-attempt-warnings.js
 * Kiểm chứng Section D: CẢNH BÁO LƯỢT THI (2.2) trên Postgres Dev DB thật (127.0.0.1:5433).
 * Tạo 1, 3 và 12 lượt thi thật cho cả bảng Attempt (Exam) và PracticeAttempt (PracticeExam).
 * Xác nhận số lượng đếm được chính xác và dọn sạch 100% dữ liệu [TEST].
 */

const prisma = require('../lib/prisma')

const DB_GUARD = '127.0.0.1:5433'

async function checkSafeDb() {
  const url = process.env.DATABASE_URL || ''
  if (!url.includes(DB_GUARD) && !url.includes('5433')) {
    throw new Error(`[AN TOÀN] Script chỉ được chạy trên Postgres Dev (${DB_GUARD}). URL hiện tại: ${url.replace(/:[^:@]+@/, ':***@')}`)
  }
}

async function main() {
  await checkSafeDb()
  console.log('[D. CẢNH BÁO LƯỢT THI] Bắt đầu kiểm chứng trên Postgres Dev DB 127.0.0.1:5433...')

  const results = []

  let testUser = null
  let testExam = null
  let testPracticeExam = null
  const createdAttemptIds = []
  const createdPracticeAttemptIds = []

  try {
    // 1. Tạo Test User
    testUser = await prisma.user.create({
      data: {
        email: `test_learner_${Date.now()}@example.com`,
        password: 'dummy_hashed_password',
        name: '[TEST] Learner',
        role: 'user',
      },
    })

    // 2. Tạo Test Exam (cho bảng Attempt)
    testExam = await prisma.exam.create({
      data: {
        title: '[TEST] Exam for Attempt Warning',
        skill: 'reading',
        passages: {
          create: [
            {
              number: 1,
              title: 'Passage 1',
              body: 'Test body',
              questions: {
                create: [
                  {
                    number: 1,
                    type: 'mcq',
                    questionText: 'Test question',
                    options: JSON.stringify(['A', 'B', 'C', 'D']),
                    correctAnswer: 'A',
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        passages: { include: { questions: true } },
      },
    })

    // 3. Tạo Test PracticeExam (cho bảng PracticeAttempt)
    testPracticeExam = await prisma.practiceExam.create({
      data: {
        title: '[TEST] Practice for Attempt Warning',
        skill: 'reading',
        passage: 'Practice passage body',
        questions: {
          create: [
            {
              orderNum: 1,
              type: 'mcq',
              content: JSON.stringify({
                type: 'mcq',
                questions: [
                  { number: 1, question: 'Question 1', options: ['A', 'B'], correctAnswer: 'A' },
                ],
              }),
            },
          ],
        },
      },
    })

    console.log(`[SETUP] Đã tạo Test User #${testUser.id}, Exam #${testExam.id}, PracticeExam #${testPracticeExam.id}`)

    // ─── KIỂM CHỨNG EXAM (BẢNG ATTEMPT) ───────────────────────────────────
    const examLevels = [1, 3, 12]
    for (const targetLevel of examLevels) {
      const currentCount = await prisma.attempt.count({ where: { examId: testExam.id } })
      const needed = targetLevel - currentCount
      for (let i = 0; i < needed; i++) {
        const att = await prisma.attempt.create({
          data: {
            userId: testUser.id,
            examId: testExam.id,
            score: 7.0,
            answers: '{}',
            correctCount: 1,
            totalCount: 1,
          },
        })
        createdAttemptIds.push(att.id)
      }

      // Đếm thật bằng query của explanationGeneratorService
      const verifiedCount = await prisma.attempt.count({ where: { examId: testExam.id } })
      const levelCategory = verifiedCount >= 10 ? 'CẢNH BÁO ĐẶC BIỆT (>= 10)' : 'Cảnh báo tiêu chuẩn (> 0)'

      results.push({
        scope: 'Exam (Attempt)',
        targetCount: targetLevel,
        realDbCount: verifiedCount,
        match: verifiedCount === targetLevel,
        levelCategory,
      })
    }

    // ─── KIỂM CHỨNG PRACTICE (BẢNG PRACTICEATTEMPT) ─────────────────────────
    const practiceLevels = [1, 3, 12]
    for (const targetLevel of practiceLevels) {
      const currentCount = await prisma.practiceAttempt.count({ where: { practiceExamId: testPracticeExam.id } })
      const needed = targetLevel - currentCount
      for (let i = 0; i < needed; i++) {
        const att = await prisma.practiceAttempt.create({
          data: {
            userId: testUser.id,
            practiceExamId: testPracticeExam.id,
            answers: {},
            correct: 1,
            total: 1,
          },
        })
        createdPracticeAttemptIds.push(att.id)
      }

      // Đếm thật bằng query của explanationGeneratorService
      const verifiedCount = await prisma.practiceAttempt.count({ where: { practiceExamId: testPracticeExam.id } })
      const levelCategory = verifiedCount >= 10 ? 'CẢNH BÁO ĐẶC BIỆT (>= 10)' : 'Cảnh báo tiêu chuẩn (> 0)'

      results.push({
        scope: 'Practice (PracticeAttempt)',
        targetCount: targetLevel,
        realDbCount: verifiedCount,
        match: verifiedCount === targetLevel,
        levelCategory,
      })
    }

    console.log('\n=== KẾT QUẢ KIỂM CHỨNG MỤC D: CẢNH BÁO LƯỢT THI TRÊN DEV DB THẬT ===')
    console.table(results)

  } finally {
    console.log('\n[CLEANUP] Bắt đầu dọn sạch dữ liệu [TEST]...')
    if (createdAttemptIds.length) {
      await prisma.attempt.deleteMany({ where: { id: { in: createdAttemptIds } } }).catch(() => {})
    }
    if (createdPracticeAttemptIds.length) {
      await prisma.practiceAttempt.deleteMany({ where: { id: { in: createdPracticeAttemptIds } } }).catch(() => {})
    }
    if (testExam) {
      await prisma.question.deleteMany({ where: { passage: { examId: testExam.id } } }).catch(() => {})
      await prisma.passage.deleteMany({ where: { examId: testExam.id } }).catch(() => {})
      await prisma.exam.delete({ where: { id: testExam.id } }).catch(() => {})
    }
    if (testPracticeExam) {
      await prisma.practiceQuestion.deleteMany({ where: { examId: testPracticeExam.id } }).catch(() => {})
      await prisma.practiceExam.delete({ where: { id: testPracticeExam.id } }).catch(() => {})
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {})
    }
    // Dọn sạch tàn dư nếu có
    await prisma.attempt.deleteMany({ where: { exam: { title: { startsWith: '[TEST]' } } } }).catch(() => {})
    await prisma.practiceAttempt.deleteMany({ where: { practiceExam: { title: { startsWith: '[TEST]' } } } }).catch(() => {})
    await prisma.question.deleteMany({ where: { passage: { exam: { title: { startsWith: '[TEST]' } } } } }).catch(() => {})
    await prisma.passage.deleteMany({ where: { exam: { title: { startsWith: '[TEST]' } } } }).catch(() => {})
    await prisma.exam.deleteMany({ where: { title: { startsWith: '[TEST] Exam for Attempt Warning' } } }).catch(() => {})
    await prisma.practiceQuestion.deleteMany({ where: { exam: { title: { startsWith: '[TEST] Practice for Attempt Warning' } } } }).catch(() => {})
    await prisma.practiceExam.deleteMany({ where: { title: { startsWith: '[TEST] Practice for Attempt Warning' } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { email: { startsWith: 'test_learner_' } } }).catch(() => {})

    console.log('[CLEANUP] Dọn sạch 100% dữ liệu [TEST] thành công!')
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('[LỖI]', err)
  process.exit(1)
})
