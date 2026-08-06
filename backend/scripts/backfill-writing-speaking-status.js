const prisma = require('../lib/prisma')

async function backfill() {
  console.log('--- Bắt đầu kiểm tra và backfill trạng thái WritingAnswer / SpeakingAnswer ---')

  // 1. Backfill WritingAnswer
  const pendingWriting = await prisma.writingAnswer.findMany({
    where: {
      status: 'pending',
      OR: [
        { aiScore: { not: null } },
        { aiFeedback: { not: null } }
      ]
    },
    select: { id: true }
  })

  console.log(`Tìm thấy ${pendingWriting.length} bản ghi WritingAnswer cũ cần cập nhật sang "graded".`)
  if (pendingWriting.length > 0) {
    const writingIds = pendingWriting.map(w => w.id)
    await prisma.writingAnswer.updateMany({
      where: { id: { in: writingIds } },
      data: { status: 'graded' }
    })
    console.log(`✅ Đã cập nhật ${pendingWriting.length} bản ghi WritingAnswer sang "graded".`)
  }

  // 2. Backfill SpeakingAnswer
  const pendingSpeaking = await prisma.speakingAnswer.findMany({
    where: {
      status: 'pending',
      OR: [
        { aiScore: { not: null } },
        { aiFeedback: { not: null } }
      ]
    },
    select: { id: true }
  })

  console.log(`Tìm thấy ${pendingSpeaking.length} bản ghi SpeakingAnswer cũ cần cập nhật sang "graded".`)
  if (pendingSpeaking.length > 0) {
    const speakingIds = pendingSpeaking.map(s => s.id)
    await prisma.speakingAnswer.updateMany({
      where: { id: { in: speakingIds } },
      data: { status: 'graded' }
    })
    console.log(`✅ Đã cập nhật ${pendingSpeaking.length} bản ghi SpeakingAnswer sang "graded".`)
  }

  console.log('--- Hoàn tất backfill trạng thái! ---')
}

backfill()
  .catch(err => {
    console.error('❌ Lỗi khi backfill:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
