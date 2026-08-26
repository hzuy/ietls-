const express = require('express')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { readingSubmitSchema } = require('../validators/submissionValidator')
const { getReadingBand } = require('../lib/scoreUtils')

const router = express.Router()
const prisma = require('../lib/prisma')

// Public: 4 bài Reading mới nhất cho trang chủ
router.get('/featured', async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'reading', deletedAt: null },
      take: 4,
      select: {
        id: true, title: true, createdAt: true, coverImageUrl: true,
        _count: { select: { attempts: true } },
        passages: {
          select: {
            questions: { where: { groupId: null }, select: { id: true } },
            questionGroups: { select: { qNumberStart: true, qNumberEnd: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    const result = exams.map(e => ({
      id: e.id, title: e.title, createdAt: e.createdAt, coverImageUrl: e.coverImageUrl,
      attemptCount: e._count.attempts,
      questionCount: e.passages.reduce((sum, p) => {
        const fromGroups = p.questionGroups.reduce((gs, g) => gs + (g.qNumberEnd - g.qNumberStart + 1), 0)
        return sum + p.questions.length + fromGroups
      }, 0)
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Danh sách đề Reading
router.get('/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'reading', deletedAt: null },
      take: 100,
      select: {
        id: true, title: true, createdAt: true, coverImageUrl: true,
        passages: {
          select: {
            questions: { where: { groupId: null }, select: { id: true } },
            questionGroups: {
              select: {
                qNumberStart: true, qNumberEnd: true,
                questions: { select: { number: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    const result = exams.map(e => ({
      ...e,
      _count: {
        questions: e.passages.reduce((sum, p) => {
          const fromGroups = p.questionGroups.reduce((gs, g) => gs + (g.qNumberEnd - g.qNumberStart + 1), 0)
          return sum + p.questions.length + fromGroups
        }, 0)
      },
      passages: undefined
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Chi tiết 1 đề
// ?withAnswers=true chỉ dành cho admin/teacher preview — trả về correctAnswer
// Mặc định: KHÔNG trả correctAnswer (bảo mật — tránh lộ đáp án qua DevTools)
router.get('/exams/:id', authMiddleware, async (req, res) => {
  try {
    const withAnswers = req.query.withAnswers === 'true'
    // Chỉ staff mới được dùng withAnswers
    if (withAnswers) {
      const role = req.user?.role
      if (role !== 'admin' && role !== 'teacher') {
        return res.status(403).json({ message: 'Không có quyền xem đáp án' })
      }
    }

    // Select fields — loại correctAnswer khi không phải preview mode
    const questionSelect = withAnswers
      ? undefined // include all fields
      : {
          id: true, passageId: true, listeningSectionId: true, groupId: true,
          number: true, type: true, questionText: true, options: true, imageUrl: true
          // correctAnswer intentionally excluded
        }

    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        passages: {
          orderBy: { number: 'asc' },
          include: {
            questions: {
              where: { groupId: null },
              orderBy: { number: 'asc' },
              ...(questionSelect ? { select: questionSelect } : {})
            },
            questionGroups: {
              orderBy: { sortOrder: 'asc' },
              include: {
                questions: {
                  orderBy: { number: 'asc' },
                  ...(questionSelect ? { select: questionSelect } : {})
                },
                noteSections: { orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } },
                matchingOptions: { orderBy: { sortOrder: 'asc' } }
              }
            }
          }
        }
      }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề' })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Nộp bài
router.post('/exams/:id/submit', authMiddleware, validate(readingSubmitSchema), async (req, res) => {
  try {
    const { answers } = req.body // { questionId: userAnswer }
    const examId = parseInt(req.params.id)

    // BUG-26: Enforce max_attempts_per_exam setting
    const maxSetting = await prisma.setting.findUnique({ where: { key: 'max_attempts_per_exam' } })
    const maxAttempts = maxSetting ? parseInt(maxSetting.value) : 0
    if (maxAttempts > 0) {
      const prevCount = await prisma.attempt.count({ where: { userId: req.user.userId, examId } })
      if (prevCount >= maxAttempts) {
        return res.status(429).json({ message: `Bạn đã đạt giới hạn ${maxAttempts} lượt thi cho đề này.` })
      }
    }


    const passages = await prisma.passage.findMany({
      where: { examId },
      include: {
        questions: { where: { groupId: null } },
        questionGroups: { include: { questions: true } }
      }
    })

    let correct = 0
    let totalSlots = 0
    const result = []

    for (const p of passages) {
      for (const q of p.questions) {
        totalSlots++
        const userAnswer = (answers[q.id] || '').trim().toLowerCase()
        const acceptedAnswers = q.correctAnswer.split('/').map(a => a.trim().toLowerCase())
        const isCorrect = acceptedAnswers.includes(userAnswer)
        if (isCorrect) correct++
        result.push({ questionId: q.id, questionType: q.type, questionText: q.questionText, userAnswer: answers[q.id] || '', correctAnswer: q.correctAnswer, isCorrect })
      }
      for (const g of p.questionGroups) {
        totalSlots += g.qNumberEnd - g.qNumberStart + 1
        const maxC = g.maxChoices || 2
        const activeQs = g.type === 'mcq_multi'
          ? g.questions
          : g.questions.filter(q => q.number >= g.qNumberStart && q.number <= g.qNumberEnd)
        for (const q of activeQs) {
          const userAnswerStr = answers[q.id] || ''
          let isGroupCorrect = false
          
          if (g.type === 'mcq_multi') {
            const userArr = userAnswerStr.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
            const correctArr = (q.correctAnswer || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
            
            let matchCount = 0
            for (const ua of userArr) {
              if (correctArr.includes(ua)) matchCount++
            }
            correct += matchCount
            isGroupCorrect = matchCount === maxC
            result.push({ questionId: q.id, questionType: g.type, questionText: q.questionText, userAnswer: userAnswerStr, correctAnswer: q.correctAnswer, isCorrect: isGroupCorrect })
          } else {
            const userAnswer = userAnswerStr.trim().toLowerCase()
            const acceptedAnswers = q.correctAnswer.split('/').map(a => a.trim().toLowerCase())
            const isCorrect = acceptedAnswers.includes(userAnswer)
            if (isCorrect) correct++
            result.push({ questionId: q.id, questionType: g.type, questionText: q.questionText, userAnswer: userAnswerStr, correctAnswer: q.correctAnswer, isCorrect })
          }
        }
      }
    }

    const band = getReadingBand(correct)

    const attempt = await prisma.$transaction(async (tx) => {
      const a = await tx.attempt.create({
        data: {
          userId: req.user.userId,
          examId,
          score: band,
          answers: JSON.stringify(answers),
          finishedAt: new Date()
        }
      })
      if (result.length > 0) {
        await tx.questionAnswer.createMany({
          data: result.map(r => ({
            attemptId: a.id,
            questionId: r.questionId,
            userAnswer: r.userAnswer,
            isCorrect: r.isCorrect,
          }))
        })
      }
      return a
    })

    // Ghi AnswerLog chi tiết cho mục đích phân tích AI (Lớp 1)
    // Bọc try-catch không chắn luồng nộp bài chính nếu bảng AnswerLog chưa được migrate trên DB thực tế
    if (result.length > 0) {
      try {
        await prisma.answerLog.createMany({
          data: result.map(r => ({
            userId: req.user.userId,
            attemptId: attempt.id,
            questionId: r.questionId,
            skillType: 'reading',
            questionType: r.questionType || 'unknown',
            isCorrect: Boolean(r.isCorrect),
            userAnswer: String(r.userAnswer ?? ''),
            correctAnswer: String(r.correctAnswer ?? ''),
          }))
        })
      } catch (logErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[AnswerLog Error Non-Fatal]', logErr.message)
        }
      }
    }

    res.json({ score: band, correct, total: totalSlots, result, attemptId: attempt.id })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// GET /reading/exams/:id/result-detail — Detailed answer key for result page
router.get('/exams/:id/result-detail', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const examId = parseInt(req.params.id)

    const [exam, attempt] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        select: {
          title: true, seriesId: true, bookNumber: true, testNumber: true,
          series: { select: { name: true } },
          passages: {
            orderBy: { number: 'asc' },
            select: {
              id: true, number: true,
              questions: {
                where: { groupId: null },
                orderBy: { number: 'asc' },
                select: { id: true, number: true, type: true, questionText: true, correctAnswer: true }
              },
              questionGroups: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true, type: true, qNumberStart: true, qNumberEnd: true, maxChoices: true,
                  questions: {
                    orderBy: { number: 'asc' },
                    select: { id: true, number: true, type: true, questionText: true, correctAnswer: true }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.attempt.findFirst({
        where: { userId, examId },
        orderBy: { finishedAt: 'desc' },
        select: {
          id: true, score: true,
          questionAnswers: {
            select: { questionId: true, userAnswer: true, isCorrect: true }
          }
        }
      })
    ])

    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' })
    if (!attempt) return res.status(404).json({ message: 'Chưa có lần làm bài nào' })

    const answerMap = {}
    for (const qa of attempt.questionAnswers) {
      answerMap[qa.questionId] = { userAnswer: qa.userAnswer, isCorrect: qa.isCorrect }
    }

    let correct = 0, wrong = 0, missed = 0, totalQuestions = 0
    const questionTypeStats = {}

    function trackType(typeName, status) {
      if (!questionTypeStats[typeName]) questionTypeStats[typeName] = { name: typeName, total: 0, correct: 0, wrong: 0, missed: 0 }
      questionTypeStats[typeName].total++
      questionTypeStats[typeName][status]++
    }

    function getTypeName(type) {
      const map = {
        fill_blank: 'Summary/Note Completion',
        short_answer: 'Short Answer',
        mcq: 'Multiple Choice',
        mcq_multi: 'Multiple Choice (Multiple)',
        matching: 'Matching',
        matching_features: 'Matching Features',
        matching_headings: 'Matching Headings',
        matching_paragraph: 'Matching Paragraph',
        matching_endings: 'Matching Sentence Endings',
        map_diagram: 'Map / Diagram',
        list_selection: 'List Selection',
        choose_title: 'Choose Title',
        true_false_ng: 'True/False/Not Given',
        yes_no_ng: 'Yes/No/Not Given',
        diagram_completion: 'Diagram Completion',
        table_completion: 'Table Completion',
      }
      return map[type] || type
    }

    const sections = exam.passages.map(passage => {
      const questions = []

      for (const q of passage.questions) {
        totalQuestions++
        const ans = answerMap[q.id]
        let status = 'missed'
        if (ans && String(ans.userAnswer || '').trim() !== '') {
          status = ans.isCorrect ? 'correct' : 'wrong'
        }
        if (status === 'correct') correct++
        else if (status === 'wrong') wrong++
        else missed++
        trackType(getTypeName(q.type), status)
        questions.push({
          number: q.number, status,
          userAnswer: ans?.userAnswer || '',
          correctAnswer: q.correctAnswer,
          grouped: false
        })
      }

      for (const g of passage.questionGroups) {
        const activeQs = g.type === 'mcq_multi'
          ? g.questions
          : g.questions.filter(q => q.number >= g.qNumberStart && q.number <= g.qNumberEnd)

        for (const q of activeQs) {
          if (g.type === 'mcq_multi') {
            const maxC = g.maxChoices || 2
            const numbers = Array.from({ length: maxC }, (_, i) => q.number + i)
            
            const userArr = (answerMap[q.id]?.userAnswer || '').split(',').map(a => a.trim()).filter(Boolean)
            const correctArr = (q.correctAnswer || '').split(',').map(a => a.trim()).filter(Boolean)
            
            const correctMatches = []
            const wrongMatches = []
            for (const ua of userArr) {
              const lower = ua.toLowerCase()
              const matchedCorrect = correctArr.find(c => c.toLowerCase() === lower)
              if (matchedCorrect) correctMatches.push(matchedCorrect)
              else wrongMatches.push(ua)
            }
            
            const statuses = []
            const userAnswers = []
            const answers = []
            
            let ci = 0, wi = 0
            const usedCorrect = []
            
            for (let s = 0; s < maxC; s++) {
              totalQuestions++
              if (ci < correctMatches.length) {
                trackType(getTypeName(g.type), 'correct')
                statuses.push('correct')
                userAnswers.push(correctMatches[ci])
                answers.push(correctMatches[ci])
                usedCorrect.push(correctMatches[ci].toLowerCase())
                ci++
              } else if (wi < wrongMatches.length) {
                trackType(getTypeName(g.type), 'wrong')
                statuses.push('wrong')
                userAnswers.push(wrongMatches[wi])
                const remainingCorrect = correctArr.find(c => !usedCorrect.includes(c.toLowerCase()))
                if (remainingCorrect) {
                  answers.push(remainingCorrect)
                  usedCorrect.push(remainingCorrect.toLowerCase())
                } else answers.push('?')
                wi++
              } else {
                trackType(getTypeName(g.type), 'missed')
                statuses.push('missed')
                userAnswers.push(null)
                const remainingCorrect = correctArr.find(c => !usedCorrect.includes(c.toLowerCase()))
                if (remainingCorrect) {
                  answers.push(remainingCorrect)
                  usedCorrect.push(remainingCorrect.toLowerCase())
                } else answers.push('?')
              }
            }
            
            questions.push({ grouped: true, numbers, answers, userAnswers, statuses })
          } else {
            // All other group types — flatten to individual questions
            totalQuestions++
            const ans = answerMap[q.id]
            let status = 'missed'
            if (ans && String(ans.userAnswer || '').trim() !== '') {
              status = ans.isCorrect ? 'correct' : 'wrong'
            }
            if (status === 'correct') correct++
            else if (status === 'wrong') wrong++
            else missed++
            trackType(getTypeName(g.type), status)
            questions.push({
              number: q.number, status,
              userAnswer: ans?.userAnswer || '',
              correctAnswer: q.correctAnswer,
              grouped: false
            })
          }
        }
      }

      questions.sort((a, b) => {
        const aNum = a.grouped ? a.numbers[0] : a.number
        const bNum = b.grouped ? b.numbers[0] : b.number
        return aNum - bNum
      })

      const nums = questions.flatMap(q => q.grouped ? q.numbers : [q.number])
      return {
        number: passage.number,
        from: Math.min(...nums),
        to: Math.max(...nums),
        questions
      }
    })

    res.json({
      bookName: exam.series?.name ?? exam.title,
      testNumber: exam.testNumber,
      skillType: 'reading',
      bandScore: attempt.score ?? 0,
      correct, wrong, missed, totalQuestions,
      questionTypes: Object.values(questionTypeStats),
      sections
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
