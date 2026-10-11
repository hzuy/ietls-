const express = require('express')
const Groq = require('groq-sdk')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const { learnerOnly } = require('../lib/roles')
const validate = require('../middleware/validate')
const { aiSubmitLimiter } = require('../middleware/rateLimiter')
const { speakingSubmitSchema, transcribeSchema } = require('../validators/submissionValidator')
const { sanitizeCorrections } = require('../lib/inlineCorrections')
const { uploadAudio } = require('../services/storageService')

const router = express.Router()
const prisma = require('../lib/prisma')
const { requestGradingJson } = require('../lib/groqClient')
const { speakingAttempts, pickAttempt } = require('../lib/attemptGroups')
const {
  analyzeTranscript,
  isInsufficient,
  insufficientFeedback,
  pickCurrentAttempt,
  readWhisperResult,
  applyRelevanceCap,
  roundBand,
  buildSpeakingGradingPrompt,
  applySpeakingGradingRules,
} = require('../lib/speakingAttempt')
const getGroqClient = () => new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Audio upload config (for Whisper transcription) ──────────────────────────
const tmpDir = path.join(__dirname, '..', 'uploads', 'tmp')
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmpDir),
    filename: (req, file, cb) => {
      const ext = (file.originalname.split('.').pop() || 'webm').toLowerCase()
      cb(null, `audio-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`)
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true)
    } else {
      cb(new Error('Chỉ chấp nhận file audio'))
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB — Groq Whisper limit
})

router.get('/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'speaking', deletedAt: null },
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
      include: {
        speakingParts: {
          orderBy: { number: 'asc' },
          include: { questions: { orderBy: { orderNum: 'asc' } } }
        }
      }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề' })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Khôi phục kết quả đã chấm của CHÍNH user cho 1 đề Speaking (Tầng 4).
// "Latest wins" theo partId (pattern giống fulltest.js) — trả part đã có answer
// 'graded' (+ aiFeedback parse được, kèm transcript để ô "Bài nói của bạn" hiển
// thị đúng) HOẶC 'failed' (kèm answerId + error để client hiện banner lỗi +
// nút "Thử chấm điểm lại" thay vì im lặng treo ở "Đang tổng hợp kết quả").
// Part đang 'pending'/'grading' bị bỏ qua — không có cách tiếp tục polling sau
// khi reload trang, giữ hành vi cũ.
router.get('/exams/:id/my-results', authMiddleware, learnerOnly, async (req, res) => {
  try {
    const examId = parseInt(req.params.id)
    const userId = req.user.userId

    const parts = await prisma.speakingPart.findMany({
      where: { examId },
      select: { id: true, number: true }
    })
    const partIds = parts.map(p => p.id)
    if (partIds.length === 0) return res.json([])
    const partNumberById = Object.fromEntries(parts.map(p => [p.id, p.number]))

    // userId trong where clause ngay từ đầu — không thể chạm answer của user khác
    const answers = await prisma.speakingAnswer.findMany({
      where: { userId, partId: { in: partIds } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, partId: true, status: true, aiFeedback: true, transcript: true, error: true, createdAt: true }
    })

    const groups = speakingAttempts(answers.map(a => ({ ...a, partNumber: partNumberById[a.partId] })))
    const latestByPart = pickAttempt(groups, req.query.attemptId)?.items || {}

    const results = []
    for (const a of Object.values(latestByPart)) {
      if (a.status === 'graded' && a.aiFeedback) {
        let feedback
        try { feedback = JSON.parse(a.aiFeedback) } catch { continue }
        results.push({
          partId: a.partId,
          answerId: a.id,
          status: 'graded',
          overall: Number.isFinite(Number(feedback.overall)) ? Number(feedback.overall) : 0,
          insufficient: feedback.insufficient === true || !Number.isFinite(Number(feedback.overall)),
          offTopic: feedback.offTopic === true,
          criteria: feedback.criteria,
          corrections: Array.isArray(feedback.corrections) ? feedback.corrections : [],
          transcript: a.transcript,
          createdAt: a.createdAt
        })
      } else if (a.status === 'failed') {
        results.push({
          partId: a.partId,
          answerId: a.id,
          status: 'failed',
          error: a.error || 'Lỗi nhận xét AI',
          transcript: a.transcript,
          createdAt: a.createdAt
        })
      } else if (a.status === 'pending' || a.status === 'grading') {
        const age = Date.now() - new Date(a.createdAt).getTime()
        if (age > 5 * 60 * 1000) { // > 5 phút
          results.push({
            partId: a.partId,
            answerId: a.id,
            status: 'failed',
            error: 'Hệ thống AI đang quá tải. Quá trình chấm điểm cho phần này đã bị hủy, vui lòng thử lại.',
            transcript: a.transcript,
            createdAt: a.createdAt
          })
        }
      }
    }

    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ── POST /speaking/transcribe — Whisper STT fallback (Brave/Firefox/Safari) ──
// Nhận chunk audio và dịch text. Dùng prompt context để tránh duplicate word khi chia chunk.
router.post('/transcribe', authMiddleware, learnerOnly, audioUpload.single('audio'), validate(transcribeSchema), async (req, res) => {
  const filePath = req.file?.path
  const promptContext = req.body.prompt || ''

  try {
    if (!req.file || !filePath) {
      return res.status(400).json({ message: 'Không có file audio' })
    }

    const groq = getGroqClient()

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      temperature: 0,
      prompt: promptContext,
    })

    const { text, isEnglish, languageLabel } = readWhisperResult(transcription)

    if (text && !isEnglish) {
      fs.unlink(filePath, () => {})
      return res.status(422).json({
        code: 'NOT_ENGLISH',
        message: `Hệ thống nhận ra bạn đang nói ${languageLabel}. Bài thi IELTS Speaking chỉ chấm câu trả lời bằng tiếng Anh, vui lòng trả lời lại bằng tiếng Anh.`
      })
    }

    const uploadRes = await uploadAudio({ path: filePath, filename: req.file.filename }, { subdir: 'user_audio', folder: 'user_audio' })
    const audioUrl = uploadRes.url

    res.json({ transcript: text, audioUrl })
  } catch (error) {
    // Clean up file nếu có lỗi xảy ra
    if (filePath) fs.unlink(filePath, () => {})
    console.error('[Whisper transcribe error]', error.message)
    res.status(500).json({ message: 'Lỗi nhận dạng giọng nói', error: error.message })
  }
})

async function processSpeakingAI(answerId, partNumber, partQuestions, transcript) {
  try {
    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: { status: 'grading' }
    })

    const analysis = analyzeTranscript(transcript)

    if (isInsufficient(partNumber, analysis)) {
      await prisma.speakingAnswer.update({
        where: { id: answerId },
        data: {
          status: 'graded',
          aiScore: 0,
          aiFeedback: JSON.stringify(insufficientFeedback()),
          error: null
        }
      })
      return
    }

    const prompt = buildSpeakingGradingPrompt({ partNumber, partQuestions, analysis })

    const feedback = await requestGradingJson(prompt)

    applySpeakingGradingRules(feedback, analysis, { partNumber })

    feedback.corrections = sanitizeCorrections(
      feedback.corrections,
      analysis.entries.map(e => e.text),
      { indexMap: analysis.spoken.map(e => e.index), isSpeaking: true }
    )

    // Preserve retryCount if previously set on answer
    const prevAnswer = await prisma.speakingAnswer.findUnique({
      where: { id: answerId },
      select: { aiFeedback: true }
    }).catch(() => null)
    if (prevAnswer?.aiFeedback) {
      try {
        const prevMeta = JSON.parse(prevAnswer.aiFeedback)
        if (prevMeta.retryCount != null) {
          feedback.retryCount = prevMeta.retryCount
        }
      } catch {}
    }

    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: {
        aiFeedback: JSON.stringify(feedback),
        aiScore: feedback.overall,
        status: 'graded',
        error: null
      }
    })

    // Non-fatal criterion-level logging for Speaking (Layer 1)
    try {
      const answerRecord = await prisma.speakingAnswer.findUnique({
        where: { id: answerId },
        select: { userId: true },
      })

      if (answerRecord && feedback.criteria) {
        const validCriteriaKeys = ['fluency', 'vocabulary', 'grammar', 'pronunciation']
        const criterionLogEntries = []

        for (const key of validCriteriaKeys) {
          if (feedback.criteria[key]) {
            criterionLogEntries.push({
              userId: answerRecord.userId,
              speakingAnswerId: answerId,
              criterion: key,
              score: feedback.criteria[key].score || 0,
              comment: feedback.criteria[key].comment || '',
            })
          }
        }

        if (criterionLogEntries.length > 0) {
          await prisma.speakingCriterionLog.createMany({
            data: criterionLogEntries,
          })
        }
      }
    } catch (logErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Speaking CriterionLog Error Non-Fatal]', logErr.message)
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Speaking AI Error]', error)
    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: {
        status: 'failed',
        error: error.message || 'Lỗi nhận xét AI'
      }
    }).catch(() => {})
  }
}

router.post('/exams/:id/submit', authMiddleware, learnerOnly, aiSubmitLimiter, validate(speakingSubmitSchema), async (req, res) => {
  try {
    const { partId, transcript } = req.body
    const examId = parseInt(req.params.id)
    const part = await prisma.speakingPart.findUnique({
      where: { id: partId },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!part) return res.status(404).json({ message: 'Không tìm thấy part' })
    if (part.examId !== examId) {
      return res.status(400).json({ message: 'Part không thuộc đề thi này' })
    }

    if (analyzeTranscript(transcript).spoken.length > 0) {
      const previous = await prisma.speakingAnswer.findFirst({
        where: { userId: req.user.userId, partId },
        orderBy: { createdAt: 'desc' },
        select: { transcript: true }
      })
      if (previous && previous.transcript === transcript) {
        return res.status(409).json({
          code: 'DUPLICATE_ANSWER',
          message: 'Câu trả lời này giống hệt lần nộp trước. Vui lòng ghi âm lại phần này.'
        })
      }
    }

    const speakingAnswer = await prisma.speakingAnswer.create({
      data: {
        userId: req.user.userId,
        partId,
        transcript,
        status: 'pending'
      }
    })

    // Fire-and-forget background processing
    processSpeakingAI(speakingAnswer.id, part.number, part.questions, transcript).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('[processSpeakingAI Unhandled]', err)
    })

    // Return response immediately
    res.json({ answerId: speakingAnswer.id, status: 'pending' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi nộp bài', error: error.message })
  }
})

// Endpoint cho Client polling trạng thái nhận xét Speaking
router.get('/answers/:id/status', authMiddleware, learnerOnly, async (req, res) => {
  try {
    const answerId = parseInt(req.params.id)
    const answer = await prisma.speakingAnswer.findUnique({ where: { id: answerId } })
    if (!answer) return res.status(404).json({ message: 'Không tìm thấy bài làm' })
    if (answer.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Không có quyền xem kết quả này' })
    }

    if (answer.status === 'graded') {
      let feedback = {}
      try { feedback = JSON.parse(answer.aiFeedback || '{}') } catch {}
      const overall = Number(feedback.overall)
      return res.json({
        answerId: answer.id,
        status: 'graded',
        ...feedback,
        overall: Number.isFinite(overall) ? overall : 0,
        insufficient: feedback.insufficient === true || !Number.isFinite(overall)
      })
    }

    if (answer.status === 'failed') {
      return res.json({
        answerId: answer.id,
        status: 'failed',
        error: answer.error || 'Lỗi nhận xét'
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

// Chấm lại 1 answer đang status='failed' bằng chính transcript đã lưu — không
// yêu cầu người dùng ghi âm lại. Khác với /submit (luôn tạo answer MỚI): retry
// chấm lại NGAY trên bản ghi cũ, dùng cho lỗi hạ tầng AI (model đổi, timeout...)
// chứ không phải muốn nói lại nội dung (dùng nút "Nộp lại" ở FE cho trường hợp đó).
router.post('/answers/:id/retry', authMiddleware, learnerOnly, aiSubmitLimiter, async (req, res) => {
  try {
    const answerId = parseInt(req.params.id)
    const answer = await prisma.speakingAnswer.findUnique({
      where: { id: answerId },
      include: { part: { include: { questions: { orderBy: { orderNum: 'asc' } } } } }
    })
    if (!answer) return res.status(404).json({ message: 'Không tìm thấy bài làm' })
    if (answer.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Không có quyền với bài làm này' })
    }
    if (answer.status !== 'failed') {
      return res.status(400).json({ message: 'Chỉ có thể chấm lại bài đang ở trạng thái lỗi' })
    }

    let meta = {}
    try {
      meta = typeof answer.aiFeedback === 'string' ? JSON.parse(answer.aiFeedback || '{}') : (answer.aiFeedback || {})
    } catch {}
    const retryCount = Number(meta?.retryCount) || 0
    if (retryCount >= 3) {
      return res.status(400).json({ message: 'Đã đạt giới hạn tối đa 3 lần thử lại cho bài làm này' })
    }

    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: {
        status: 'pending',
        error: null,
        aiFeedback: JSON.stringify({ ...meta, retryCount: retryCount + 1 })
      }
    })

    processSpeakingAI(answerId, answer.part.number, answer.part.questions, answer.transcript).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('[processSpeakingAI Retry Unhandled]', err)
    })

    res.json({ answerId, status: 'pending' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
