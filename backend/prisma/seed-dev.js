// seed-dev.js — dữ liệu giả tối thiểu cho DB dev local (Docker postgres-dev).
// Chạy qua: npm run db:dev:seed   (không chạy trực tiếp `node prisma/seed-dev.js`
// trừ khi DATABASE_URL trong shell đã trỏ postgres-dev — script tự chặn nếu không).
//
// Idempotent: chạy lại nhiều lần không tạo trùng (upsert theo email/marker title).
// KHÔNG BAO GIỜ copy dữ liệu thật từ Supabase — toàn bộ dữ liệu dưới đây là giả.

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const DB_URL = process.env.DATABASE_URL || ''
console.log('\n=== SEED DEV DATA ===')
console.log('DB:', DB_URL.replace(/:([^:@]+)@/, ':***@'))

// An toàn ngược lại với seed-demo-data.js (script đó CHỈ chạy trên prod) —
// script này CHỈ chạy trên postgres-dev local, không bao giờ chạm Supabase.
if (!DB_URL.includes('127.0.0.1:5433')) {
  console.error('ERROR: DATABASE_URL không trỏ vào postgres-dev (127.0.0.1:5433). Dừng lại để tránh seed nhầm lên DB khác (kể cả production).')
  process.exit(1)
}
console.log('Confirmed: postgres-dev local ✓\n')

const prisma = new PrismaClient({ log: ['error'] })

const SEED_MARKER = '[SEED-DEV]'

async function seedUsers() {
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'dev-admin@example.test' },
    update: {},
    create: { email: 'dev-admin@example.test', password: passwordHash, name: `${SEED_MARKER} Admin Dev`, role: 'admin' },
  })
  const teacher = await prisma.user.upsert({
    where: { email: 'dev-teacher@example.test' },
    update: {},
    create: { email: 'dev-teacher@example.test', password: passwordHash, name: `${SEED_MARKER} Teacher Dev`, role: 'teacher' },
  })
  const user = await prisma.user.upsert({
    where: { email: 'dev-user@example.test' },
    update: {},
    create: { email: 'dev-user@example.test', password: passwordHash, name: `${SEED_MARKER} User Dev`, role: 'user' },
  })

  console.log('Users:', { admin: admin.id, teacher: teacher.id, user: user.id })
  return { admin, teacher, user }
}

async function seedExams() {
  const existing = await prisma.exam.findFirst({ where: { title: { startsWith: SEED_MARKER } } })
  if (existing) {
    console.log('Exams: đã tồn tại, bỏ qua (xoá bằng --cleanup nếu muốn seed lại)')
    return prisma.exam.findMany({ where: { title: { startsWith: SEED_MARKER } } })
  }

  const readingExam = await prisma.exam.create({
    data: {
      title: `${SEED_MARKER} Reading Test 1`,
      skill: 'reading',
      bookNumber: 1,
      testNumber: 1,
      passages: {
        create: [
          {
            number: 1,
            title: 'A Short Passage',
            body: 'This is a placeholder passage body used only for local dev/test data.',
            questionGroups: {
              create: [
                {
                  qNumberStart: 1,
                  qNumberEnd: 2,
                  instruction: 'Choose the correct answer.',
                  type: 'mcq',
                  questions: {
                    create: [
                      { number: 1, type: 'mcq', questionText: 'Sample question 1?', options: JSON.stringify(['A', 'B', 'C']), correctAnswer: 'A' },
                      { number: 2, type: 'mcq', questionText: 'Sample question 2?', options: JSON.stringify(['A', 'B', 'C']), correctAnswer: 'B' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: { passages: { include: { questionGroups: { include: { questions: true } } } } },
  })

  const listeningExam = await prisma.exam.create({
    data: {
      title: `${SEED_MARKER} Listening Test 1`,
      skill: 'listening',
      bookNumber: 1,
      testNumber: 1,
      listeningSections: {
        create: [
          {
            number: 1,
            context: 'A placeholder listening context for local dev/test data.',
            questionGroups: {
              create: [
                {
                  qNumberStart: 1,
                  qNumberEnd: 1,
                  instruction: 'Choose the correct answer.',
                  type: 'mcq',
                  questions: {
                    create: [
                      { number: 1, type: 'mcq', questionText: 'Sample listening question 1?', options: JSON.stringify(['A', 'B', 'C']), correctAnswer: 'C' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log('Exams:', { reading: readingExam.id, listening: listeningExam.id })
  return [readingExam, listeningExam]
}

async function seedAttempts(user, exams) {
  const existing = await prisma.attempt.findFirst({ where: { userId: user.id, isSeeded: true } })
  if (existing) {
    console.log('Attempts: đã tồn tại, bỏ qua')
    return
  }

  for (const exam of exams) {
    await prisma.attempt.create({
      data: {
        userId: user.id,
        examId: exam.id,
        score: 6.5,
        finishedAt: new Date(),
        isSeeded: true,
      },
    })
  }
  console.log('Attempts: created', exams.length, 'attempt(s) for user', user.id)
}

async function cleanup() {
  console.log('Deleting seeded dev data...')
  const attempts = await prisma.attempt.deleteMany({ where: { isSeeded: true } })
  const exams = await prisma.exam.deleteMany({ where: { title: { startsWith: SEED_MARKER } } })
  const users = await prisma.user.deleteMany({ where: { name: { startsWith: SEED_MARKER } } })
  console.log('Deleted → attempts:', attempts.count, '| exams:', exams.count, '| users:', users.count)
}

async function main() {
  if (process.argv.includes('--cleanup')) {
    await cleanup()
    return
  }
  const { user } = await seedUsers()
  const exams = await seedExams()
  await seedAttempts(user, exams)
  console.log('\nDone. Login: dev-admin@example.test / dev-teacher@example.test / dev-user@example.test — password: Password123!\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
