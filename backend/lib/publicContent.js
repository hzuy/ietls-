// ─── PUBLIC CONTENT (trang chủ) — fetcher + SWR cache dùng chung ──────────────
// Gom logic query của các danh sách công khai (practice list, sample list,
// full-tests) về 1 chỗ để:
//   - routes/practice.js, routes/samples.js, routes/admin/examSeries.js  dùng
//     cho endpoint lẻ (giữ tương thích).
//   - routes/home.js  gộp tất cả vào 1 request GET /api/home.
// Tất cả đi qua cùng cache key nên endpoint lẻ và /api/home chia sẻ 1 entry.
//
// Invalidate: các route admin create/update/delete gọi invalidate('practice:'),
// invalidate('samples:'), invalidate('fulltests:') (xem swrCache.js).

const prisma = require('./prisma')
const { getOrRevalidate } = require('./swrCache')

const PUBLIC_LIST_TTL = 120 * 1000 // 2 phút

// ─── Practice list ───────────────────────────────────────────────────────────
function getQuestionCount(exam) {
  if (exam.questions?.length > 0) {
    return exam.questions.reduce((s, pq) => {
      try {
        const group = JSON.parse(pq.content)
        return s + (group.qNumberEnd - group.qNumberStart + 1)
      } catch { return s }
    }, 0)
  }
  return 0
}

async function listPracticeExams(skill, limit) {
  const rows = await prisma.practiceExam.findMany({
    where: { skill, deletedAt: null },
    ...(limit > 0 ? { take: limit } : {}),
    orderBy: { createdAt: 'desc' },
    include: { questions: { select: { content: true } } }
  })
  return rows.map(r => ({
    ...r,
    questionCount: getQuestionCount(r),
    questions: undefined
  }))
}

function getPracticeListCached(skill, limit) {
  return getOrRevalidate(
    `practice:${skill}:${limit}`,
    () => listPracticeExams(skill, limit),
    PUBLIC_LIST_TTL
  )
}

// ─── Sample list ─────────────────────────────────────────────────────────────
async function listSamples(skill, limit) {
  const model = skill === 'writing' ? prisma.writingSample : prisma.speakingSample
  const rows = await model.findMany({
    where: { deletedAt: null },
    ...(limit > 0 ? { take: limit } : {}),
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, level: true, examType: true, thumbnailUrl: true, tags: true, createdAt: true }
  })
  return rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }))
}

function getSampleListCached(skill, limit) {
  return getOrRevalidate(
    `samples:${skill}:${limit}`,
    () => listSamples(skill, limit),
    PUBLIC_LIST_TTL
  )
}

// ─── Full-tests (grouped by seriesId + bookNumber + testNumber) ───────────────
async function buildFullTests() {
  const [exams, covers, series] = await Promise.all([
    prisma.exam.findMany({
      where: { bookNumber: { not: null }, testNumber: { not: null }, deletedAt: null },
      select: { id: true, title: true, skill: true, bookNumber: true, testNumber: true, seriesId: true },
      orderBy: [{ seriesId: 'asc' }, { bookNumber: 'asc' }, { testNumber: 'asc' }, { skill: 'asc' }]
    }),
    prisma.bookCover.findMany({ where: { deletedAt: null } }),
    prisma.examSeries.findMany({ where: { deletedAt: null } })
  ])

  const seriesMap = {}
  for (const s of series) seriesMap[s.id] = s.name

  const coverMap = {}
  for (const c of covers) {
    // Key cover by seriesId and bookNumber to avoid collisions
    coverMap[`${c.seriesId}-${c.bookNumber}`] = c.coverImageUrl
  }

  const grouped = {}
  for (const e of exams) {
    // Key by seriesId, bookNumber, and testNumber for unique identification
    const key = `${e.seriesId}-${e.bookNumber}-${e.testNumber}`
    if (!grouped[key]) {
      grouped[key] = {
        seriesId: e.seriesId,
        seriesName: seriesMap[e.seriesId] || 'IELTS',
        bookNumber: e.bookNumber,
        testNumber: e.testNumber,
        exams: {},
        coverImageUrl: coverMap[`${e.seriesId}-${e.bookNumber}`] || null
      }
    }
    grouped[key].exams[e.skill] = { id: e.id, title: e.title }
  }
  return Object.values(grouped)
}

function getFullTestsCached() {
  return getOrRevalidate('fulltests:home', buildFullTests, PUBLIC_LIST_TTL)
}

module.exports = {
  PUBLIC_LIST_TTL,
  getQuestionCount,
  listPracticeExams,
  getPracticeListCached,
  listSamples,
  getSampleListCached,
  buildFullTests,
  getFullTestsCached,
}
