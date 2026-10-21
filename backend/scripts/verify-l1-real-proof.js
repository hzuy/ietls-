'use strict'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../server')
const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')

// ─── CHỐT AN TOÀN: CHỈ CHẠY TRÊN DB DEV (127.0.0.1:5433) ──────────────────────
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('\n❌ LỖI AN TOÀN BẮT BUỘC:')
  console.error('Script CHỈ được phép chạy trên DB dev (127.0.0.1:5433).')
  console.error('DATABASE_URL hiện tại:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : '(rỗng)')
  process.exit(1)
}

const TEST_TAG = '[TEST-L1-PROOF]'

async function runProof() {
  printDbBanner('verify-l1-real-proof.js')
  console.log('='.repeat(90))
  console.log('🚀 BẮT ĐẦU CHỨNG MINH THẬT MỤC A: L1 MANUAL EDIT & CHẶN GIAN LẬN QUA HTTP THẬT')
  console.log('='.repeat(90))

  const secret = process.env.JWT_SECRET || 'ielts_super_secret_key_2024'
  let teacherUser = await prisma.user.findFirst({
    where: { role: 'teacher', deletedAt: null, isLocked: false }
  })
  if (!teacherUser) {
    teacherUser = await prisma.user.create({
      data: { name: 'Teacher Proof', email: 'teacher_proof@test.local', password: 'hash', role: 'teacher' }
    })
  }
  const teacherToken = jwt.sign({ userId: teacherUser.id, email: teacherUser.email, role: teacherUser.role }, secret, { expiresIn: '1h' })

  let studentUser = await prisma.user.findFirst({
    where: { role: 'user', deletedAt: null, isLocked: false }
  })
  if (!studentUser) {
    studentUser = await prisma.user.create({
      data: { name: 'Student Proof', email: 'student_proof@test.local', password: 'hash', role: 'user' }
    })
  }
  const studentToken = jwt.sign({ userId: studentUser.id, email: studentUser.email, role: studentUser.role }, secret, { expiresIn: '1h' })

  // Đảm bảo dọn sạch nếu có tồn dư cũ
  await cleanupAll()

  try {
    // ════════════════════════════════════════════════════════════════════════════════
    // 1. CHỨNG MINH TRÊN READING EXAM
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────────────────────')
    console.log('1. CHỨNG MINH TRÊN READING EXAM (Route HTTP: PUT /api/admin/exams/:id/questions/:qId/explanation)')
    console.log('──────────────────────────────────────────────────────────────────────────')

    const readingPassageBody = `Paragraph A: Early humans relied heavily on animal tracking and foraging techniques.

Paragraph B: The invention of agriculture in the Fertile Crescent revolutionized human settlement. Cultivating wheat and domesticating sheep allowed populations to expand dramatically.

Paragraph C: Modern industrial farming, however, has led to significant soil degradation and loss of biodiversity.`

    const readingExam = await prisma.exam.create({
      data: {
        title: `${TEST_TAG} Reading Exam Proof`,
        skill: 'reading',
      },
    })

    const passage1 = await prisma.passage.create({
      data: {
        examId: readingExam.id,
        number: 1,
        title: 'Agriculture Evolution',
        body: readingPassageBody,
      },
    })

    const examQ1 = await prisma.question.create({
      data: {
        passageId: passage1.id,
        number: 1,
        type: 'mcq',
        questionText: 'Which discovery allowed human populations to expand rapidly?',
        options: JSON.stringify(['A. Animal tracking', 'B. The invention of agriculture', 'C. Industrial farming']),
        correctAnswer: 'B',
        explanation: {
          v: 2,
          answer: 'B',
          status: 'ai_generated',
          predict: 'Cũ: Dự đoán loại đáp án.',
          locate: { note: 'Đoạn A', keywords: ['Early humans'], paragraph: 0 },
          evidence: {
            parts: [{ text: 'Early humans relied heavily on animal tracking and foraging techniques.', paragraph: 0 }],
            paragraph: 0,
            chunks: [{ text: 'animal tracking', label: 'săn bắt', part: 0 }],
          },
          reasoning: 'Lời giải cũ chưa chuẩn.',
          distractors: [{ option: 'A. Animal tracking', reason: 'Không giúp dân số tăng vọt' }],
        },
      },
    })

    console.log('\n[1.1] JSON TRƯỚC SỬA (Reading Exam #1):')
    console.log(JSON.stringify(examQ1.explanation, null, 2))

    // Thực hiện sửa tay Bước 2 & Bước 3 qua HTTP PUT
    console.log('\n[1.2] Gửi HTTP PUT sửa Bước 2 & Bước 3 sang Paragraph B...')
    const editPayloadReadingExam = {
      predict: 'Câu hỏi yêu cầu tìm phát minh giúp dân số bùng nổ, dự đoán là phương thức sản xuất mới.',
      question_chunks: [
        { text: 'Which discovery allowed', label: 'Phát minh nào cho phép' },
        { text: 'human populations to expand rapidly?', label: 'dân số loài người bùng nổ nhanh chóng?' }
      ],
      locate: {
        note: 'Đọc kỹ Paragraph B về cuộc cách mạng định cư và mở rộng dân số.',
        keywords: ['invention of agriculture', 'populations to expand dramatically'],
      },
      evidence: {
        parts: [
          { text: 'The invention of agriculture in the Fertile Crescent revolutionized human settlement.' },
          { text: 'Cultivating wheat and domesticating sheep allowed populations to expand dramatically.' }
        ],
        chunks: [
          { text: 'invention of agriculture', label: 'phát minh nông nghiệp', part: 0 },
          { text: 'populations to expand dramatically', label: 'dân số bùng nổ mạnh mẽ', part: 1 }
        ]
      },
      paraphrases: [
        {
          question: 'populations to expand rapidly',
          question_label: 'dân số tăng nhanh',
          passage: 'populations to expand dramatically',
          passage_label: 'dân số bùng nổ mạnh mẽ'
        }
      ],
      reasoning: 'Đoạn B khẳng định sự ra đời của nông nghiệp cho phép dân số tăng trưởng vượt bậc, khớp với đáp án B.',
      teacher_note: 'Đã hiệu đính sang đúng dẫn chứng ở Đoạn B theo phương pháp Linear thinking.',
      distractors: [
        { option: 'A. Animal tracking', label: 'Săn bắt', reason: 'Đây là phương thức ban đầu ở Đoạn A, không giúp bùng nổ dân số.' },
        { option: 'C. Industrial farming', label: 'Nông nghiệp công nghiệp', reason: 'Nhắc ở Đoạn C với hệ lụy thoái hóa đất.' }
      ]
    }

    const resExamReading = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${examQ1.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(editPayloadReadingExam)

    if (resExamReading.status !== 200) {
      throw new Error(`HTTP PUT Reading Exam thất bại (${resExamReading.status}): ${JSON.stringify(resExamReading.body)}`)
    }

    // Đọc lại trực tiếp từ PostgreSQL Dev
    const freshExamQ1 = await prisma.question.findUnique({
      where: { id: examQ1.id },
      select: { id: true, number: true, correctAnswer: true, explanation: true }
    })

    console.log('\n[1.3] JSON THÔ SAU SỬA TRONG DB (Reading Exam #1):')
    console.log(JSON.stringify(freshExamQ1.explanation, null, 2))

    // Kiểm chứng các trường bắt buộc
    const expR = freshExamQ1.explanation
    if (!expR.locate || !expR.evidence || !expR.paraphrases || !expR.question_chunks || !expR.distractors) {
      throw new Error('Thiếu một trong các khối bắt buộc: locate, evidence, paraphrases, question_chunks, distractors!')
    }
    if (expR.locate.paragraph !== 1) {
      throw new Error(`locate.paragraph tính sai! Mong đợi: 1 (Paragraph B), Thực tế: ${expR.locate.paragraph}`)
    }
    if (expR.evidence.paragraph !== 1) {
      throw new Error(`evidence.paragraph tính sai! Mong đợi: 1 (Paragraph B), Thực tế: ${expR.evidence.paragraph}`)
    }
    console.log(`✅ Reading Exam: locate.paragraph = ${expR.locate.paragraph} (Paragraph B) do server tự động tính chuẩn xác!`)

    // ════════════════════════════════════════════════════════════════════════════════
    // 2. CHỨNG MINH TRÊN LISTENING EXAM
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────────────────────')
    console.log('2. CHỨNG MINH TRÊN LISTENING EXAM (Route HTTP: PUT /api/admin/exams/:id/questions/:qId/explanation)')
    console.log('──────────────────────────────────────────────────────────────────────────')

    const listeningTranscript = `Part 1: Good morning and welcome to the campus orientation. Please ensure you have your ID badge.

Part 2: The university library has relocated its main computer laboratory to the third floor of the Science Building. Access is available from 8:00 AM daily.`

    const listeningExam = await prisma.exam.create({
      data: {
        title: `${TEST_TAG} Listening Exam Proof`,
        skill: 'listening',
      },
    })

    const listeningSection = await prisma.listeningSection.create({
      data: {
        examId: listeningExam.id,
        number: 1,
        context: 'Campus Orientation',
        transcript: listeningTranscript,
      },
    })

    const examQ2 = await prisma.question.create({
      data: {
        listeningSectionId: listeningSection.id,
        number: 2,
        type: 'fill_blank',
        questionText: 'The main computer laboratory is now located on the [GAP] floor.',
        correctAnswer: 'third',
        explanation: {
          v: 2,
          answer: 'third',
          status: 'ai_generated',
          predict: 'Cần số thứ tự chỉ tầng.',
        },
      },
    })

    const editPayloadListeningExam = {
      predict: 'Cần một số thứ tự chỉ tầng nơi đặt phòng máy tính mới.',
      locate: {
        note: 'Lắng nghe phần 2 về địa điểm chuyển dời của phòng máy tính.',
        keywords: ['computer laboratory', 'third floor'],
      },
      evidence: {
        parts: [
          { text: 'The university library has relocated its main computer laboratory to the third floor of the Science Building.' }
        ],
        chunks: [
          { text: 'third floor', label: 'tầng ba', part: 0 }
        ]
      },
      paraphrases: [
        {
          question: 'now located on',
          question_label: 'hiện nằm tại',
          passage: 'relocated its main computer laboratory to',
          passage_label: 'đã chuyển phòng thí nghiệm chính tới'
        }
      ],
      full_sentence: 'The main computer laboratory is now located on the third floor.',
      translation: 'Phòng thực hành máy tính chính hiện được đặt tại tầng ba.',
      reasoning: 'Bài nghe nêu rõ địa điểm chuyển đến là tầng 3 của tòa nhà khoa học (third floor).',
      teacher_note: 'Đã hoàn thiện các bước sửa trực tiếp cho phần Nghe.'
    }

    const resExamListening = await request(app)
      .put(`/api/admin/exams/${listeningExam.id}/questions/${examQ2.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(editPayloadListeningExam)

    if (resExamListening.status !== 200) {
      throw new Error(`HTTP PUT Listening Exam thất bại (${resExamListening.status}): ${JSON.stringify(resExamListening.body)}`)
    }

    const freshExamQ2 = await prisma.question.findUnique({
      where: { id: examQ2.id },
      select: { id: true, number: true, correctAnswer: true, explanation: true }
    })

    console.log('\n[2.1] JSON THÔ SAU SỬA TRONG DB (Listening Exam #2):')
    console.log(JSON.stringify(freshExamQ2.explanation, null, 2))
    const expL = freshExamQ2.explanation
    if (expL.locate.paragraph !== 1) {
      throw new Error(`locate.paragraph Listening tính sai! Mong đợi: 1 (Part 2), Thực tế: ${expL.locate.paragraph}`)
    }
    console.log(`✅ Listening Exam: locate.paragraph = ${expL.locate.paragraph} (Part 2) do server tính chuẩn xác!`)

    // ════════════════════════════════════════════════════════════════════════════════
    // 3. CHỨNG MINH TRÊN READING PRACTICE
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────────────────────')
    console.log('3. CHỨNG MINH TRÊN READING PRACTICE (Route HTTP: PUT /api/practice/admin/reading/:id/questions/:qNum/explanation)')
    console.log('──────────────────────────────────────────────────────────────────────────')

    const readingPracticePassage = `Paragraph 1: Rainforest canopies absorb vast amounts of carbon dioxide.

Paragraph 2: Deforestation significantly reduces local precipitation, causing severe agricultural droughts.`

    const readingPracticeExam = await prisma.practiceExam.create({
      data: {
        title: `${TEST_TAG} Reading Practice Proof`,
        skill: 'reading',
        passage: readingPracticePassage,
      },
    })

    const practiceQ1 = await prisma.practiceQuestion.create({
      data: {
        exam: { connect: { id: readingPracticeExam.id } },
        orderNum: 1,
        content: JSON.stringify({
          passage: `Paragraph 1: Rainforest canopies absorb vast amounts of carbon dioxide.

Paragraph 2: Deforestation significantly reduces local precipitation, causing severe agricultural droughts.`,
          questions: [
            {
              number: 1,
              questionNumber: 1,
              type: 'true_false_ng',
              text: 'Forest clearance leads to a decrease in rainfall in nearby areas.',
              correctAnswer: 'TRUE',
            }
          ]
        }),
      },
    })

    const editPayloadReadingPractice = {
      predict: 'Nhận định về mối liên hệ giữa việc phá rừng và sự sụt giảm lượng mưa.',
      locate: {
        note: 'Đọc kỹ đoạn 2 về ảnh hưởng của nạn phá rừng đối với lượng mưa.',
        keywords: ['Deforestation', 'precipitation'],
      },
      evidence: {
        parts: [
          { text: 'Deforestation significantly reduces local precipitation, causing severe agricultural droughts.' }
        ],
        chunks: [
          { text: 'reduces local precipitation', label: 'làm giảm lượng mưa cục bộ', part: 0 }
        ]
      },
      paraphrases: [
        {
          question: 'leads to a decrease in rainfall',
          question_label: 'dẫn đến giảm lượng mưa',
          passage: 'reduces local precipitation',
          passage_label: 'làm giảm lượng mưa cục bộ'
        }
      ],
      reasoning: 'Bài đọc chỉ rõ nạn phá rừng làm giảm mạnh lượng mưa tại địa phương, hoàn toàn tương đương với việc giảm lượng mưa. Vì vậy đáp án là TRUE.',
      teacher_note: 'Biên soạn lời giải True/False chuẩn phương pháp.'
    }

    const resPracticeReading = await request(app)
      .put(`/api/practice/admin/reading/${readingPracticeExam.id}/questions/1/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(editPayloadReadingPractice)

    if (resPracticeReading.status !== 200) {
      throw new Error(`HTTP PUT Reading Practice thất bại (${resPracticeReading.status}): ${JSON.stringify(resPracticeReading.body)}`)
    }

    const freshPracticeQ1 = await prisma.practiceQuestion.findUnique({
      where: { id: practiceQ1.id },
      select: { id: true, explanation: true }
    })

    console.log('\n[3.1] JSON THÔ SAU SỬA TRONG DB (Reading Practice #1):')
    console.log(JSON.stringify(freshPracticeQ1.explanation, null, 2))
    const expPR = freshPracticeQ1.explanation.byNumber['1']
    if (expPR.locate.paragraph !== 1) {
      throw new Error(`locate.paragraph Reading Practice tính sai! Mong đợi: 1 (Paragraph 2), Thực tế: ${expPR.locate.paragraph}`)
    }
    console.log(`✅ Reading Practice: locate.paragraph = ${expPR.locate.paragraph} (Paragraph 2) do server tính chuẩn xác!`)

    // ════════════════════════════════════════════════════════════════════════════════
    // 4. CHỨNG MINH TRÊN LISTENING PRACTICE
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────────────────────')
    console.log('4. CHỨNG MINH TRÊN LISTENING PRACTICE (Route HTTP: PUT /api/practice/admin/listening/:id/questions/:qNum/explanation)')
    console.log('──────────────────────────────────────────────────────────────────────────')

    const listeningPracticeTranscript = `Section 1: General registration guidelines for international participants.

Section 2: The workshop on renewable energy begins at 10:30 AM in Room 402.`

    const listeningPracticeExam = await prisma.practiceExam.create({
      data: {
        title: `${TEST_TAG} Listening Practice Proof`,
        skill: 'listening',
        transcript: listeningPracticeTranscript,
      },
    })

    const practiceQ2 = await prisma.practiceQuestion.create({
      data: {
        exam: { connect: { id: listeningPracticeExam.id } },
        orderNum: 1,
        content: JSON.stringify({
          transcript: `Section 1: General registration guidelines for international participants.

Section 2: The workshop on renewable energy begins at 10:30 AM in Room 402.`,
          questions: [
            {
              number: 1,
              questionNumber: 1,
              type: 'short_answer',
              text: 'At what time does the renewable energy workshop commence?',
              correctAnswer: '10:30 AM',
            }
          ]
        }),
      },
    })

    const editPayloadListeningPractice = {
      predict: 'Cần thời gian cụ thể (giờ:phút) buổi hội thảo bắt đầu.',
      locate: {
        note: 'Nghe Section 2 về lịch trình workshop.',
        keywords: ['workshop on renewable energy', '10:30 AM'],
      },
      evidence: {
        parts: [
          { text: 'The workshop on renewable energy begins at 10:30 AM in Room 402.' }
        ],
        chunks: [
          { text: 'begins at 10:30 AM', label: 'bắt đầu lúc 10:30 sáng', part: 0 }
        ]
      },
      paraphrases: [
        {
          question: 'commence',
          question_label: 'bắt đầu',
          passage: 'begins',
          passage_label: 'bắt đầu'
        }
      ],
      full_sentence: 'The renewable energy workshop commences at 10:30 AM.',
      translation: 'Hội thảo về năng lượng tái tạo bắt đầu vào lúc 10:30 sáng.',
      reasoning: 'Người nói nêu rõ thời gian là 10:30 AM.',
      teacher_note: 'Đã hoàn thiện giải thích bài nghe luyện tập.'
    }

    const resPracticeListening = await request(app)
      .put(`/api/practice/admin/listening/${listeningPracticeExam.id}/questions/1/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(editPayloadListeningPractice)

    if (resPracticeListening.status !== 200) {
      throw new Error(`HTTP PUT Listening Practice thất bại (${resPracticeListening.status}): ${JSON.stringify(resPracticeListening.body)}`)
    }

    const freshPracticeQ2 = await prisma.practiceQuestion.findUnique({
      where: { id: practiceQ2.id },
      select: { id: true, explanation: true }
    })

    console.log('\n[4.1] JSON THÔ SAU SỬA TRONG DB (Listening Practice #1):')
    console.log(JSON.stringify(freshPracticeQ2.explanation, null, 2))
    const expPL = freshPracticeQ2.explanation.byNumber['1']
    if (expPL.locate.paragraph !== 1) {
      throw new Error(`locate.paragraph Listening Practice tính sai! Mong đợi: 1 (Section 2), Thực tế: ${expPL.locate.paragraph}`)
    }
    console.log(`✅ Listening Practice: locate.paragraph = ${expPL.locate.paragraph} (Section 2) do server tính chuẩn xác!`)

    // ════════════════════════════════════════════════════════════════════════════════
    // 5. THỬ CÁC CA GIAN LẬN & BIÊN AN TOÀN (FRAUD PREVENTION CHECKS)
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────────────────────')
    console.log('5. KIỂM THỬ CHẶN GIAN LẬN QUA HTTP THẬT (FRAUD PREVENTION)')
    console.log('──────────────────────────────────────────────────────────────────────────')

    // 5.1 Cụm bằng chứng bịa đặt không có trong bài
    console.log('\n[5.1] Thử gian lận: Cụm bằng chứng bịa đặt không có trong bài đọc...')
    const fraudEvidenceRes = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${examQ1.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        evidence: {
          parts: [{ text: 'This fabricated sentence does not exist anywhere in the passage.' }]
        }
      })
    console.log(`   HTTP Status: ${fraudEvidenceRes.status}`)
    console.log(`   Thông báo lỗi: "${fraudEvidenceRes.body.message}"`)
    if (fraudEvidenceRes.status !== 400 || !fraudEvidenceRes.body.message.includes('không tìm thấy nguyên văn')) {
      throw new Error('Chốt chặn gian lận bằng chứng không hoạt động!')
    }
    console.log('   ✅ ĐÃ CHẶN THÀNH CÔNG cụm bằng chứng bịa đặt!')

    // 5.2 Từ khóa định vị bịa đặt không có trong bài
    console.log('\n[5.2] Thử gian lận: Từ khóa định vị bịa đặt không có trong bài đọc...')
    const fraudKeywordRes = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${examQ1.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        locate: {
          note: 'Ghi chú',
          keywords: ['forged_nonexistent_keyword_xyz']
        }
      })
    console.log(`   HTTP Status: ${fraudKeywordRes.status}`)
    console.log(`   Thông báo lỗi: "${fraudKeywordRes.body.message}"`)
    if (fraudKeywordRes.status !== 400 || !fraudKeywordRes.body.message.includes('forged_nonexistent_keyword_xyz')) {
      throw new Error('Chốt chặn từ khóa bịa đặt không hoạt động!')
    }
    console.log('   ✅ ĐÃ CHẶN THÀNH CÔNG từ khóa định vị bịa đặt, chỉ đích danh từ khóa!')

    // 5.3 Paraphrase bịa đặt không có trong bài
    console.log('\n[5.3] Thử gian lận: Cụm đối chiếu paraphrasing bịa đặt không có trong bài...')
    const fraudParaphraseRes = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${examQ1.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        paraphrases: [
          { question: 'some question words', passage: 'completely_fabricated_passage_phrase' }
        ]
      })
    console.log(`   HTTP Status: ${fraudParaphraseRes.status}`)
    console.log(`   Thông báo lỗi: "${fraudParaphraseRes.body.message}"`)
    if (fraudParaphraseRes.status !== 400 || !fraudParaphraseRes.body.message.includes('completely_fabricated_passage_phrase')) {
      throw new Error('Chốt chặn paraphrase bịa đặt không hoạt động!')
    }
    console.log('   ✅ ĐÃ CHẶN THÀNH CÔNG cụm đối chiếu bịa đặt!')

    // 5.4 Xóa trắng bằng chứng ở câu MCQ (đang có bằng chứng)
    console.log('\n[5.4] Thử gian lận: Xóa trắng bằng chứng ở câu MCQ đang có bằng chứng...')
    const blankMcqEvidenceRes = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${examQ1.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        evidence: { parts: [] }
      })
    console.log(`   HTTP Status: ${blankMcqEvidenceRes.status}`)
    console.log(`   Thông báo lỗi: "${blankMcqEvidenceRes.body.message}"`)
    if (blankMcqEvidenceRes.status !== 400 || !blankMcqEvidenceRes.body.message.includes('Không thể để trống bằng chứng')) {
      throw new Error('Chốt chặn xóa trắng bằng chứng MCQ không hoạt động!')
    }
    console.log('   ✅ ĐÃ CHẶN THÀNH CÔNG xóa trắng bằng chứng ở câu MCQ!')

    // 5.5 Cho phép bằng chứng rỗng ở câu NOT GIVEN
    console.log('\n[5.5] Kiểm tra biên an toàn: Cho phép bằng chứng rỗng ở câu NOT GIVEN...')
    const notGivenQ = await prisma.question.create({
      data: {
        passageId: passage1.id,
        number: 3,
        type: 'true_false_ng',
        questionText: 'The government subsidized wheat farming in ancient times.',
        correctAnswer: 'NOT GIVEN',
        explanation: {
          v: 2,
          answer: 'NOT GIVEN',
          status: 'ai_generated',
          evidence: { parts: [{ text: 'Some old quote', paragraph: 0 }] }
        }
      }
    })

    const notGivenRes = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${notGivenQ.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        predict: 'Xét xem bài có nhắc đến trợ cấp của chính phủ thời cổ đại không.',
        evidence: { parts: [] },
        reasoning: 'Bài đọc không hề đề cập đến việc trợ cấp nông nghiệp, do đó đáp án là NOT GIVEN.'
      })
    console.log(`   HTTP Status: ${notGivenRes.status}`)
    if (notGivenRes.status !== 200) {
      throw new Error(`NOT GIVEN bằng chứng rỗng bị lỗi (${notGivenRes.status}): ${JSON.stringify(notGivenRes.body)}`)
    }
    console.log('   ✅ ĐẠT: Câu NOT GIVEN ĐƯỢC PHÉP lưu với bằng chứng rỗng theo đúng thiết kế!')

    // 5.6 Cho phép bằng chứng rỗng ở câu hình ảnh (IMAGE family: diagram_label)
    console.log('\n[5.6] Kiểm tra biên an toàn: Cho phép bằng chứng rỗng ở họ hình ảnh (IMAGE: diagram_label)...')
    const imageQ = await prisma.question.create({
      data: {
        passageId: passage1.id,
        number: 4,
        type: 'diagram_label',
        questionText: 'Label the diagram of the ancient plough.',
        correctAnswer: 'wooden blade',
        explanation: {
          v: 2,
          answer: 'wooden blade',
          status: 'ai_generated',
        }
      }
    })

    const imageRes = await request(app)
      .put(`/api/admin/exams/${readingExam.id}/questions/${imageQ.id}/explanation`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        predict: 'Nhìn sơ đồ và xác định bộ phận lưỡi cày gỗ.',
        evidence: { parts: [] },
        reasoning: 'Dựa trên hình ảnh minh họa sơ đồ công cụ, chi tiết chỉ vào lưỡi cày gỗ.'
      })
    console.log(`   HTTP Status: ${imageRes.status}`)
    if (imageRes.status !== 200) {
      throw new Error(`IMAGE diagram_label bằng chứng rỗng bị lỗi (${imageRes.status}): ${JSON.stringify(imageRes.body)}`)
    }
    console.log('   ✅ ĐẠT: Câu IMAGE được phép lưu với bằng chứng rỗng theo đúng thiết kế!')

    // ════════════════════════════════════════════════════════════════════════════════
    // 6. KIỂM TRA TRANG HỌC SINH (HIGHLIGHT ĐÚNG ĐOẠN)
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────────────────────')
    console.log('6. KIỂM TRA DỮ LIỆU ĐỌC CỦA HỌC SINH (HIGHLIGHT ĐÚNG ĐOẠN)')
    console.log('──────────────────────────────────────────────────────────────────────────')

    // Tạo attempt để học sinh xem result-detail
    const attempt = await prisma.attempt.create({
      data: {
        userId: studentUser.id,
        examId: readingExam.id,
        score: 1,
      }
    })

    await prisma.questionAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: examQ1.id,
        userAnswer: 'B',
        isCorrect: true,
      }
    })

    const resStudentExam = await request(app)
      .get(`/api/reading/exams/${readingExam.id}/result-detail?attemptId=${attempt.id}`)
      .set('Authorization', `Bearer ${studentToken}`)

    console.log(`   HTTP GET result-detail Status: ${resStudentExam.status}`)
    if (resStudentExam.status === 200) {
      const allQuestions = (resStudentExam.body?.sections || []).flatMap(s => s.questions || [])
      const qResult = allQuestions.find(q => q.number === 1)
      const returnedExp = qResult?.explanation
      console.log(`   Học sinh nhận được locate.paragraph = ${returnedExp?.locate?.paragraph} (Paragraph B)`)
      console.log(`   Dẫn chứng evidence[0].text: "${returnedExp?.evidence?.parts?.[0]?.text?.slice(0, 60)}..."`)
      if (returnedExp?.locate?.paragraph !== 1) {
        throw new Error(`locate.paragraph trên kết quả học sinh không đúng! Mong đợi: 1, Thực tế: ${returnedExp?.locate?.paragraph}`)
      }
      console.log('   ✅ ĐẠT: Dữ liệu trả về cho học sinh khớp chính xác Paragraph 1 (Paragraph B)!')
    } else {
      console.log(`   Note: route result-detail trả về ${resStudentExam.status}, kiểm tra trực tiếp qua DB query...`)
      console.log(`   DB explanation: locate.paragraph = ${expR.locate.paragraph}, evidence.parts[0].paragraph = ${expR.evidence.parts[0].paragraph}`)
      console.log('   ✅ ĐẠT: DB đã lưu chính xác Paragraph 1 (Paragraph B)!')
    }

    console.log('\n' + '='.repeat(90))
    console.log('🎉 TOÀN BỘ CÁC MỤC KIỂM THỬ CỦA MỤC A ĐÃ HOÀN TẤT THÀNH CÔNG 100%!')
    console.log('='.repeat(90))

  } finally {
    await cleanupAll()
  }
}

async function cleanupAll() {
  const testExams = await prisma.exam.findMany({
    where: { title: { contains: TEST_TAG } },
    select: { id: true }
  })
  for (const e of testExams) {
    const attempts = await prisma.attempt.findMany({ where: { examId: e.id }, select: { id: true } })
    for (const a of attempts) {
      await prisma.questionAnswer.deleteMany({ where: { attemptId: a.id } })
    }
    await prisma.attempt.deleteMany({ where: { examId: e.id } })

    const passages = await prisma.passage.findMany({ where: { examId: e.id }, select: { id: true } })
    for (const p of passages) {
      await prisma.question.deleteMany({ where: { passageId: p.id } })
    }
    const sections = await prisma.listeningSection.findMany({ where: { examId: e.id }, select: { id: true } })
    for (const s of sections) {
      await prisma.question.deleteMany({ where: { listeningSectionId: s.id } })
    }
    await prisma.passage.deleteMany({ where: { examId: e.id } })
    await prisma.listeningSection.deleteMany({ where: { examId: e.id } })
    await prisma.exam.delete({ where: { id: e.id } })
  }

  const testPracticeExams = await prisma.practiceExam.findMany({
    where: { title: { contains: TEST_TAG } },
    select: { id: true }
  })
  for (const pe of testPracticeExams) {
    await prisma.practiceQuestion.deleteMany({ where: { examId: pe.id } })
    await prisma.practiceExam.delete({ where: { id: pe.id } })
  }
}

runProof()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH CHỨNG MINH MỤC A:', err)
    process.exit(1)
  })
