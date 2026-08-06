const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function syncAll() {
  console.log('--- Bắt đầu đồng bộ Exams vào Series ---')
  
  const exams = await prisma.exam.findMany({
    where: { testNumber: { not: null }, deletedAt: null }
  })
  
  const fullSeries = await prisma.series.findMany({ where: { deletedAt: null } })
  
  console.log(`Tìm thấy ${exams.length} exams cần kiểm tra.`)
  
  let count = 0
  for (const exam of exams) {
    // Thử tìm Series dựa trên tên của Exam title (VD: "Cambridge 19" chứa trong "Cambridge 19 Test 4")
    // Hoặc tìm Series dựa trên tên của ExamSeries liên kết
    
    let matchingSeries = []
    
    // Cách 1: Dựa trên title của exam (VD: "Cambridge 19" in "Cambridge 19 Test 4")
    matchingSeries = fullSeries.filter(fs => {
        const fsName = fs.name.toLowerCase().replace('ielts', '').trim() // "cambridge 19"
        return exam.title.toLowerCase().includes(fsName)
    })

    if (matchingSeries.length === 0) {
        // Cách 2: Nếu title không chứa, thử tìm theo ExamSeries liên kết (nếu có)
        if (exam.seriesId) {
            const es = await prisma.examSeries.findUnique({ where: { id: exam.seriesId } })
            if (es) {
                matchingSeries = fullSeries.filter(fs => fs.name.toLowerCase().includes(es.name.toLowerCase().replace('ielts', '').trim()))
            }
        }
    }
    
    for (const fs of matchingSeries) {
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
