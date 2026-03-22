const express = require('express')
const { PrismaClient } = require('@prisma/client')
const Groq = require('groq-sdk')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

router.get('/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'speaking' },
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

router.post('/exams/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { partId, transcript } = req.body
    const part = await prisma.speakingPart.findUnique({
      where: { id: partId },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!part) return res.status(404).json({ message: 'Không tìm thấy part' })

    const wordCount = transcript.trim().split(/\s+/).length
    if (wordCount < 10) return res.status(400).json({ message: 'Câu trả lời quá ngắn!' })

    const questionsText = part.questions.map((q, i) => `${i + 1}. ${q.questionText}`).join('\n')

    const prompt = `Bạn là giám khảo IELTS Speaking. Đánh giá câu trả lời Part ${part.number}.

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

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3
    })

    const feedback = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim())

    // Round all scores to nearest IELTS half-band (0, 0.5, 1, ..., 9)
    const roundBand = s => Math.round(Math.min(9, Math.max(0, parseFloat(s) || 0)) * 2) / 2
    feedback.overall = roundBand(feedback.overall)
    if (feedback.criteria) {
      for (const key of Object.keys(feedback.criteria)) {
        if (feedback.criteria[key]) feedback.criteria[key].score = roundBand(feedback.criteria[key].score)
      }
    }

    await prisma.speakingAnswer.create({
      data: {
        userId: req.user.userId,
        partId,
        transcript,
        aiFeedback: JSON.stringify(feedback),
        aiScore: feedback.overall
      }
    })

    res.json(feedback)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi nhận xét', error: error.message })
  }
})

module.exports = router
