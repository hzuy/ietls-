const express = require('express')
const bcrypt = require('bcryptjs')
const authMiddleware = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const Groq = require('groq-sdk')
const pdfParse = require('pdf-parse')
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const router = express.Router()
const prisma = require('../lib/prisma')

// Multer config cho audio upload
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  }
})
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Chỉ chấp nhận file audio'))
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
})

// Middleware admin
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

const teacherOrAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

// ─── AUTO SYNC SeriesExam ─────────────────────────────────────────────────────
// When saving an exam with examSeriesId + testNumber, auto-link it to any Full Test
// Series that already contains sibling exams (same ExamSeries + testNumber).
async function syncSeriesExam(examId, examSeriesId, testNumber) {
  if (!examSeriesId || !testNumber) return
  const tn = parseInt(testNumber)
  const sid = parseInt(examSeriesId)
  // Find sibling exams in the same ExamSeries at the same testNumber
  const siblings = await prisma.exam.findMany({
    where: { seriesId: sid, testNumber: tn, id: { not: examId } },
    select: { id: true }
  })
  if (!siblings.length) return
  // Find which Full Test Series already contain any sibling at this testNumber
  const linked = await prisma.seriesExam.findMany({
    where: { examId: { in: siblings.map(s => s.id) }, testNumber: tn },
    select: { seriesId: true }
  })
  const seriesIds = [...new Set(linked.map(l => l.seriesId))]
  if (!seriesIds.length) return
  // For each such Series, create a SeriesExam for the new exam if not already there
  for (const fullSeriesId of seriesIds) {
    const exists = await prisma.seriesExam.findFirst({
      where: { seriesId: fullSeriesId, examId }
    })
    if (!exists) {
      await prisma.seriesExam.create({ data: { seriesId: fullSeriesId, examId, testNumber: tn } })
    }
  }
}

// ─── UPLOAD AUDIO ────────────────────────────────────────────────────────────
router.post('/upload-audio', authMiddleware, teacherOnly, upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  const audioUrl = `/uploads/${req.file.filename}`
  res.json({ audioUrl, filename: req.file.filename })
})

// ─── UPLOAD IMAGE ────────────────────────────────────────────────────────────
const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'))
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
})

router.post('/upload-image', authMiddleware, teacherOnly, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  const imageUrl = `/uploads/${req.file.filename}`
  res.json({ imageUrl, filename: req.file.filename })
})

router.post('/exams/:id/cover', authMiddleware, teacherOnly, imageUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const coverImageUrl = `/uploads/${req.file.filename}`
    const exam = await prisma.exam.update({
      where: { id: parseInt(req.params.id) },
      data: { coverImageUrl },
      select: { id: true, coverImageUrl: true }
    })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

// ─── TRANSCRIBE AUDIO (Groq Whisper) ────────────────────────────────────────
router.post('/transcribe', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { audioUrl } = req.body
    if (!audioUrl) return res.status(400).json({ message: 'Thiếu audioUrl' })

    const filename = audioUrl.replace('/uploads/', '')
    const filePath = path.join(uploadsDir, filename)

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File audio không tồn tại trên server' })

    console.log('[Transcribe] Bắt đầu phiên âm:', filename)
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      response_format: 'json',
      language: 'en',
      temperature: 0.0
    })

    const text = transcription.text || ''
    console.log('[Transcribe] Xong, độ dài:', text.length)
    res.json({ transcript: text })
  } catch (error) {
    console.error('[Transcribe] Lỗi:', error.message)
    res.status(500).json({ message: 'Lỗi phiên âm: ' + error.message })
  }
})

// ─── GET ALL EXAMS ───────────────────────────────────────────────────────────
router.get('/exams', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const skillFilter = req.query.skill || undefined
    const exams = await prisma.exam.findMany({
      where: skillFilter ? { skill: skillFilter, deletedAt: null } : { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
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
    })

    const examIds = exams.map(e => e.id)
    const avgScores = await prisma.attempt.groupBy({
      by: ['examId'],
      where: { examId: { in: examIds }, score: { not: null }, finishedAt: { not: null } },
      _avg: { score: true }
    })
    const avgScoreMap = Object.fromEntries(avgScores.map(a => [a.examId, a._avg.score]))

    res.json(exams.map(e => {
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
    }))
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── CREATE READING EXAM ─────────────────────────────────────────────────────
router.post('/exams/reading', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { title, passages, bookNumber, testNumber, seriesId } = req.body

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'reading' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Reading có tên "${existing.title}". Vui lòng đặt tên khác.` })

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

      // true_false_ng / yes_no_ng: flat questions with type = group.type
      if (['true_false_ng', 'yes_no_ng'].includes(g.type)) {
        return {
          ...base,
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: g.type,
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // note_completion / table_completion: noteSections + questions with fill_blank
      if (g.type === 'note_completion' || g.type === 'table_completion') {
        return {
          ...base,
          noteSections: {
            create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '',
              sortOrder: nsi,
              lines: {
                create: (ns.lines || []).map((l, li) => ({
                  contentWithTokens: l.content || '',
                  lineType: l.lineType || 'content',
                  sortOrder: li
                }))
              }
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'fill_blank',
              questionText: '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // matching_information: matchingOptions + questions with type matching_paragraph
      if (g.type === 'matching_information') {
        return {
          ...base,
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'matching_paragraph',
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // drag_word_bank: noteSections + matchingOptions (word bank) + questions (correctAnswer = letter)
      if (g.type === 'drag_word_bank') {
        return {
          ...base,
          noteSections: {
            create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '',
              sortOrder: nsi,
              lines: {
                create: (ns.lines || []).map((l, li) => ({
                  contentWithTokens: l.content || '',
                  lineType: l.lineType || 'content',
                  sortOrder: li
                }))
              }
            }))
          },
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'fill_blank',
              questionText: '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // matching_drag: matchingOptions (pool) + questions (items on left, correctAnswer = letter)
      if (g.type === 'matching_drag') {
        return {
          ...base,
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'matching',
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // diagram_label: image + questions (questionText = hint, correctAnswer = answer)
      if (g.type === 'diagram_label') {
        return {
          ...base,
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'fill_blank',
              questionText: q.hint || q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // matching_headings: headings as matchingOptions (i/ii/iii), paragraphs as questions
      if (g.type === 'matching_headings') {
        return {
          ...base,
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'matching_headings',
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // mcq, mcq_multi, short_answer
      return {
        ...base,
        questions: {
          create: (g.questions || []).map(q => ({
            number: q.number,
            type: g.type,
            questionText: q.questionText || '',
            options: q.options ? JSON.stringify(q.options.filter(o => o.trim())) : null,
            correctAnswer: q.correctAnswer || '',
            imageUrl: null
          }))
        }
      }
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'reading',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
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
                  number: q.number,
                  type: q.type,
                  questionText: q.questionText,
                  options: q.options ? JSON.stringify(q.options) : null,
                  correctAnswer: q.correctAnswer,
                  imageUrl: q.imageUrl || null
                })) }
              : undefined
          }))
        }
      },
      include: {
        passages: { include: { questions: true, questionGroups: true } }
      }
    })

    await syncSeriesExam(exam.id, seriesId, testNumber)
    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi tạo đề Reading', error: error.message })
  }
})

// ─── CREATE LISTENING EXAM ───────────────────────────────────────────────────
router.post('/exams/listening', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { title, sections, bookNumber, testNumber, seriesId } = req.body

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'listening' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Listening có tên "${existing.title}". Vui lòng đặt tên khác.` })

    const buildGroupData = (g, gi) => {
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

      if (g.type === 'note_completion' || g.type === 'table_completion') {
        return {
          ...base,
          noteSections: {
            create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '',
              sortOrder: nsi,
              lines: {
                create: (ns.lines || []).map((l, li) => ({
                  contentWithTokens: l.content || '',
                  lineType: l.lineType || 'content',
                  sortOrder: li
                }))
              }
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'fill_blank',
              questionText: '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      if (['matching', 'map_diagram'].includes(g.type)) {
        return {
          ...base,
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: g.type,
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // drag_word_bank: noteSections + matchingOptions (word bank) + questions
      if (g.type === 'drag_word_bank') {
        return {
          ...base,
          noteSections: {
            create: (g.noteSections || []).map((ns, nsi) => ({
              title: ns.title || '',
              sortOrder: nsi,
              lines: {
                create: (ns.lines || []).map((l, li) => ({
                  contentWithTokens: l.content || '',
                  lineType: l.lineType || 'content',
                  sortOrder: li
                }))
              }
            }))
          },
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'fill_blank',
              questionText: '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // matching_drag: matchingOptions pool + questions (left items)
      if (g.type === 'matching_drag') {
        return {
          ...base,
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'matching',
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // diagram_label: image + questions (questionText = hint, correctAnswer = answer)
      if (g.type === 'diagram_label') {
        return {
          ...base,
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'fill_blank',
              questionText: q.hint || q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // matching_headings: headings as matchingOptions (i/ii/iii), paragraphs as questions
      if (g.type === 'matching_headings') {
        return {
          ...base,
          matchingOptions: {
            create: (g.matchingOptions || []).map((mo, moi) => ({
              optionLetter: mo.letter,
              optionText: mo.text || '',
              sortOrder: moi
            }))
          },
          questions: {
            create: (g.questions || []).map(q => ({
              number: q.number,
              type: 'matching_headings',
              questionText: q.questionText || '',
              correctAnswer: q.correctAnswer || '',
              options: null,
              imageUrl: null
            }))
          }
        }
      }

      // mcq, mcq_multi, short_answer
      return {
        ...base,
        questions: {
          create: (g.questions || []).map(q => ({
            number: q.number,
            type: g.type,
            questionText: q.questionText || '',
            options: q.options ? JSON.stringify(q.options.filter(o => o.trim())) : null,
            correctAnswer: q.correctAnswer || '',
            imageUrl: null
          }))
        }
      }
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'listening',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        listeningSections: {
          create: sections.map(s => ({
            number: s.number,
            context: s.context || '',
            audioUrl: s.audioUrl || null,
            transcript: s.transcript || null,
            // Support old flat questions OR new questionGroups
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

    await syncSeriesExam(exam.id, seriesId, testNumber)
    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi tạo đề Listening', error: error.message })
  }
})

// ─── CREATE WRITING EXAM ─────────────────────────────────────────────────────
router.post('/exams/writing', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { title, task1, task2, bookNumber, testNumber, seriesId } = req.body
    // task1: { prompt, imageUrl }
    // task2: { prompt }

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'writing' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Writing có tên "${existing.title}". Vui lòng đặt tên khác.` })

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'writing',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        writingTasks: {
          create: [
            {
              number: 1,
              prompt: task1.prompt,
              imageUrl: task1.imageUrl || null,
              minWords: 150
            },
            {
              number: 2,
              prompt: task2.prompt,
              imageUrl: null,
              minWords: 250
            }
          ]
        }
      },
      include: { writingTasks: true }
    })

    await syncSeriesExam(exam.id, seriesId, testNumber)
    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi tạo đề Writing', error: error.message })
  }
})

// ─── CREATE SPEAKING EXAM ────────────────────────────────────────────────────
router.post('/exams/speaking', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { title, part1, part2, part3, bookNumber, testNumber, seriesId } = req.body
    // part1: { questions: ['...', '...'] }
    // part2: { cueCard: '...', questions: ['...'] }
    // part3: { questions: ['...', '...'] }

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'speaking' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Speaking có tên "${existing.title}". Vui lòng đặt tên khác.` })

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'speaking',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        speakingParts: {
          create: [
            {
              number: 1,
              cueCard: part1.cueCard || null,
              questions: {
                create: part1.questions.filter(q => q.trim()).map((q, i) => ({
                  orderNum: i + 1,
                  questionText: q
                }))
              }
            },
            {
              number: 2,
              cueCard: part2.cueCard || null,
              questions: {
                create: part2.questions.filter(q => q.trim()).map((q, i) => ({
                  orderNum: i + 1,
                  questionText: q
                }))
              }
            },
            {
              number: 3,
              cueCard: part3.cueCard || null,
              questions: {
                create: part3.questions.filter(q => q.trim()).map((q, i) => ({
                  orderNum: i + 1,
                  questionText: q
                }))
              }
            }
          ]
        }
      },
      include: {
        speakingParts: { include: { questions: true } }
      }
    })

    await syncSeriesExam(exam.id, seriesId, testNumber)
    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi tạo đề Speaking', error: error.message })
  }
})

// ─── AI TEXT IMPORT ──────────────────────────────────────────────────────────
// ─── BOOK COVERS ─────────────────────────────────────────────────────────────
router.get('/book-covers', authMiddleware, async (req, res) => {
  try {
    const seriesId = parseInt(req.query.seriesId) || 1
    const covers = await prisma.bookCover.findMany({ where: { seriesId } })
    const map = {}
    for (const c of covers) map[c.bookNumber] = c.coverImageUrl
    res.json(map)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/book-covers/:bookNumber', authMiddleware, teacherOnly, imageUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const bookNumber = parseInt(req.params.bookNumber)
    const seriesId = parseInt(req.body.seriesId) || 1
    const coverImageUrl = `/uploads/${req.file.filename}`
    await prisma.bookCover.upsert({
      where: { seriesId_bookNumber: { seriesId, bookNumber } },
      create: { seriesId, bookNumber, coverImageUrl },
      update: { coverImageUrl }
    })
    res.json({ bookNumber, coverImageUrl })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

// ─── GET FULL TESTS (grouped by bookNumber + testNumber) ─────────────────────
router.get('/full-tests', authMiddleware, async (req, res) => {
  try {
    const [exams, covers] = await Promise.all([
      prisma.exam.findMany({
        where: { bookNumber: { not: null }, testNumber: { not: null }, deletedAt: null },
        select: { id: true, title: true, skill: true, bookNumber: true, testNumber: true, seriesId: true },
        orderBy: [{ bookNumber: 'asc' }, { testNumber: 'asc' }, { skill: 'asc' }]
      }),
      prisma.bookCover.findMany({ where: { seriesId: 1 } })
    ])
    const coverMap = {}
    for (const c of covers) coverMap[c.bookNumber] = c.coverImageUrl

    const grouped = {}
    for (const e of exams) {
      const key = `${e.bookNumber}-${e.testNumber}`
      if (!grouped[key]) grouped[key] = {
        seriesId: e.seriesId, bookNumber: e.bookNumber, testNumber: e.testNumber, exams: {},
        coverImageUrl: coverMap[e.bookNumber] || null
      }
      grouped[key].exams[e.skill] = { id: e.id, title: e.title }
    }
    res.json(Object.values(grouped))
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── EXAM SERIES CRUD ─────────────────────────────────────────────────────────
router.get('/exam-series', authMiddleware, async (req, res) => {
  try {
    const series = await prisma.examSeries.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { bookCovers: { where: { deletedAt: null } } } } }
    })
    res.json(series)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/exam-series', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Tên bộ đề không được để trống' })
    const s = await prisma.examSeries.create({ data: { name: name.trim() } })
    res.json(s)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/exam-series/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Tên không được để trống' })
    const s = await prisma.examSeries.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name.trim() }
    })
    res.json(s)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/exam-series/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.examSeries.update({ where: { id }, data: { deletedAt: new Date() } })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/exam-series/:id/books', authMiddleware, async (req, res) => {
  try {
    const books = await prisma.bookCover.findMany({
      where: { seriesId: parseInt(req.params.id), deletedAt: null },
      orderBy: { bookNumber: 'asc' }
    })
    res.json(books)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/exam-series/:id/books', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id)
    const max = await prisma.bookCover.findFirst({
      where: { seriesId, deletedAt: null },
      orderBy: { bookNumber: 'desc' }
    })
    const nextNumber = (max?.bookNumber || 0) + 1
    const book = await prisma.bookCover.create({ data: { seriesId, bookNumber: nextNumber } })
    res.json(book)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/exam-series/:seriesId/books/:bookNumber', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const seriesId = parseInt(req.params.seriesId)
    const oldNumber = parseInt(req.params.bookNumber)
    const newNumber = parseInt(req.body.bookNumber)
    if (!newNumber || newNumber < 1) return res.status(400).json({ message: 'Số cuốn không hợp lệ' })
    if (newNumber === oldNumber) return res.json({ ok: true })
    // Update BookCover
    await prisma.bookCover.updateMany({ where: { seriesId, bookNumber: oldNumber }, data: { bookNumber: newNumber } })
    // Update associated Exams
    await prisma.exam.updateMany({ where: { seriesId, bookNumber: oldNumber }, data: { bookNumber: newNumber } })
    res.json({ ok: true, bookNumber: newNumber })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/exam-series/:seriesId/books/:bookNumber', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const seriesId = parseInt(req.params.seriesId)
    const bookNumber = parseInt(req.params.bookNumber)
    const now = new Date()
    // Soft-delete all exams in this book
    await prisma.exam.updateMany({ where: { seriesId, bookNumber, deletedAt: null }, data: { deletedAt: now } })
    // Soft-delete the book cover
    await prisma.bookCover.updateMany({ where: { seriesId, bookNumber }, data: { deletedAt: now } })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/exam-series/:seriesId/covers/:bookNumber', authMiddleware, teacherOnly, imageUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const seriesId = parseInt(req.params.seriesId)
    const bookNumber = parseInt(req.params.bookNumber)
    const coverImageUrl = `/uploads/${req.file.filename}`
    await prisma.bookCover.upsert({
      where: { seriesId_bookNumber: { seriesId, bookNumber } },
      create: { seriesId, bookNumber, coverImageUrl },
      update: { coverImageUrl }
    })
    res.json({ seriesId, bookNumber, coverImageUrl })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

// ─── GET SINGLE EXAM (full detail for editing) ───────────────────────────────
router.get('/exams/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        passages: { orderBy: { number: 'asc' }, include: {
          questions: { where: { groupId: null }, orderBy: { number: 'asc' } },
          questionGroups: { orderBy: { sortOrder: 'asc' }, include: {
            questions: { orderBy: { number: 'asc' } },
            noteSections: { orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } },
            matchingOptions: { orderBy: { sortOrder: 'asc' } }
          }}
        }},
        listeningSections: { orderBy: { number: 'asc' }, include: {
          questions: { where: { groupId: null }, orderBy: { number: 'asc' } },
          questionGroups: { orderBy: { sortOrder: 'asc' }, include: {
            questions: { orderBy: { number: 'asc' } },
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
router.put('/exams/:id', authMiddleware, teacherOnly, async (req, res) => {
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

// ─── CAMBRIDGE PDF IMPORT ─────────────────────────────────────────────────────

const pdfsDir = path.join(__dirname, '..', 'uploads', 'pdfs')

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(pdfsDir, { recursive: true })
    cb(null, pdfsDir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + '.pdf')
  }
})

const pdfUpload = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true)
    else cb(new Error('Chỉ chấp nhận file PDF'))
  },
  limits: { fileSize: 300 * 1024 * 1024 }
})

// Extract all pages with position-based sorting (handles two-column layouts)
async function extractAllPages(filePath) {
  const buf = fs.readFileSync(filePath)
  const pages = []

  await pdfParse(buf, {
    pagerender: (pageData) =>
      pageData.getTextContent({ normalizeWhitespace: true }).then(tc => {
        const items = tc.items.filter(i => i.str && i.str.trim())
        if (!items.length) { pages.push(''); return '' }

        // Detect two-column layout by x-coordinate distribution
        const xValues = items.map(i => i.transform[4])
        const xMin = Math.min(...xValues), xMax = Math.max(...xValues)
        const xMid = (xMin + xMax) / 2
        const leftCount = items.filter(i => i.transform[4] < xMid).length
        const rightCount = items.filter(i => i.transform[4] >= xMid).length
        const isTwoCol = leftCount > 8 && rightCount > 8 && Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount) > 0.25

        let ordered
        if (isTwoCol) {
          // Sort each column by y (top=high y in PDF coords), concat left then right
          const byY = arr => arr.slice().sort((a, b) => b.transform[5] - a.transform[5])
          ordered = [
            ...byY(items.filter(i => i.transform[4] < xMid)),
            ...byY(items.filter(i => i.transform[4] >= xMid))
          ]
        } else {
          // Single column: top-to-bottom, left-to-right
          ordered = items.slice().sort((a, b) => {
            const dy = b.transform[5] - a.transform[5]
            return Math.abs(dy) > 4 ? dy : a.transform[4] - b.transform[4]
          })
        }

        // Group items on same line (within 4pt vertically)
        const lines = []
        let line = [], lastY = null
        for (const item of ordered) {
          const y = item.transform[5]
          if (lastY !== null && Math.abs(y - lastY) > 4) {
            lines.push(line.join(' '))
            line = []
          }
          line.push(item.str.trim())
          lastY = y
        }
        if (line.length) lines.push(line.join(' '))

        const text = lines
          .filter(l => l.trim())
          .join('\n')
          // Remove common Cambridge PDF noise
          .replace(/\bGo on to the next page\.?\s*/gi, '')
          .replace(/\bTurn over( for.*)?\s*/gi, '')
          .replace(/\bPlease turn over\.?\s*/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        pages.push(text)
        return text
      })
  })

  return pages
}

// Phase 1: Upload PDF → detect structure
router.post('/cambridge/upload', authMiddleware, adminOnly, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file PDF' })
    console.log('[Cambridge] File received:', req.file.filename, req.file.size, 'bytes')

    const pages = await extractAllPages(req.file.path)
    const totalPages = pages.length
    console.log('[Cambridge] Total pages extracted:', totalPages)

    // Store pages for later extraction
    const dataFile = req.file.filename.replace('.pdf', '.json')
    fs.writeFileSync(path.join(pdfsDir, dataFile), JSON.stringify(pages))

    // Send first 40 pages — enough to cover TOC + start of content
    const tocSample = pages.slice(0, Math.min(40, totalPages))
      .map((p, i) => `=== PAGE ${i + 1} ===\n${p}`)
      .join('\n\n')
      .substring(0, 20000)
    console.log('[Cambridge] TOC sample length:', tocSample.length)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.0,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing Cambridge IELTS book PDFs. A Cambridge IELTS Academic/General book contains 4 tests. Each test has 4 sections: Listening (questions + transcript at the back), Reading (3 passages), Writing (Task 1 + Task 2), Speaking (3 parts). The Answer Key is typically near the end of the book. Return ONLY valid JSON, no explanation.`
        },
        {
          role: 'user',
          content: `Analyze the structure of this Cambridge IELTS book PDF. Find the page ranges for each test's 4 skills and the answer key.

ORIGINAL FILENAME: ${req.file.originalname}

IMPORTANT: Page numbers in the PDF text usually appear as standalone numbers or in headers/footers. Tests are typically labeled "Test 1", "Test 2", etc. Reading passages have titles. Listening sections say "SECTION 1", "SECTION 2", etc. The Answer Key section shows answers like "1. B  2. TRUE  3. carbon".

PDF CONTENT (first ${Math.min(40, totalPages)} pages):
${tocSample}

Total pages in PDF: ${totalPages}

Return this exact JSON structure (use 0 for unknown page numbers):
{
  "bookTitle": "Cambridge IELTS 19 Academic",
  "totalPages": ${totalPages},
  "tests": [
    {
      "testNumber": 1,
      "listening": { "startPage": 10, "endPage": 22 },
      "reading": { "startPage": 23, "endPage": 48 },
      "writing": { "startPage": 49, "endPage": 53 },
      "speaking": { "startPage": 54, "endPage": 57 }
    },
    {
      "testNumber": 2,
      "listening": { "startPage": 0, "endPage": 0 },
      "reading": { "startPage": 0, "endPage": 0 },
      "writing": { "startPage": 0, "endPage": 0 },
      "speaking": { "startPage": 0, "endPage": 0 }
    },
    {
      "testNumber": 3,
      "listening": { "startPage": 0, "endPage": 0 },
      "reading": { "startPage": 0, "endPage": 0 },
      "writing": { "startPage": 0, "endPage": 0 },
      "speaking": { "startPage": 0, "endPage": 0 }
    },
    {
      "testNumber": 4,
      "listening": { "startPage": 0, "endPage": 0 },
      "reading": { "startPage": 0, "endPage": 0 },
      "writing": { "startPage": 0, "endPage": 0 },
      "speaking": { "startPage": 0, "endPage": 0 }
    }
  ],
  "answerKey": { "startPage": 180, "endPage": 200 }
}`
        }
      ]
    })

    let structure
    try {
      const raw = completion.choices[0].message.content.trim()
        .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      structure = JSON.parse(raw)
    } catch {
      // Fallback: estimate page ranges for a ~200-page book
      const perTest = Math.floor(totalPages / 5)
      structure = {
        bookTitle: 'Cambridge IELTS',
        totalPages,
        tests: [1, 2, 3, 4].map(n => ({
          testNumber: n,
          listening:  { startPage: (n - 1) * perTest + 1,      endPage: (n - 1) * perTest + 12 },
          reading:    { startPage: (n - 1) * perTest + 13,     endPage: (n - 1) * perTest + 38 },
          writing:    { startPage: (n - 1) * perTest + 39,     endPage: (n - 1) * perTest + 43 },
          speaking:   { startPage: (n - 1) * perTest + 44,     endPage: (n - 1) * perTest + perTest }
        })),
        answerKey: { startPage: totalPages - 25, endPage: totalPages - 5 }
      }
    }

    // If AI couldn't detect book title, use the original filename
    if (!structure.bookTitle || structure.bookTitle === 'Unknown' || structure.bookTitle === 'Cambridge IELTS') {
      const cleanName = req.file.originalname.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
      structure.bookTitle = cleanName
    }

    res.json({ dataFile, originalName: req.file.originalname, structure })
  } catch (err) {
    console.error('[Cambridge] ERROR:', err)
    res.status(500).json({ message: 'Lỗi phân tích PDF', error: err.message, stack: err.stack?.substring(0, 500) })
  }
})

// Phase 2: Extract specific test + skill
router.post('/cambridge/extract', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { dataFile, testNumber, skill, startPage, endPage, answerStart, answerEnd, bookTitle } = req.body

    const dataPath = path.join(pdfsDir, dataFile)
    if (!fs.existsSync(dataPath)) return res.status(404).json({ message: 'File không tồn tại, upload lại PDF' })

    const pages = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const totalPages = pages.length

    // If admin left page range at 0, fall back to reasonable defaults
    const effStart = (startPage > 0) ? startPage : 1
    const effEnd   = (endPage   > 0) ? endPage   : totalPages

    console.log('[Cambridge] Extracting', skill, 'test', testNumber, 'pages', effStart, '-', effEnd, '/', totalPages)

    const sectionText = pages
      .slice(Math.max(0, effStart - 1), effEnd)
      .map((p, i) => `=== PAGE ${effStart + i} ===\n${p}`)
      .join('\n\n')
    console.log('[Cambridge] Section text length:', sectionText.length)

    let answerText = ''
    if (answerStart > 0 && answerEnd > 0) {
      answerText = pages
        .slice(Math.max(0, answerStart - 1), answerEnd)
        .map((p, i) => `=== PAGE ${answerStart + i} ===\n${p}`)
        .join('\n\n')
        .substring(0, 8000)
      console.log('[Cambridge] Answer text length:', answerText.length)
    }

    const title = `${bookTitle} - Test ${testNumber} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`
    let prompt = ''

    if (skill === 'reading') {
      prompt = `You are extracting IELTS Reading Test ${testNumber} from a Cambridge IELTS book PDF.

The text below is extracted from the PDF pages. It may have formatting artifacts. Extract ALL 3 passages and ALL 40 questions with their correct answers.

READING SECTION TEXT:
${sectionText.substring(0, 40000)}

${answerText ? `ANSWER KEY TEXT:\n${answerText}` : ''}

INSTRUCTIONS:
- Extract exactly 3 passages (Passage 1, Passage 2, Passage 3)
- Each passage has a title and body text (copy the full passage body)
- Questions are numbered 1–40 total (Passage 1: Q1–13, Passage 2: Q14–26, Passage 3: Q27–40 — but actual ranges vary)
- For correct answers: use the Answer Key section if provided; otherwise infer from context
- Question types: true_false_ng, yes_no_ng, mcq, fill_blank, short_answer, matching_headings, matching_features, matching_paragraph, matching_endings, choose_title, diagram_completion
- For MCQ: options array like ["A. option text", "B. option text", "C. option text", "D. option text"]
- For TRUE/FALSE/NOT GIVEN: correctAnswer is "TRUE", "FALSE", or "NOT GIVEN"
- For YES/NO/NOT GIVEN: correctAnswer is "YES", "NO", or "NOT GIVEN"
- For fill_blank / short_answer: correctAnswer is the word(s) that fill the blank
- For matching_headings: questionText is e.g. "Paragraph A" and correctAnswer is the Roman numeral "i", "ii", "iii", etc.

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "passages": [
    {
      "number": 1,
      "title": "The exact passage title",
      "body": "Full passage text here...",
      "questions": [
        { "number": 1, "type": "true_false_ng", "questionText": "The statement text", "options": null, "correctAnswer": "TRUE" },
        { "number": 5, "type": "mcq", "questionText": "Which of the following...?", "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"], "correctAnswer": "A. First option" },
        { "number": 9, "type": "fill_blank", "questionText": "The process involves ___ and ___", "options": null, "correctAnswer": "heating / cooling" },
        { "number": 14, "type": "matching_headings", "questionText": "Paragraph B", "options": null, "correctAnswer": "iii" }
      ]
    },
    { "number": 2, "title": "...", "body": "...", "questions": [] },
    { "number": 3, "title": "...", "body": "...", "questions": [] }
  ]
}`

    } else if (skill === 'listening') {
      prompt = `You are extracting IELTS Listening Test ${testNumber} from a Cambridge IELTS book PDF.

The text contains the QUESTIONS (not the audio transcripts). Extract all 4 sections with their questions.

LISTENING SECTION TEXT:
${sectionText.substring(0, 30000)}

${answerText ? `ANSWER KEY TEXT:\n${answerText}` : ''}

INSTRUCTIONS:
- There are 4 sections (SECTION 1, SECTION 2, SECTION 3, SECTION 4)
- Total 40 questions: Section 1 Q1–10, Section 2 Q11–20, Section 3 Q21–30, Section 4 Q31–40
- Write a 1-2 sentence context description for each section (what the audio is about)
- Question types: fill_blank, mcq, mcq_multi, short_answer, matching, map_diagram
- For fill_blank: questionText should include the blank as ___, e.g. "The venue is at ___ Street"
- For MCQ: include options like ["A. option", "B. option", "C. option"]
- Correct answers come from the Answer Key; if not available, leave as empty string ""

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "sections": [
    {
      "number": 1,
      "context": "A conversation between two students about enrolling in a course at a local college.",
      "questions": [
        { "number": 1, "type": "fill_blank", "questionText": "Name: ___ Johnson", "options": null, "correctAnswer": "Sarah" },
        { "number": 3, "type": "mcq", "questionText": "What type of course does the student want?", "options": ["A. Part-time", "B. Full-time", "C. Online", "D. Evening"], "correctAnswer": "A. Part-time" }
      ]
    },
    { "number": 2, "context": "...", "questions": [] },
    { "number": 3, "context": "...", "questions": [] },
    { "number": 4, "context": "...", "questions": [] }
  ]
}`

    } else if (skill === 'writing') {
      prompt = `You are extracting IELTS Writing Test ${testNumber} from a Cambridge IELTS book PDF.

WRITING SECTION TEXT:
${sectionText.substring(0, 8000)}

INSTRUCTIONS:
- Task 1: usually describes a chart, graph, map, process diagram, or letter. Copy the full prompt/instruction.
- Task 2: an essay question. Copy the full question text.
- taskType for Task 1: "chart" (bar/line/pie chart, table), "map" (map comparison), "process" (process diagram), "diagram" (other diagram), "letter" (informal/formal letter for GT)

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "task1": {
    "taskType": "chart",
    "prompt": "The graph below shows... Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."
  },
  "task2": {
    "prompt": "Some people think... To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words."
  }
}`

    } else if (skill === 'speaking') {
      prompt = `You are extracting IELTS Speaking Test ${testNumber} from a Cambridge IELTS book PDF.

SPEAKING SECTION TEXT:
${sectionText.substring(0, 8000)}

INSTRUCTIONS:
- Part 1: 3-5 questions on familiar topics (home, work, hobbies, etc.)
- Part 2: a cue card topic with bullet points + follow-up questions
- Part 3: 4-6 discussion questions related to Part 2 topic

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "part1": {
    "description": "The examiner asks general questions about familiar topics.",
    "questions": ["Do you work or study?", "What do you like about your hometown?", "How do you usually spend your weekends?"]
  },
  "part2": {
    "instructions": "You will have to talk about the topic for one to two minutes. You have one minute to think about what you are going to say. You can make some notes to help you if you wish.",
    "cueCard": "Describe a place you have visited that you particularly liked.\n\nYou should say:\n  where it is\n  when you went there\n  what you did there\nand explain why you liked it so much.",
    "questions": ["Would you like to go back?", "Do you think tourism has changed this place?"]
  },
  "part3": {
    "description": "Discussion topics related to travel and places.",
    "topics": [
      {
        "label": "Tourism",
        "questions": ["Why do people enjoy travelling to different countries?", "How has tourism changed in recent years?"]
      },
      {
        "label": "Local culture",
        "questions": ["How important is it to preserve local culture?", "Can tourism help preserve culture or does it damage it?"]
      }
    ]
  }
}`
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.0,
      max_tokens: skill === 'reading' ? 16000 : 8000,
      messages: [
        {
          role: 'system',
          content: 'You are an expert IELTS content extractor. Extract exam content from Cambridge IELTS PDF text accurately. The PDF text may have minor formatting artifacts — interpret them correctly. Return ONLY valid JSON with no markdown code blocks.'
        },
        { role: 'user', content: prompt }
      ]
    })

    const raw = completion.choices[0].message.content.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let extracted
    try {
      extracted = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[Cambridge] JSON parse error:', parseErr.message)
      console.error('[Cambridge] Raw output (first 1000):', raw.substring(0, 1000))
      return res.status(422).json({
        message: 'AI trả về dữ liệu không hợp lệ. Hãy thử điều chỉnh lại số trang hoặc thử lại.',
        raw: raw.substring(0, 800)
      })
    }

    res.json({ extracted })
  } catch (err) {
    console.error('[Cambridge] Extract error:', err)
    res.status(500).json({ message: 'Lỗi trích xuất nội dung', error: err.message })
  }
})

// ─── CAMBRIDGE: SIMPLIFIED UPLOAD (no AI Phase 1) ────────────────────────────
router.post('/cambridge/upload-pdf', authMiddleware, adminOnly, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file PDF' })
    console.log('[PDF Upload] File:', req.file.originalname, req.file.size, 'bytes')

    const pages = await extractAllPages(req.file.path)
    const pageCount = pages.length
    console.log('[PDF Upload] Pages extracted:', pageCount)

    const dataFile = req.file.filename.replace('.pdf', '.json')
    fs.writeFileSync(path.join(pdfsDir, dataFile), JSON.stringify(pages))

    res.json({ dataFile, originalName: req.file.originalname, pageCount })
  } catch (err) {
    console.error('[PDF Upload] ERROR:', err)
    res.status(500).json({ message: 'Lỗi đọc PDF: ' + err.message })
  }
})

// ─── CAMBRIDGE: EXTRACT + SAVE TO DB (Groq AI) ───────────────────────────────

async function createExamFromExtracted(skill, bookNumber, testNumber, title, data, seriesId) {
  const bn = bookNumber ? parseInt(bookNumber) : null
  const tn = testNumber ? parseInt(testNumber) : null
  const sid = seriesId ? parseInt(seriesId) : null

  if (skill === 'reading') {
    const exam = await prisma.exam.create({
      data: {
        title, skill: 'reading', bookNumber: bn, testNumber: tn, seriesId: sid,
        passages: {
          create: (data.passages || []).map(p => ({
            number: p.number, title: p.title || '', body: p.body || '',
            questions: {
              create: (p.questions || []).map(q => ({
                number: q.number, type: q.type, questionText: q.questionText || '',
                options: q.options ? JSON.stringify(q.options) : null,
                correctAnswer: q.correctAnswer || '', imageUrl: q.imageUrl || null
              }))
            }
          }))
        }
      }
    })
    const totalQ = (data.passages || []).reduce((s, p) => s + (p.questions?.length || 0), 0)
    return { examId: exam.id, questionCount: totalQ }
  }

  if (skill === 'listening') {
    const exam = await prisma.exam.create({
      data: { title, skill: 'listening', bookNumber: bn, testNumber: tn, seriesId: sid }
    })
    let totalQ = 0
    for (const s of (data.sections || [])) {
      const section = await prisma.listeningSection.create({
        data: { examId: exam.id, number: s.number, context: s.context || '', audioUrl: null, transcript: s.transcript || '' }
      })
      for (const q of (s.questions || [])) {
        await prisma.question.create({
          data: {
            listeningSectionId: section.id, number: q.number, type: q.type,
            questionText: q.questionText || '',
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || '', imageUrl: q.imageUrl || null
          }
        })
        totalQ++
      }
    }
    return { examId: exam.id, questionCount: totalQ }
  }

  if (skill === 'writing') {
    const exam = await prisma.exam.create({
      data: {
        title, skill: 'writing', bookNumber: bn, testNumber: tn, seriesId: sid,
        writingTasks: {
          create: [
            { number: 1, prompt: data.task1?.prompt || '', imageUrl: null, minWords: 150 },
            { number: 2, prompt: data.task2?.prompt || '', imageUrl: null, minWords: 250 }
          ]
        }
      }
    })
    return { examId: exam.id, questionCount: 2 }
  }

  if (skill === 'speaking') {
    const part3Questions = (data.part3?.topics || []).flatMap(t => [
      t.label?.trim() ? `##TOPIC##:${t.label.trim()}` : null,
      ...(t.questions || []).filter(q => q?.trim())
    ]).filter(Boolean)
    const exam = await prisma.exam.create({
      data: {
        title, skill: 'speaking', bookNumber: bn, testNumber: tn, seriesId: sid,
        speakingParts: {
          create: [
            { number: 1, cueCard: data.part1?.description || null, questions: { create: (data.part1?.questions || []).map((q, i) => ({ orderNum: i + 1, questionText: q })) } },
            { number: 2, cueCard: data.part2?.cueCard || null, questions: { create: (data.part2?.questions || []).map((q, i) => ({ orderNum: i + 1, questionText: q })) } },
            { number: 3, cueCard: data.part3?.description || null, questions: { create: part3Questions.map((q, i) => ({ orderNum: i + 1, questionText: q })) } }
          ]
        }
      }
    })
    const totalQ = (data.part1?.questions?.length || 0) + (data.part2?.questions?.length || 0) + part3Questions.length
    return { examId: exam.id, questionCount: totalQ }
  }

  throw new Error('Unknown skill: ' + skill)
}

router.post('/cambridge/extract-save', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { dataFile, bookNumber, testNumber, skill, startPage, endPage, answerStart, answerEnd, seriesId } = req.body
    console.log('[Extract] skill=%s test=%s pages=%s-%s answers=%s-%s', skill, testNumber, startPage, endPage, answerStart, answerEnd)

    const dataPath = path.join(pdfsDir, dataFile)
    if (!fs.existsSync(dataPath)) return res.status(404).json({ message: 'File không tồn tại, upload lại PDF' })

    const pages = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const total = pages.length
    const s = (startPage > 0) ? startPage : 1
    const e = (endPage   > 0) ? endPage   : total

    const contentText = pages.slice(s - 1, e).map((p, i) => `=== PAGE ${s + i} ===\n${p}`).join('\n\n')
    let answerText = ''
    if (answerStart > 0 && answerEnd > 0) {
      answerText = pages.slice(answerStart - 1, answerEnd).map((p, i) => `=== PAGE ${answerStart + i} ===\n${p}`).join('\n\n').substring(0, 6000)
    }
    console.log('[Extract] Content chars:', contentText.length, '| Answer chars:', answerText.length)

    let seriesName = 'IELTS'
    if (seriesId) {
      try {
        const s = await prisma.examSeries.findUnique({ where: { id: parseInt(seriesId) } })
        if (s) seriesName = s.name
      } catch {}
    }
    const bookLabel = bookNumber ? `${seriesName} ${bookNumber}` : seriesName
    const title = `${bookLabel} - Test ${testNumber} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`

    const PROMPTS = {
      reading: `Extract IELTS Reading Test ${testNumber} from the PDF text. Return ONLY valid JSON, no markdown, no explanation.

READING TEXT (pages ${s}–${e}):
${contentText.substring(0, 35000)}
${answerText ? `\nANSWER KEY (use for correctAnswer):\n${answerText}` : ''}

Rules:
- 3 passages. "body" = full passage text verbatim (essential for students to read).
- question types: mcq|mcq_multi|true_false_ng|yes_no_ng|fill_blank|short_answer|matching_headings|matching_features|matching_paragraph|matching_endings|choose_title|diagram_completion
- mcq/mcq_multi: options=["A. text","B. text",...], correctAnswer=exact matching option string
- true_false_ng/yes_no_ng: correctAnswer="TRUE"/"FALSE"/"NOT GIVEN" or "YES"/"NO"/"NOT GIVEN"
- matching_headings: options=["i. heading",...], correctAnswer=roman numeral string
- fill_blank/short_answer: options=null, correctAnswer=word(s) to fill
- imageUrl=null for all questions

{"title":"${title}","passages":[{"number":1,"title":"Passage title","body":"Full passage text here...","questions":[{"number":1,"type":"mcq","questionText":"Question?","options":["A. opt","B. opt","C. opt","D. opt"],"correctAnswer":"A. opt","imageUrl":null}]}]}`,

      listening: `Extract IELTS Listening Test ${testNumber} from the PDF text below. Return ONLY valid JSON matching this exact schema.

LISTENING TEXT (pages ${s}–${e}):
${contentText.substring(0, 30000)}
${answerText ? `\nANSWER KEY:\n${answerText}` : ''}

Rules:
- 4 sections (SECTION 1–4), questions 1–40
- Question types: fill_blank|mcq|mcq_multi|short_answer|matching|map_diagram
- fill_blank: blank shown as ___ in questionText, correctAnswer = missing word(s)
- mcq: options ["A. text","B. text","C. text"], correctAnswer = exact option text
- mcq_multi (choose TWO): correctAnswer = "A. text,C. text"
- map_diagram: options = ["A","B","C",...], correctAnswer = correct letter
- Use answer key for correctAnswer

{"title":"${title}","sections":[{"number":1,"context":"Brief description of the conversation/talk","transcript":"","questions":[{"number":1,"type":"fill_blank","questionText":"Name: ___ Johnson","options":null,"correctAnswer":"Sarah","imageUrl":null}]}]}`,

      writing: `Extract IELTS Writing Test ${testNumber} from the PDF text below. Return ONLY valid JSON.

WRITING TEXT (pages ${s}–${e}):
${contentText.substring(0, 8000)}

{"title":"${title}","task1":{"taskType":"chart","prompt":"Full Task 1 prompt including instructions..."},"task2":{"prompt":"Full Task 2 essay question including instructions..."}}

taskType options: chart | map | process | diagram | letter`,

      speaking: `Extract IELTS Speaking Test ${testNumber} from the PDF text below. Return ONLY valid JSON.

SPEAKING TEXT (pages ${s}–${e}):
${contentText.substring(0, 8000)}

{"title":"${title}","part1":{"description":"Examiner asks about familiar topics.","questions":["Q1?","Q2?","Q3?"]},"part2":{"instructions":"You will have to talk for 1–2 minutes...","cueCard":"Describe ...\\n\\nYou should say:\\n  ...\\nand explain ...","questions":["Follow-up Q?"]},"part3":{"description":"Discussion topics related to ...","topics":[{"label":"Topic A","questions":["Q1?","Q2?"]},{"label":"Topic B","questions":["Q3?"]}]}}`
    }

    const prompt = PROMPTS[skill]
    if (!prompt) return res.status(400).json({ message: 'Skill không hợp lệ' })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.0,
      max_tokens: skill === 'reading' ? 16000 : 6000,
      messages: [
        { role: 'system', content: 'You are an expert IELTS content extractor. Extract exam content from Cambridge IELTS PDF text accurately. Return ONLY valid JSON with no markdown code blocks, no explanation.' },
        { role: 'user', content: prompt }
      ]
    })

    const finishReason = completion.choices[0].finish_reason
    let raw = (completion.choices[0].message.content || '').trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    console.log('[Extract] finish_reason:', finishReason, '| Raw length:', raw.length)
    console.log('[Extract] Raw preview:', raw.substring(0, 300))

    // Attempt to repair truncated JSON (finish_reason === 'length')
    if (finishReason === 'length' && raw && !raw.endsWith('}')) {
      // Try to close any open arrays/objects
      const opens = { '{': '}', '[': ']' }
      const stack = []
      let inString = false, escape = false
      for (const ch of raw) {
        if (escape) { escape = false; continue }
        if (ch === '\\' && inString) { escape = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (!inString) {
          if (ch === '{' || ch === '[') stack.push(opens[ch])
          else if (ch === '}' || ch === ']') stack.pop()
        }
      }
      // Remove trailing comma before closing
      raw = raw.replace(/,\s*$/, '')
      raw += stack.reverse().join('')
      console.log('[Extract] Repaired JSON tail:', raw.slice(-100))
    }

    let extracted
    try {
      extracted = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[Extract] JSON parse error:', parseErr.message)
      const hint = finishReason === 'length' ? ' (Output bị cắt ngắn — giảm phạm vi trang hoặc tách từng passage)' : ''
      return res.status(422).json({
        message: `AI trả về JSON không hợp lệ: ${parseErr.message}.${hint} Hãy thử điều chỉnh phạm vi trang hoặc giảm số trang.`,
        raw: raw.substring(0, 800)
      })
    }

    // Validate content before saving
    if (skill === 'reading' && (!extracted.passages || extracted.passages.length === 0)) {
      return res.status(422).json({ message: 'AI không trích xuất được passage nào. Hãy kiểm tra lại phạm vi trang.', raw: raw.substring(0, 400) })
    }
    if (skill === 'listening' && (!extracted.sections || extracted.sections.length === 0)) {
      return res.status(422).json({ message: 'AI không trích xuất được section nào. Hãy kiểm tra lại phạm vi trang.', raw: raw.substring(0, 400) })
    }

    console.log('[Extract] Parsed OK —', skill === 'reading' ? `${extracted.passages?.length} passages` : skill === 'listening' ? `${extracted.sections?.length} sections` : 'tasks OK')

    const examTitle = extracted.title || title
    const { examId, questionCount } = await createExamFromExtracted(skill, bookNumber, testNumber, examTitle, extracted, seriesId)
    console.log('[Extract] Created exam', examId, 'skill=', skill, 'questions=', questionCount)

    res.json({ examId, title: examTitle, questionCount, skill, testNumber: parseInt(testNumber) })
  } catch (err) {
    console.error('[Extract] ERROR:', err)
    res.status(500).json({ message: 'Lỗi trích xuất: ' + err.message })
  }
})

// ─── MAKE ADMIN ──────────────────────────────────────────────────────────────
router.post('/make-admin', authMiddleware, adminOnly, async (req, res) => {
  try {
    const targetId = req.body.userId ? parseInt(req.body.userId) : req.user.userId
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role: 'admin' },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json({ message: 'Đã nâng quyền admin!', user })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── DASHBOARD ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const os = require('os')

router.get('/dashboard', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [totalUsers, usersThisMonth, usersLastMonth, attemptsToday, avgBandRaw, totalExams] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
      prisma.attempt.count({ where: { finishedAt: { gte: startOfToday } } }),
      prisma.attempt.aggregate({ where: { score: { not: null } }, _avg: { score: true } }),
      prisma.exam.count(),
    ])

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

    // 1. User Growth Data (Real)
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true }
    })
    const userDayMap = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      userDayMap[d.toISOString().slice(0, 10)] = 0
    }
    recentUsers.forEach(u => {
      const key = u.createdAt.toISOString().slice(0, 10)
      if (key in userDayMap) userDayMap[key]++
    })
    const registrationsByDay = Object.entries(userDayMap).map(([date, count]) => ({ date, count }))

    // 2. System Logs (Real actions from DB)
    const [latestExams, latestAttempts] = await Promise.all([
      prisma.exam.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { title: true, createdAt: true } }),
      prisma.attempt.findMany({ take: 2, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } })
    ])
    
    const systemLogs = [
      ...latestExams.map(e => ({
        time: e.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        user: 'Hệ thống',
        action: `Đã thêm đề mới: ${e.title}`,
        status: 'Hoàn tất'
      })),
      ...latestAttempts.map(a => ({
        time: a.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        user: a.user?.name || 'Ẩn danh',
        action: `Hoàn thành bài thi ${a.examId}`,
        status: 'Thành công'
      }))
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5)

    // 3. System Health (Real server stats)
    const freeMem = os.freemem()
    const totalMem = os.totalmem()
    const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
    
    const aiAttemptsToday = await prisma.attempt.count({ 
      where: { 
        finishedAt: { gte: startOfToday },
        exam: { skill: { in: ['writing', 'speaking'] } }
      } 
    })
    const aiLimitUsage = Math.min(100, Math.round((aiAttemptsToday / 500) * 100)) 

    const systemHealth = {
      serverMemory: memUsage,
      aiLimit: aiLimitUsage
    }

    // Attempts per day - last 30 days
    const recentAttempts = await prisma.attempt.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true }
    })
    const dayMap = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dayMap[key] = 0
    }
    recentAttempts.forEach(a => {
      const key = a.createdAt.toISOString().slice(0, 10)
      if (key in dayMap) dayMap[key]++
    })
    const attemptsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

    // Band score distribution
    const allScores = await prisma.attempt.findMany({
      where: { score: { not: null } }, select: { score: true }
    })
    const bandBuckets = { '<4.0': 0, '4.0-4.5': 0, '5.0-5.5': 0, '6.0-6.5': 0, '7.0-7.5': 0, '8.0+': 0 }
    allScores.forEach(({ score }) => {
      if (score < 4)       bandBuckets['<4.0']++
      else if (score < 5)  bandBuckets['4.0-4.5']++
      else if (score < 6)  bandBuckets['5.0-5.5']++
      else if (score < 7)  bandBuckets['6.0-6.5']++
      else if (score < 8)  bandBuckets['7.0-7.5']++
      else                 bandBuckets['8.0+']++
    })
    const bandDistribution = Object.entries(bandBuckets).map(([range, count]) => ({ range, count }))

    // Skill distribution
    const skillDist = await prisma.attempt.groupBy({
      by: ['examId'],
      _count: { id: true }
    })
    const examSkillMap = await prisma.exam.findMany({ select: { id: true, skill: true } })
    const skillLookup = Object.fromEntries(examSkillMap.map(e => [e.id, e.skill]))
    const skillCount = { reading: 0, listening: 0, writing: 0, speaking: 0 }
    skillDist.forEach(({ examId, _count }) => {
      const s = skillLookup[examId]
      if (s && s in skillCount) skillCount[s] += _count.id
    })
    const skillDistribution = Object.entries(skillCount).map(([skill, count]) => ({ skill, count }))

    // Recent 10 attempts
    const recent = await prisma.attempt.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { finishedAt: { not: null } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        exam: { select: { id: true, title: true, skill: true } }
      }
    })

    res.json({
      stats: {
        totalUsers, usersThisMonth, usersLastMonth,
        attemptsToday,
        avgBand: avgBandRaw._avg.score || 0,
        totalExams,
      },
      registrationsByDay,
      systemLogs,
      systemHealth,
      attemptsByDay,
      bandDistribution,
      skillDistribution,
      recentAttempts: recent,
    })
  } catch (error) {
    console.error('[Dashboard Error]', error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── USERS ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const baseWhere = { role: 'user' }
    const where = search ? {
      ...baseWhere,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : baseWhere
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true,
          isLocked: true, createdAt: true,
          _count: { select: { attempts: true } }
        }
      }),
      prisma.user.count({ where })
    ])

    const userIds = users.map(u => u.id)
    const [avgScores, lastAttempts] = await Promise.all([
      prisma.attempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, score: { not: null } },
        _avg: { score: true }
      }),
      prisma.attempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _max: { createdAt: true }
      })
    ])
    const avgMap = Object.fromEntries(avgScores.map(a => [a.userId, a._avg.score]))
    const lastMap = Object.fromEntries(lastAttempts.map(a => [a.userId, a._max.createdAt]))

    res.json({
      users: users.map(u => ({
        ...u,
        avgScore: avgMap[u.id] ?? null,
        lastAttemptAt: lastMap[u.id] ?? null,
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })

    const [attempts, skillAvg] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { exam: { select: { title: true, skill: true } } }
      }),
      prisma.attempt.groupBy({
        by: ['examId'],
        where: { userId: id, score: { not: null } },
        _avg: { score: true }
      })
    ])

    const examIds = [...new Set(skillAvg.map(a => a.examId))]
    const exams = await prisma.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, skill: true } })
    const skillLookup = Object.fromEntries(exams.map(e => [e.id, e.skill]))
    const bySkill = { reading: [], listening: [], writing: [], speaking: [] }
    skillAvg.forEach(a => {
      const s = skillLookup[a.examId]
      if (s && s in bySkill) bySkill[s].push(a._avg.score)
    })
    const skillStats = Object.fromEntries(
      Object.entries(bySkill).map(([s, scores]) => [
        s, scores.length > 0 ? (scores.reduce((a,b) => a+b, 0) / scores.length) : null
      ])
    )

    res.json({ user, attempts, skillStats, totalAttempts: attempts.length })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/users/:id/toggle-lock', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.user.findUnique({ where: { id }, select: { isLocked: true } })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' })
    const updated = await prisma.user.update({ where: { id }, data: { isLocked: !user.isLocked } })
    res.json({ isLocked: updated.isLocked })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Không thể xóa tài khoản đang dùng' })
    await prisma.user.delete({ where: { id } })
    res.json({ message: 'Đã xóa user' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── ATTEMPTS ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/attempts', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { search = '', skill = '', dateFrom, dateTo, seriesId, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 20 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = { finishedAt: { not: null } }

    // Lọc theo exam (skill, seriesId) — dùng relation filter đúng chuẩn Prisma
    if (skill || seriesId) {
      where.exam = {}
      if (skill) where.exam.skill = skill
      if (seriesId) where.exam.seriesId = parseInt(seriesId)
    }

    // Tìm kiếm theo tên/email user
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    // Lọc theo ngày — dateTo set đến cuối ngày (23:59:59)
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        where.createdAt.lte = to
      }
    }

    // Sắp xếp: theo band hoặc theo ngày
    const orderBy = sortBy === 'score'
      ? { score: sortOrder === 'asc' ? 'asc' : 'desc' }
      : { createdAt: 'desc' }

    const [attempts, total] = await Promise.all([
      prisma.attempt.findMany({
        where,
        skip, take: parseInt(limit),
        orderBy,
        include: {
          user: { select: { id: true, name: true, email: true } },
          exam: { select: { id: true, title: true, skill: true } }
        }
      }),
      prisma.attempt.count({ where })
    ])

    res.json({ attempts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── ANALYTICS ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/analytics', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { period = 'month' } = req.query
    const days = period === 'week' ? 7 : period === 'quarter' ? 90 : 30
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [totalAttempts, totalUsers, avgBandRaw, skillStats, topUsers, topWrongQ] = await Promise.all([
      prisma.attempt.count({ where: { finishedAt: { not: null }, createdAt: { gte: since } } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.attempt.aggregate({ where: { score: { not: null }, createdAt: { gte: since } }, _avg: { score: true } }),
      // Skill breakdown
      prisma.attempt.findMany({
        where: { finishedAt: { not: null }, createdAt: { gte: since } },
        include: { exam: { select: { skill: true } } }
      }),
      // Top 10 users by avg score
      prisma.attempt.groupBy({
        by: ['userId'],
        where: { score: { not: null } },
        _avg: { score: true },
        _count: { id: true },
        orderBy: { _avg: { score: 'desc' } },
        take: 10
      }),
      // Top wrong questions
      prisma.questionAnswer.groupBy({
        by: ['questionId'],
        where: { isCorrect: false },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      })
    ])

    // Aggregate skill stats
    const bySkill = { reading: { count: 0, scores: [] }, listening: { count: 0, scores: [] }, writing: { count: 0, scores: [] }, speaking: { count: 0, scores: [] } }
    skillStats.forEach(a => {
      const s = a.exam.skill
      if (s in bySkill) {
        bySkill[s].count++
        if (a.score != null) bySkill[s].scores.push(a.score)
      }
    })
    const skillBreakdown = Object.entries(bySkill).map(([skill, { count, scores }]) => ({
      skill, count,
      avgScore: scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length) : null
    }))

    // Top users - fetch names
    const topUserIds = topUsers.map(u => u.userId)
    const topUserInfo = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true }
    })
    const userMap = Object.fromEntries(topUserInfo.map(u => [u.id, u]))
    const topUsersResult = topUsers.map(u => ({
      ...userMap[u.userId],
      avgScore: u._avg.score,
      attemptCount: u._count.id
    }))

    // Top wrong questions - fetch question text
    const wrongQIds = topWrongQ.map(q => q.questionId)
    const wrongQInfo = await prisma.question.findMany({
      where: { id: { in: wrongQIds } },
      select: { id: true, questionText: true, type: true }
    })
    const qMap = Object.fromEntries(wrongQInfo.map(q => [q.id, q]))
    const topWrongQuestions = topWrongQ.map(q => ({
      ...qMap[q.questionId],
      wrongCount: q._count.id
    })).filter(q => q.id)

    res.json({
      overview: { totalAttempts, totalUsers, avgBand: avgBandRaw._avg.score },
      skillBreakdown,
      topUsers: topUsersResult,
      topWrongQuestions,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── PROFILE (CURRENT USER) ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/me', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/me/password', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Thiếu thông tin' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'Mật khẩu mới phải ít nhất 6 ký tự' })
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.userId }, data: { password: hashed } })
    res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── ACCOUNTS (ADMIN/TEACHER) ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/accounts', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      const account = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
      })
      return res.json(account ? [account] : [])
    }
    const accounts = await prisma.user.findMany({
      where: { role: { in: ['admin', 'teacher'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(accounts)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/accounts', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!['admin', 'teacher'].includes(role)) return res.status(400).json({ message: 'Role không hợp lệ' })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ message: 'Email đã tồn tại' })
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.status(201).json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/accounts/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (req.user.role === 'teacher' && id !== req.user.userId) {
      return res.status(403).json({ message: 'Không có quyền truy cập' })
    }
    const { name, role, isLocked } = req.body
    const data = {}
    if (name) data.name = name
    if (req.user.role === 'admin') {
      if (role && ['admin', 'teacher'].includes(role)) data.role = role
      if (isLocked !== undefined) data.isLocked = isLocked
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/accounts/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.userId) return res.status(400).json({ message: 'Không thể xóa tài khoản đang dùng' })
    await prisma.user.delete({ where: { id } })
    res.json({ message: 'Đã xóa tài khoản' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── SETTINGS ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany()
    const obj = Object.fromEntries(settings.map(s => [s.key, s.value]))
    res.json(obj)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const entries = Object.entries(req.body)
    await Promise.all(entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    ))
    res.json({ message: 'Đã lưu cài đặt' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── STAFF MANAGEMENT ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get('/staff', authMiddleware, adminOnly, async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['admin', 'teacher'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isLocked: true, createdAt: true }
    })
    res.json(staff)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/make-teacher', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ message: 'Thiếu userId' })
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role: 'teacher' },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json({ message: 'Đã nâng quyền teacher!', user })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/remove-staff', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ message: 'Thiếu userId' })
    if (parseInt(userId) === req.user.userId) return res.status(400).json({ message: 'Không thể tự xóa quyền của mình' })
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role: 'user' },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json({ message: 'Đã xóa quyền staff', user })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── TRASH ────────────────────────────────────────────────────────────────────
const teacherOrAdmin2 = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher')
    return res.status(403).json({ message: 'Không có quyền' })
  next()
}

// Cascade-safe hard delete for Exam records
// No-cascade FKs on Exam: Attempt.examId, SeriesExam.examId, WritingAnswer.taskId, SpeakingAnswer.partId
async function hardDeleteExams(examIds) {
  if (!examIds.length) return
  const [taskIds, partIds] = await Promise.all([
    prisma.writingTask.findMany({ where: { examId: { in: examIds } }, select: { id: true } }).then(r => r.map(t => t.id)),
    prisma.speakingPart.findMany({ where: { examId: { in: examIds } }, select: { id: true } }).then(r => r.map(p => p.id)),
  ])
  await Promise.all([
    prisma.attempt.deleteMany({ where: { examId: { in: examIds } } }),
    prisma.seriesExam.deleteMany({ where: { examId: { in: examIds } } }),
    taskIds.length ? prisma.writingAnswer.deleteMany({ where: { taskId: { in: taskIds } } }) : Promise.resolve(),
    partIds.length ? prisma.speakingAnswer.deleteMany({ where: { partId: { in: partIds } } }) : Promise.resolve(),
  ])
  await prisma.exam.deleteMany({ where: { id: { in: examIds } } })
}

// Cascade-safe hard delete for Series records (SeriesExam has no onDelete: Cascade)
async function hardDeleteSeries(seriesIds) {
  if (!seriesIds.length) return
  await prisma.seriesExam.deleteMany({ where: { seriesId: { in: seriesIds } } })
  await prisma.series.deleteMany({ where: { id: { in: seriesIds } } })
}

router.get('/trash', authMiddleware, teacherOrAdmin2, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const softWhere = { deletedAt: { not: null } }
    const expiredWhere = { deletedAt: { not: null, lt: thirtyDaysAgo } }

    // Auto-purge items older than 30 days
    await Promise.all([
      prisma.practiceExam.deleteMany({ where: expiredWhere }),
      prisma.writingSample.deleteMany({ where: expiredWhere }),
      prisma.speakingSample.deleteMany({ where: expiredWhere }),
      prisma.examSeries.deleteMany({ where: expiredWhere }),
      prisma.bookCover.deleteMany({ where: expiredWhere }),
    ])
    const [expiredExams, expiredSeries] = await Promise.all([
      prisma.exam.findMany({ where: expiredWhere, select: { id: true } }),
      prisma.series.findMany({ where: expiredWhere, select: { id: true } }),
    ])
    await hardDeleteExams(expiredExams.map(e => e.id))
    await hardDeleteSeries(expiredSeries.map(s => s.id))

    const [practices, writings, speakings, exams, examSeriesList, books, seriesList] = await Promise.all([
      prisma.practiceExam.findMany({
        where: softWhere,
        select: { id: true, title: true, skill: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.writingSample.findMany({
        where: softWhere,
        select: { id: true, title: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.speakingSample.findMany({
        where: softWhere,
        select: { id: true, title: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.exam.findMany({
        where: softWhere,
        select: { id: true, title: true, skill: true, coverImageUrl: true, seriesId: true, bookNumber: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.examSeries.findMany({
        where: softWhere,
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.bookCover.findMany({
        where: softWhere,
        select: { id: true, seriesId: true, bookNumber: true, coverImageUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.series.findMany({
        where: softWhere,
        select: { id: true, name: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' }
      }),
    ])

    // Enrich books with seriesName
    const seriesIds = [...new Set(books.map(b => b.seriesId))]
    let seriesNameMap = {}
    if (seriesIds.length) {
      const seriesRows = await prisma.examSeries.findMany({
        where: { id: { in: seriesIds } },
        select: { id: true, name: true }
      })
      for (const s of seriesRows) seriesNameMap[s.id] = s.name
    }

    const items = [
      ...practices.map(r => ({ ...r, type: r.skill === 'reading' ? 'reading_practice' : 'listening_practice' })),
      ...writings.map(r => ({ ...r, type: 'writing_sample' })),
      ...speakings.map(r => ({ ...r, type: 'speaking_sample' })),
      ...exams.map(r => ({ ...r, thumbnailUrl: r.coverImageUrl, type: `exam_${r.skill}` })),
      ...examSeriesList.map(r => ({ ...r, title: r.name, type: 'exam_series' })),
      ...books.map(r => ({ ...r, title: `Cuốn ${r.bookNumber} — ${seriesNameMap[r.seriesId] || 'Bộ đề'}`, thumbnailUrl: r.coverImageUrl, type: 'book' })),
      ...seriesList.map(r => ({ ...r, title: r.name, type: 'series' })),
    ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))

    res.json(items)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.post('/trash/:type/:id/restore', authMiddleware, teacherOrAdmin2, async (req, res) => {
  const { type, id } = req.params
  const numId = parseInt(id)
  try {
    if (type === 'reading_practice' || type === 'listening_practice') {
      await prisma.practiceExam.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'writing_sample') {
      await prisma.writingSample.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'speaking_sample') {
      await prisma.speakingSample.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type.startsWith('exam_')) {
      await prisma.exam.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'exam_series') {
      await prisma.examSeries.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'book') {
      // Restore BookCover + all exams in this book
      const book = await prisma.bookCover.findUnique({ where: { id: numId }, select: { seriesId: true, bookNumber: true } })
      if (book) {
        await Promise.all([
          prisma.bookCover.update({ where: { id: numId }, data: { deletedAt: null } }),
          prisma.exam.updateMany({ where: { seriesId: book.seriesId, bookNumber: book.bookNumber }, data: { deletedAt: null } }),
        ])
      }
    } else if (type === 'series') {
      await prisma.series.update({ where: { id: numId }, data: { deletedAt: null } })
    } else {
      return res.status(400).json({ message: 'Loại không hợp lệ' })
    }
    res.json({ message: 'Đã khôi phục' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khôi phục', error: err.message })
  }
})

router.delete('/trash/purge', authMiddleware, teacherOrAdmin2, async (req, res) => {
  try {
    const where = { deletedAt: { not: null } }
    await Promise.all([
      prisma.practiceExam.deleteMany({ where }),
      prisma.writingSample.deleteMany({ where }),
      prisma.speakingSample.deleteMany({ where }),
      prisma.examSeries.deleteMany({ where }),
      prisma.bookCover.deleteMany({ where }),
    ])
    const [allExams, allSeries] = await Promise.all([
      prisma.exam.findMany({ where, select: { id: true } }),
      prisma.series.findMany({ where, select: { id: true } }),
    ])
    await hardDeleteExams(allExams.map(e => e.id))
    await hardDeleteSeries(allSeries.map(s => s.id))
    res.json({ message: 'Đã dọn sạch thùng rác' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi dọn rác', error: err.message })
  }
})

router.delete('/trash/:type/:id/permanent', authMiddleware, teacherOrAdmin2, async (req, res) => {
  const { type, id } = req.params
  const numId = parseInt(id)
  try {
    if (type === 'reading_practice' || type === 'listening_practice') {
      await prisma.practiceExam.delete({ where: { id: numId } })
    } else if (type === 'writing_sample') {
      await prisma.writingSample.delete({ where: { id: numId } })
    } else if (type === 'speaking_sample') {
      await prisma.speakingSample.delete({ where: { id: numId } })
    } else if (type.startsWith('exam_')) {
      await hardDeleteExams([numId])
    } else if (type === 'exam_series') {
      await prisma.examSeries.delete({ where: { id: numId } })
    } else if (type === 'book') {
      const book = await prisma.bookCover.findUnique({ where: { id: numId }, select: { seriesId: true, bookNumber: true } })
      if (book) {
        const bookExams = await prisma.exam.findMany({ where: { seriesId: book.seriesId, bookNumber: book.bookNumber }, select: { id: true } })
        await hardDeleteExams(bookExams.map(e => e.id))
        await prisma.bookCover.delete({ where: { id: numId } })
      }
    } else if (type === 'series') {
      await hardDeleteSeries([numId])
    } else {
      return res.status(400).json({ message: 'Loại không hợp lệ' })
    }
    res.json({ message: 'Đã xóa vĩnh viễn' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa vĩnh viễn', error: err.message })
  }
})

module.exports = router
