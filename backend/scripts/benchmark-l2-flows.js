'use strict'

const { printDbBanner } = require('../lib/dbInfo')
const prisma = require('../lib/prisma')
const {
  regenerateQuestionExplanation,
  isAnswerMatch,
} = require('../services/explanationGeneratorService')

// ─── CHỐT AN TOÀN: CHỈ CHẠY TRÊN DB DEV (127.0.0.1:5433) ──────────────────────
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('\n❌ LỖI AN TOÀN BẮT BUỘC:')
  console.error('Benchmark L2 CHỈ được phép chạy trên DB dev (127.0.0.1:5433).')
  console.error('DATABASE_URL hiện tại:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : '(rỗng)')
  console.error('Dừng thực thi ngay lập tức để bảo vệ dữ liệu!')
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── DỮ LIỆU ĐỌC & NGHE THẬT CHO BENCHMARK ──────────────────────────────────
const EKMAN_PASSAGE = `Paragraph B: Paul Ekman became interested in lying after a question from his students. Clinical observations showed that patients frequently concealed symptoms, but it was his students who asked whether deceptive facial expressions could be systematically detected.`

const GLASSMAKING_PASSAGE = `The discovery of glassmaking dates back at least to 2500 BC in Mesopotamia and Egypt. Early glass was an opaque substance used for beads and small vessels. The raw materials used were silica (usually quartz sand), alkali, and lime.
During the Roman Empire, glassmaking underwent a revolutionary transformation with the invention of glassblowing around the 1st century BC on the Syro-Palestinian coast. This breakthrough allowed craftsmen to produce hollow glass vessels quickly, thinly, and in a wide range of shapes.
By the Middle Ages, the Venetian island of Murano had emerged as the preeminent centre of European glass production, celebrated for its exquisite crystalline glass, mirrors, and chandeliers.`

const BIODIVERSITY_PASSAGE = `Paragraph A: Biodiversity is essential for maintaining ecosystem balance. Tropical rainforests harbor over 50 percent of the world's plant and animal species despite covering only six percent of the planet's land area. Deforestation has accelerated species extinction at alarming rates.
Paragraph B: When massive forest tracts are bulldozed or burned, the complex web of interdependent plant and animal species is torn apart. The catastrophic loss of canopy leads directly to rapid soil erosion, dried riverbeds, and the collapse of local microclimates.
Paragraph C: Centuries before modern chemical fertilizers, ancient agriculturalists practiced ingenious techniques of soil enhancement. Indigenous farmers in the Amazon basin deposited charcoal, bone fragments, and nutrient-rich organic waste into the earth, creating fertile dark earth known as terra preta that sustained crops for generations.
Paragraph D: To prevent further ecological catastrophe, international bodies have formulated integrated preservation frameworks for the decades ahead. These systems combine satellite monitoring with legally binding conservation corridors, ensuring that fragmented habitats remain genetically linked and safeguarded.`

const CONFERENCE_TRANSCRIPT = `Welcome everyone to the City Transport Annual Conference. Before we begin the keynote sessions, please ensure you collect your delegate badges from the main foyer. You will find that registration opens daily at 8:30 AM.
Please note that due to audio-visual maintenance in Room 101, all keynote speeches and plenary sessions will take place in Conference Hall B on the second floor. Refreshments will be served at noon.`

const RESEARCH_TRANSCRIPT = `Recent scientific inquiries into memory retention have yielded fascinating insights. Dr. Elizabeth Hayes discovered that short-term visual memory consolidation depends critically on uninterrupted slow-wave sleep cycles. In contrast, Prof. Marcus Vance argued that emotional valence, rather than sleep architecture, is the decisive factor determining which autobiographical events are transferred into long-term cognitive storage.`

// ─── 31 BENCHMARK CASES DEFINITION ──────────────────────────────────────────
const BENCHMARK_CASES = [
  // ── 12 Ca Reading correctAnswer SAI (Cần giáo viên đề xuất đáp án đúng) ──
  {
    id: 'R-SAI-01',
    category: 'Reading SAI',
    type: 'multiple_choice',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'According to the writer, Ekman became interested in lying after a question from his:',
    options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
    storedAnswer: 'peers', // SAI
    proposedAnswer: 'students.', // ĐÚNG
    expectedAiAnswer: 'C', // hoặc 'students'
    mode: 'proposed',
  },
  {
    id: 'R-SAI-02',
    category: 'Reading SAI',
    type: 'mcq',
    passage: GLASSMAKING_PASSAGE,
    skill: 'reading',
    questionText: 'Glassmaking was transformed in the Roman Empire primarily due to the development of:',
    options: ['A. stained glass panels', 'B. glassblowing techniques', 'C. metal furnaces', 'D. chemical dyes'],
    storedAnswer: 'A', // SAI
    proposedAnswer: 'B', // ĐÚNG
    expectedAiAnswer: 'B',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-03',
    category: 'Reading SAI',
    type: 'mcq',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: "Which TWO groups of people are mentioned in connection with Ekman's early observations? Choose TWO letters, A-E.",
    options: ['A. peers', 'B. patients', 'C. students', 'D. teachers', 'E. journalists'],
    storedAnswer: 'A, D', // SAI
    proposedAnswer: 'B, C', // ĐÚNG
    expectedAiAnswer: 'B, C',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-04',
    category: 'Reading SAI',
    type: 'true_false_ng',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'More than half of the world species live in tropical rainforests.',
    options: [],
    storedAnswer: 'FALSE', // SAI
    proposedAnswer: 'TRUE', // ĐÚNG
    expectedAiAnswer: 'TRUE',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-05',
    category: 'Reading SAI',
    type: 'true_false_ng',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Deforestation has had a negligible impact on wildlife survival rates.',
    options: [],
    storedAnswer: 'TRUE', // SAI
    proposedAnswer: 'FALSE', // ĐÚNG
    expectedAiAnswer: 'FALSE',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-06',
    category: 'Reading SAI',
    type: 'true_false_ng',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Soil erosion in rainforests costs national governments billions of dollars annually.',
    options: [],
    storedAnswer: 'TRUE', // SAI
    proposedAnswer: 'NOT GIVEN', // ĐÚNG
    expectedAiAnswer: 'NOT GIVEN',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-07',
    category: 'Reading SAI',
    type: 'yes_no_ng',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'Paul Ekman initial fascination with deception was stimulated by inquiries from his students.',
    options: [],
    storedAnswer: 'NO', // SAI
    proposedAnswer: 'YES', // ĐÚNG
    expectedAiAnswer: 'YES',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-08',
    category: 'Reading SAI',
    type: 'yes_no_ng',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'Patients specifically suggested to Ekman that deceptive expressions could be detected.',
    options: [],
    storedAnswer: 'YES', // SAI
    proposedAnswer: 'NO', // ĐÚNG
    expectedAiAnswer: 'NO',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-09',
    category: 'Reading SAI',
    type: 'yes_no_ng',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'Ekman published his first comprehensive handbook on facial micro-expressions in 1978.',
    options: [],
    storedAnswer: 'YES', // SAI
    proposedAnswer: 'NOT GIVEN', // ĐÚNG
    expectedAiAnswer: 'NOT GIVEN',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-10',
    category: 'Reading SAI',
    type: 'matching_headings',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Choose the correct heading for Paragraph A from the list of headings below.',
    options: [
      'i. The vital importance of ecosystem variety',
      'ii. Ancient methods of soil enrichment',
      'iii. Global effects of industrial expansion',
      'iv. Destruction caused by intensive deforestation',
      'v. Sustainable conservation frameworks for the future',
    ],
    storedAnswer: 'iv', // SAI
    proposedAnswer: 'i', // ĐÚNG
    expectedAiAnswer: 'i',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-11',
    category: 'Reading SAI',
    type: 'matching_headings',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Choose the correct heading for Paragraph B from the list of headings below.',
    options: [
      'i. The vital importance of ecosystem variety',
      'ii. Ancient methods of soil enrichment',
      'iii. Global effects of industrial expansion',
      'iv. Destruction caused by intensive deforestation',
      'v. Sustainable conservation frameworks for the future',
    ],
    storedAnswer: 'i', // SAI
    proposedAnswer: 'iv', // ĐÚNG
    expectedAiAnswer: 'iv',
    mode: 'proposed',
  },
  {
    id: 'R-SAI-12',
    category: 'Reading SAI',
    type: 'fill_blank',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Indigenous farmers enhanced Amazonian soils by adding materials such as bone fragments and [GAP].',
    options: [],
    storedAnswer: 'chemical fertilizers', // SAI
    proposedAnswer: 'charcoal', // ĐÚNG
    expectedAiAnswer: 'charcoal',
    mode: 'proposed',
  },

  // ── 6 Ca Listening correctAnswer SAI ─────────────────────────────────────
  {
    id: 'L-SAI-13',
    category: 'Listening SAI',
    type: 'fill_blank',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Registration desk opening time: [GAP]',
    options: [],
    storedAnswer: '9:00 AM', // SAI
    proposedAnswer: '8:30 AM', // ĐÚNG
    expectedAiAnswer: '8:30 AM',
    mode: 'proposed',
  },
  {
    id: 'L-SAI-14',
    category: 'Listening SAI',
    type: 'fill_blank',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Keynote speeches and plenary sessions have been moved to [GAP] on the second floor.',
    options: [],
    storedAnswer: 'Room 101', // SAI
    proposedAnswer: 'Conference Hall B', // ĐÚNG
    expectedAiAnswer: 'Conference Hall B',
    mode: 'proposed',
  },
  {
    id: 'L-SAI-15',
    category: 'Listening SAI',
    type: 'mcq',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Where will the keynote speeches take place?',
    options: ['A. Room 101', 'B. Conference Hall B', 'C. Main Foyer'],
    storedAnswer: 'A', // SAI
    proposedAnswer: 'B', // ĐÚNG
    expectedAiAnswer: 'B',
    mode: 'proposed',
  },
  {
    id: 'L-SAI-16',
    category: 'Listening SAI',
    type: 'mcq',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Delegates must collect their badges from:',
    options: ['A. Main Foyer', 'B. Room 101', 'C. Second floor'],
    storedAnswer: 'C', // SAI
    proposedAnswer: 'A', // ĐÚNG
    expectedAiAnswer: 'A',
    mode: 'proposed',
  },
  {
    id: 'L-SAI-17',
    category: 'Listening SAI',
    type: 'matching',
    passage: RESEARCH_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Which researcher highlighted the role of emotional valence in memory retention?',
    options: ['A. Dr. Elizabeth Hayes', 'B. Prof. Marcus Vance'],
    storedAnswer: 'A', // SAI
    proposedAnswer: 'B', // ĐÚNG (Prof. Marcus Vance)
    expectedAiAnswer: 'B',
    mode: 'proposed',
  },
  {
    id: 'L-SAI-18',
    category: 'Listening SAI',
    type: 'fill_blank',
    passage: RESEARCH_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Consolidation of visual memories relies heavily on [GAP] cycles.',
    options: [],
    storedAnswer: 'long-term memory', // SAI
    proposedAnswer: 'slow-wave sleep', // ĐÚNG
    expectedAiAnswer: 'slow-wave sleep',
    mode: 'proposed',
  },

  // ── 12 Ca correctAnswer ĐÚNG (Đo xung đột giả trên Luồng X & Luồng Y) ────
  // Luồng X (Chỉ góp ý bằng chữ):
  {
    id: 'R-DUNG-19',
    category: 'Reading ĐÚNG (Luồng X)',
    type: 'mcq',
    passage: GLASSMAKING_PASSAGE,
    skill: 'reading',
    questionText: 'Glassmaking was transformed in the Roman Empire primarily due to the development of:',
    options: ['A. stained glass panels', 'B. glassblowing techniques', 'C. metal furnaces', 'D. chemical dyes'],
    storedAnswer: 'B', // ĐÚNG
    feedback: 'Vui lòng giải thích chi tiết hơn về phát minh glassblowing vào thế kỷ 1 TCN.',
    mode: 'feedback_only',
  },
  {
    id: 'R-DUNG-20',
    category: 'Reading ĐÚNG (Luồng X)',
    type: 'true_false_ng',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'More than half of the world species live in tropical rainforests.',
    options: [],
    storedAnswer: 'TRUE', // ĐÚNG
    feedback: 'Nhấn mạnh số liệu 50 percent trong đoạn A tương đương more than half.',
    mode: 'feedback_only',
  },
  {
    id: 'R-DUNG-21',
    category: 'Reading ĐÚNG (Luồng X)',
    type: 'true_false_ng',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Deforestation has had a negligible impact on wildlife survival rates.',
    options: [],
    storedAnswer: 'FALSE', // ĐÚNG
    feedback: 'Đối chiếu từ negligible với cụm accelerated species extinction at alarming rates.',
    mode: 'feedback_only',
  },
  {
    id: 'R-DUNG-22',
    category: 'Reading ĐÚNG (Luồng X)',
    type: 'yes_no_ng',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'Paul Ekman initial fascination with deception was stimulated by inquiries from his students.',
    options: [],
    storedAnswer: 'YES', // ĐÚNG
    feedback: 'Làm rõ quan hệ giữa question from students và fascination.',
    mode: 'feedback_only',
  },
  {
    id: 'L-DUNG-23',
    category: 'Listening ĐÚNG (Luồng X)',
    type: 'fill_blank',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Registration desk opening time: [GAP]',
    options: [],
    storedAnswer: '8:30 AM', // ĐÚNG
    feedback: 'Giải thích rõ cụm registration opens daily at 8:30 AM trong bài nói.',
    mode: 'feedback_only',
  },
  {
    id: 'L-DUNG-24',
    category: 'Listening ĐÚNG (Luồng X)',
    type: 'mcq',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Where will the keynote speeches take place?',
    options: ['A. Room 101', 'B. Conference Hall B', 'C. Main Foyer'],
    storedAnswer: 'B', // ĐÚNG
    feedback: 'Giải thích lý do bảo trì Room 101 dẫn đến chuyển sang Conference Hall B.',
    mode: 'feedback_only',
  },

  // Luồng Y (Đề xuất đáp án TRÙNG đáp án đang lưu):
  {
    id: 'R-DUNG-25',
    category: 'Reading ĐÚNG (Luồng Y)',
    type: 'mcq',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: "Which TWO groups of people are mentioned in connection with Ekman's early observations? Choose TWO letters, A-E.",
    options: ['A. peers', 'B. patients', 'C. students', 'D. teachers', 'E. journalists'],
    storedAnswer: 'B, C', // ĐÚNG
    proposedAnswer: 'B, C', // TRÙNG ĐANG LƯU
    mode: 'proposed_match',
  },
  {
    id: 'R-DUNG-26',
    category: 'Reading ĐÚNG (Luồng Y)',
    type: 'yes_no_ng',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'Patients specifically suggested to Ekman that deceptive expressions could be detected.',
    options: [],
    storedAnswer: 'NO', // ĐÚNG
    proposedAnswer: 'NO', // TRÙNG ĐANG LƯU
    mode: 'proposed_match',
  },
  {
    id: 'R-DUNG-27',
    category: 'Reading ĐÚNG (Luồng Y)',
    type: 'matching_headings',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Choose the correct heading for Paragraph A from the list of headings below.',
    options: [
      'i. The vital importance of ecosystem variety',
      'ii. Ancient methods of soil enrichment',
      'iii. Global effects of industrial expansion',
      'iv. Destruction caused by intensive deforestation',
      'v. Sustainable conservation frameworks for the future',
    ],
    storedAnswer: 'i', // ĐÚNG
    proposedAnswer: 'i', // TRÙNG ĐANG LƯU
    mode: 'proposed_match',
  },
  {
    id: 'R-DUNG-28',
    category: 'Reading ĐÚNG (Luồng Y)',
    type: 'fill_blank',
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    questionText: 'Indigenous farmers enhanced Amazonian soils by adding materials such as bone fragments and [GAP].',
    options: [],
    storedAnswer: 'charcoal', // ĐÚNG
    proposedAnswer: 'charcoal', // TRÙNG ĐANG LƯU
    mode: 'proposed_match',
  },
  {
    id: 'L-DUNG-29',
    category: 'Listening ĐÚNG (Luồng Y)',
    type: 'fill_blank',
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Keynote speeches and plenary sessions have been moved to [GAP] on the second floor.',
    options: [],
    storedAnswer: 'Conference Hall B', // ĐÚNG
    proposedAnswer: 'Conference Hall B', // TRÙNG ĐANG LƯU
    mode: 'proposed_match',
  },
  {
    id: 'L-DUNG-30',
    category: 'Listening ĐÚNG (Luồng Y)',
    type: 'fill_blank',
    passage: RESEARCH_TRANSCRIPT,
    skill: 'listening',
    questionText: 'Consolidation of visual memories relies heavily on [GAP] cycles.',
    options: [],
    storedAnswer: 'slow-wave sleep', // ĐÚNG
    proposedAnswer: 'slow-wave sleep', // TRÙNG ĐANG LƯU
    mode: 'proposed_match',
  },

  // ── 1 Ca Giả lập Fallback (Groq fallback khi Gemini lỗi) ──────────────────
  {
    id: 'FB-SIM-31',
    category: 'Giả lập Fallback',
    type: 'mcq',
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    questionText: 'According to the writer, Ekman became interested in lying after a question from his:',
    options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
    storedAnswer: 'peers', // SAI
    proposedAnswer: 'students.', // ĐÚNG
    mode: 'simulate_fallback',
  },
]

async function runBenchmark() {
  printDbBanner()
  console.log('='.repeat(80))
  console.log('🚀 KHỞI ĐỘNG BENCHMARK THÔ L2 — SỐ ĐO THẬT VỚI GOOGLE GEMINI TRÊN DEV DB')
  console.log('='.repeat(80))

  const TEST_MARKER = '[TEST-BENCHMARK-L2]'
  const results = []

  // Bước 1: Dọn sạch mọi dữ liệu test cũ nếu có
  console.log('\n[1/4] Dọn sạch dữ liệu test cũ...')
  await cleanupTestData(TEST_MARKER)

  // Bước 2: Tạo Exam và Questions thật trong Dev DB
  console.log('\n[2/4] Khởi tạo Exam & Questions thật trong Postgres Dev...')
  const exam = await prisma.exam.create({
    data: {
      title: `${TEST_MARKER} Benchmark L2 Test Exam`,
      skill: 'reading',
    },
  })

  const passage = await prisma.passage.create({
    data: {
      examId: exam.id,
      number: 1,
      title: 'Benchmark Passage',
      body: 'See question level passages',
    },
  })

  // Tạo toàn bộ 31 questions trong DB
  const createdQuestions = {}
  for (const c of BENCHMARK_CASES) {
    const q = await prisma.question.create({
      data: {
        passageId: passage.id,
        number: parseInt(c.id.replace(/\D/g, ''), 10),
        type: c.type,
        questionText: c.questionText,
        correctAnswer: c.storedAnswer,
        options: c.options && c.options.length ? JSON.stringify(c.options) : null,
        explanation: null,
      },
    })
    createdQuestions[c.id] = q
  }
  console.log(`Đã tạo thành công ${BENCHMARK_CASES.length} câu hỏi test với ID đề #${exam.id}.`)

  // Bước 3: Chạy từng case với Gemini thật
  console.log('\n[3/4] Bắt đầu chạy đo từng ca qua regenerateQuestionExplanation (Gemini Thật)...')
  let falseConflictCount = 0
  let unauthorizedAnswerChangeCount = 0
  let unauthorizedWrongExplanationSavedCount = 0

  for (let i = 0; i < BENCHMARK_CASES.length; i++) {
    const c = BENCHMARK_CASES[i]
    const qDb = createdQuestions[c.id]
    const startTime = Date.now()

    console.log(`\n── [${i + 1}/${BENCHMARK_CASES.length}] Đang chạy ${c.id}: ${c.category} (${c.type}) ──`)
    console.log(`   Đáp án lưu trong DB: "${c.storedAnswer}"`)
    if (c.proposedAnswer) console.log(`   Đáp án đề xuất:      "${c.proposedAnswer}"`)
    if (c.feedback) console.log(`   Góp ý bằng chữ:      "${c.feedback}"`)

    // Gán passage tương ứng vào passage body của DB để service đọc
    await prisma.passage.update({
      where: { id: passage.id },
      data: { body: c.passage },
    })

    // Reset lại câu hỏi về trạng thái ban đầu
    await prisma.question.update({
      where: { id: qDb.id },
      data: {
        correctAnswer: c.storedAnswer,
        explanation: null,
      },
    })

    let res
    let retryCount = 0
    let provider = 'Gemini'
    let durationMs = 0

    try {
      if (c.mode === 'simulate_fallback') {
        // Giả lập ca Gemini lỗi hoàn toàn, rơi vào fallback:
        // Mock solveBlindWithGeminiRetry trả về FALLBACK_NOT_ALLOWED
        const originalFetch = global.fetch
        try {
          // Buộc Gemini ném lỗi để kiểm tra chốt an toàn Fallback Blocking
          global.fetch = async () => {
            throw new Error('Simulated Gemini 503 Service Unavailable')
          }
          res = await regenerateQuestionExplanation({
            examId: exam.id,
            questionId: qDb.id,
            isPractice: false,
            proposedAnswer: c.proposedAnswer,
            confirmChangeAnswer: false,
          })
        } finally {
          global.fetch = originalFetch
        }
      } else if (c.mode === 'feedback_only') {
        res = await regenerateQuestionExplanation({
          examId: exam.id,
          questionId: qDb.id,
          isPractice: false,
          teacherFeedback: c.feedback,
          confirmChangeAnswer: false,
        })
      } else {
        // proposed or proposed_match
        res = await regenerateQuestionExplanation({
          examId: exam.id,
          questionId: qDb.id,
          isPractice: false,
          proposedAnswer: c.proposedAnswer,
          confirmChangeAnswer: false,
        })
      }
    } catch (err) {
      res = { ok: false, error: 'EXCEPTION', message: err.message }
    }

    durationMs = Date.now() - startTime

    // Đọc lại DB để kiểm tra DB có bị sửa lén không
    const freshQ = await prisma.question.findUnique({
      where: { id: qDb.id },
      select: { correctAnswer: true, explanation: true },
    })
    const finalStoredAnswer = freshQ.correctAnswer
    const explanationSaved = freshQ.explanation

    // Phân tích kết quả
    const aiBlindAnswer = res.aiBlindAnswer || res.explanation?.answer || 'N/A'
    const finalStatus = res.status || (res.requiresConfirmation ? 'requires_confirmation' : (res.conflict ? 'conflict' : (res.ok ? 'success' : 'failed')))

    // Kiểm tra các chốt an toàn bắt buộc:
    // 1. Không đổi correctAnswer khi confirmChangeAnswer = false
    if (finalStoredAnswer !== c.storedAnswer) {
      unauthorizedAnswerChangeCount++
      console.error(`❌ VI PHẠM: correctAnswer trong DB bị đổi từ "${c.storedAnswer}" thành "${finalStoredAnswer}" khi chưa có confirm!`)
    }

    // 2. Không lưu lời giải ủng hộ đáp án sai khi chưa có confirm
    if (explanationSaved && c.category.includes('SAI')) {
      unauthorizedWrongExplanationSavedCount++
      console.error(`❌ VI PHẠM: Lời giải đã bị lưu vào DB khi chưa có confirm!`)
    }

    // 3. Đo xung đột giả trên ca ĐÚNG
    let isFalseConflict = false
    if (c.category.includes('ĐÚNG')) {
      if (res.conflict === true || res.isConflict === true) {
        isFalseConflict = true
        falseConflictCount++
        console.error(`❌ XUNG ĐỘT GIẢ: Ca đúng "${c.storedAnswer}" bị báo conflict! AI ra: "${aiBlindAnswer}"`)
      }
    }

    console.log(`   ⏱ Thời gian:         ${(durationMs / 1000).toFixed(2)}s`)
    console.log(`   🤖 AI giải mù:       "${aiBlindAnswer}"`)
    console.log(`   📌 Trạng thái cuối:  ${finalStatus}`)
    console.log(`   🔒 correctAnswer DB: "${finalStoredAnswer}" (Giữ nguyên: ${finalStoredAnswer === c.storedAnswer ? '✅' : '❌'})`)

    results.push({
      id: c.id,
      category: c.category,
      type: c.type,
      storedAnswer: c.storedAnswer,
      proposedAnswer: c.proposedAnswer || '(None - Feedback)',
      aiBlindAnswer,
      provider: c.mode === 'simulate_fallback' ? 'Simulated Fallback' : provider,
      retries: retryCount,
      status: finalStatus,
      finalStoredAnswer,
      durationSec: (durationMs / 1000).toFixed(2),
      isFalseConflict,
      safeAnswerPreserved: finalStoredAnswer === c.storedAnswer,
    })

    // Khoảng nghỉ 1.5s giữa các lượt để giữ nhịp tốc độ API
    await sleep(1500)
  }

  // Bước 4: In Bảng kết quả tổng hợp
  console.log('\n' + '='.repeat(100))
  console.log('📊 BẢNG TỔNG HỢP KẾT QUẢ BENCHMARK THÔ L2 (GEMINI THẬT)')
  console.log('='.repeat(100))

  console.log('| ID | Danh mục | Loại câu | Đáp án lưu | Đề xuất | AI giải mù | Provider | Trạng thái | Đ.án cuối DB | Thời gian |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    console.log(`| ${r.id} | ${r.category} | ${r.type} | ${r.storedAnswer} | ${r.proposedAnswer} | ${r.aiBlindAnswer} | ${r.provider} | ${r.status} | ${r.finalStoredAnswer} | ${r.durationSec}s |`)
  }

  console.log('\n' + '='.repeat(100))
  console.log('📈 TỔNG KẾT CHỈ SỐ AN TOÀN & ĐỘ CHÍNH XÁC L2:')
  console.log(`• Tổng số ca đã đo:                              ${results.length}`)
  console.log(`• Ca lưu lời giải ủng hộ đáp án sai (khi chưa confirm): ${unauthorizedWrongExplanationSavedCount} (Yêu cầu: 0)`)
  console.log(`• Ca tự tiện đổi correctAnswer (khi chưa confirm):      ${unauthorizedAnswerChangeCount} (Yêu cầu: 0)`)
  console.log(`• Ca Xung đột giả trên đề đúng:                  ${falseConflictCount} (Yêu cầu: 0)`)
  console.log(`• Tỷ lệ xung đột giả:                            ${((falseConflictCount / 12) * 100).toFixed(1)}%`)
  console.log('='.repeat(100))

  // Bước 5: Dọn sạch dữ liệu test [TEST]
  console.log('\n[4/4] Dọn sạch dữ liệu test trong DB...')
  await cleanupTestData(TEST_MARKER)
  const remainingCount = await prisma.exam.count({
    where: { title: { contains: TEST_MARKER } },
  })
  console.log(`Số bản ghi [TEST] còn sót lại trong DB: ${remainingCount} (Yêu cầu: 0)`)

  // Trả về báo cáo
  return {
    results,
    unauthorizedWrongExplanationSavedCount,
    unauthorizedAnswerChangeCount,
    falseConflictCount,
    remainingCount,
  }
}

async function cleanupTestData(marker) {
  const testExams = await prisma.exam.findMany({
    where: { title: { contains: marker } },
    select: { id: true },
  })
  for (const e of testExams) {
    const passages = await prisma.passage.findMany({ where: { examId: e.id }, select: { id: true } })
    for (const p of passages) {
      await prisma.question.deleteMany({ where: { passageId: p.id } })
    }
    await prisma.passage.deleteMany({ where: { examId: e.id } })
    await prisma.exam.delete({ where: { id: e.id } })
  }
}

if (require.main === module) {
  runBenchmark()
    .then((summary) => {
      console.log('\n✅ Hoàn thành script benchmark L2!')
      if (summary.unauthorizedWrongExplanationSavedCount > 0 || summary.unauthorizedAnswerChangeCount > 0) {
        console.error('❌ PHÁT HIỆN LỖI AN TOÀN NGHIÊM TRỌNG! DỪNG LẠI!')
        process.exit(1)
      }
      process.exit(0)
    })
    .catch((err) => {
      console.error('Lỗi khi chạy benchmark:', err)
      process.exit(1)
    })
}

module.exports = { runBenchmark }
