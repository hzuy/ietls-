const express = require('express')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { updateExamSchema } = require('../../../validators/adminExamValidator')
const { invalidate } = require('../../../lib/swrCache')

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

// Prisma relation filter "đề đã có ít nhất 1 câu hỏi", theo từng skill.
// Dùng cho cả filter status (has/no_questions) và stats card "Chưa có câu hỏi".
function hasQuestionsFilterFor(skill) {
  switch (skill) {
    case 'reading':
      return { passages: { some: { OR: [{ questionGroups: { some: {} } }, { questions: { some: { groupId: null } } }] } } }
    case 'listening':
      return { listeningSections: { some: { OR: [{ questionGroups: { some: {} } }, { questions: { some: { groupId: null } } }] } } }
    case 'writing':
      return { writingTasks: { some: {} } }
    case 'speaking':
      return { speakingParts: { some: { questions: { some: {} } } } }
    default:
      return null
  }
}

// ─── GET EXAMS (PAGINATED & FILTERED) ───────────────────────────────────────
router.get('/exams', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { skill, search = '', seriesId, page = 1, limit = 20, status = 'all', sortBy = 'createdAt', sortOrder = 'desc' } = req.query
    const parsedPage = Math.max(1, parseInt(page) || 1)
    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit) || 20))
    const skip = (parsedPage - 1) * parsedLimit

    // baseWhere: skill + bộ đề + tìm kiếm — dùng cho stats tổng quan
    const baseWhere = { deletedAt: null }
    if (skill) baseWhere.skill = skill
    if (seriesId) baseWhere.seriesId = parseInt(seriesId)
    if (search) baseWhere.title = { contains: search, mode: 'insensitive' }

    // where: baseWhere + filter trạng thái câu hỏi (áp cho danh sách + phân trang)
    const hasQ = hasQuestionsFilterFor(skill)
    const where = { ...baseWhere }
    if (hasQ && status === 'has_questions') Object.assign(where, hasQ)
    if (hasQ && status === 'no_questions') where.NOT = hasQ

    // Sắp xếp — sortBy: createdAt | title | attempts | score
    const SORT_FIELDS = new Set(['createdAt', 'title', 'attempts', 'score'])
    const sb = SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt'
    const so = sortOrder === 'asc' ? 'asc' : 'desc'
    let orderBy
    if (sb === 'attempts') {
      orderBy = { attempts: { _count: so } }
    } else if (sb === 'score') {
      // FALLBACK: avgScore là giá trị dẫn xuất (tính sau query, theo trang), chưa
      // ORDER BY được ở tầng DB. Tạm xấp xỉ "Band cao nhất" = nhiều lượt làm nhất
      // rồi mới nhất. TODO: thêm cột Exam.avgScore để sắp xếp chính xác.
      orderBy = [{ attempts: { _count: 'desc' } }, { createdAt: 'desc' }]
    } else {
      orderBy = { [sb]: so }
    }

    // Stats tổng quan chạy song song với query danh sách (không phụ thuộc kết quả)
    const statsPromise = skill
      ? Promise.all([
          prisma.exam.count({ where: baseWhere }),
          hasQ ? prisma.exam.count({ where: { ...baseWhere, NOT: hasQ } }) : Promise.resolve(0),
          prisma.attempt.aggregate({ where: { exam: baseWhere }, _count: { _all: true }, _avg: { score: true } }),
        ])
      : Promise.resolve(null)

    const [exams, total, statsRaw] = await Promise.all([
      prisma.exam.findMany({
        where,
        orderBy,
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
      prisma.exam.count({ where }),
      statsPromise
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

    // Stats tổng quan: toàn DB theo baseWhere (skill + bộ đề + tìm kiếm),
    // KHÔNG giới hạn trang, KHÔNG áp filter trạng thái câu hỏi.
    const stats = statsRaw ? {
      totalExams: statsRaw[0],
      noQuestionsCount: statsRaw[1],
      totalAttempts: statsRaw[2]._count._all,
      avgBand: statsRaw[2]._avg.score, // null khi chưa có lượt nào có điểm
    } : null

    res.json({
      exams: data,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit),
      stats
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
    invalidate('fulltests:')
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật', error: error.message })
  }
})

// ─── DIFF-BASED UPSERT HELPERS (Reading + Listening PUT) ────────────────────
// PUT used to delete-and-recreate the whole Passage/ListeningSection → Question
// tree on every save, which regenerates Question IDs and orphans QuestionAnswer/
// AnswerLog rows from attempts already taken. These helpers instead match
// existing rows by number/sortOrder, update in place (preserving id), and only
// ever delete a Question after confirming no QuestionAnswer/AnswerLog points to
// it — otherwise the whole request is rejected (see BlockedDeletionError).
class BlockedDeletionError extends Error {
  constructor(blockedQuestions) {
    super('blocked-deletion')
    this.blockedQuestions = blockedQuestions
  }
}

const NOTE_GROUP_TYPES = ['note_completion', 'table_completion', 'drag_word_bank']
const READING_MATCHING_GROUP_TYPES = ['matching_information', 'drag_word_bank', 'matching_drag']
const LISTENING_MATCHING_GROUP_TYPES = ['matching', 'map_diagram', 'drag_word_bank', 'matching_drag']

function mapReadingQuestionFields(groupType, q) {
  if (['true_false_ng', 'yes_no_ng'].includes(groupType)) {
    return { type: groupType, questionText: q.questionText || '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  if (NOTE_GROUP_TYPES.includes(groupType)) {
    return { type: 'fill_blank', questionText: '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  if (groupType === 'matching_information') {
    return { type: 'matching_paragraph', questionText: q.questionText || '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  if (groupType === 'matching_drag') {
    return { type: 'matching', questionText: q.questionText || '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  return {
    type: groupType, questionText: q.questionText || '',
    options: q.options ? JSON.stringify(q.options.filter(o => o.trim())) : null,
    correctAnswer: q.correctAnswer || '', imageUrl: null
  }
}

function mapListeningQuestionFields(groupType, q) {
  if (NOTE_GROUP_TYPES.includes(groupType)) {
    return { type: 'fill_blank', questionText: '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  if (['matching', 'map_diagram'].includes(groupType)) {
    return { type: groupType, questionText: q.questionText || '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  if (groupType === 'matching_drag') {
    return { type: 'matching', questionText: q.questionText || '', correctAnswer: q.correctAnswer || '', options: null, imageUrl: null }
  }
  return {
    type: groupType, questionText: q.questionText || '',
    options: q.options ? JSON.stringify(q.options.filter(o => o.trim())) : null,
    correctAnswer: q.correctAnswer || '', imageUrl: null
  }
}

function mapStandaloneQuestionFields(q) {
  return {
    type: q.type, questionText: q.questionText,
    options: q.options ? JSON.stringify(q.options) : null,
    correctAnswer: q.correctAnswer, imageUrl: q.imageUrl || null
  }
}

function buildNoteSectionsRaw(g) {
  return (g.noteSections || []).map((ns, nsi) => ({
    title: ns.title || '', sortOrder: nsi,
    lines: (ns.lines || []).map((l, li) => ({ contentWithTokens: l.content || '', lineType: l.lineType || 'content', sortOrder: li }))
  }))
}

function buildMatchingOptionsRaw(g) {
  return (g.matchingOptions || []).map((mo, moi) => ({ optionLetter: mo.letter, optionText: mo.text || '', sortOrder: moi }))
}

// Diff an existing Question[] (id + number only) against submitted question
// payloads, matched by `number`. Never touches the DB — callers decide what to
// do with each bucket.
function planQuestionDiff(existingQuestions, submittedQuestions, fieldMapper) {
  const existingByNumber = new Map(existingQuestions.map(q => [q.number, q]))
  const submittedNumbers = new Set(submittedQuestions.map(q => q.number))
  const toUpdate = []
  const toCreate = []
  const toPrune = []
  for (const q of submittedQuestions) {
    const ex = existingByNumber.get(q.number)
    const fields = fieldMapper(q)
    if (ex) toUpdate.push({ id: ex.id, data: { number: q.number, ...fields } })
    else toCreate.push({ number: q.number, ...fields })
  }
  for (const ex of existingQuestions) {
    if (!submittedNumbers.has(ex.number)) toPrune.push(ex)
  }
  return { toUpdate, toCreate, toPrune }
}

// Plan the update of an existing QuestionGroup in place: scalar fields +
// note/matching children (always refreshed — safe, nothing points a FK at
// NoteSection/MatchingOption) + its own questions diffed by number. Pushes
// deferred write thunks onto `operations` (executed only after the whole
// request has been confirmed answer-safe — see the blocked-deletion check in
// the route handler) instead of writing immediately, and returns the question
// rows that are candidates for pruning (not yet deleted).
function planGroupUpdate(tx, oldGroup, g, gi, skill, operations) {
  const isReading = skill === 'reading'
  const matchingTypes = isReading ? READING_MATCHING_GROUP_TYPES : LISTENING_MATCHING_GROUP_TYPES
  const mapFn = isReading ? mapReadingQuestionFields : mapListeningQuestionFields

  operations.push(() => tx.questionGroup.update({
    where: { id: oldGroup.id },
    data: {
      qNumberStart: g.qNumberStart, qNumberEnd: g.qNumberEnd,
      instruction: g.instruction || '', type: g.type, imageUrl: g.imageUrl || null,
      sortOrder: gi, maxChoices: g.maxChoices || 2,
      ...(isReading ? { canReuse: g.canReuse || false } : {})
    }
  }))

  operations.push(() => tx.noteSection.deleteMany({ where: { groupId: oldGroup.id } }))
  operations.push(() => tx.matchingOption.deleteMany({ where: { groupId: oldGroup.id } }))

  if (NOTE_GROUP_TYPES.includes(g.type)) {
    for (const ns of buildNoteSectionsRaw(g)) {
      operations.push(() => tx.noteSection.create({ data: { groupId: oldGroup.id, title: ns.title, sortOrder: ns.sortOrder, lines: { create: ns.lines } } }))
    }
  }
  if (matchingTypes.includes(g.type)) {
    const opts = buildMatchingOptionsRaw(g)
    if (opts.length) operations.push(() => tx.matchingOption.createMany({ data: opts.map(o => ({ ...o, groupId: oldGroup.id })) }))
  }

  const plan = planQuestionDiff(oldGroup.questions, g.questions || [], q => mapFn(g.type, q))
  for (const u of plan.toUpdate) operations.push(() => tx.question.update({ where: { id: u.id }, data: u.data }))
  if (plan.toCreate.length) operations.push(() => tx.question.createMany({ data: plan.toCreate.map(q => ({ ...q, groupId: oldGroup.id })) }))
  return plan.toPrune
}

// Nested-create payload for a brand new QuestionGroup (no positional match in
// the existing group list).
function groupCreateData(g, gi, skill) {
  const isReading = skill === 'reading'
  const matchingTypes = isReading ? READING_MATCHING_GROUP_TYPES : LISTENING_MATCHING_GROUP_TYPES
  const mapFn = isReading ? mapReadingQuestionFields : mapListeningQuestionFields
  const data = {
    qNumberStart: g.qNumberStart, qNumberEnd: g.qNumberEnd, instruction: g.instruction || '',
    type: g.type, imageUrl: g.imageUrl || null, sortOrder: gi, maxChoices: g.maxChoices || 2,
    ...(isReading ? { canReuse: g.canReuse || false } : {})
  }
  if (NOTE_GROUP_TYPES.includes(g.type)) {
    data.noteSections = { create: buildNoteSectionsRaw(g).map(ns => ({ title: ns.title, sortOrder: ns.sortOrder, lines: { create: ns.lines } })) }
  }
  if (matchingTypes.includes(g.type)) {
    data.matchingOptions = { create: buildMatchingOptionsRaw(g) }
  }
  data.questions = { create: (g.questions || []).map(q => ({ number: q.number, ...mapFn(g.type, q) })) }
  return data
}

// Batch-check which of the given question ids already have a QuestionAnswer or
// AnswerLog referencing them (i.e. cannot be safely deleted).
async function findAnsweredQuestionIds(tx, questionIds) {
  if (!questionIds.length) return new Set()
  const [qas, logs] = await Promise.all([
    tx.questionAnswer.findMany({ where: { questionId: { in: questionIds } }, select: { questionId: true }, distinct: ['questionId'] }),
    tx.answerLog.findMany({ where: { questionId: { in: questionIds } }, select: { questionId: true }, distinct: ['questionId'] })
  ])
  return new Set([...qas.map(x => x.questionId), ...logs.map(x => x.questionId)])
}

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
      const submittedPassages = req.body.passages || []

      try {
        const updated = await prisma.$transaction(async (tx) => {
          // Everything below is planned first with zero DB writes; writes are
          // deferred into `operations` and only executed once we've confirmed
          // (further down) that nothing answer-blocked needs deleting — so a
          // blocked request leaves the DB completely untouched.
          const operations = [() => tx.exam.update({ where: { id }, data: { title, bookNumber: bn, testNumber: tn } })]

          const oldPassages = await tx.passage.findMany({
            where: { examId: id },
            orderBy: { number: 'asc' },
            include: {
              questions: { where: { groupId: null }, select: { id: true, number: true } },
              questionGroups: { orderBy: { sortOrder: 'asc' }, include: { questions: { select: { id: true, number: true } } } }
            }
          })
          const oldByNumber = new Map(oldPassages.map(p => [p.number, p]))
          const submittedNumbers = new Set(submittedPassages.map(p => p.number))

          const pruneQuestionIds = []
          const pruneLabels = new Map()
          const deleteGroupCandidates = []
          const deletePassageCandidates = []

          for (const p of submittedPassages) {
            const oldP = oldByNumber.get(p.number)
            if (oldP) {
              operations.push(() => tx.passage.update({ where: { id: oldP.id }, data: {
                title: p.title, subtitle: p.subtitle || null,
                letteredParagraphs: p.letteredParagraphs || false, body: p.body
              }}))

              const directPlan = planQuestionDiff(oldP.questions, p.questions || [], mapStandaloneQuestionFields)
              for (const u of directPlan.toUpdate) operations.push(() => tx.question.update({ where: { id: u.id }, data: u.data }))
              if (directPlan.toCreate.length) operations.push(() => tx.question.createMany({ data: directPlan.toCreate.map(q => ({ ...q, passageId: oldP.id })) }))
              directPlan.toPrune.forEach(q => {
                pruneQuestionIds.push(q.id)
                pruneLabels.set(q.id, { passageNumber: p.number, groupSortOrder: null, questionNumber: q.number })
              })

              const submittedGroups = p.questionGroups || []
              const oldGroups = oldP.questionGroups
              for (let gi = 0; gi < submittedGroups.length; gi++) {
                const g = submittedGroups[gi]
                const oldG = oldGroups[gi]
                if (oldG) {
                  const toPrune = planGroupUpdate(tx, oldG, g, gi, 'reading', operations)
                  toPrune.forEach(q => {
                    pruneQuestionIds.push(q.id)
                    pruneLabels.set(q.id, { passageNumber: p.number, groupSortOrder: oldG.sortOrder, questionNumber: q.number })
                  })
                } else {
                  operations.push(() => tx.questionGroup.create({ data: { passageId: oldP.id, ...groupCreateData(g, gi, 'reading') } }))
                }
              }
              for (let gi = submittedGroups.length; gi < oldGroups.length; gi++) {
                const oldG = oldGroups[gi]
                const qIds = oldG.questions.map(q => q.id)
                const labelsByQId = new Map(oldG.questions.map(q => [q.id, { passageNumber: p.number, groupSortOrder: oldG.sortOrder, questionNumber: q.number }]))
                deleteGroupCandidates.push({ groupId: oldG.id, questionIds: qIds, labelsByQId })
              }
            } else {
              operations.push(() => tx.passage.create({ data: {
                examId: id, number: p.number, title: p.title, subtitle: p.subtitle || null,
                letteredParagraphs: p.letteredParagraphs || false, body: p.body,
                questionGroups: (p.questionGroups && p.questionGroups.length)
                  ? { create: p.questionGroups.map((g, gi) => groupCreateData(g, gi, 'reading')) } : undefined,
                questions: (p.questions && p.questions.length)
                  ? { create: p.questions.map(q => ({ number: q.number, ...mapStandaloneQuestionFields(q) })) } : undefined
              }}))
            }
          }

          for (const oldP of oldPassages) {
            if (submittedNumbers.has(oldP.number)) continue
            const qIds = []
            const labelsByQId = new Map()
            oldP.questions.forEach(q => { qIds.push(q.id); labelsByQId.set(q.id, { passageNumber: oldP.number, groupSortOrder: null, questionNumber: q.number }) })
            oldP.questionGroups.forEach(g => g.questions.forEach(q => { qIds.push(q.id); labelsByQId.set(q.id, { passageNumber: oldP.number, groupSortOrder: g.sortOrder, questionNumber: q.number }) }))
            deletePassageCandidates.push({ passageId: oldP.id, questionIds: qIds, labelsByQId })
          }

          const allCandidateIds = [
            ...pruneQuestionIds,
            ...deleteGroupCandidates.flatMap(c => c.questionIds),
            ...deletePassageCandidates.flatMap(c => c.questionIds)
          ]
          const answeredIds = await findAnsweredQuestionIds(tx, allCandidateIds)

          const blockedQuestions = []
          pruneQuestionIds.forEach(qId => { if (answeredIds.has(qId)) blockedQuestions.push(pruneLabels.get(qId)) })
          deleteGroupCandidates.forEach(c => c.questionIds.forEach(qId => { if (answeredIds.has(qId)) blockedQuestions.push(c.labelsByQId.get(qId)) }))
          deletePassageCandidates.forEach(c => c.questionIds.forEach(qId => { if (answeredIds.has(qId)) blockedQuestions.push(c.labelsByQId.get(qId)) }))

          if (blockedQuestions.length) throw new BlockedDeletionError(blockedQuestions)

          for (const op of operations) await op()
          for (const qId of pruneQuestionIds) await tx.question.delete({ where: { id: qId } })
          for (const c of deleteGroupCandidates) await tx.questionGroup.delete({ where: { id: c.groupId } })
          for (const c of deletePassageCandidates) await tx.passage.delete({ where: { id: c.passageId } })

          return tx.exam.findUnique({ where: { id }, include: { passages: { include: { questions: true, questionGroups: true } } } })
        })
        invalidate('fulltests:')
        return res.json(updated)
      } catch (err) {
        if (err instanceof BlockedDeletionError) {
          return res.status(409).json({
            message: 'Không thể lưu: một số câu hỏi đã có học viên làm bài nên không thể xoá. Vui lòng khôi phục lại (các) câu hỏi này trước khi lưu.',
            blockedQuestions: err.blockedQuestions
          })
        }
        throw err
      }
    }

    if (existing.skill === 'listening') {
      const submittedSections = req.body.sections || []

      try {
        const updated = await prisma.$transaction(async (tx) => {
          // Same defer-then-check-then-apply pattern as Reading above.
          const operations = [() => tx.exam.update({ where: { id }, data: { title, bookNumber: bn, testNumber: tn } })]

          const oldSections = await tx.listeningSection.findMany({
            where: { examId: id },
            orderBy: { number: 'asc' },
            include: {
              questions: { where: { groupId: null }, select: { id: true, number: true } },
              questionGroups: { orderBy: { sortOrder: 'asc' }, include: { questions: { select: { id: true, number: true } } } }
            }
          })
          const oldByNumber = new Map(oldSections.map(s => [s.number, s]))
          const submittedNumbers = new Set(submittedSections.map(s => s.number))

          const pruneQuestionIds = []
          const pruneLabels = new Map()
          const deleteGroupCandidates = []
          const deleteSectionCandidates = []

          for (const s of submittedSections) {
            const oldS = oldByNumber.get(s.number)
            if (oldS) {
              operations.push(() => tx.listeningSection.update({ where: { id: oldS.id }, data: {
                context: s.context || '', audioUrl: s.audioUrl || null, transcript: s.transcript || null
              }}))

              const directPlan = planQuestionDiff(oldS.questions, s.questions || [], mapStandaloneQuestionFields)
              for (const u of directPlan.toUpdate) operations.push(() => tx.question.update({ where: { id: u.id }, data: u.data }))
              if (directPlan.toCreate.length) operations.push(() => tx.question.createMany({ data: directPlan.toCreate.map(q => ({ ...q, listeningSectionId: oldS.id })) }))
              directPlan.toPrune.forEach(q => {
                pruneQuestionIds.push(q.id)
                pruneLabels.set(q.id, { sectionNumber: s.number, groupSortOrder: null, questionNumber: q.number })
              })

              const submittedGroups = s.questionGroups || []
              const oldGroups = oldS.questionGroups
              for (let gi = 0; gi < submittedGroups.length; gi++) {
                const g = submittedGroups[gi]
                const oldG = oldGroups[gi]
                if (oldG) {
                  const toPrune = planGroupUpdate(tx, oldG, g, gi, 'listening', operations)
                  toPrune.forEach(q => {
                    pruneQuestionIds.push(q.id)
                    pruneLabels.set(q.id, { sectionNumber: s.number, groupSortOrder: oldG.sortOrder, questionNumber: q.number })
                  })
                } else {
                  operations.push(() => tx.questionGroup.create({ data: { sectionId: oldS.id, ...groupCreateData(g, gi, 'listening') } }))
                }
              }
              for (let gi = submittedGroups.length; gi < oldGroups.length; gi++) {
                const oldG = oldGroups[gi]
                const qIds = oldG.questions.map(q => q.id)
                const labelsByQId = new Map(oldG.questions.map(q => [q.id, { sectionNumber: s.number, groupSortOrder: oldG.sortOrder, questionNumber: q.number }]))
                deleteGroupCandidates.push({ groupId: oldG.id, questionIds: qIds, labelsByQId })
              }
            } else {
              operations.push(() => tx.listeningSection.create({ data: {
                examId: id, number: s.number, context: s.context || '', audioUrl: s.audioUrl || null, transcript: s.transcript || null,
                questionGroups: (s.questionGroups && s.questionGroups.length)
                  ? { create: s.questionGroups.map((g, gi) => groupCreateData(g, gi, 'listening')) } : undefined,
                questions: (s.questions && s.questions.length)
                  ? { create: s.questions.map(q => ({ number: q.number, ...mapStandaloneQuestionFields(q) })) } : undefined
              }}))
            }
          }

          for (const oldS of oldSections) {
            if (submittedNumbers.has(oldS.number)) continue
            const qIds = []
            const labelsByQId = new Map()
            oldS.questions.forEach(q => { qIds.push(q.id); labelsByQId.set(q.id, { sectionNumber: oldS.number, groupSortOrder: null, questionNumber: q.number }) })
            oldS.questionGroups.forEach(g => g.questions.forEach(q => { qIds.push(q.id); labelsByQId.set(q.id, { sectionNumber: oldS.number, groupSortOrder: g.sortOrder, questionNumber: q.number }) }))
            deleteSectionCandidates.push({ sectionId: oldS.id, questionIds: qIds, labelsByQId })
          }

          const allCandidateIds = [
            ...pruneQuestionIds,
            ...deleteGroupCandidates.flatMap(c => c.questionIds),
            ...deleteSectionCandidates.flatMap(c => c.questionIds)
          ]
          const answeredIds = await findAnsweredQuestionIds(tx, allCandidateIds)

          const blockedQuestions = []
          pruneQuestionIds.forEach(qId => { if (answeredIds.has(qId)) blockedQuestions.push(pruneLabels.get(qId)) })
          deleteGroupCandidates.forEach(c => c.questionIds.forEach(qId => { if (answeredIds.has(qId)) blockedQuestions.push(c.labelsByQId.get(qId)) }))
          deleteSectionCandidates.forEach(c => c.questionIds.forEach(qId => { if (answeredIds.has(qId)) blockedQuestions.push(c.labelsByQId.get(qId)) }))

          if (blockedQuestions.length) throw new BlockedDeletionError(blockedQuestions)

          for (const op of operations) await op()
          for (const qId of pruneQuestionIds) await tx.question.delete({ where: { id: qId } })
          for (const c of deleteGroupCandidates) await tx.questionGroup.delete({ where: { id: c.groupId } })
          for (const c of deleteSectionCandidates) await tx.listeningSection.delete({ where: { id: c.sectionId } })

          return tx.exam.findUnique({ where: { id }, include: { listeningSections: { include: { questions: true, questionGroups: true } } } })
        })
        invalidate('fulltests:')
        return res.json(updated)
      } catch (err) {
        if (err instanceof BlockedDeletionError) {
          return res.status(409).json({
            message: 'Không thể lưu: một số câu hỏi đã có học viên làm bài nên không thể xoá. Vui lòng khôi phục lại (các) câu hỏi này trước khi lưu.',
            blockedQuestions: err.blockedQuestions
          })
        }
        throw err
      }
    }

    if (existing.skill === 'writing') {
      const { task1, task2 } = req.body

      // WritingTask numbers are always exactly 1 and 2 — task1/task2 are fixed
      // slots in the form (never a deletable array), so unlike Reading/Listening
      // there is no delete scenario here at all. Reuse the existing rows (same
      // pattern as SpeakingPart) instead of delete-and-recreate, so WritingAnswer
      // rows (which point at taskId) keep a valid reference.
      const existingTasks = await prisma.writingTask.findMany({ where: { examId: id }, select: { id: true, number: true } })
      const taskIdByNumber = new Map(existingTasks.map(t => [t.number, t.id]))
      const specs = [
        { number: 1, prompt: task1.prompt, imageUrl: task1.imageUrl || null, minWords: 150 },
        { number: 2, prompt: task2.prompt, imageUrl: null, minWords: 250 }
      ]

      const updated = await prisma.$transaction(async (tx) => {
        await tx.exam.update({ where: { id }, data: { title, bookNumber: bn, testNumber: tn } })
        for (const spec of specs) {
          const existingId = taskIdByNumber.get(spec.number)
          if (existingId) {
            await tx.writingTask.update({ where: { id: existingId }, data: { prompt: spec.prompt, imageUrl: spec.imageUrl, minWords: spec.minWords } })
          } else {
            await tx.writingTask.create({ data: { examId: id, ...spec } })
          }
        }
        return tx.exam.findUnique({ where: { id }, include: { writingTasks: true } })
      })
      invalidate('fulltests:')
      return res.json(updated)
    }

    if (existing.skill === 'speaking') {
      const { part1, part2, part3 } = req.body
      const srcByNumber = { 1: part1, 2: part2, 3: part3 }

      // Speaking has NO Attempt row — SpeakingAnswer (transcript + AI scores of past
      // attempts) IS the student's record, and its partId FK is required with no
      // cascade. So reuse the existing SpeakingPart rows (always Part 1/2/3) instead
      // of deleting them: update cueCard, replace only the SpeakingQuestion rows
      // (which carry no incoming FK). SpeakingAnswer rows keep their partId link and
      // are fully preserved — no data loss, not even orphaned.
      const existingParts = await prisma.speakingPart.findMany({
        where: { examId: id }, select: { id: true, number: true }
      })
      const partIdByNumber = new Map(existingParts.map(p => [p.number, p.id]))

      await prisma.$transaction(async (tx) => {
        await tx.exam.update({ where: { id }, data: { title, bookNumber: bn, testNumber: tn } })

        for (const number of [1, 2, 3]) {
          const src = srcByNumber[number] || {}
          const cueCard = src.cueCard || null
          const questions = (src.questions || [])
            .filter(q => q.trim())
            .map((q, i) => ({ orderNum: i + 1, questionText: q }))

          const partId = partIdByNumber.get(number)
          if (partId) {
            await tx.speakingPart.update({ where: { id: partId }, data: { cueCard } })
            await tx.speakingQuestion.deleteMany({ where: { partId } })
            if (questions.length) {
              await tx.speakingQuestion.createMany({ data: questions.map(q => ({ ...q, partId })) })
            }
          } else {
            await tx.speakingPart.create({
              data: { examId: id, number, cueCard, questions: { create: questions } }
            })
          }
        }
      })

      const updated = await prisma.exam.findUnique({
        where: { id },
        include: {
          speakingParts: {
            orderBy: { number: 'asc' },
            include: { questions: { orderBy: { orderNum: 'asc' } } }
          }
        }
      })
      invalidate('fulltests:')
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
    invalidate('fulltests:')
    res.json({ message: 'Xóa đề thành công' })
  } catch (error) {
    console.error('[Delete exam]', error)
    res.status(500).json({ message: 'Lỗi xóa đề', error: error.message })
  }
})

module.exports = router
