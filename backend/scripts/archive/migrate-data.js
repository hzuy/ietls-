const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function migratePracticeExams() {
  console.log('--- Migrating Practice Exams (via Raw SQL) ---')
  
  // Fetch via raw SQL to bypass client generation issues
  const exams = await prisma.$queryRaw`SELECT * FROM "PracticeExam" WHERE "isNormalized" = false AND "questions" IS NOT NULL AND "deletedAt" IS NULL`

  for (const exam of exams) {
    try {
      const qData = JSON.parse(exam.questions)
      const groups = qData.groups || []
      
      let orderNum = 0
      for (const group of groups) {
        const options = group.questions ? JSON.stringify(group.questions.map(q => q.options)) : null
        const correctAnswer = group.questions ? JSON.stringify(group.questions.map(q => q.correctAnswer)) : null
        
        await prisma.$executeRaw`
          INSERT INTO "PracticeQuestion" ("examId", "content", "type", "orderNum", "options", "correctAnswer", "createdAt")
          VALUES (${exam.id}, ${JSON.stringify(group)}, ${group.type}, ${orderNum++}, ${options}, ${correctAnswer}, NOW())
        `
      }

      await prisma.$executeRaw`UPDATE "PracticeExam" SET "isNormalized" = true WHERE "id" = ${exam.id}`
      console.log(`✓ Migrated PracticeExam ID: ${exam.id}`)
    } catch (e) {
      console.error(`✗ Failed to migrate PracticeExam ID: ${exam.id}`, e.message)
    }
  }
}

async function migrateSeriesMapping() {
  console.log('\n--- Syncing Series Mapping (via Raw SQL) ---')
  const adminSeries = await prisma.$queryRaw`SELECT * FROM "ExamSeries" WHERE "deletedAt" IS NULL`
  const userSeries = await prisma.$queryRaw`SELECT * FROM "Series" WHERE "deletedAt" IS NULL`

  for (const us of userSeries) {
    const matchingAdmin = adminSeries.find(as => as.name === us.name)
    if (matchingAdmin) {
      const exists = await prisma.$queryRaw`SELECT * FROM "SeriesMapping" WHERE "seriesId" = ${us.id} AND "examSeriesId" = ${matchingAdmin.id} LIMIT 1`
      
      if (exists.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO "SeriesMapping" ("seriesId", "examSeriesId", "createdAt")
          VALUES (${us.id}, ${matchingAdmin.id}, NOW())
        `
        console.log(`✓ Linked User Series "${us.name}" (ID:${us.id}) to Admin Series ID:${matchingAdmin.id}`)
      }
    }
  }
}

async function main() {
  try {
    await migratePracticeExams()
    await migrateSeriesMapping()
    console.log('\n--- Migration Finished ---')
  } catch (err) {
    console.error('Migration crashed:', err.message)
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
