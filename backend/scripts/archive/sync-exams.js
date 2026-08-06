const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function syncAll() {
  console.log('--- Bắt đầu đồng bộ Exams vào Series ---')
  
  const exams = await prisma.exam.findMany({
    where: { seriesId: { not: null }, testNumber: { not: null }, deletedAt: null }
  })
  
  const examSeries = await prisma.examSeries.findMany()
  const fullSeries = await prisma.series.findMany({ where: { deletedAt: null } })
  
  console.log(`Tìm thấy ${exams.length} exams cần kiểm tra.`)
  
  let count = 0
  for (const exam of exams) {
    const es = examSeries.find(s => s.id === exam.seriesId)
    if (!es) continue
    
    // Tìm series có tên chứa tên của exam series (VD: "Cambridge 19" chứa "Cambridge 19")
    const matching = fullSeries.filter(s => s.name.toLowerCase().includes(es.name.toLowerCase()))
    
    for (const fs of matching) {
      const exists = await prisma.seriesExam.findFirst({
        where: { seriesId: fs.id, examId: exam.id }
      })
      
      if (!exists) {
        await prisma.seriesExam.create({
          data: {
            seriesId: fs.id,
            examId: exam.id,
            testNumber: exam.testNumber
          }
        })
        console.log(`+ Đã add "${exam.title}" vào bộ đề "${fs.name}" (Test ${exam.testNumber})`)
        count++
      }
    }
  }
  
  console.log(`--- Xong! Đã bổ sung ${count} liên kết mới. ---`)
  await prisma.$disconnect()
}

syncAll().catch(err => {
  console.error(err)
  process.exit(1)
})
