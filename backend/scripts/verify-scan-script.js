'use strict'

/**
 * Script kiểm chứng scan-legacy-explanations.js bắt được bản ghi có cụm nội bộ trên DB dev.
 * Tạo 1 bản ghi test, chạy quét, kiểm tra xem có bắt được không, rồi xóa dọn dẹp bản ghi test.
 */

const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')
const { runScan } = require('./scan-legacy-explanations')

async function main() {
  printDbBanner('VERIFY SCAN')

  console.log('\n[SETUP] Tạo bản ghi test có cụm nội bộ trên DB dev...')
  // Find a test exam or first exam to attach dummy question
  const passage = await prisma.passage.findFirst()
  if (!passage) {
    throw new Error('Không tìm thấy passage nào trên DB dev để tạo test record')
  }

  // Create a temporary question with internal jargon
  const testQuestion = await prisma.question.create({
    data: {
      passageId: passage.id,
      number: 9999,
      type: 'mcq',
      questionText: 'Test question for jargon detection',
      correctAnswer: 'A',
      explanation: {
        v: 2,
        status: 'ai_generated',
        answer: 'B', // Deliberate mismatch as well!
        reasoning: 'Đáp án người dùng nhập là sai do ngộ nhận giữa các khái niệm trong bài.',
        locate: { note: 'Thử thách này bẫy người làm.' },
      },
    },
  })

  console.log(`=> Đã tạo Question test ID=${testQuestion.id}, number=9999 với cụm nội bộ và answer mismatch.`)

  try {
    console.log('\n[RUN] Thực thi runScan()...')
    const scanResults = await runScan()

    const foundJargon = scanResults.examJargonItems.find((item) => item.id === testQuestion.id)
    const foundMismatch = scanResults.examMismatchItems.find((item) => item.id === testQuestion.id)

    console.log('\n[ASSERT] Kiểm tra kết quả bắt được:')
    if (foundJargon) {
      console.log('✅ ĐÃ BẮT ĐƯỢC BẢN GHI TEST CÓ CỤM NỘI BỘ:')
      console.log(JSON.stringify(foundJargon, null, 2))
    } else {
      console.error('❌ KHÔNG BẮT ĐƯỢC BẢN GHI TEST CÓ CỤM NỘI BỘ!')
      process.exit(1)
    }

    if (foundMismatch) {
      console.log('✅ ĐÃ BẮT ĐƯỢC BẢN GHI TEST CÓ ANSWER MISMATCH:')
      console.log(JSON.stringify(foundMismatch, null, 2))
    } else {
      console.error('❌ KHÔNG BẮT ĐƯỢC BẢN GHI TEST CÓ ANSWER MISMATCH!')
      process.exit(1)
    }
  } finally {
    console.log('\n[CLEANUP] Xóa bản ghi test ID=' + testQuestion.id + ' khỏi DB dev...')
    await prisma.question.delete({ where: { id: testQuestion.id } })
    console.log('=> Đã dọn dẹp bản ghi test thành công. DB sạch.')
  }
}

main()
  .then(() => {
    console.log('\n🎉 KIỂM CHỨNG SCRIPT QUÉT THÀNH CÔNG RỰC RỠ!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Lỗi khi kiểm chứng:', err)
    process.exit(1)
  })
