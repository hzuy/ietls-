const express = require('express')
const authMiddleware = require('../middleware/auth')
const { learnerOnly } = require('../lib/roles')
const validate = require('../middleware/validate')
const { aiSubmitLimiter } = require('../middleware/rateLimiter')
const { writingSubmitSchema } = require('../validators/submissionValidator')
const { sanitizeCorrections } = require('../lib/inlineCorrections')

const router = express.Router()
const prisma = require('../lib/prisma')
const { requestGradingJson } = require('../lib/groqClient')
const { writingAttempts, pickAttempt } = require('../lib/attemptGroups')
const { buildWritingGradingPrompt, applyWritingGradingRules, preCheckEssay, resolveImageToDataUri } = require('../lib/writingGrading')

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
// "Latest wins" theo taskId (pattern giống fulltest.js) — trả task đã có answer
// 'graded' (+ aiFeedback parse được) HOẶC 'failed' (kèm answerId + error để
// client hiện banner lỗi + nút "Thử chấm điểm lại" thay vì im lặng coi như
// task chưa từng nộp). Task đang 'pending'/'grading' bị bỏ qua — không có cách
// tiếp tục polling sau khi reload trang, giữ hành vi cũ.
router.get('/exams/:id/my-results', authMiddleware, learnerOnly, async (req, res) => {
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
      select: { id: true, taskId: true, status: true, aiFeedback: true, wordCount: true, error: true, essayText: true, createdAt: true }
    })

    const latestByTask = pickAttempt(writingAttempts(answers), req.query.attemptId)?.items || {}

    const results = []
    for (const a of Object.values(latestByTask)) {
      if (a.status === 'graded' && a.aiFeedback) {
        let feedback
        try { feedback = JSON.parse(a.aiFeedback) } catch { continue }
        results.push({
          taskId: a.taskId,
          answerId: a.id,
          status: 'graded',
          overall: feedback.overall,
          criteria: feedback.criteria,
          corrections: Array.isArray(feedback.corrections) ? feedback.corrections : [],
          wordCount: a.wordCount,
          essayText: a.essayText,
          createdAt: a.createdAt
        })
      } else if (a.status === 'failed') {
        results.push({
          taskId: a.taskId,
          answerId: a.id,
          status: 'failed',
          error: a.error || 'Lỗi chấm bài AI'
        })
      }
    }

    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

async function processWritingAI(answerId, taskPrompt, taskNumber, essay, imageUrl = null) {
  try {
    await prisma.writingAnswer.update({
      where: { id: answerId },
      data: { status: 'grading' }
    })

    const minWords = taskNumber === 1 ? 150 : 250
    const preCheck = preCheckEssay(essay, taskPrompt, minWords)
    const wordCount = preCheck.wordCount

    // MỤC 5: Kiểm tra gibberish trước khi gọi AI — trả 1.0 cho cả 4 tiêu chí, KHÔNG gọi AI
    if (preCheck.isGibberish) {
      const feedback = {
        relevance_reason: preCheck.reason,
        relevance: 'gibberish',
        criteria: {
          task_achievement: { score: 1.0, comment: `Bài viết không hợp lệ: ${preCheck.reason}.` },
          coherence_cohesion: { score: 1.0, comment: 'Không đủ dữ liệu đánh giá tính mạch lạc.' },
          lexical_resource: { score: 1.0, comment: 'Không đủ dữ liệu đánh giá vốn từ vựng.' },
          grammatical_range: { score: 1.0, comment: 'Không đủ dữ liệu đánh giá ngữ pháp.' },
        },
        overall: 1.0,
        corrections: [],
        offTopic: true,
      }

      await prisma.writingAnswer.update({
        where: { id: answerId },
        data: {
          aiFeedback: JSON.stringify(feedback),
          aiScore: 1.0,
          status: 'graded',
          error: null
        }
      })
      return
    }

    let imageDataUri = null
    if (taskNumber === 1 && imageUrl) {
      try {
        imageDataUri = await resolveImageToDataUri(imageUrl)
      } catch (imgErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[processWritingAI resolveImageToDataUri warning]', imgErr.message)
        }
      }
    }

    const prompt = buildWritingGradingPrompt({
      taskPrompt,
      taskNumber,
      essay,
      wordCount,
      hasImage: Boolean(imageDataUri)
    })

    const rawFeedback = await requestGradingJson(prompt, { image: imageDataUri })
    const feedback = applyWritingGradingRules(rawFeedback, wordCount, minWords, essay)
    feedback.corrections = sanitizeCorrections(feedback.corrections, [essay])

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

router.post('/exams/:id/submit', authMiddleware, learnerOnly, aiSubmitLimiter, validate(writingSubmitSchema), async (req, res) => {
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
    processWritingAI(writingAnswer.id, task.prompt, task.number, essay, task.imageUrl).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('[processWritingAI Unhandled]', err)
    })

    // Return response immediately
    res.json({ answerId: writingAnswer.id, status: 'pending', wordCount })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi nộp bài', error: error.message })
  }
})

// Endpoint cho Client polling trạng thái chấm bài Writing
router.get('/answers/:id/status', authMiddleware, learnerOnly, async (req, res) => {
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
        wordCount: answer.wordCount,
        essayText: answer.essayText,
        createdAt: answer.createdAt
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

// Chấm lại 1 answer đang status='failed' bằng chính essayText đã lưu — không
// yêu cầu người dùng viết lại. Khác với /submit (luôn tạo answer MỚI): retry
// chấm lại NGAY trên bản ghi cũ, dùng cho lỗi hạ tầng AI (model đổi, timeout...)
// chứ không phải muốn viết lại nội dung (dùng nút "Nộp lại" ở FE cho trường hợp đó).
router.post('/answers/:id/retry', authMiddleware, learnerOnly, aiSubmitLimiter, async (req, res) => {
  try {
    const answerId = parseInt(req.params.id)
    const answer = await prisma.writingAnswer.findUnique({
      where: { id: answerId },
      include: { task: true }
    })
    if (!answer) return res.status(404).json({ message: 'Không tìm thấy bài làm' })
    if (answer.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Không có quyền với bài làm này' })
    }
    if (answer.status !== 'failed') {
      return res.status(400).json({ message: 'Chỉ có thể chấm lại bài đang ở trạng thái lỗi' })
    }

    await prisma.writingAnswer.update({
      where: { id: answerId },
      data: { status: 'pending', error: null }
    })

    processWritingAI(answerId, answer.task.prompt, answer.task.number, answer.essayText, answer.task.imageUrl).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('[processWritingAI Retry Unhandled]', err)
    })

    res.json({ answerId, status: 'pending' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
