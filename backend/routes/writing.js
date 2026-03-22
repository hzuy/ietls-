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
      where: { skill: 'writing' },
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

router.post('/exams/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { taskId, essay } = req.body
    const task = await prisma.writingTask.findUnique({ where: { id: taskId } })
    if (!task) return res.status(404).json({ message: 'Không tìm thấy task' })

    const wordCount = essay.trim().split(/\s+/).length
    if (wordCount < 50) return res.status(400).json({ message: 'Bài viết quá ngắn!' })

    const prompt = `Bạn là giám khảo IELTS. Chấm bài Writing Task ${task.number}.

ĐỀ BÀI: ${task.prompt}
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

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3
    })

    const responseText = completion.choices[0].message.content
    const feedback = JSON.parse(responseText.replace(/```json|```/g, '').trim())

    // Round all scores to nearest IELTS half-band (0, 0.5, 1, ..., 9)
    const roundBand = s => Math.round(Math.min(9, Math.max(0, parseFloat(s) || 0)) * 2) / 2
    feedback.overall = roundBand(feedback.overall)
    if (feedback.criteria) {
      for (const key of Object.keys(feedback.criteria)) {
        if (feedback.criteria[key]) feedback.criteria[key].score = roundBand(feedback.criteria[key].score)
      }
    }

    await prisma.writingAnswer.create({
      data: {
        userId: req.user.userId,
        taskId,
        essayText: essay,
        wordCount,
        aiFeedback: JSON.stringify(feedback),
        aiScore: feedback.overall
      }
    })

    res.json({ ...feedback, wordCount })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi chấm bài', error: error.message })
  }
})

module.exports = router
