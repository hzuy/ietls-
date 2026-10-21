'use strict'

const prisma = require('../lib/prisma')
const {
  updateManualExplanation,
  regenerateQuestionExplanation,
} = require('../services/explanationGeneratorService')
const { printDbBanner } = require('../lib/dbInfo')

// ─── CHỐT AN TOÀN BẮT BUỘC: CHỈ CHẠY TRÊN DEV DB (127.0.0.1:5433) ─────────────
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('\n❌ LỖI AN TOÀN BẮT BUỘC: DATABASE_URL phải trỏ vào 127.0.0.1:5433')
  process.exit(1)
}

async function main() {
  printDbBanner('print-real-json.js')
  console.log('='.repeat(80))
  console.log('📋 IN JSON THỰC TẾ TỪ POSTGRESQL DEV SAU SỬA TAY VÀ SAU LUỒNG Y')
  console.log('='.repeat(80))

  const TEST_TAG = '[TEST-JSON-PRINT]'

  // 1. Tạo Exam test
  const exam = await prisma.exam.create({
    data: {
      title: `${TEST_TAG} Exam Test JSON`,
      skill: 'reading',
    },
  })
  const passage = await prisma.passage.create({
    data: {
      examId: exam.id,
      number: 1,
      title: 'Passage JSON',
      body: 'Paul Ekman became interested in lying after a question from his students.',
    },
  })
  const examQ = await prisma.question.create({
    data: {
      passageId: passage.id,
      number: 1,
      type: 'mcq',
      questionText: 'According to the writer, Ekman became interested in lying after a question from his:',
      options: JSON.stringify(['A. peers', 'B. patients', 'C. students', 'D. teachers']),
      correctAnswer: 'B', // Cố tình đặt đáp án sai trước
    },
  })

  // 2. Tạo PracticeExam test
  const practiceExam = await prisma.practiceExam.create({
    data: {
      title: `${TEST_TAG} Practice Test JSON`,
      skill: 'reading',
      passage: 'Paul Ekman became interested in lying after a question from his students.',
    },
  })
  const practiceQ = await prisma.practiceQuestion.create({
    data: {
      exam: { connect: { id: practiceExam.id } },
      orderNum: 1,
      content: JSON.stringify({
        passage: 'Paul Ekman became interested in lying after a question from his students.',
        questions: [
          {
            number: 1,
            questionNumber: 1,
            type: 'fill_blank',
            text: 'Ekman studied deception following a question from his [GAP].',
            correctAnswer: 'patients', // Cố tình đặt đáp án sai trước
          },
        ],
      }),
    },
  })

  try {
    // ─── A. SỬA TAY (MANUAL EDIT) TRÊN EXAM ───
    console.log('\n--- 1. EXAM: SAU SỬA TAY (MANUAL EDIT) ---')
    await updateManualExplanation({
      examId: exam.id,
      questionId: examQ.id,
      isPractice: false,
      fields: {
        predict: 'Dự đoán người đặt câu hỏi kích thích sự quan tâm của Ekman.',
        locate: {
          note: 'Đọc kỹ câu đầu tiên của đoạn văn.',
          keywords: ['Paul Ekman', 'interested in lying'],
        },
        evidence: {
          parts: [{ text: 'Paul Ekman became interested in lying after a question from his students.' }],
          chunks: [{ text: 'question from his students', label: 'câu hỏi từ sinh viên', part: 0 }],
        },
        reasoning: 'Đoạn văn chỉ rõ Ekman bắt đầu quan tâm đến chủ đề nói dối sau câu hỏi từ sinh viên của ông.',
        teacher_note: 'Đã hiệu đính thủ công bởi giáo viên phụ trách.',
      },
    })
    const freshExamQManual = await prisma.question.findUnique({
      where: { id: examQ.id },
      select: { id: true, number: true, type: true, correctAnswer: true, explanation: true },
    })
    console.log(JSON.stringify(freshExamQManual.explanation, null, 2))

    // ─── B. SỬA TAY (MANUAL EDIT) TRÊN PRACTICE ───
    console.log('\n--- 2. PRACTICE: SAU SỬA TAY (MANUAL EDIT) ---')
    await updateManualExplanation({
      examId: practiceExam.id,
      questionNumber: 1,
      isPractice: true,
      fields: {
        predict: 'Cần một danh từ chỉ người ở số nhiều để điền vào chỗ trống.',
        locate: {
          note: 'Tìm thông tin về người đặt câu hỏi cho Ekman.',
          keywords: ['interested in lying', 'question from his students'],
        },
        evidence: {
          parts: [{ text: 'Paul Ekman became interested in lying after a question from his students.' }],
          chunks: [{ text: 'question from his students', label: 'câu hỏi từ sinh viên', part: 0 }],
        },
        full_sentence: 'Ekman studied deception following a question from his students.',
        translation: 'Ekman đã nghiên cứu sự lừa dối sau một câu hỏi từ các sinh viên của ông.',
        reasoning: 'Từ "students" trong bài đọc điền chính xác vào chỗ trống chỉ đối tượng hỏi.',
        teacher_note: 'Đã hoàn tất biên soạn lời giải dạng điền từ.',
      },
    })
    const freshPracticeQManual = await prisma.practiceQuestion.findUnique({
      where: { id: practiceQ.id },
      select: { id: true, explanation: true },
    })
    console.log(JSON.stringify(freshPracticeQManual.explanation, null, 2))

    // ─── C. LUỒNG Y TRÊN EXAM (TRƯỚC VÀ SAU ĐỔI ĐÁP ÁN) ───
    console.log('\n--- 3. EXAM: LUỒNG Y (XÁC NHẬN ĐỔI ĐÁP ÁN TỪ B SANG C) ---')
    const examQBefore = await prisma.question.findUnique({ where: { id: examQ.id } })
    console.log(`[EXAM] correctAnswer TRƯỚC: "${examQBefore.correctAnswer}"`)

    const resExamY = await regenerateQuestionExplanation({
      examId: exam.id,
      questionId: examQ.id,
      isPractice: false,
      proposedAnswer: 'C',
      confirmChangeAnswer: true,
    })

    const freshExamQFlowY = await prisma.question.findUnique({
      where: { id: examQ.id },
      select: { id: true, number: true, type: true, correctAnswer: true, explanation: true },
    })
    console.log(`[EXAM] correctAnswer SAU:   "${freshExamQFlowY.correctAnswer}"`)
    console.log(`[EXAM] status trong DB:     "${freshExamQFlowY.explanation.status}"`)
    console.log(`[EXAM] teacher_note sinh:   "${freshExamQFlowY.explanation.teacher_note}"`)
    console.log(JSON.stringify(freshExamQFlowY.explanation, null, 2))

    if (freshExamQFlowY.explanation.status !== 'ai_generated') {
      throw new Error(`[LỖI 2.2] Exam status sau Luồng Y phải là ai_generated, thực tế: ${freshExamQFlowY.explanation.status}`)
    }
    if (!freshExamQFlowY.explanation.teacher_note.includes('Đã đổi đáp án chuẩn từ "B" sang "C" theo xác nhận của giáo viên')) {
      throw new Error(`[LỖI 2.2] Exam teacher_note sai định dạng: ${freshExamQFlowY.explanation.teacher_note}`)
    }

    // ─── D. LUỒNG Y TRÊN PRACTICE (TRƯỚC VÀ SAU ĐỔI ĐÁP ÁN) ───
    console.log('\n--- 4. PRACTICE: LUỒNG Y (XÁC NHẬN ĐỔI ĐÁP ÁN TỪ patients SANG students) ---')
    const practiceQBefore = await prisma.practiceQuestion.findUnique({ where: { id: practiceQ.id } })
    const parsedBefore = JSON.parse(practiceQBefore.content)
    console.log(`[PRACTICE] correctAnswer TRƯỚC: "${parsedBefore.questions[0].correctAnswer}"`)

    const resPracticeY = await regenerateQuestionExplanation({
      examId: practiceExam.id,
      questionNumber: 1,
      isPractice: true,
      proposedAnswer: 'students',
      confirmChangeAnswer: true,
    })

    const freshPracticeQFlowY = await prisma.practiceQuestion.findUnique({
      where: { id: practiceQ.id },
      select: { id: true, content: true, explanation: true },
    })
    const parsedAfter = JSON.parse(freshPracticeQFlowY.content)
    const expPracticeY = freshPracticeQFlowY.explanation.byNumber['1']
    console.log(`[PRACTICE] correctAnswer SAU:   "${parsedAfter.questions[0].correctAnswer}"`)
    console.log(`[PRACTICE] status trong DB:     "${expPracticeY.status}"`)
    console.log(`[PRACTICE] teacher_note sinh:   "${expPracticeY.teacher_note}"`)
    console.log(JSON.stringify(freshPracticeQFlowY.explanation, null, 2))

    if (expPracticeY.status !== 'ai_generated') {
      throw new Error(`[LỖI 2.2] Practice status sau Luồng Y phải là ai_generated, thực tế: ${expPracticeY.status}`)
    }
    if (!expPracticeY.teacher_note.includes('Đã đổi đáp án chuẩn từ "patients" sang "students" theo xác nhận của giáo viên')) {
      throw new Error(`[LỖI 2.2] Practice teacher_note sai định dạng: ${expPracticeY.teacher_note}`)
    }

  } finally {
    // Dọn sạch test data
    await prisma.question.deleteMany({ where: { passageId: passage.id } })
    await prisma.passage.deleteMany({ where: { examId: exam.id } })
    await prisma.exam.delete({ where: { id: exam.id } })

    await prisma.practiceQuestion.deleteMany({ where: { examId: practiceExam.id } })
    await prisma.practiceExam.delete({ where: { id: practiceExam.id } })
    console.log('\n🧹 Đã dọn sạch dữ liệu test JSON!')
  }
}

main().catch(console.error)
