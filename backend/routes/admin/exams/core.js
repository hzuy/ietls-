const express = require('express')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { syncSeriesExam } = require('../../../lib/syncHelpers')
const { updateExamSchema } = require('../../../validators/adminExamValidator')

// ─── GET EXAM COUNTS BY SKILL ───────────────────────────────────────────────
router.get('/exams/counts', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const counts = await prisma.exam.groupBy({
      by: ['skill'],
      where: { deletedAt: null },
      _count: { id: true }
    })
    const countMap = { reading: 0, listening: 0, writing: 0, speaking: 0 }
    counts.forEach(c => {
      if (c.skill in countMap) countMap[c.skill] = c._count.id
    })
    res.json(countMap)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── GET EXAMS (PAGINATED & FILTERED) ───────────────────────────────────────
router.get('/exams', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { skill, search = '', seriesId, page = 1, limit = 20 } = req.query
    const parsedPage = Math.max(1, parseInt(page) || 1)
    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit) || 20))
    const skip = (parsedPage - 1) * parsedLimit

    const where = { deletedAt: null }
    if (skill) where.skill = skill
    if (seriesId) where.seriesId = parseInt(seriesId)
    if (search) {
      where.title = { contains: search, mode: 'insensitive' }
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
        select: {
          id: true,
          title: true,
          skill: true,
          bookNumber: true,
          testNumber: true,
          seriesId: true,
          createdAt: true,
          passages: {
            select: {
              id: true,
              _count: { select: { questionGroups: true } },
              questionGroups: { select: { qNumberStart: true, qNumberEnd: true } },
              questions: { where: { groupId: null }, select: { id: true } }
            }
          },
          listeningSections: {
            select: {
              id: true,
              _count: { select: { questionGroups: true } },
              questionGroups: { select: { qNumberStart: true, qNumberEnd: true } },
              questions: { where: { groupId: null }, select: { id: true } }
            }
          },
          writingTasks:  { select: { id: true } },
          speakingParts: { select: { id: true, _count: { select: { questions: true } } } },
          _count: { select: { attempts: true } }
        }
      }),
      prisma.exam.count({ where })
    ])

    const examIds = exams.map(e => e.id)
    const avgScores = examIds.length > 0 ? await prisma.attempt.groupBy({
      by: ['examId'],
      where: { examId: { in: examIds }, score: { not: null }, finishedAt: { not: null } },
      _avg: { score: true }
    }) : []
    const avgScoreMap = Object.fromEntries(avgScores.map(a => [a.examId, a._avg.score]))

    const data = exams.map(e => {
      let questionCount = null
      if (e.skill === 'reading') {
        questionCount = e.passages.reduce((sum, p) => {
          const fromGroups = p.questionGroups.reduce((gs, g) => gs + (g.qNumberEnd - g.qNumberStart + 1), 0)
          return sum + p.questions.length + fromGroups
        }, 0)
      } else if (e.skill === 'listening') {
        questionCount = e.listeningSections.reduce((sum, s) => {
          const fromGroups = s.questionGroups.reduce((gs, g) => gs + (g.qNumberEnd - g.qNumberStart + 1), 0)
          return sum + s.questions.length + fromGroups
        }, 0)
      }
      return { ...e, avgScore: avgScoreMap[e.id] ?? null, questionCount }
    })

    res.json({
      exams: data,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit)
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── GET SINGLE EXAM (full detail for editing) ───────────────────────────────
router.get('/exams/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const qSelect = {
      id: true, number: true, type: true, questionText: true,
      options: true, correctAnswer: true, imageUrl: true,
    }
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        passages: { orderBy: { number: 'asc' }, include: {
          questions: { where: { groupId: null }, orderBy: { number: 'asc' }, select: qSelect },
          questionGroups: { orderBy: { sortOrder: 'asc' }, include: {
            questions: { orderBy: { number: 'asc' }, select: qSelect },
            noteSections: { orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } },
            matchingOptions: { orderBy: { sortOrder: 'asc' } }
          }}
        }},
        listeningSections: { orderBy: { number: 'asc' }, include: {
          questions: { where: { groupId: null }, orderBy: { number: 'asc' }, select: qSelect },
          questionGroups: { orderBy: { sortOrder: 'asc' }, include: {
            questions: { orderBy: { number: 'asc' }, select: qSelect },
            noteSections: { orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } },
            matchingOptions: { orderBy: { sortOrder: 'asc' } }
          }}
        }},
        writingTasks: { orderBy: { number: 'asc' } },
        speakingParts: { orderBy: { number: 'asc' }, include: { questions: { orderBy: { orderNum: 'asc' } } } }
      }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề' })
    const parseQ = q => ({ ...q, options: q.options ? JSON.parse(q.options) : null })
    exam.passages?.forEach(p => {
      p.questions = p.questions.map(parseQ)
      p.questionGroups?.forEach(g => { g.questions = g.questions.map(parseQ) })
    })
    exam.listeningSections?.forEach(s => {
      s.questions = s.questions.map(parseQ)
      s.questionGroups?.forEach(g => { g.questions = g.questions.map(parseQ) })
    })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── UPDATE BASIC INFO (title only — dùng cho trang quản lý nội dung) ────────
router.put('/exams/:id/basic', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { title } = req.body
    if (!title?.trim()) return res.status(400).json({ message: 'Thiếu tiêu đề' })
    const exam = await prisma.exam.update({
      where: { id },
      data: { title: title.trim() },
      select: { id: true, title: true, skill: true, coverImageUrl: true, createdAt: true }
    })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật', error: error.message })
  }
})

// ─── UPDATE EXAM ──────────────────────────────────────────────────────────────
router.put('/exams/:id', authMiddleware, teacherOnly, validate(updateExamSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.exam.findUnique({ where: { id }, select: { skill: true, seriesId: true } })
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy đề' })

    const { title, bookNumber, testNumber } = req.body
    const bn = bookNumber ? parseInt(bookNumber) : null
    const tn = testNumber ? parseInt(testNumber) : null

    if (existing.skill === 'reading') {
      const { passages } = req.body

      const buildReadingGroupData = (g, gi) => {
        const base = {
          qNumberStart: g.qNumberStart,
          qNumberEnd: g.qNumberEnd,
          instruction: g.instruction || '',
          type: g.type,
          imageUrl: g.imageUrl || null,
          sortOrder: gi,
          canReuse: g.canReuse || false,
          maxChoices: g.maxChoices || 2,
        }
        if (['true_false_ng', 'yes_no_ng'].includes(g.type)) {
          return {
            ...base,
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: g.type, questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (g.type === 'note_completion' || g.type === 'table_completion') {
          return {
            ...base,
            noteSections: { create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '', sortOrder: nsi,
              lines: { create: (ns.lines || []).map((l, li) => ({ contentWithTokens: l.content || '', lineType: l.lineType || 'content', sortOrder: li })) }
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'fill_blank', questionText: '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (g.type === 'matching_information') {
          return {
            ...base,
            matchingOptions: { create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'matching_paragraph', questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (g.type === 'drag_word_bank') {
          return {
            ...base,
            noteSections: { create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '', sortOrder: nsi,
              lines: { create: (ns.lines || []).map((l, li) => ({ contentWithTokens: l.content || '', lineType: l.lineType || 'content', sortOrder: li })) }
            })) },
            matchingOptions: { create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'fill_blank', questionText: '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (g.type === 'matching_drag') {
          return {
            ...base,
            matchingOptions: { create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'matching', questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        return {
          ...base,
          questions: { create: (g.questions || []).map(q => ({
            number: q.number, type: g.type, questionText: q.questionText || '',
            options: q.options ? JSON.stringify(q.options.filter(o => o.trim())) : null,
            correctAnswer: q.correctAnswer || '', imageUrl: null
          })) }
        }
      }

      // Delete QuestionAnswers first to avoid FK constraint
      const oldPassages = await prisma.passage.findMany({
        where: { examId: id },
        include: {
          questions: { select: { id: true } },
          questionGroups: { include: { questions: { select: { id: true } } } }
        }
      })
      const oldDirectQIds = oldPassages.flatMap(p => p.questions.map(q => q.id))
      const oldGroupQIds = oldPassages.flatMap(p => p.questionGroups.flatMap(g => g.questions.map(q => q.id)))
      const allOldQIds = [...oldDirectQIds, ...oldGroupQIds]
      if (allOldQIds.length) await prisma.questionAnswer.deleteMany({ where: { questionId: { in: allOldQIds } } })
      await prisma.passage.deleteMany({ where: { examId: id } })

      const updated = await prisma.exam.update({
        where: { id },
        data: {
          title, bookNumber: bn, testNumber: tn,
          passages: {
            create: passages.map(p => ({
              number: p.number,
              title: p.title,
              subtitle: p.subtitle || null,
              letteredParagraphs: p.letteredParagraphs || false,
              body: p.body,
              questionGroups: p.questionGroups
                ? { create: p.questionGroups.map((g, gi) => buildReadingGroupData(g, gi)) }
                : undefined,
              questions: p.questions
                ? { create: (p.questions || []).map(q => ({
                    number: q.number, type: q.type, questionText: q.questionText,
                    options: q.options ? JSON.stringify(q.options) : null,
                    correctAnswer: q.correctAnswer, imageUrl: q.imageUrl || null
                  })) }
                : undefined
            }))
          }
        },
        include: { passages: { include: { questions: true, questionGroups: true } } }
      })
      await syncSeriesExam(id, existing.seriesId, tn)
      return res.json(updated)
    }

    if (existing.skill === 'listening') {
      const { sections } = req.body
      // Delete all nested data for old sections
      const oldSections = await prisma.listeningSection.findMany({
        where: { examId: id },
        include: {
          questions: { select: { id: true } },
          questionGroups: {
            include: {
              questions: { select: { id: true } },
              noteSections: { include: { lines: { select: { id: true } } } },
              matchingOptions: { select: { id: true } }
            }
          }
        }
      })
      // Collect all question IDs (both old direct and group-based)
      const oldDirectQIds = oldSections.flatMap(s => s.questions.map(q => q.id))
      const oldGroupQIds = oldSections.flatMap(s => s.questionGroups.flatMap(g => g.questions.map(q => q.id)))
      const allQIds = [...oldDirectQIds, ...oldGroupQIds]
      if (allQIds.length) await prisma.questionAnswer.deleteMany({ where: { questionId: { in: allQIds } } })
      // Delete sections (cascade deletes groups, noteSections, lines, matchingOptions, questions)
      await prisma.listeningSection.deleteMany({ where: { examId: id } })

      const buildGroupData = (g, gi) => {
        const base = {
          qNumberStart: g.qNumberStart,
          qNumberEnd: g.qNumberEnd,
          instruction: g.instruction || '',
          type: g.type,
          imageUrl: g.imageUrl || null,
          sortOrder: gi,
          maxChoices: g.maxChoices || 2,
        }
        if (g.type === 'note_completion' || g.type === 'table_completion') {
          return {
            ...base,
            noteSections: { create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '', sortOrder: nsi,
              lines: { create: (ns.lines || []).map((l, li) => ({ contentWithTokens: l.content || '', lineType: l.lineType || 'content', sortOrder: li })) }
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'fill_blank', questionText: '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (['matching', 'map_diagram'].includes(g.type)) {
          return {
            ...base,
            matchingOptions: { create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: g.type, questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (g.type === 'drag_word_bank') {
          return {
            ...base,
            noteSections: { create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '', sortOrder: nsi,
              lines: { create: (ns.lines || []).map((l, li) => ({ contentWithTokens: l.content || '', lineType: l.lineType || 'content', sortOrder: li })) }
            })) },
            matchingOptions: { create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'fill_blank', questionText: '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        if (g.type === 'matching_drag') {
          return {
            ...base,
            matchingOptions: { create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi
            })) },
            questions: { create: (g.questions || []).map(q => ({
              number: q.number, type: 'matching', questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '', options: null, imageUrl: null
            })) }
          }
        }
        return {
          ...base,
          questions: { create: (g.questions || []).map(q => ({
            number: q.number, type: g.type, questionText: q.questionText || '',
            options: q.options ? JSON.stringify(q.options.filter(o => o.trim())) : null,
            correctAnswer: q.correctAnswer || '', imageUrl: null
          })) }
        }
      }

      const updated = await prisma.exam.update({
        where: { id },
        data: {
          title, bookNumber: bn, testNumber: tn,
          listeningSections: {
            create: sections.map(s => ({
              number: s.number,
              context: s.context || '',
              audioUrl: s.audioUrl || null,
              transcript: s.transcript || null,
              questions: s.questionGroups
                ? undefined
                : { create: (s.questions || []).map(q => ({
                    number: q.number, type: q.type, questionText: q.questionText,
                    options: q.options ? JSON.stringify(q.options) : null,
                    correctAnswer: q.correctAnswer, imageUrl: q.imageUrl || null
                  })) },
              questionGroups: s.questionGroups
                ? { create: s.questionGroups.map((g, gi) => buildGroupData(g, gi)) }
                : undefined
            }))
          }
        }
      })
      await syncSeriesExam(id, existing.seriesId, tn)
      return res.json(updated)
    }

    if (existing.skill === 'writing') {
      const { task1, task2 } = req.body
      await prisma.writingTask.deleteMany({ where: { examId: id } })
      const updated = await prisma.exam.update({
        where: { id },
        data: {
          title, bookNumber: bn, testNumber: tn,
          writingTasks: {
            create: [
              { number: 1, prompt: task1.prompt, imageUrl: task1.imageUrl || null, minWords: 150 },
              { number: 2, prompt: task2.prompt, imageUrl: null, minWords: 250 }
            ]
          }
        },
        include: { writingTasks: true }
      })
      await syncSeriesExam(id, existing.seriesId, tn)
      return res.json(updated)
    }

    if (existing.skill === 'speaking') {
      const { part1, part2, part3 } = req.body
      // Delete SpeakingAnswers first to avoid FK constraint
      const oldParts = await prisma.speakingPart.findMany({ where: { examId: id }, select: { id: true } })
      const oldPartIds = oldParts.map(p => p.id)
      if (oldPartIds.length) await prisma.speakingAnswer.deleteMany({ where: { partId: { in: oldPartIds } } })
      await prisma.speakingPart.deleteMany({ where: { examId: id } })
      const updated = await prisma.exam.update({
        where: { id },
        data: {
          title, bookNumber: bn, testNumber: tn,
          speakingParts: {
            create: [
              {
                number: 1, cueCard: part1.cueCard || null,
                questions: { create: part1.questions.filter(q => q.trim()).map((q, i) => ({ orderNum: i + 1, questionText: q })) }
              },
              {
                number: 2, cueCard: part2.cueCard || null,
                questions: { create: part2.questions.filter(q => q.trim()).map((q, i) => ({ orderNum: i + 1, questionText: q })) }
              },
              {
                number: 3, cueCard: part3.cueCard || null,
                questions: { create: part3.questions.filter(q => q.trim()).map((q, i) => ({ orderNum: i + 1, questionText: q })) }
              }
            ]
          }
        },
        include: { speakingParts: { include: { questions: true } } }
      })
      await syncSeriesExam(id, existing.seriesId, tn)
      return res.json(updated)
    }

    res.status(400).json({ message: 'Skill không hợp lệ' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi cập nhật đề', error: error.message })
  }
})

// ─── DELETE EXAM ─────────────────────────────────────────────────────────────
router.delete('/exams/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } })
    res.json({ message: 'Xóa đề thành công' })
  } catch (error) {
    console.error('[Delete exam]', error)
    res.status(500).json({ message: 'Lỗi xóa đề', error: error.message })
  }
})

module.exports = router
