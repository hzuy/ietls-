const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Bắt đầu sửa lại toàn bộ gán bộ đề ---')
  
  try {
    // 1. Xóa sạch liên kết cũ để làm lại từ đầu cho chuẩn
    await prisma.seriesExam.deleteMany({})
    console.log('✓ Đã xóa sạch các liên kết cũ.')

    // 2. Lấy danh sách Exams, ExamSeries và Series
    const [exams, adminSeries, userSeries] = await Promise.all([
      prisma.exam.findMany({ where: { deletedAt: null } }),
      prisma.examSeries.findMany(),
      prisma.series.findMany({ where: { deletedAt: null } })
    ])

    let count = 0
    for (const exam of exams) {
      if (!exam.seriesId) continue

      // Tìm tên bộ đề mà Admin đã chọn cho bài này
      const adminS = adminSeries.find(as => as.id === exam.seriesId)
      if (!adminS) continue

      // Tìm bộ đề hiển thị cho User có tên tương ứng
      const targetS = userSeries.find(us => us.name === adminS.name)
      
      if (targetS) {
        await prisma.seriesExam.create({
          data: {
            seriesId: targetS.id,
            examId: exam.id,
            testNumber: exam.testNumber || 1
          }
        })
        console.log(`+ Đã gán bài "${exam.title}" vào bộ đề "${targetS.name}" (Test ${exam.testNumber})`)
        count++
      }
    }

    console.log(`\n--- HOÀN THÀNH ---`)
    console.log(`Đã gán lại thành công ${count} bài thi vào đúng vị trí.`)

  } catch (err) {
    console.error('Lỗi nghiêm trọng:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
