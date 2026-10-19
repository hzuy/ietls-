'use strict'

const { printDbBanner } = require('../lib/dbInfo')
const {
  classifyFamily,
  generateExplanation,
} = require('./generate-explanations')
const {
  isAnswerMatch,
  containsInternalJargon,
} = require('../services/explanationGeneratorService')
const groqClient = require('../lib/groqClient')
const prisma = require('../lib/prisma')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Kiểm tra an toàn: script này CHỈ chạy trên DB dev
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('LỖI AN TOÀN: Benchmark CHỈ được chạy trên DB dev (127.0.0.1:5433). Dừng ngay lập tức!')
  process.exit(1)
}

// ─── DỮ LIỆU BÀI ĐỌC & TRANSCRIPT MẪU CHO BENCHMARK ───────────────────────────
const EKMAN_PASSAGE = `Paragraph B: Paul Ekman became interested in lying after a question from his students. Clinical observations showed that patients frequently concealed symptoms, but it was his students who asked whether deceptive facial expressions could be systematically detected.`

const GLASSMAKING_PASSAGE = `The discovery of glassmaking dates back at least to 2500 BC in Mesopotamia and Egypt. Early glass was an opaque substance used for beads and small vessels. The raw materials used were silica (usually quartz sand), alkali, and lime.
During the Roman Empire, glassmaking underwent a revolutionary transformation with the invention of glassblowing around the 1st century BC on the Syro-Palestinian coast. This breakthrough allowed craftsmen to produce hollow glass vessels quickly, thinly, and in a wide range of shapes.
By the Middle Ages, the Venetian island of Murano had emerged as the preeminent centre of European glass production, celebrated for its exquisite crystalline glass, mirrors, and chandeliers.`

const BIODIVERSITY_PASSAGE = `Paragraph A: Biodiversity is essential for maintaining ecosystem balance. Tropical rainforests harbor over 50 percent of the world's plant and animal species despite covering only six percent of the planet's land area. Deforestation has accelerated species extinction at alarming rates.
Paragraph B: When massive forest tracts are bulldozed or burned, the complex web of interdependent plant and animal species is torn apart. The catastrophic loss of canopy leads directly to rapid soil erosion, dried riverbeds, and the collapse of local microclimates.
Paragraph C: Centuries before modern chemical fertilizers, ancient agriculturalists practiced ingenious techniques of soil enhancement. Indigenous farmers in the Amazon basin deposited charcoal, bone fragments, and nutrient-rich organic waste into the earth, creating fertile dark earth known as terra preta that sustained crops for generations.
Paragraph D: To prevent further ecological catastrophe, international bodies have formulated integrated preservation frameworks for the decades ahead. These systems combine satellite monitoring with legally binding conservation corridors, ensuring that fragmented habitats remain genetically linked and safeguarded.
Paragraph E: The surge in global industrial manufacturing over the past century has generated environmental consequences reaching far beyond factory perimeters. Greenhouse gas emissions have altered atmospheric dynamics, acidifying oceanic habitats and disturbing long-established migratory patterns worldwide.`

const RESEARCHERS_PASSAGE = `Recent scientific inquiries into memory retention have yielded fascinating insights. Dr. Elizabeth Hayes discovered that short-term visual memory consolidation depends critically on uninterrupted slow-wave sleep cycles. In contrast, Prof. Marcus Vance argued that emotional valence, rather than sleep architecture, is the decisive factor determining which autobiographical events are transferred into long-term cognitive storage.`

const CONFERENCE_TRANSCRIPT = `Welcome everyone to the City Transport Annual Conference. Before we begin the keynote sessions, please ensure you collect your delegate badges from the main foyer. You will find that registration opens daily at 8:30 AM.
Please note that due to audio-visual maintenance in Room 101, all keynote speeches and plenary sessions will take place in Conference Hall B on the second floor.`

// ─── BỘ BENCHMARK MỞ RỘNG (21 TEST CASES × 3 RUNS = 63 ĐÚNG, 76 SAI CỐ TÌNH) ────
const BENCHMARK_CASES = [
  // 1. MCQ đơn — ca Ekman "students."
  {
    type: 'mcq',
    typeName: 'MCQ (đơn — ca Ekman "students.")',
    isEkmanQ1: true,
    q: {
      number: 1,
      type: 'mcq',
      questionText: 'According to the writer, Ekman became interested in lying after a question from his:',
      options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
    },
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    correctAnswer: 'students.', // Có dấu chấm cuối theo đề bài Ekman
    deliberateWrong: ['peers', 'patients', 'teachers'],
  },
  // 2. MCQ đơn — Glassmaking Roman invention
  {
    type: 'mcq',
    typeName: 'MCQ (đơn — Glassmaking Roman invention)',
    q: {
      number: 2,
      type: 'mcq',
      questionText: 'Glassmaking was transformed in the Roman Empire primarily due to the development of:',
      options: ['A. stained glass panels', 'B. glassblowing techniques', 'C. metal furnaces', 'D. chemical dyes'],
    },
    passage: GLASSMAKING_PASSAGE,
    skill: 'reading',
    correctAnswer: 'B',
    deliberateWrong: ['A', 'C', 'D'],
  },
  // 3. MCQ multi (nhiều đáp án) — Ekman early observations
  {
    type: 'mcq_multi',
    typeName: 'MCQ multi (nhiều đáp án — chuẩn & thứ tự ngược)',
    isMcqMulti: true,
    q: {
      number: 3,
      type: 'mcq_multi',
      questionText: "Which TWO groups of people are mentioned in connection with Ekman's early observations? Choose TWO letters, A-E.",
      options: ['A. peers', 'B. patients', 'C. students', 'D. teachers', 'E. journalists'],
    },
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    correctAnswer: 'B, C',
    reversedCorrectAnswer: 'C, B', // Ca "đúng nhưng khác thứ tự" bắt buộc phải khớp
    // 10 biến thể sai: đổi 1 lựa chọn (1-4), thêm thừa (5-6), thiếu (7-8), sai hoàn toàn (9-10)
    deliberateWrong: [
      'A, B',     // 1. Đổi một lựa chọn
      'B, D',     // 2. Đổi một lựa chọn
      'A, C',     // 3. Đổi một lựa chọn
      'C, E',     // 4. Đổi một lựa chọn
      'B, C, D',  // 5. Thêm thừa 1 lựa chọn
      'A, B, C',  // 6. Thêm thừa 2 lựa chọn
      'B',        // 7. Thiếu 1 lựa chọn
      'C',        // 8. Thiếu 1 lựa chọn
      'A, D',     // 9. Sai hoàn toàn
      'D, E',     // 10. Sai hoàn toàn
    ],
  },
  // 4. TFNG 1 — True
  {
    type: 'true_false_ng',
    typeName: 'TFNG (True / False / Not Given — ca TRUE)',
    q: {
      number: 4,
      type: 'true_false_ng',
      questionText: 'More than half of the world species live in tropical rainforests.',
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'TRUE',
    deliberateWrong: ['FALSE', 'NOT GIVEN'],
  },
  // 5. TFNG 2 — False
  {
    type: 'true_false_ng',
    typeName: 'TFNG (True / False / Not Given — ca FALSE)',
    q: {
      number: 5,
      type: 'true_false_ng',
      questionText: 'Deforestation has had a negligible impact on wildlife survival rates.',
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'FALSE',
    deliberateWrong: ['TRUE', 'NOT GIVEN'],
  },
  // 6. TFNG 3 — Not Given
  {
    type: 'true_false_ng',
    typeName: 'TFNG (True / False / Not Given — ca NOT GIVEN)',
    q: {
      number: 6,
      type: 'true_false_ng',
      questionText: 'Soil erosion in rainforests costs national governments billions of dollars annually.',
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'NOT GIVEN',
    deliberateWrong: ['TRUE', 'FALSE'],
  },
  // 7. YNNG 1 — Yes
  {
    type: 'yes_no_ng',
    typeName: 'YNNG (Yes / No / Not Given — ca YES)',
    q: {
      number: 7,
      type: 'yes_no_ng',
      questionText: 'Paul Ekman initial fascination with deception was stimulated by inquiries from his students.',
    },
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    correctAnswer: 'YES',
    deliberateWrong: ['NO', 'NOT GIVEN'],
  },
  // 8. YNNG 2 — No
  {
    type: 'yes_no_ng',
    typeName: 'YNNG (Yes / No / Not Given — ca NO)',
    q: {
      number: 8,
      type: 'yes_no_ng',
      questionText: 'Patients specifically suggested to Ekman that deceptive expressions could be detected.',
    },
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    correctAnswer: 'NO',
    deliberateWrong: ['YES', 'NOT GIVEN'],
  },
  // 9. YNNG 3 — Not Given
  {
    type: 'yes_no_ng',
    typeName: 'YNNG (Yes / No / Not Given — ca NOT GIVEN)',
    q: {
      number: 9,
      type: 'yes_no_ng',
      questionText: 'Ekman published his first comprehensive handbook on facial micro-expressions in 1978.',
    },
    passage: EKMAN_PASSAGE,
    skill: 'reading',
    correctAnswer: 'NOT GIVEN',
    deliberateWrong: ['YES', 'NO'],
  },
  // 10-14. Matching Headings (5 câu liên hoàn: i, iv, ii, v, iii)
  {
    type: 'matching_headings',
    typeName: 'Matching Headings (Paragraph A -> "i")',
    q: {
      number: 10,
      type: 'matching_headings',
      questionText: 'Choose the correct heading for Paragraph A from the list of headings below.',
      options: [
        'i. The vital importance of ecosystem variety',
        'ii. Ancient methods of soil enrichment',
        'iii. Global effects of industrial expansion',
        'iv. Destruction caused by intensive deforestation',
        'v. Sustainable conservation frameworks for the future',
        'vi. Economic challenges in modern agriculture',
        'vii. Technological innovations in weather forecasting',
      ],
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'i',
    deliberateWrong: ['iv', 'ii'],
  },
  {
    type: 'matching_headings',
    typeName: 'Matching Headings (Paragraph B -> "iv")',
    q: {
      number: 11,
      type: 'matching_headings',
      questionText: 'Choose the correct heading for Paragraph B from the list of headings below.',
      options: [
        'i. The vital importance of ecosystem variety',
        'ii. Ancient methods of soil enrichment',
        'iii. Global effects of industrial expansion',
        'iv. Destruction caused by intensive deforestation',
        'v. Sustainable conservation frameworks for the future',
        'vi. Economic challenges in modern agriculture',
        'vii. Technological innovations in weather forecasting',
      ],
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'iv',
    deliberateWrong: ['i', 'iii'],
  },
  {
    type: 'matching_headings',
    typeName: 'Matching Headings (Paragraph C -> "ii")',
    q: {
      number: 12,
      type: 'matching_headings',
      questionText: 'Choose the correct heading for Paragraph C from the list of headings below.',
      options: [
        'i. The vital importance of ecosystem variety',
        'ii. Ancient methods of soil enrichment',
        'iii. Global effects of industrial expansion',
        'iv. Destruction caused by intensive deforestation',
        'v. Sustainable conservation frameworks for the future',
        'vi. Economic challenges in modern agriculture',
        'vii. Technological innovations in weather forecasting',
      ],
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'ii',
    deliberateWrong: ['iv', 'v'],
  },
  {
    type: 'matching_headings',
    typeName: 'Matching Headings (Paragraph D -> "v")',
    q: {
      number: 13,
      type: 'matching_headings',
      questionText: 'Choose the correct heading for Paragraph D from the list of headings below.',
      options: [
        'i. The vital importance of ecosystem variety',
        'ii. Ancient methods of soil enrichment',
        'iii. Global effects of industrial expansion',
        'iv. Destruction caused by intensive deforestation',
        'v. Sustainable conservation frameworks for the future',
        'vi. Economic challenges in modern agriculture',
        'vii. Technological innovations in weather forecasting',
      ],
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'v',
    deliberateWrong: ['i', 'ii'],
  },
  {
    type: 'matching_headings',
    typeName: 'Matching Headings (Paragraph E -> "iii")',
    q: {
      number: 14,
      type: 'matching_headings',
      questionText: 'Choose the correct heading for Paragraph E from the list of headings below.',
      options: [
        'i. The vital importance of ecosystem variety',
        'ii. Ancient methods of soil enrichment',
        'iii. Global effects of industrial expansion',
        'iv. Destruction caused by intensive deforestation',
        'v. Sustainable conservation frameworks for the future',
        'vi. Economic challenges in modern agriculture',
        'vii. Technological innovations in weather forecasting',
      ],
    },
    passage: BIODIVERSITY_PASSAGE,
    skill: 'reading',
    correctAnswer: 'iii',
    deliberateWrong: ['ii', 'v'],
  },
  // 15-16. Matching Features
  {
    type: 'matching_features',
    typeName: 'Matching Features (Dr. Elizabeth Hayes -> "A")',
    q: {
      number: 15,
      type: 'matching_features',
      questionText: 'Visual memory consolidation depends directly on uninterrupted slow-wave sleep cycles.',
      options: ['A. Dr. Elizabeth Hayes', 'B. Prof. Marcus Vance', 'C. Dr. Alan Turing'],
    },
    passage: RESEARCHERS_PASSAGE,
    skill: 'reading',
    correctAnswer: 'A',
    deliberateWrong: ['B', 'C'],
  },
  {
    type: 'matching_features',
    typeName: 'Matching Features (Prof. Marcus Vance -> "B")',
    q: {
      number: 16,
      type: 'matching_features',
      questionText: 'Emotional valence is the primary determinant of long-term episodic memory storage.',
      options: ['A. Dr. Elizabeth Hayes', 'B. Prof. Marcus Vance', 'C. Dr. Alan Turing'],
    },
    passage: RESEARCHERS_PASSAGE,
    skill: 'reading',
    correctAnswer: 'B',
    deliberateWrong: ['A', 'C'],
  },
  // 17-18. Completion Reading
  {
    type: 'fill_blank',
    typeName: 'Completion Reading (silica)',
    q: {
      number: 17,
      type: 'fill_blank',
      questionText: 'Early glass was manufactured using quartz sand as a natural source of: [Q:17]',
    },
    passage: GLASSMAKING_PASSAGE,
    skill: 'reading',
    correctAnswer: 'silica',
    deliberateWrong: ['lime', 'sandstone'],
  },
  {
    type: 'short_answer',
    typeName: 'Completion Reading (Murano)',
    q: {
      number: 18,
      type: 'short_answer',
      questionText: 'Which island became the celebrated centre of European glass production by the Middle Ages? [Q:18]',
    },
    passage: GLASSMAKING_PASSAGE,
    skill: 'reading',
    correctAnswer: 'Murano',
    deliberateWrong: ['Venice', 'Rome'],
  },
  // 19-20. Completion Listening
  {
    type: 'note_completion',
    typeName: 'Completion Listening (8:30 AM)',
    q: {
      number: 19,
      type: 'note_completion',
      questionText: 'Registration desk opens daily at: [Q:19]',
    },
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    correctAnswer: '8:30 AM',
    deliberateWrong: ['9:00 AM', 'main foyer'],
  },
  {
    type: 'table_completion',
    typeName: 'Completion Listening (Conference Hall B)',
    q: {
      number: 20,
      type: 'table_completion',
      questionText: 'All keynote speeches and plenary sessions will be hosted in: [Q:20]',
    },
    passage: CONFERENCE_TRANSCRIPT,
    skill: 'listening',
    correctAnswer: 'Conference Hall B',
    deliberateWrong: ['Room 101', 'main foyer'],
  },
]

// ─── THEO DÕI VÀ BÁO CÁO 429/503/FALLBACK ─────────────────────────────────────
let trackedGemini429 = 0
let trackedGemini503 = 0

const originalRequestGeminiJson = groqClient.requestGeminiJson
groqClient.requestGeminiJson = async (...args) => {
  try {
    return await originalRequestGeminiJson(...args)
  } catch (err) {
    if (err.status === 429 || /429|resource exhausted/i.test(err.message)) {
      trackedGemini429++
    } else if (err.status === 503 || /503|high demand|overloaded/i.test(err.message)) {
      trackedGemini503++
    }
    throw err
  }
}

async function runBenchmarkForProvider(providerName) {
  console.log(`\n================================================================================`)
  console.log(`BẮT ĐẦU BENCHMARK CHO PROVIDER: ${providerName.toUpperCase()}`)
  console.log(`================================================================================`)

  const originalGeminiKey = process.env.GEMINI_API_KEY
  if (providerName.toLowerCase() === 'groq') {
    delete process.env.GEMINI_API_KEY
  } else {
    process.env.GEMINI_API_KEY = originalGeminiKey
    process.env.ENABLE_GEMINI_IN_TEST = 'true'
  }

  let totalCorrectRuns = 0
  let passedCorrectRuns = 0
  let falsePositiveRuns = 0

  let totalWrongRuns = 0
  let caughtWrongRuns = 0
  let omittedWrongRuns = 0

  let providerAnsweredRuns = 0
  let fallbackRuns = 0

  const errorList = []
  const repeatabilityMap = new Map()
  let ekmanQ1Verified = false
  let ekmanQ1JargonFree = false

  for (const c of BENCHMARK_CASES) {
    console.log(`\n--- [${providerName}] ${c.typeName} ---`)
    const family = classifyFamily(c.type)
    const ctx = {
      skill: c.skill,
      parts: [
        { label: c.skill === 'listening' ? 'TRANSCRIPT' : 'BÀI ĐỌC', text: c.passage },
      ],
      sourceText: c.passage,
    }

    // 1. Chạy 3 lần với ĐÁP ÁN ĐÚNG
    const correctOutcomes = []
    const correctAnswersToTest = [c.correctAnswer]
    if (c.reversedCorrectAnswer) {
      // Bổ sung ca "đúng nhưng khác thứ tự" ('C, B')
      correctAnswersToTest.push(c.reversedCorrectAnswer)
    }

    for (const testAns of correctAnswersToTest) {
      for (let r = 1; r <= 3; r++) {
        const qConfig = { ...c.q, correctAnswer: testAns }
        const tStart = Date.now()
        let explanation = null
        let err = null
        try {
          explanation = await generateExplanation(qConfig, family, ctx)
        } catch (e) {
          err = e.message
        }
        const dur = Date.now() - tStart

        if (explanation) {
          if (explanation.provider?.toLowerCase() === providerName.toLowerCase()) {
            providerAnsweredRuns++
          }
          if (explanation.isFallback) {
            fallbackRuns++
          }
        }

        const aiAnswer = explanation?.answer || ''
        const rawOptions = c.q.options || null
        const match = explanation ? isAnswerMatch(aiAnswer, testAns, rawOptions, c.q.type) : false

        totalCorrectRuns++
        if (match) {
          passedCorrectRuns++
        } else {
          falsePositiveRuns++
          errorList.push({
            type: 'FALSE_POSITIVE',
            question: c.typeName,
            teacherAns: testAns,
            aiAns: aiAnswer,
            error: err,
          })
        }
        correctOutcomes.push(match)

        // Kiểm tra ca Ekman Q1
        if (c.isEkmanQ1 && r === 1) {
          ekmanQ1Verified = match
          ekmanQ1JargonFree = explanation ? !containsInternalJargon(explanation) : false
          console.log(`     [EKMAN CHECK] Khớp: ${match} | Sạch cụm nội bộ: ${ekmanQ1JargonFree}`)
        }

        console.log(`  [ĐÚNG ${r}/3] (${testAns}) AI: "${aiAnswer}" | Teacher: "${testAns}" -> ${match ? '✅ KHỚP (Match)' : '❌ LỆCH (False Positive)'} (${dur}ms, provider: ${explanation?.provider || 'Unknown'})`)
        await sleep(100)
      }
    }

    // Đánh giá repeatability cho các lần chạy đúng
    const allSame = correctOutcomes.length > 0 && correctOutcomes.every(o => o === correctOutcomes[0])
    repeatabilityMap.set(`${c.type}_${c.q.number}`, allSame)

    // 2. Chạy ĐÁP ÁN SAI CỐ TÌNH
    // Với mcq_multi: 10 biến thể × 3 lần = 30 lượt.
    // Với các dạng khác: mỗi biến thể chạy 2 lần (hoặc 1 lần cho dạng 2 options).
    const wrongRepeats = c.isMcqMulti ? 3 : (c.deliberateWrong.length <= 2 ? 1 : 2)
    for (let w = 0; w < c.deliberateWrong.length; w++) {
      const wrongAns = c.deliberateWrong[w]
      for (let rep = 1; rep <= wrongRepeats; rep++) {
        const qConfig = { ...c.q, correctAnswer: wrongAns }
        const tStart = Date.now()
        let explanation = null
        let err = null
        try {
          explanation = await generateExplanation(qConfig, family, ctx)
        } catch (e) {
          err = e.message
        }
        const dur = Date.now() - tStart

        if (explanation) {
          if (explanation.provider?.toLowerCase() === providerName.toLowerCase()) {
            providerAnsweredRuns++
          }
          if (explanation.isFallback) {
            fallbackRuns++
          }
        }

        const aiAnswer = explanation?.answer || ''
        const rawOptions = c.q.options || null
        const match = explanation ? isAnswerMatch(aiAnswer, wrongAns, rawOptions, c.q.type) : false

        totalWrongRuns++
        if (!match) {
          caughtWrongRuns++
        } else {
          omittedWrongRuns++
          errorList.push({
            type: 'OMISSION',
            question: c.typeName,
            wrongAns,
            aiAns: aiAnswer,
            error: err,
          })
        }

        console.log(`  [SAI #${w + 1}] (${wrongAns}) AI: "${aiAnswer}" | Teacher sai: "${wrongAns}" -> ${!match ? '🛡️ BẮT ĐÚNG (Conflict)' : '🚨 BỎ SÓT (Omission)'} (${dur}ms)`)
        await sleep(100)
      }
    }
  }

  // Khôi phục GEMINI_API_KEY
  process.env.GEMINI_API_KEY = originalGeminiKey

  const totalRepeatabilityChecks = repeatabilityMap.size
  const successfulRepeatability = Array.from(repeatabilityMap.values()).filter(Boolean).length
  const repeatabilityRate = (successfulRepeatability / totalRepeatabilityChecks) * 100
  const falsePositiveRate = (falsePositiveRuns / totalCorrectRuns) * 100
  const omissionRate = (omittedWrongRuns / totalWrongRuns) * 100

  const summary = {
    provider: providerName,
    totalCorrectRuns,
    passedCorrectRuns,
    falsePositiveRuns,
    falsePositiveRate: `${falsePositiveRate.toFixed(1)}%`,
    totalWrongRuns,
    caughtWrongRuns,
    omittedWrongRuns,
    omissionRate: `${omissionRate.toFixed(1)}%`,
    repeatabilityRate: `${repeatabilityRate.toFixed(1)}%`,
    providerAnsweredRuns,
    fallbackRuns,
    gemini429: providerName.toLowerCase() === 'gemini' ? trackedGemini429 : 0,
    gemini503: providerName.toLowerCase() === 'gemini' ? trackedGemini503 : 0,
    thresholdMet: providerName.toLowerCase() === 'gemini'
      ? (repeatabilityRate === 100 && falsePositiveRate === 0 && omissionRate === 0)
      : true,
    ekmanQ1Verified,
    ekmanQ1JargonFree,
    errors: errorList,
  }

  return summary
}

async function main() {
  console.log('================================================================================')
  console.log('BENCHMARK MỞ RỘNG (PHẦN 3): CHẾ ĐỘ GIẢI MÙ, NHÃN GỐC, NGƯỠNG DỪNG BẮT BUỘC')
  console.log('Chế độ: --dry-run (không ghi DB)')
  console.log('================================================================================')

  printDbBanner()

  // 1. Chạy Gemini (Primary)
  const geminiSummary = await runBenchmarkForProvider('Gemini')

  // 2. Chạy Groq (Fallback)
  const groqSummary = await runBenchmarkForProvider('Groq')

  console.log('\n================================================================================')
  console.log('TỔNG HỢP KẾT QUẢ BENCHMARK MỞ RỘNG (PHẦN 3):')
  console.log('================================================================================')
  console.table([
    {
      Provider: geminiSummary.provider,
      'Tổng đúng': geminiSummary.totalCorrectRuns,
      'Khớp': geminiSummary.passedCorrectRuns,
      'Báo sai nhầm (FP)': geminiSummary.falsePositiveRate,
      'Tổng sai': geminiSummary.totalWrongRuns,
      'Bắt đúng': geminiSummary.caughtWrongRuns,
      'Bỏ sót (FN)': geminiSummary.omissionRate,
      'Lặp lại': geminiSummary.repeatabilityRate,
      'Thực trả': geminiSummary.providerAnsweredRuns,
      'Fallback': geminiSummary.fallbackRuns,
      '429': geminiSummary.gemini429,
      '503': geminiSummary.gemini503,
    },
    {
      Provider: groqSummary.provider,
      'Tổng đúng': groqSummary.totalCorrectRuns,
      'Khớp': groqSummary.passedCorrectRuns,
      'Báo sai nhầm (FP)': groqSummary.falsePositiveRate,
      'Tổng sai': groqSummary.totalWrongRuns,
      'Bắt đúng': groqSummary.caughtWrongRuns,
      'Bỏ sót (FN)': groqSummary.omissionRate,
      'Lặp lại': groqSummary.repeatabilityRate,
      'Thực trả': groqSummary.providerAnsweredRuns,
      'Fallback': groqSummary.fallbackRuns,
      '429': 0,
      '503': 0,
    },
  ])

  console.log('\n[ĐỐI CHIẾU NGƯỠNG BẮT BUỘC TRÊN GEMINI]:')
  console.log(`- Tính lặp lại (Repeatability): ${geminiSummary.repeatabilityRate} (Yêu cầu: 100%) -> ${geminiSummary.repeatabilityRate === '100.0%' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`)
  console.log(`- Báo sai nhầm (False Positive): ${geminiSummary.falsePositiveRate} (Yêu cầu: 0%) -> ${geminiSummary.falsePositiveRate === '0.0%' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`)
  console.log(`- BỎ SÓT (Omission Rate): ${geminiSummary.omissionRate} (Yêu cầu: 0%) -> ${geminiSummary.omissionRate === '0.0%' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`)
  console.log(`- Ca Ekman Q1 ("students."): ${geminiSummary.ekmanQ1Verified ? '✅ Khớp' : '❌ Lệch'} | Sạch cụm nội bộ: ${geminiSummary.ekmanQ1JargonFree ? '✅ Sạch' : '❌ Chứa cụm'}`)

  if (geminiSummary.errors && geminiSummary.errors.length > 0) {
    console.error('\n🚨 DANH SÁCH CHI TIẾT CÁC CA LỖI TRÊN GEMINI:')
    console.error(JSON.stringify(geminiSummary.errors, null, 2))
  }

  if (!geminiSummary.thresholdMet) {
    console.error('\n🚨 CẢNH BÁO BẮT BUỘC (Mục 3.3): Gemini KHÔNG đạt ngưỡng (Lặp lại 100% / Báo sai 0% / Bỏ sót 0%)!')
    console.error('DỪNG TOÀN BỘ! KHÔNG THỰC HIỆN PHẦN 4! Báo cáo lại cho người dùng kèm danh sách lỗi trên.')
    process.exit(2)
  }

  console.log('\n🎉 TẤT CẢ CÁC CHỈ SỐ GEMINI ĐẠT NGƯỠNG BẮT BUỘC 100% / 0% / 0%!')
}

main()
  .catch(err => {
    console.error('Benchmark thất bại:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
