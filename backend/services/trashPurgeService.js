const prisma = require('../lib/prisma')

const RETENTION_DAYS = 30
const MODELS = {
  practiceExam: { id: true, title: true, skill: true, deletedAt: true },
  writingSample: { id: true, title: true, deletedAt: true },
  speakingSample: { id: true, title: true, deletedAt: true },
  exam: { id: true, title: true, skill: true, seriesId: true, bookNumber: true, deletedAt: true },
  examSeries: { id: true, name: true, deletedAt: true },
  bookCover: { id: true, seriesId: true, bookNumber: true, deletedAt: true, series: { select: { name: true } } },
}
const TYPES = {
  reading_practice: { model: 'practiceExam', entityType: 'PracticeExam', skill: 'reading' },
  listening_practice: { model: 'practiceExam', entityType: 'PracticeExam', skill: 'listening' },
  writing_sample: { model: 'writingSample', entityType: 'WritingSample' },
  speaking_sample: { model: 'speakingSample', entityType: 'SpeakingSample' },
  exam_reading: { model: 'exam', entityType: 'Exam', skill: 'reading' },
  exam_listening: { model: 'exam', entityType: 'Exam', skill: 'listening' },
  exam_writing: { model: 'exam', entityType: 'Exam', skill: 'writing' },
  exam_speaking: { model: 'exam', entityType: 'Exam', skill: 'speaking' },
  exam_series: { model: 'examSeries', entityType: 'ExamSeries' },
  book: { model: 'bookCover', entityType: 'BookCover' },
}

class TrashPurgeError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'TrashPurgeError'
    this.status = status
    this.code = code
  }
}

function isEligible(row, cutoff) {
  return row.deletedAt != null && (!cutoff || new Date(row.deletedAt) < cutoff)
}

function mergeRows(target, rows) {
  for (const row of rows) target.set(row.id, row)
}

function requireEligibleChildren(rows, cutoff) {
  const active = rows.filter(row => row.deletedAt == null).length
  if (active) {
    throw new TrashPurgeError(409, 'TRASH_HAS_ACTIVE_CHILDREN', `Mục này còn ${active} mục con đang hoạt động. Vui lòng xử lý các mục con trước khi xóa vĩnh viễn.`)
  }
  if (cutoff && rows.some(row => !isEligible(row, cutoff))) {
    throw new TrashPurgeError(409, 'TRASH_CHILD_RETENTION_PENDING', 'Mục này còn mục con chưa hết thời hạn 30 ngày trong thùng rác. Chưa thể dọn các mục quá hạn cùng nhau.')
  }
}

// Use the caller's transaction for both lookups and deletes. Exam children with
// Restrict FKs must be removed before the database cascades the exam graph.
async function deleteExamGraph(tx, ids) {
  if (!ids.length) return 0
  const [tasks, parts, questions] = await Promise.all([
    tx.writingTask.findMany({ where: { examId: { in: ids } }, select: { id: true } }),
    tx.speakingPart.findMany({ where: { examId: { in: ids } }, select: { id: true } }),
    tx.question.findMany({
      where: { OR: [{ passage: { examId: { in: ids } } }, { listeningSection: { examId: { in: ids } } }] },
      select: { id: true },
    }),
  ])
  if (questions.length) await tx.answerLog.deleteMany({ where: { questionId: { in: questions.map(row => row.id) } } })
  await tx.attempt.deleteMany({ where: { examId: { in: ids } } })
  if (tasks.length) await tx.writingAnswer.deleteMany({ where: { taskId: { in: tasks.map(row => row.id) } } })
  if (parts.length) await tx.speakingAnswer.deleteMany({ where: { partId: { in: parts.map(row => row.id) } } })
  const deleted = await tx.exam.deleteMany({ where: { id: { in: ids } } })
  return deleted.count
}

async function purgeTrash({ type, id, expiredOnly = false, now = new Date() } = {}) {
  const target = type ? TYPES[type] : null
  if (type && !target) throw new TrashPurgeError(400, 'INVALID_TRASH_TYPE', 'Loại không hợp lệ')
  if (type && (!Number.isSafeInteger(id) || id <= 0)) throw new TrashPurgeError(400, 'INVALID_TRASH_ID', 'ID không hợp lệ')
  const cutoff = expiredOnly ? new Date(now.getTime() - RETENTION_DAYS * 86400000) : null

  try {
    return await prisma.$transaction(async tx => {
      const selected = Object.fromEntries(Object.keys(MODELS).map(model => [model, new Map()]))
      let entityLabel = null
      if (target) {
        const row = await tx[target.model].findUnique({ where: { id }, select: MODELS[target.model] })
        if (!row || (target.skill && row.skill !== target.skill)) {
          throw new TrashPurgeError(404, 'TRASH_ITEM_NOT_FOUND', 'Không tìm thấy mục trong thùng rác')
        }
        if (!isEligible(row, cutoff)) {
          throw new TrashPurgeError(409, 'TRASH_ITEM_NOT_DELETED', 'Mục này chưa được chuyển vào thùng rác, không thể xóa vĩnh viễn.')
        }
        selected[target.model].set(row.id, row)
        entityLabel = row.title || row.name || `Cuốn ${row.bookNumber} — ${row.series?.name || 'Bộ đề'}`
      } else {
        const where = { deletedAt: cutoff ? { not: null, lt: cutoff } : { not: null } }
        await Promise.all(Object.entries(MODELS).map(async ([model, select]) => {
          mergeRows(selected[model], await tx[model].findMany({ where, select }))
        }))
      }

      // A series delete must never cascade-drop a live book or orphan a live
      // exam. Retention also cannot remove newer trashed descendants early.
      const seriesIds = [...selected.examSeries.keys()]
      if (seriesIds.length) {
        const where = { seriesId: { in: seriesIds } }
        const [books, exams] = await Promise.all([
          tx.bookCover.findMany({ where, select: MODELS.bookCover }),
          tx.exam.findMany({ where, select: MODELS.exam }),
        ])
        requireEligibleChildren([...books, ...exams], cutoff)
        mergeRows(selected.bookCover, books)
        mergeRows(selected.exam, exams)
      }

      const books = [...selected.bookCover.values()]
      if (books.length) {
        const exams = await tx.exam.findMany({
          where: { OR: books.map(book => ({ seriesId: book.seriesId, bookNumber: book.bookNumber })) },
          select: MODELS.exam,
        })
        requireEligibleChildren(exams, cutoff)
        mergeRows(selected.exam, exams)
      }

      // No writes have occurred before every selected parent/child is checked.
      const counts = Object.fromEntries(Object.keys(MODELS).map(model => [model, 0]))
      counts.exam = await deleteExamGraph(tx, [...selected.exam.keys()])
      for (const model of ['practiceExam', 'writingSample', 'speakingSample', 'bookCover', 'examSeries']) {
        const ids = [...selected[model].keys()]
        if (ids.length) counts[model] = (await tx[model].deleteMany({ where: { id: { in: ids } } })).count
      }
      return { counts, entityType: target?.entityType || 'Trash', entityId: target ? id : null, entityLabel, cutoff }
    }, { isolationLevel: 'Serializable', timeout: 15000 })
  } catch (error) {
    if (error.code === 'P2034') {
      throw new TrashPurgeError(409, 'TRASH_PURGE_CONFLICT', 'Dữ liệu thùng rác vừa thay đổi. Vui lòng tải lại và thử lại.')
    }
    throw error
  }
}

module.exports = { purgeTrash, TrashPurgeError, RETENTION_DAYS }
