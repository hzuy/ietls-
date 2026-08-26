const express = require('express')
const groqSdk = require('groq-sdk')
const Groq = groqSdk.Groq || groqSdk.default || groqSdk
const authMiddleware = require('../middleware/auth')
const prisma = require('../lib/prisma')
const { cleanJsonRaw, repairTruncatedJson } = require('../services/cambridge/jsonSanitizer')

const router = express.Router()

// Helper to get Groq client lazily
function getGroqClient() {
  if (process.env.GROQ_API_KEY) {
    try {
      return new Groq({ apiKey: process.env.GROQ_API_KEY })
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[Groq SDK Init Warning]', err.message)
    }
  }
  return null
}

// In-memory rate-limiter: Max 5 requests per user per day (24 hours)
const adviceRateLimitMap = new Map()

function adviceRateLimiter(req, res, next) {
  const userId = req.user?.userId
  if (!userId) return next()

  const now = Date.now()
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  const userRecord = adviceRateLimitMap.get(userId) || { count: 0, resetTime: now + ONE_DAY_MS }

  if (now > userRecord.resetTime) {
    userRecord.count = 0
    userRecord.resetTime = now + ONE_DAY_MS
  }

  if (userRecord.count >= 5) {
    return res.status(429).json({
      message: 'Bạn đã đạt giới hạn 5 lần xin nhận xét AI trong ngày. Vui lòng quay lại sau 24 giờ.',
      resetTime: new Date(userRecord.resetTime).toISOString(),
    })
  }

  userRecord.count += 1
  adviceRateLimitMap.set(userId, userRecord)
  next()
}

// Helper: Determine target user ID securely
function getTargetUserId(req, res) {
  let targetUserId = req.user.userId

  if (req.query.userId) {
    const requestedId = parseInt(req.query.userId)
    if (!isNaN(requestedId) && requestedId > 0) {
      const userRole = req.user.role || 'user'
      if (userRole === 'admin' || userRole === 'teacher') {
        targetUserId = requestedId
      } else if (requestedId !== req.user.userId) {
        res.status(403).json({ message: 'Không có quyền xem thống kê của người dùng khác' })
        return null
      }
    }
  }

  return targetUserId
}

// Internal Helper: Get error breakdown data
async function fetchErrorBreakdown(targetUserId, skill) {
  const whereCondition = { userId: targetUserId }
  if (skill && (skill === 'reading' || skill === 'listening')) {
    whereCondition.skillType = skill
  }

  const groups = await prisma.answerLog.groupBy({
    by: ['skillType', 'questionType', 'isCorrect', 'userAnswer'],
    where: whereCondition,
    _count: { id: true },
  })

  if (!groups || groups.length === 0) return []

  const statsMap = {}
  for (const g of groups) {
    const key = `${g.skillType}:${g.questionType}`
    if (!statsMap[key]) {
      statsMap[key] = {
        skillType: g.skillType,
        questionType: g.questionType,
        total: 0,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        wrong: 0,
      }
    }

    const count = g._count.id || 0
    statsMap[key].total += count

    if (g.isCorrect) {
      statsMap[key].correct += count
    } else {
      statsMap[key].incorrect += count
      const isSkipped = !g.userAnswer || String(g.userAnswer).trim() === ''
      if (isSkipped) {
        statsMap[key].skipped += count
      } else {
        statsMap[key].wrong += count
      }
    }
  }

  const result = Object.values(statsMap).map(item => {
    const total = item.total
    const errorRate = total > 0 ? Number((item.incorrect / total).toFixed(3)) : 0
    const accuracyRate = total > 0 ? Number((item.correct / total).toFixed(3)) : 0

    return {
      skillType: item.skillType,
      questionType: item.questionType,
      total: item.total,
      correct: item.correct,
      incorrect: item.incorrect,
      skipped: item.skipped,
      wrong: item.wrong,
      errorRate,
      accuracyRate,
    }
  })

  result.sort((a, b) => (b.errorRate !== a.errorRate ? b.errorRate - a.errorRate : b.total - a.total))
  return result
}

// Internal Helper: Get trend data
async function fetchTrendData(targetUserId, skill, limitCount = 10) {
  const limit = Math.min(20, Math.max(1, limitCount))
  const attemptWhere = { userId: targetUserId, finishedAt: { not: null } }
  if (skill && (skill === 'reading' || skill === 'listening')) {
    attemptWhere.exam = { skill }
  }

  const attempts = await prisma.attempt.findMany({
    where: attemptWhere,
    orderBy: { finishedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      examId: true,
      score: true,
      finishedAt: true,
      createdAt: true,
      exam: {
        select: {
          title: true,
          skill: true,
          bookNumber: true,
          testNumber: true,
        },
      },
    },
  })

  if (!attempts || attempts.length === 0) return []

  const attemptIds = attempts.map(a => a.id)
  const logGroups = await prisma.answerLog.groupBy({
    by: ['attemptId', 'isCorrect'],
    where: { userId: targetUserId, attemptId: { in: attemptIds } },
    _count: { id: true },
  })

  const attemptLogMap = {}
  for (const lg of logGroups) {
    if (!lg.attemptId) continue
    if (!attemptLogMap[lg.attemptId]) {
      attemptLogMap[lg.attemptId] = { correct: 0, incorrect: 0, total: 0 }
    }
    const count = lg._count.id || 0
    attemptLogMap[lg.attemptId].total += count
    if (lg.isCorrect) attemptLogMap[lg.attemptId].correct += count
    else attemptLogMap[lg.attemptId].incorrect += count
  }

  const trendList = attempts.map(a => {
    const stats = attemptLogMap[a.id] || { correct: 0, incorrect: 0, total: 0 }
    const total = stats.total
    const errorRate = total > 0 ? Number((stats.incorrect / total).toFixed(3)) : 0
    const accuracyRate = total > 0 ? Number((stats.correct / total).toFixed(3)) : 0

    return {
      attemptId: a.id,
      examId: a.examId,
      examTitle: a.exam?.title || `Exam #${a.examId}`,
      skillType: a.exam?.skill || 'unknown',
      score: a.score ?? null,
      finishedAt: a.finishedAt,
      total,
      correct: stats.correct,
      incorrect: stats.incorrect,
      accuracyRate,
      errorRate,
    }
  })

  trendList.sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime())
  return trendList
}

// Internal Helper: Calculate writing criteria statistics
async function fetchWritingCriteriaStats(targetUserId) {
  const logs = await prisma.writingCriterionLog.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      criterion: true,
      score: true,
      comment: true,
      createdAt: true,
    },
  })

  if (!logs || logs.length === 0) return []

  const criterionGroupMap = {}
  for (const log of logs) {
    if (!criterionGroupMap[log.criterion]) {
      criterionGroupMap[log.criterion] = []
    }
    criterionGroupMap[log.criterion].push(log)
  }

  const result = Object.keys(criterionGroupMap).map(criterion => {
    const list = criterionGroupMap[criterion]
    const sampleCount = list.length
    const totalScore = list.reduce((sum, item) => sum + (item.score || 0), 0)
    const rawAvg = totalScore / sampleCount
    const avgScore = Math.round(rawAvg * 2) / 2
    const latestLog = list[sampleCount - 1]
    const latestScore = latestLog.score || 0

    let trend = 'insufficient_data'
    if (sampleCount >= 2) {
      const prevLogs = list.slice(0, sampleCount - 1)
      const prevSum = prevLogs.reduce((sum, item) => sum + (item.score || 0), 0)
      const prevAvg = prevSum / prevLogs.length
      const diff = latestScore - prevAvg

      if (diff > 0.25) trend = 'up'
      else if (diff < -0.25) trend = 'down'
      else trend = 'stable'
    }

    return {
      criterion,
      avgScore,
      sampleCount,
      latestScore,
      latestComment: latestLog.comment || null,
      trend,
    }
  })

  // Sort by avgScore ASC (weakest criterion first)
  result.sort((a, b) => a.avgScore - b.avgScore)
  return result
}

// Internal Helper: Calculate speaking criteria statistics
async function fetchSpeakingCriteriaStats(targetUserId) {
  const logs = await prisma.speakingCriterionLog.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      criterion: true,
      score: true,
      comment: true,
      createdAt: true,
    },
  })

  if (!logs || logs.length === 0) return []

  const criterionGroupMap = {}
  for (const log of logs) {
    if (!criterionGroupMap[log.criterion]) {
      criterionGroupMap[log.criterion] = []
    }
    criterionGroupMap[log.criterion].push(log)
  }

  const result = Object.keys(criterionGroupMap).map(criterion => {
    const list = criterionGroupMap[criterion]
    const sampleCount = list.length
    const totalScore = list.reduce((sum, item) => sum + (item.score || 0), 0)
    const rawAvg = totalScore / sampleCount
    const avgScore = Math.round(rawAvg * 2) / 2
    const latestLog = list[sampleCount - 1]
    const latestScore = latestLog.score || 0

    let trend = 'insufficient_data'
    if (sampleCount >= 2) {
      const prevLogs = list.slice(0, sampleCount - 1)
      const prevSum = prevLogs.reduce((sum, item) => sum + (item.score || 0), 0)
      const prevAvg = prevSum / prevLogs.length
      const diff = latestScore - prevAvg

      if (diff > 0.25) trend = 'up'
      else if (diff < -0.25) trend = 'down'
      else trend = 'stable'
    }

    return {
      criterion,
      avgScore,
      sampleCount,
      latestScore,
      latestComment: latestLog.comment || null,
      trend,
    }
  })

  // Sort by avgScore ASC (weakest criterion first)
  result.sort((a, b) => a.avgScore - b.avgScore)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/error-breakdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/error-breakdown', authMiddleware, async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req, res)
    if (targetUserId === null) return

    const result = await fetchErrorBreakdown(targetUserId, req.query.skill)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi tính toán thống kê lỗi', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/trend
// ─────────────────────────────────────────────────────────────────────────────
router.get('/trend', authMiddleware, async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req, res)
    if (targetUserId === null) return

    const limit = parseInt(req.query.limit) || 10
    const result = await fetchTrendData(targetUserId, req.query.skill, limit)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy xu hướng điểm số', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/writing-criteria
// ─────────────────────────────────────────────────────────────────────────────
router.get('/writing-criteria', authMiddleware, async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req, res)
    if (targetUserId === null) return

    const result = await fetchWritingCriteriaStats(targetUserId)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi tính toán thống kê tiêu chí Writing', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/speaking-criteria
// ─────────────────────────────────────────────────────────────────────────────
router.get('/speaking-criteria', authMiddleware, async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req, res)
    if (targetUserId === null) return

    const result = await fetchSpeakingCriteriaStats(targetUserId)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi tính toán thống kê tiêu chí Speaking', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stats/advice — Layer 3 AI Advisor Recommendation (4 Skills Unified)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/advice', authMiddleware, adviceRateLimiter, async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req, res)
    if (targetUserId === null) return

    // Count total AnswerLogs for Reading/Listening
    const totalLogs = await prisma.answerLog.count({ where: { userId: targetUserId } })
    const rlAvailable = totalLogs >= 10

    // Fetch Reading & Listening stats if available
    let errorBreakdown = []
    let recentTrend = []
    if (rlAvailable) {
      errorBreakdown = await fetchErrorBreakdown(targetUserId)
      recentTrend = await fetchTrendData(targetUserId, null, 10)
    }

    // Fetch Writing & Speaking criteria stats
    const writingStats = await fetchWritingCriteriaStats(targetUserId)
    const speakingStats = await fetchSpeakingCriteriaStats(targetUserId)

    const writingAvailable = writingStats.length > 0
    const speakingAvailable = speakingStats.length > 0

    // Global Threshold Check: If ALL 4 skills lack sufficient data -> return insufficientData
    if (!rlAvailable && !writingAvailable && !speakingAvailable) {
      return res.json({
        insufficientData: true,
        message: 'Bạn chưa có đủ dữ liệu ở bất kỳ kỹ năng nào để AI có thể đưa ra lộ trình ôn tập. Vui lòng làm thêm bài thi.',
        totalQuestions: totalLogs,
      })
    }

    const inputData = {
      reading_listening: {
        available: rlAvailable,
        totalQuestionsLogged: totalLogs,
        errorBreakdown: rlAvailable ? errorBreakdown : [],
        recentTrend: rlAvailable ? recentTrend : [],
      },
      writing: {
        available: writingAvailable,
        criteria: writingAvailable ? writingStats : [],
      },
      speaking: {
        available: speakingAvailable,
        criteria: speakingAvailable ? speakingStats : [],
      },
    }

    // Construct verbatim prompt for 4 skills
    const prompt = `Bạn là cố vấn học thuật IELTS chuyên nghiệp. Nhiệm vụ của bạn là phân tích dữ liệu thống kê kết quả làm bài của học viên trên 4 kỹ năng (Reading, Listening, Writing, Speaking) dưới đây và đưa ra nhận xét, đánh giá toàn diện cùng lộ trình ôn tập cụ thể.

DỮ LIỆU THỐNG KÊ KẾT QUẢ HỌC VIÊN CHUẨN TỪ BACKEND:
${JSON.stringify(inputData, null, 2)}

YÊU CẦU BẮT BUỘC KHI TẠO CÂU TRẢ LỜI:
1. TUYỆT ĐỐI KHÔNG TỰ TÍNH TOÁN LẠI NỐI THÊM HOẶC BỊA ĐẶT CÁC CON SỐ/PHẦN TRĂM KHÁC KHÔNG CÓ TRONG DỮ LIỆU TRÊN.
2. CHỈ ĐƯỢC PHÉP TRÍCH DẪN VÀ DIỄN GIẢI CHÍNH XÁC CÁC SỐ LIỆU ĐÃ CÓ NẰM TRONG DỮ LIỆU INPUT (ví dụ: số câu đúng, số câu bỏ qua, số câu sai, tỉ lệ lỗi, điểm trung bình tiêu chí avgScore).
3. Đánh giá dạng bài yếu nhất của Reading/Listening dựa trên "errorRate" cao nhất và số câu "skipped" / "wrong".
4. QUAN TRỌNG VỀ READING/LISTENING — phân biệt rõ 2 loại "không đạt điểm":
   - "skipped" (bỏ qua): học viên KHÔNG có thời gian làm, KHÔNG phản ánh việc không hiểu bài. Khi viết weaknesses/summary về câu bị skipped, dùng ngôn ngữ liên quan QUẢN LÝ THỜI GIAN (ví dụ: "chưa kịp làm", "cần luyện tốc độ"), TUYỆT ĐỐI không dùng từ "yếu", "khó khăn", "sai", "lỗi" cho các câu skipped.
   - "wrong" (làm sai): học viên có làm nhưng chưa đúng, đây MỚI là dấu hiệu thực sự về lỗ hổng kiến thức/kỹ năng. Chỉ dùng các từ như "cần cải thiện", "còn yếu" cho nhóm "wrong".
   - Nếu một questionType có skipped cao nhưng wrong = 0, hãy nói rõ "chưa có đủ dữ liệu để đánh giá năng lực thật ở dạng này vì học viên chưa kịp làm", KHÔNG kết luận học viên yếu ở dạng đó.
5. QUAN TRỌNG VỀ KỸ NĂNG THIẾU DỮ LIỆU (available = false hoặc mảng rỗng []):
   - TUYỆT ĐỐI KHÔNG ĐƯỢC BỊA ĐẶT NHẬN XÉT HOẶC TỰ SUY DOÁN ĐIỂM SỐ/PHONG ĐỘ cho kỹ năng đó.
   - Trong "summary", phải nói rõ: "Học viên chưa có đủ dữ liệu làm bài để đánh giá kỹ năng [Tên kỹ năng]".
   - Trong "skills", đặt "available": false, "strengths": [], "weaknesses": [].
6. QUAN TRỌNG VỀ XU HƯỚNG WRITING/SPEAKING (trend):
   - Nếu tiêu chí có "trend": "insufficient_data", KHÔNG được diễn giải thành "đang cải thiện" hay "đang giảm sút" — phải nói rõ "chưa đủ dữ liệu để xác định xu hướng".
7. Trả về câu trả lời dưới dạng DUY NHẤT một chuỗi JSON hợp lệ (không chứa markdown, không có chữ dẫn dắt bên ngoài), theo đúng cấu trúc sau:

{
  "summary": "Tóm tắt ngắn gọn tình hình học tập và phong độ làm bài của học viên trên các kỹ năng hiện có (2-3 câu).",
  "skills": {
    "reading_listening": {
      "available": true,
      "strengths": [
        "Điểm mạnh 1...",
        "Điểm mạnh 2..."
      ],
      "weaknesses": [
        "Điểm yếu 1...",
        "Điểm yếu 2..."
      ]
    },
    "writing": {
      "available": true,
      "strengths": [
        "Điểm mạnh 1 (tiêu chí điểm cao)..."
      ],
      "weaknesses": [
        "Điểm yếu 1 (tiêu chí avgScore thấp nhất, trích dẫn điểm)..."
      ]
    },
    "speaking": {
      "available": true,
      "strengths": [
        "Điểm mạnh 1..."
      ],
      "weaknesses": [
        "Điểm yếu 1..."
      ]
    }
  },
  "actionItems": [
    "Lời khuyên hành động 1 (ưu tiên kỹ năng yếu nhất trong các kỹ năng có dữ liệu)...",
    "Lời khuyên hành động 2...",
    "Lời khuyên hành động 3...",
    "Lời khuyên hành động 4..."
  ]
}`

    // Call Groq LLM API if client initialized
    const groq = getGroqClient()

    let responseText = ''
    let finishReason = null

    if (groq) {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
      })
      responseText = completion.choices[0]?.message?.content || ''
      finishReason = completion.choices[0]?.finish_reason || null
    }

    let adviceObj = null

    if (responseText) {
      const cleanedJson = repairTruncatedJson(responseText, finishReason)
      try {
        adviceObj = JSON.parse(cleanedJson)
      } catch (parseErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[AI Advice JSON Parse Error]', parseErr.message)
        }
      }
    }

    // Fallback if AI response missing or parse failed
    if (!adviceObj || typeof adviceObj !== 'object') {
      adviceObj = {
        summary: `Hệ thống đã tổng hợp phân tích điểm số các kỹ năng của bạn.`,
        skills: {
          reading_listening: {
            available: rlAvailable,
            strengths: rlAvailable ? ['Đã làm tốt một số dạng bài Reading/Listening.'] : [],
            weaknesses: rlAvailable ? ['Cần xem lại các câu trả lời sai và chưa hoàn thành.'] : [],
          },
          writing: {
            available: writingAvailable,
            strengths: writingAvailable ? [writingStats[writingStats.length - 1] ? `Tiêu chí ${writingStats[writingStats.length - 1].criterion} tốt nhất (${writingStats[writingStats.length - 1].avgScore})` : ''] : [],
            weaknesses: writingAvailable ? [writingStats[0] ? `Tiêu chí ${writingStats[0].criterion} cần cải thiện (${writingStats[0].avgScore})` : ''] : [],
          },
          speaking: {
            available: speakingAvailable,
            strengths: speakingAvailable ? [speakingStats[speakingStats.length - 1] ? `Tiêu chí ${speakingStats[speakingStats.length - 1].criterion} tốt nhất (${speakingStats[speakingStats.length - 1].avgScore})` : ''] : [],
            weaknesses: speakingAvailable ? [speakingStats[0] ? `Tiêu chí ${speakingStats[0].criterion} cần cải thiện (${speakingStats[0].avgScore})` : ''] : [],
          },
        },
        actionItems: ['Tập trung rèn luyện các kỹ năng yếu nhất dựa trên nhận xét chi tiết.'],
      }
    }

    res.json({
      insufficientData: false,
      totalQuestions: totalLogs,
      availableSkills: {
        reading_listening: rlAvailable,
        writing: writingAvailable,
        speaking: speakingAvailable,
      },
      advice: adviceObj,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi sinh nhận xét AI', error: error.message })
  }
})

module.exports = router
