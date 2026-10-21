'use strict'

const prisma = require('../lib/prisma')
const {
  updateManualExplanation,
  regenerateQuestionExplanation,
} = require('../services/explanationGeneratorService')
const { printDbBanner } = require('../lib/dbInfo')

async function main() {
  printDbBanner()
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
      correctAnswer: 'C',
    },
  })

  // 2. Tạo PracticeExam test
  const practiceExam = await prisma.practiceExam.create({
    data: {
      title: `${TEST_TAG} Practice Test JSON`,
      skill: 'reading',
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
            correctAnswer: 'students',
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
        locate_note: 'Đọc kỹ câu đầu tiên của đoạn văn.',
        locate_keywords: ['Paul Ekman', 'interested in lying', 'question from his students'],
        evidence_quote: 'Paul Ekman became interested in lying after a question from his students.',
        evidence_chunks: [{ text: 'question from his students', label: 'câu hỏi từ sinh viên' }],
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
        locate_note: 'Tìm thông tin về người đặt câu hỏi cho Ekman.',
        locate_keywords: ['Ekman', 'question from his'],
        evidence_quote: 'Paul Ekman became interested in lying after a question from his students.',
        evidence_chunks: [{ text: 'question from his students', label: 'câu hỏi từ sinh viên' }],
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

    // ─── C. LUỒNG Y (ĐỔI ĐÁP ÁN VÀ TẠO GIẢI THÍCH) TRÊN EXAM ───
    console.log('\n--- 3. EXAM: SAU LUỒNG Y (XÁC NHẬN ĐỔI ĐÁP ÁN) ---')
    // Đổi đáp án câu Exam từ 'C' sang 'students' (hoặc 'C. students')
    await regenerateQuestionExplanation({
      examId: exam.id,
      questionId: examQ.id,
      isPractice: false,
      proposedAnswer: 'C. students',
      confirmChangeAnswer: true,
    })
    const freshExamQFlowY = await prisma.question.findUnique({
      where: { id: examQ.id },
      select: { id: true, number: true, type: true, correctAnswer: true, explanation: true },
    })
    console.log(`correctAnswer trong DB: "${freshExamQFlowY.correctAnswer}"`)
    console.log(JSON.stringify(freshExamQFlowY.explanation, null, 2))

    // ─── D. LUỒNG Y TRÊN PRACTICE ───
    console.log('\n--- 4. PRACTICE: SAU LUỒNG Y (XÁC NHẬN ĐỔI ĐÁP ÁN) ---')
    await regenerateQuestionExplanation({
      examId: practiceExam.id,
      questionNumber: 1,
      isPractice: true,
      proposedAnswer: 'his students',
      confirmChangeAnswer: true,
    })
    const freshPracticeQFlowY = await prisma.practiceQuestion.findUnique({
      where: { id: practiceQ.id },
      select: { id: true, content: true, explanation: true },
    })
    console.log(`Content trong DB: ${freshPracticeQFlowY.content}`)
    console.log(JSON.stringify(freshPracticeQFlowY.explanation, null, 2))

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
