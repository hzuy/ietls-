const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function syncAll() {
  console.log('--- Bắt đầu đồng bộ Exams vào Series (V3) ---')
  
  const exams = await prisma.exam.findMany({
    where: { testNumber: { not: null }, deletedAt: null }
  })
  
  const fullSeries = await prisma.series.findMany({ where: { deletedAt: null } })
  
  console.log(`Tìm thấy ${exams.length} exams. Series available:`, fullSeries.map(s => s.name));
  
  let count = 0
  for (const exam of exams) {
    let targetSeriesId = null;
    
    // Logic đặc biệt cho "Cambridge Test 4"
    if (exam.title.toLowerCase().includes('cambridge') && exam.title.toLowerCase().includes('test 4')) {
        // Ưu tiên Cambridge 19
        const s19 = fullSeries.find(s => s.name.includes('19'));
        if (s19) targetSeriesId = s19.id;
    } else if (exam.title.toLowerCase().includes('cambridge 19')) {
        const s19 = fullSeries.find(s => s.name.includes('19'));
        if (s19) targetSeriesId = s19.id;
    } else if (exam.title.toLowerCase().includes('cambridge 18')) {
        const s18 = fullSeries.find(s => s.name.includes('18'));
        if (s18) targetSeriesId = s18.id;
    }
    
    if (targetSeriesId) {
      const exists = await prisma.seriesExam.findFirst({
        where: { seriesId: targetSeriesId, examId: exam.id }
      })
      
      if (!exists) {
        await prisma.seriesExam.create({
          data: {
            seriesId: targetSeriesId,
            examId: exam.id,
            testNumber: exam.testNumber
          }
        })
        const sName = fullSeries.find(s => s.id === targetSeriesId).name;
        console.log(`+ Đã add "${exam.title}" (ID: ${exam.id}) vào bộ đề "${sName}" (Test ${exam.testNumber})`)
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
