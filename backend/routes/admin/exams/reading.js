const express = require('express')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { syncSeriesExam } = require('../../../lib/syncHelpers')
const { createReadingExamSchema } = require('../../../validators/adminExamValidator')

// ─── CREATE READING EXAM ─────────────────────────────────────────────────────
router.post('/exams/reading', authMiddleware, teacherOnly, validate(createReadingExamSchema), async (req, res) => {
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

module.exports = router
