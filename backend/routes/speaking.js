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
const { analyzeTranscript, isInsufficient, insufficientFeedback, pickCurrentAttempt, readWhisperResult, applyRelevanceCap } = require('../lib/speakingAttempt')
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

    const latestByPart = pickCurrentAttempt(answers.map(a => ({ ...a, partNumber: partNumberById[a.partId] })))

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

    const questions = (partQuestions || []).filter(q => !String(q.questionText || '').startsWith('##TOPIC##:'))
    const questionsText = questions.map((q, i) => `${i + 1}. ${q.questionText}`).join('\n')
    const questionCount = Math.max(questions.length, 1)
    const answerLines = analysis.spoken.map((e, idx) => {
      const q = questions.find(x => x.id === e.questionId) || (e.questionId == null ? questions[e.index] : null)
      const asked = q ? q.questionText : (partNumber === 2 ? 'Cue card ở trên' : 'Không xác định')
      return `Câu ${idx + 1}\n  Hỏi: ${asked}\n  Trả lời: ${e.text}`
    }).join('\n')

    const prompt = `Bạn là giám khảo IELTS Speaking. Đánh giá câu trả lời Part ${partNumber}.

CÂU HỎI:\n${questionsText}
CÂU TRẢ LỜI (mỗi câu kèm đúng câu hỏi mà thí sinh đang trả lời; thí sinh trả lời ${analysis.answeredCount}/${questionCount} câu, các câu bỏ trống đã bị loại):\n${answerLines}

Chỉ chấm dựa trên nội dung thí sinh thực sự nói. Câu bỏ trống hoặc trả lời lạc đề phải làm giảm điểm Fluency and Coherence tương ứng.
Đếm "on_topic_answers" là số câu trả lời thực sự trả lời đúng câu hỏi tương ứng bằng tiếng Anh có nghĩa. Câu lạc đề, vô nghĩa, nói về chủ đề khác hoặc chỉ là vài từ rời rạc thì KHÔNG được tính.

Sửa lỗi trực tiếp trong câu trả lời: liệt kê các lỗi ngữ pháp, từ vựng, chính tả, dấu câu theo đúng thứ tự xuất hiện. "original" phải chép NGUYÊN VĂN một cụm ngắn (1-6 từ) có thật trong câu trả lời, "corrected" là cụm thay thế đúng, "explanation" giải thích ngắn gọn bằng tiếng Việt vì sao sai và vì sao sửa như vậy. Chỉ sửa lỗi thật, không viết lại câu đã đúng, chấp nhận cả chính tả Anh-Anh và Anh-Mỹ (vd colour/color, cosier/cozier đều đúng). Tối đa 25 lỗi. "answer" là số thứ tự "Câu n" chứa lỗi. Bỏ qua các từ đệm như "um", "uh" vì đây là văn nói.

Trả về JSON (không có gì khác):
{
  "on_topic_answers": 3,
  "overall": 6.5,
  "criteria": {
    "fluency": { "score": 6.5, "comment": "..." },
    "vocabulary": { "score": 6.5, "comment": "..." },
    "grammar": { "score": 6.5, "comment": "..." },
    "pronunciation": { "score": 6.5, "comment": "..." }
  },
  "corrections": [
    { "answer": 1, "original": "cụm sai trong câu trả lời", "corrected": "cụm đúng", "type": "grammar|vocabulary|spelling|word_choice", "explanation": "..." }
  ]
}`

    const feedback = await requestGradingJson(prompt)

    // Round all scores to nearest IELTS half-band (0, 0.5, 1, ..., 9)
    const roundBand = s => Math.round(Math.min(9, Math.max(0, parseFloat(s) || 0)) * 2) / 2
    feedback.overall = roundBand(feedback.overall)
    if (feedback.criteria) {
      for (const key of Object.keys(feedback.criteria)) {
        if (feedback.criteria[key]) feedback.criteria[key].score = roundBand(feedback.criteria[key].score)
      }
    }
    applyRelevanceCap(feedback, analysis.answeredCount)
    feedback.corrections = sanitizeCorrections(feedback.corrections, analysis.entries.map(e => e.text), { indexMap: analysis.spoken.map(e => e.index) })

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

    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: { status: 'pending', error: null }
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
