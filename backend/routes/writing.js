const express = require('express')
const Groq = require('groq-sdk')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { writingSubmitSchema } = require('../validators/submissionValidator')
const { cleanJsonRaw, repairTruncatedJson } = require('../services/json/jsonSanitizer')

const router = express.Router()
const prisma = require('../lib/prisma')
const getGroqClient = () => new Groq({ apiKey: process.env.GROQ_API_KEY })

// Public: 4 Writing samples mới nhất cho trang chủ
router.get('/samples', async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'writing', deletedAt: null },
      take: 4,
      select: {
        id: true, title: true, createdAt: true, coverImageUrl: true,
        _count: { select: { attempts: true } },
        writingTasks: { select: { number: true }, orderBy: { number: 'asc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    })
    const result = exams.map(e => ({
      id: e.id, title: e.title, createdAt: e.createdAt, coverImageUrl: e.coverImageUrl,
      attemptCount: e._count.attempts,
      tag: e.writingTasks[0] ? `Task ${e.writingTasks[0].number}` : 'Task 1'
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'writing', deletedAt: null },
      take: 100,
      select: { id: true, title: true, createdAt: true, coverImageUrl: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(exams)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/exams/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { writingTasks: { orderBy: { number: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề' })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Khôi phục kết quả đã chấm của CHÍNH user cho 1 đề Writing (Tầng 4).
// "Latest wins" theo taskId (pattern giống fulltest.js) — chỉ trả task đã có
// answer với status 'graded' + aiFeedback parse được. Client merge thẳng vào
// state `results` (key theo taskId) mà không phải sửa UI render.
router.get('/exams/:id/my-results', authMiddleware, async (req, res) => {
  try {
    const examId = parseInt(req.params.id)
    const userId = req.user.userId

    const tasks = await prisma.writingTask.findMany({
      where: { examId },
      select: { id: true }
    })
    const taskIds = tasks.map(t => t.id)
    if (taskIds.length === 0) return res.json([])

    // userId trong where clause ngay từ đầu — không thể chạm answer của user khác
    const answers = await prisma.writingAnswer.findMany({
      where: { userId, taskId: { in: taskIds } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, taskId: true, status: true, aiFeedback: true, wordCount: true }
    })

    // list đã desc theo createdAt → bản đầu tiên gặp cho mỗi task = mới nhất
    const latestByTask = {}
    for (const a of answers) {
      if (!latestByTask[a.taskId]) latestByTask[a.taskId] = a
    }

    const results = []
    for (const a of Object.values(latestByTask)) {
      if (a.status !== 'graded' || !a.aiFeedback) continue
      let feedback
      try { feedback = JSON.parse(a.aiFeedback) } catch { continue }
      results.push({
        taskId: a.taskId,
        answerId: a.id,
        status: 'graded',
        overall: feedback.overall,
        criteria: feedback.criteria,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        wordCount: a.wordCount
      })
    }

    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

async function processWritingAI(answerId, taskPrompt, taskNumber, essay) {
  try {
    await prisma.writingAnswer.update({
      where: { id: answerId },
      data: { status: 'grading' }
    })

    const prompt = `Bạn là giám khảo IELTS. Chấm bài Writing Task ${taskNumber}.

ĐỀ BÀI: ${taskPrompt}
BÀI VIẾT: ${essay}

Trả về JSON (không có gì khác):
{
  "overall": 6.5,
  "criteria": {
    "task_achievement": { "score": 6.5, "comment": "..." },
    "coherence_cohesion": { "score": 6.5, "comment": "..." },
    "lexical_resource": { "score": 6.5, "comment": "..." },
    "grammatical_range": { "score": 6.5, "comment": "..." }
  },
  "strengths": "...",
  "improvements": "..."
}`

    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const finishReason = completion.choices[0]?.finish_reason || null
    const cleanedJson = repairTruncatedJson(responseText, finishReason)
    const feedback = JSON.parse(cleanedJson)

    // Round all scores to nearest IELTS half-band (0, 0.5, 1, ..., 9)
    const roundBand = s => Math.round(Math.min(9, Math.max(0, parseFloat(s) || 0)) * 2) / 2
    feedback.overall = roundBand(feedback.overall)
    if (feedback.criteria) {
      for (const key of Object.keys(feedback.criteria)) {
        if (feedback.criteria[key]) feedback.criteria[key].score = roundBand(feedback.criteria[key].score)
      }
    }

    await prisma.writingAnswer.update({
      where: { id: answerId },
      data: {
        aiFeedback: JSON.stringify(feedback),
        aiScore: feedback.overall,
        status: 'graded',
        error: null
      }
    })

    // Non-fatal criterion-level logging for Writing (Layer 1)
    try {
      const answerRecord = await prisma.writingAnswer.findUnique({
        where: { id: answerId },
        select: { userId: true },
      })

      if (answerRecord && feedback.criteria) {
        const validCriteriaKeys = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range']
        const criterionLogEntries = []

        for (const key of validCriteriaKeys) {
          if (feedback.criteria[key]) {
            criterionLogEntries.push({
              userId: answerRecord.userId,
              writingAnswerId: answerId,
              criterion: key,
              score: feedback.criteria[key].score || 0,
              comment: feedback.criteria[key].comment || '',
            })
          }
        }

        if (criterionLogEntries.length > 0) {
          await prisma.writingCriterionLog.createMany({
            data: criterionLogEntries,
          })
        }
      }
    } catch (logErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Writing CriterionLog Error Non-Fatal]', logErr.message)
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Writing AI Error]', error)
    await prisma.writingAnswer.update({
      where: { id: answerId },
      data: {
        status: 'failed',
        error: error.message || 'Lỗi chấm bài AI'
      }
    }).catch(() => {})
  }
}

router.post('/exams/:id/submit', authMiddleware, validate(writingSubmitSchema), async (req, res) => {
  try {
    const { taskId, essay, autoSubmit } = req.body
    const examId = parseInt(req.params.id)
    const task = await prisma.writingTask.findUnique({ where: { id: taskId } })
    if (!task) return res.status(404).json({ message: 'Không tìm thấy task' })
    if (task.examId !== examId) {
      return res.status(400).json({ message: 'Task không thuộc đề thi này' })
    }

    // BUG-26: Enforce max_attempts_per_exam setting
    const maxSetting = await prisma.setting.findUnique({ where: { key: 'max_attempts_per_exam' } })
    const maxAttempts = maxSetting ? parseInt(maxSetting.value) : 0
    if (maxAttempts > 0) {
      const prevCount = await prisma.attempt.count({ where: { userId: req.user.userId, examId } })
      if (prevCount >= maxAttempts) {
        return res.status(429).json({ message: `Bạn đã đạt giới hạn ${maxAttempts} lượt thi cho đề này.` })
      }
    }

    const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0

    if (wordCount < 50) {
      // Nộp thủ công: giữ nguyên hành vi cũ — chặn bài dưới 50 từ.
      if (!autoSubmit) return res.status(400).json({ message: 'Bài viết quá ngắn!' })

      // Tự động nộp khi hết giờ, bài dưới 50 từ (kể cả rỗng): ghi thẳng band 0,
      // KHÔNG gọi Groq — không đủ nội dung để AI chấm.
      const feedback = {
        overall: 0,
        criteria: {
          task_achievement:   { score: 0, comment: 'Không đủ dữ liệu để chấm' },
          coherence_cohesion: { score: 0, comment: 'Không đủ dữ liệu để chấm' },
          lexical_resource:   { score: 0, comment: 'Không đủ dữ liệu để chấm' },
          grammatical_range:  { score: 0, comment: 'Không đủ dữ liệu để chấm' },
        },
        strengths: [],
        improvements: ['Bài viết chưa đủ nội dung để đánh giá.'],
      }
      const zeroAnswer = await prisma.writingAnswer.create({
        data: {
          userId: req.user.userId,
          taskId,
          essayText: essay,
          wordCount,
          status: 'graded',
          aiScore: 0,
          aiFeedback: JSON.stringify(feedback),
        }
      })
      return res.json({ answerId: zeroAnswer.id, status: 'graded', ...feedback, wordCount })
    }

    // wordCount >= 50: luồng chấm AI bình thường (autoSubmit hay không đều như nhau).
    const writingAnswer = await prisma.writingAnswer.create({
      data: {
        userId: req.user.userId,
        taskId,
        essayText: essay,
        wordCount,
        status: 'pending'
      }
    })

    // Fire-and-forget background processing
    processWritingAI(writingAnswer.id, task.prompt, task.number, essay).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('[processWritingAI Unhandled]', err)
    })

    // Return response immediately
    res.json({ answerId: writingAnswer.id, status: 'pending', wordCount })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi nộp bài', error: error.message })
  }
})

// Endpoint cho Client polling trạng thái chấm bài Writing
router.get('/answers/:id/status', authMiddleware, async (req, res) => {
  try {
    const answerId = parseInt(req.params.id)
    const answer = await prisma.writingAnswer.findUnique({ where: { id: answerId } })
    if (!answer) return res.status(404).json({ message: 'Không tìm thấy bài làm' })
    if (answer.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Không có quyền xem kết quả này' })
    }

    if (answer.status === 'graded') {
      let feedback = {}
      try { feedback = JSON.parse(answer.aiFeedback || '{}') } catch {}
      return res.json({
        answerId: answer.id,
        status: 'graded',
        ...feedback,
        wordCount: answer.wordCount
      })
    }

    if (answer.status === 'failed') {
      return res.json({
        answerId: answer.id,
        status: 'failed',
        error: answer.error || 'Lỗi chấm bài'
      })
    }

    return res.json({
      answerId: answer.id,
      status: answer.status
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
