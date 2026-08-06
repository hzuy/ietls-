const prisma = require('./prisma')

// ─── AUTO SYNC SeriesExam ─────────────────────────────────────────────────────
// When saving an exam with examSeriesId + testNumber, auto-link it to any Full Test
// Series that already contains sibling exams (same ExamSeries + testNumber).
async function syncSeriesExam(examId, examSeriesId, testNumber) {
  if (!examSeriesId || !testNumber) return
  const tn = parseInt(testNumber)
  const sid = parseInt(examSeriesId)

  // 1. Find the ExamSeries name to match with Series name
  const examSeries = await prisma.examSeries.findUnique({ where: { id: sid } })
  if (!examSeries) return

  // 2. Find any Series that matches this ExamSeries name (e.g., "Cambridge 19")
  const matchingSeries = await prisma.series.findMany({
    where: { name: { contains: examSeries.name, mode: 'insensitive' }, deletedAt: null }
  })

  const seriesIds = new Set(matchingSeries.map(s => s.id))

  // 3. Also check existing siblings for historical reasons (fallback)
  const siblings = await prisma.exam.findMany({
    where: { seriesId: sid, testNumber: tn, id: { not: examId } },
    select: { id: true }
  })

  if (siblings.length > 0) {
    const linked = await prisma.seriesExam.findMany({
      where: { examId: { in: siblings.map(s => s.id) } },
      select: { seriesId: true }
    })
    linked.forEach(l => seriesIds.add(l.seriesId))
  }

  if (!seriesIds.size) return

  // 4. Link to all found series — batch check + createMany to avoid N+1
  const existing = await prisma.seriesExam.findMany({
    where: { examId, seriesId: { in: Array.from(seriesIds) } },
    select: { seriesId: true },
  })
  const existingSet = new Set(existing.map(e => e.seriesId))
  const toCreate = Array.from(seriesIds)
    .filter(id => !existingSet.has(id))
    .map(id => ({ seriesId: id, examId, testNumber: tn }))
  if (toCreate.length > 0) {
    await prisma.seriesExam.createMany({ data: toCreate })
  }
}

module.exports = { syncSeriesExam }
