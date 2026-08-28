const express = require('express')
const Groq = require('groq-sdk')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { speakingSubmitSchema, transcribeSchema } = require('../validators/submissionValidator')
const { cleanJsonRaw, repairTruncatedJson } = require('../services/json/jsonSanitizer')

const router = express.Router()
const prisma = require('../lib/prisma')
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

// ── Public: 4 Speaking samples mới nhất cho trang chủ ───────────────────────
router.get('/samples', async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'speaking', deletedAt: null },
      take: 4,
      select: {
        id: true, title: true, createdAt: true, coverImageUrl: true,
        _count: { select: { attempts: true } },
        speakingParts: { select: { number: true }, orderBy: { number: 'asc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    })
    const result = exams.map(e => ({
      id: e.id, title: e.title, createdAt: e.createdAt, coverImageUrl: e.coverImageUrl,
      attemptCount: e._count.attempts,
      tag: e.speakingParts[0] ? `Part ${e.speakingParts[0].number}` : 'Part 1'
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
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

// ── POST /speaking/transcribe — Whisper STT fallback (Brave/Firefox/Safari) ──
// Nhận chunk audio và dịch text. Dùng prompt context để tránh duplicate word khi chia chunk.
router.post('/transcribe', authMiddleware, audioUpload.single('audio'), validate(transcribeSchema), async (req, res) => {
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
      language: 'en',
      response_format: 'json',
      temperature: 0,
      prompt: promptContext,
    })

    // Clean up temp file sau khi success
    fs.unlink(filePath, () => {})

    res.json({ transcript: transcription.text || '' })
  } catch (error) {
    // Clean up file nếu có lỗi xảy ra
    if (filePath) fs.unlink(filePath, () => {})
    console.error('[Whisper transcribe error]', error.message)
    res.status(500).json({ message: 'Lỗi nhận dạng giọng nói', error: error.message })
  }
})

async function processSpeakingAI(answerId, partNumber, questionsText, transcript) {
  try {
    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: { status: 'grading' }
    })

    const prompt = `Bạn là giám khảo IELTS Speaking. Đánh giá câu trả lời Part ${partNumber}.

CÂU HỎI:\n${questionsText}
CÂU TRẢ LỜI: ${transcript}

Trả về JSON (không có gì khác):
{
  "overall": 6.5,
  "criteria": {
    "fluency": { "score": 6.5, "comment": "..." },
    "vocabulary": { "score": 6.5, "comment": "..." },
    "grammar": { "score": 6.5, "comment": "..." },
    "pronunciation": { "score": 6.5, "comment": "..." }
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

router.post('/exams/:id/submit', authMiddleware, validate(speakingSubmitSchema), async (req, res) => {
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

    const wordCount = transcript.trim().split(/\s+/).length
    if (wordCount < 10) return res.status(400).json({ message: 'Câu trả lời quá ngắn!' })

    const questionsText = part.questions.map((q, i) => `${i + 1}. ${q.questionText}`).join('\n')

    const speakingAnswer = await prisma.speakingAnswer.create({
      data: {
        userId: req.user.userId,
        partId,
        transcript,
        status: 'pending'
      }
    })

    // Fire-and-forget background processing
    processSpeakingAI(speakingAnswer.id, part.number, questionsText, transcript).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('[processSpeakingAI Unhandled]', err)
    })

    // Return response immediately
    res.json({ answerId: speakingAnswer.id, status: 'pending' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi nộp bài', error: error.message })
  }
})

// Endpoint cho Client polling trạng thái nhận xét Speaking
router.get('/answers/:id/status', authMiddleware, async (req, res) => {
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
      return res.json({
        answerId: answer.id,
        status: 'graded',
        ...feedback
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

module.exports = router
