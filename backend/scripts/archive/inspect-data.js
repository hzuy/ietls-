const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const es = await prisma.examSeries.findMany()
  const s = await prisma.series.findMany()
  const exams = await prisma.exam.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, seriesId: true, testNumber: true, skill: true }
  })

  console.log('--- DANH SÁCH BỘ ĐỀ ADMIN CHỌN (ExamSeries) ---')
  es.forEach(item => console.log(`ID: ${item.id} | Tên: ${item.name}`))

  console.log('\n--- DANH SÁCH BỘ ĐỀ USER THẤY (Series) ---')
  s.forEach(item => console.log(`ID: ${item.id} | Tên: ${item.name}`))

  console.log('\n--- DANH SÁCH EXAMS ĐANG CÓ ---')
  exams.forEach(e => console.log(`ID: ${e.id} | Title: ${e.title} | Thuộc ExamSeries ID: ${e.seriesId} | Test: ${e.testNumber}`))

  await prisma.$disconnect()
}

main()
