const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const legacyPractice = await prisma.practiceExam.count({ where: { isNormalized: false, deletedAt: null } })
  const speakingSamples = await prisma.speakingSample.findMany({ 
    where: { deletedAt: null },
    include: { _count: { select: { parts: true } } }
  })
  
  const unmigratedSpeaking = speakingSamples.filter(s => s._count.parts === 0)

  console.log('--- BÁO CÁO LEGACY ---')
  console.log('1. Practice Exams chưa chuẩn hóa:', legacyPractice)
  console.log('2. Speaking Samples chưa có Parts:', unmigratedSpeaking.length)
  if (unmigratedSpeaking.length > 0) {
    console.log('   Các ID chưa migrate:', unmigratedSpeaking.map(s => s.id).join(', '))
  }
  await prisma.$disconnect()
}
check()
