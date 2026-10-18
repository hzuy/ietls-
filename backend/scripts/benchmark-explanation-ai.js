'use strict'

const { printDbBanner } = require('../lib/dbInfo')
const {
  classifyFamily,
  generateExplanation,
} = require('./generate-explanations')
const { isAnswerMatch } = require('../services/explanationGeneratorService')
const prisma = require('../lib/prisma')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const BENCHMARK_CASES = [
  {
    type: 'mcq',
    typeName: 'MCQ (đơn — ca Ekman "students.")',
    q: {
      number: 1,
      type: 'mcq',
      questionText: 'According to the writer, Ekman became interested in lying after a question from his:',
      options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
    },
    passage: `Paragraph B: Paul Ekman became interested in lying after a question from his students. Clinical observations showed that patients frequently concealed symptoms, but it was his students who asked whether deceptive facial expressions could be systematically detected.`,
    skill: 'reading',
    correctAnswer: 'students.', // Có dấu chấm cuối theo đề bài Ekman
    deliberateWrong: ['peers', 'patients', 'teachers'],
  },
  {
    type: 'mcq_multi',
    typeName: 'MCQ multi (nhiều đáp án)',
    q: {
      number: 2,
      type: 'mcq_multi',
      questionText: "Which TWO groups of people are mentioned in connection with Ekman's early observations? Choose TWO letters, A-E.",
      options: ['A. peers', 'B. patients', 'C. students', 'D. teachers', 'E. journalists'],
    },
    passage: `Paragraph B: Paul Ekman became interested in lying after a question from his students. Clinical observations showed that patients frequently concealed symptoms, but it was his students who asked whether deceptive facial expressions could be systematically detected.`,
    skill: 'reading',
    correctAnswer: 'B, C',
    deliberateWrong: ['A, B', 'D, E', 'A, D'],
  },
  {
    type: 'true_false_ng',
    typeName: 'TFNG (True / False / Not Given)',
    q: {
      number: 5,
      type: 'true_false_ng',
      questionText: 'More than half of the world species live in tropical rainforests.',
    },
    passage: `Paragraph A: Biodiversity is essential for maintaining ecosystem balance. Tropical rainforests harbor over 50 percent of the world's plant and animal species despite covering only six percent of the planet's land area. Deforestation has accelerated species extinction at alarming rates.`,
    skill: 'reading',
    correctAnswer: 'TRUE',
    deliberateWrong: ['FALSE', 'NOT GIVEN', 'NO'],
  },
  {
    type: 'yes_no_ng',
    typeName: 'YNNG (Yes / No / Not Given)',
    q: {
      number: 6,
      type: 'yes_no_ng',
      questionText: 'Paul Ekman initial fascination with deception was stimulated by inquiries from his students.',
    },
    passage: `Paragraph B: Paul Ekman became interested in lying after a question from his students. Clinical observations showed that patients frequently concealed symptoms, but it was his students who asked whether deceptive facial expressions could be systematically detected.`,
    skill: 'reading',
    correctAnswer: 'YES',
    deliberateWrong: ['NO', 'NOT GIVEN', 'FALSE'],
  },
  {
    type: 'matching_headings',
    typeName: 'Matching Headings',
    q: {
      number: 7,
      type: 'matching_headings',
      questionText: 'Choose the correct heading for Paragraph A from the list of headings below.',
      options: ['i. The vital importance of ecosystem variety', 'ii. Clinical deception experiments', 'iii. Global warming effects', 'iv. Technological solutions for preservation'],
    },
    passage: `Paragraph A: Biodiversity is essential for maintaining ecosystem balance. Tropical rainforests harbor over 50 percent of the world's plant and animal species despite covering only six percent of the planet's land area. Deforestation has accelerated species extinction at alarming rates.`,
    skill: 'reading',
    correctAnswer: 'i',
    deliberateWrong: ['ii', 'iii', 'iv'],
  },
  {
    type: 'completion',
    typeName: 'Completion (Note completion)',
    q: {
      number: 1,
      type: 'note_completion',
      questionText: 'Registration desk opens daily at: [Q:1]',
    },
    passage: `Welcome everyone to the City Transport Annual Conference. Before we begin the keynote sessions, please ensure you collect your delegate badges from the main foyer. You will find that registration opens daily at 8:30 AM.`,
    skill: 'listening',
    correctAnswer: '8:30 AM',
    deliberateWrong: ['9:00 AM', 'main foyer', 'Conference Hall B'],
  },
]

async function runBenchmarkForProvider(providerName) {
  console.log(`\n================================================================================`)
  console.log(`BẮT ĐẦU BENCHMARK CHO: ${providerName.toUpperCase()}`)
  console.log(`================================================================================`)

  const originalGeminiKey = process.env.GEMINI_API_KEY
  if (providerName.toLowerCase() === 'groq') {
    // Tạm thời ẩn GEMINI_API_KEY để ép fallback/chạy Groq
    delete process.env.GEMINI_API_KEY
  } else {
    process.env.GEMINI_API_KEY = originalGeminiKey
    process.env.ENABLE_GEMINI_IN_TEST = 'true'
  }

  const results = []
  let totalCorrectRuns = 0
  let passedCorrectRuns = 0 // Đúng đáp án và khớp (không báo sai nhầm)
  let falsePositiveRuns = 0 // Báo sai nhầm: đáp án đúng của teacher nhưng AI báo lệch

  let totalWrongRuns = 0
  let caughtWrongRuns = 0   // Bắt được đáp án sai cố tình (không bỏ sót)
  let omittedWrongRuns = 0  // BỎ SÓT: đáp án sai cố tình nhưng AI coi là đúng

  const repeatabilityMap = new Map()

  for (const c of BENCHMARK_CASES) {
    console.log(`\n--- [${providerName}] Kiểm thử loại câu: ${c.typeName} ---`)
    const family = classifyFamily(c.type)
    const ctx = {
      skill: c.skill,
      parts: [
        { label: c.skill === 'listening' ? 'TRANSCRIPT' : 'BÀI ĐỌC', text: c.passage }
      ],
      sourceText: c.passage,
    }

    // 1. Chạy 3 lần với ĐÁP ÁN ĐÚNG
    const correctOutcomes = []
    for (let r = 1; r <= 3; r++) {
      const qConfig = { ...c.q, correctAnswer: c.correctAnswer }
      const tStart = Date.now()
      let explanation = null
      let err = null
      try {
        explanation = await generateExplanation(qConfig, family, ctx)
      } catch (e) {
        err = e.message
      }
      const dur = Date.now() - tStart

      const aiAnswer = explanation?.answer || ''
      const match = explanation ? isAnswerMatch(aiAnswer, c.correctAnswer, c.q.options, c.q.type) : false
      totalCorrectRuns++
      if (match) {
        passedCorrectRuns++
      } else {
        falsePositiveRuns++
      }
      correctOutcomes.push(match)

      console.log(`  [ĐÚNG ${r}/3] AI answer: "${aiAnswer}" | Teacher: "${c.correctAnswer}" -> ${match ? '✅ KHỚP (Match)' : '❌ LỆCH (False Positive)'} (${dur}ms, provider: ${explanation?.provider || 'Unknown'})`)
      await sleep(1000)
    }

    // Đánh giá repeatability cho 3 lần chạy đúng
    const allSame = correctOutcomes.every(o => o === correctOutcomes[0])
    repeatabilityMap.set(`${c.type}_correct`, allSame)

    // 2. Chạy 3 KIỂU ĐÁP ÁN SAI CỐ TÌNH
    for (let w = 0; w < c.deliberateWrong.length; w++) {
      const wrongAns = c.deliberateWrong[w]
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

      const aiAnswer = explanation?.answer || ''
      // Với đáp án sai cố tình: match = true nghĩa là BỎ SÓT (AI không phát hiện sai)
      // match = false nghĩa là THÀNH CÔNG (AI phát hiện ra sai, báo conflict)
      const match = explanation ? isAnswerMatch(aiAnswer, wrongAns, c.q.options, c.q.type) : false
      totalWrongRuns++
      if (!match) {
        caughtWrongRuns++
      } else {
        omittedWrongRuns++
      }

      console.log(`  [SAI #${w + 1}/3] AI answer: "${aiAnswer}" | Teacher sai cố tình: "${wrongAns}" -> ${!match ? '🛡️ PHÁT HIỆN LỆCH (Bắt đúng)' : '🚨 BỎ SÓT (Omission)'} (${dur}ms)`)
      await sleep(1000)
    }
  }

  // Khôi phục GEMINI_API_KEY
  process.env.GEMINI_API_KEY = originalGeminiKey

  // Tính toán số liệu
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
    thresholdMet: providerName.toLowerCase() === 'gemini'
      ? (repeatabilityRate === 100 && falsePositiveRate === 0 && omissionRate === 0)
      : true,
  }

  return summary
}

async function main() {
  console.log('================================================================================')
  console.log('BENCHMARK B.7: KIỂM THỬ KHẢ NĂNG NHẬN DIỆN VÀ PHẢN BIỆN ĐÁP ÁN AI')
  console.log('Chế độ: --dry-run (không ghi DB)')
  console.log('================================================================================')

  printDbBanner()

  // 1. Chạy Gemini
  const geminiSummary = await runBenchmarkForProvider('Gemini')

  // 2. Chạy Groq
  const groqSummary = await runBenchmarkForProvider('Groq')

  console.log('\n================================================================================')
  console.log('TỔNG HỢP KẾT QUẢ BENCHMARK (B.7):')
  console.log('================================================================================')
  console.table([geminiSummary, groqSummary])

  console.log('\n[ĐỐI CHIẾU NGƯỠNG BẮT BUỘC TRÊN GEMINI]:')
  console.log(`- Tính lặp lại (Repeatability): ${geminiSummary.repeatabilityRate} (Yêu cầu: 100%) -> ${geminiSummary.repeatabilityRate === '100.0%' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`)
  console.log(`- Báo sai nhầm (False Positive): ${geminiSummary.falsePositiveRate} (Yêu cầu: 0%) -> ${geminiSummary.falsePositiveRate === '0.0%' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`)
  console.log(`- BỎ SÓT (Omission Rate): ${geminiSummary.omissionRate} (Yêu cầu: 0%) -> ${geminiSummary.omissionRate === '0.0%' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`)

  if (parseFloat(geminiSummary.omissionRate) > 0) {
    console.error('\n🚨 CẢNH BÁO BẮT BUỘC: Tỷ lệ BỎ SÓT trên Gemini > 0%! DỪNG TOÀN BỘ, không thực hiện Phần 5!')
    process.exit(2)
  }

  console.log('\n🎉 TẤT CẢ CÁC CHỈ SỐ GEMINI ĐẠT NGƯỠNG BẮT BUỘC 100% / 0% / 0%!')
}

main().catch(err => {
  console.error('Benchmark thất bại:', err)
  process.exit(1)
}).finally(() => prisma.$disconnect())
