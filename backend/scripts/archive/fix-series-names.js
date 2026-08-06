const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Cập nhật tên các bộ đề hiển thị cho người dùng ---')
  try {
    // ID 1: Cambridge IELTS 18 -> IELTS Cambridge Academic
    await prisma.series.update({
      where: { id: 1 },
      data: { name: 'IELTS Cambridge Academic' }
    })
    console.log('✓ Đã cập nhật ID 1 thành "IELTS Cambridge Academic"')

    // ID 2: Cambridge IELTS 19 -> IELTS Practice Plus
    await prisma.series.update({
      where: { id: 2 },
      data: { name: 'IELTS Practice Plus' }
    })
    console.log('✓ Đã cập nhật ID 2 thành "IELTS Practice Plus"')

  } catch (err) {
    console.error('Lỗi khi cập nhật:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
