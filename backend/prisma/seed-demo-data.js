// seed-demo-data.js
// Run:     node prisma/seed-demo-data.js
// Cleanup: node prisma/seed-demo-data.js --cleanup

const { PrismaClient } = require('../node_modules/.prisma/client/default')
require('dotenv').config()

const DB_URL = process.env.DATABASE_URL || ''
console.log('\n=== SEED DEMO DATA ===')
console.log('DB:', DB_URL.replace(/:([^:@]+)@/, ':***@'))
if (!DB_URL.includes('qtuzysaqftzmveyvrzxz')) {
  console.error('ERROR: Not pointing to main DB. Aborting.')
  process.exit(1)
}
console.log('Confirmed: main database ✓\n')

const prisma = new PrismaClient({ log: ['error'] })

// Bell-curve IELTS score pool (0.5 steps, peak at 5.5–6.5)
const SCORE_POOL = [
  ...Array(2).fill(3.0), ...Array(3).fill(3.5),
  ...Array(6).fill(4.0), ...Array(9).fill(4.5),
  ...Array(14).fill(5.0), ...Array(16).fill(5.5),
  ...Array(18).fill(6.0), ...Array(16).fill(6.5),
  ...Array(12).fill(7.0), ...Array(8).fill(7.5),
  ...Array(4).fill(8.0), ...Array(2).fill(8.5), ...Array(1).fill(9.0),
]

const bellScore = () => SCORE_POOL[Math.floor(Math.random() * SCORE_POOL.length)]
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function randomDate(maxBack = 90) {
  const n = Math.floor(Math.pow(Math.random(), 0.7) * maxBack)
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function criterionScores(overall, keys) {
  const result = {}
  keys.forEach((k) => {
    let s = Math.round((overall + (Math.random() - 0.5) * 1.5) * 2) / 2
    result[k] = Math.max(1.0, Math.min(9.0, s))
  })
  return result
}

const WC = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range']
const SC = ['fluency', 'vocabulary', 'grammar', 'pronunciation']

async function withRetry(fn, tries = 4, delay = 2000) {
  for (let i = 0; i < tries; i++) {
    try { return await fn() }
    catch (e) {
      if (i === tries - 1) throw e
      process.stdout.write(' [retry' + (i + 1) + ']')
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log('Deleting seeded data...')
  const a = await prisma.$executeRaw`DELETE FROM "Attempt" WHERE "isSeeded" = true`
  const w = await prisma.$executeRaw`DELETE FROM "WritingAnswer" WHERE "essayText" LIKE '%[SEED-DEMO]%'`
  const s = await prisma.$executeRaw`DELETE FROM "SpeakingAnswer" WHERE transcript LIKE '%[SEED-DEMO]%'`
  console.log('Deleted → attempts:', a, '| writingAnswers:', w, '| speakingAnswers:', s)
}

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  // Load users
  const users = await withRetry(() =>
    prisma.$queryRaw`SELECT id FROM "User" ORDER BY id ASC LIMIT 600`
  )
  const userIds = users.map((u) => Number(u.id))
  console.log('Users loaded:', userIds.length)

  // Load exams
  const exams = await withRetry(() =>
    prisma.$queryRaw`SELECT id, skill FROM "Exam" WHERE "deletedAt" IS NULL`
  )
  const ebs = { reading: [], listening: [], writing: [], speaking: [] }
  exams.forEach((e) => { if (ebs[e.skill]) ebs[e.skill].push(Number(e.id)) })
  Object.entries(ebs).forEach(([s, ids]) => console.log(' ' + s + ':', ids.length, 'exams →', ids.join(',')))

  const wts = await withRetry(() =>
    prisma.$queryRaw`SELECT id, "examId" FROM "WritingTask"`
  )
  const sps = await withRetry(() =>
    prisma.$queryRaw`SELECT id, "examId" FROM "SpeakingPart"`
  )
  console.log('WritingTasks:', wts.length, '| SpeakingParts:', sps.length)

  const plan = [
    { skill: 'reading', n: 55 },
    { skill: 'listening', n: 50 },
    { skill: 'writing', n: 50 },
    { skill: 'speaking', n: 45 },
  ]

  let totalCreated = 0
  const affectedUsers = new Set()

  for (const { skill, n } of plan) {
    console.log('\nCreating ' + n + ' ' + skill + ' attempts...')
    let done = 0

    for (let i = 0; i < n; i++) {
      const uid = pick(userIds)
      const eid = pick(ebs[skill])
      const score = bellScore()
      const ca = randomDate(90)
      const fa = new Date(ca.getTime() + (Math.floor(Math.random() * 60) + 15) * 60000)

      try {
        // Raw INSERT to include isSeeded column (not in generated Prisma client yet)
        const ar = await withRetry(() =>
          prisma.$queryRaw`
            INSERT INTO "Attempt" ("userId","examId",score,"finishedAt","createdAt","isSeeded")
            VALUES (${uid},${eid},${score},${fa},${ca},true)
            RETURNING id
          `
        )
        affectedUsers.add(uid)
        done++
        totalCreated++

        if (skill === 'writing') {
          const pool = wts.filter((t) => Number(t.examId) === eid)
          const t = pick(pool.length ? pool : wts)
          const tid = Number(t.id)
          const wc = Math.floor(score * 30 + 150)
          const essay = '[SEED-DEMO] Demo essay for dashboard testing purposes.'
          const wr = await withRetry(() =>
            prisma.$queryRaw`
              INSERT INTO "WritingAnswer" ("userId","taskId","essayText","wordCount","aiScore",status,"createdAt")
              VALUES (${uid},${tid},${essay},${wc},${score},'graded',${ca})
              RETURNING id
            `
          )
          const wid = Number(wr[0].id)
          for (const [crit, cs] of Object.entries(criterionScores(score, WC))) {
            await withRetry(() =>
              prisma.$queryRaw`
                INSERT INTO "WritingCriterionLog" ("userId","writingAnswerId",criterion,score,"createdAt")
                VALUES (${uid},${wid},${crit},${cs},${ca})
              `
            )
          }
        }

        if (skill === 'speaking') {
          const pool = sps.filter((p) => Number(p.examId) === eid)
          const pt = pick(pool.length ? pool : sps)
          const pid = Number(pt.id)
          const tr = '[SEED-DEMO] Demo transcript for dashboard testing purposes.'
          const sr = await withRetry(() =>
            prisma.$queryRaw`
              INSERT INTO "SpeakingAnswer" ("userId","partId",transcript,"aiScore",status,"createdAt")
              VALUES (${uid},${pid},${tr},${score},'graded',${ca})
              RETURNING id
            `
          )
          const sid = Number(sr[0].id)
          for (const [crit, cs] of Object.entries(criterionScores(score, SC))) {
            await withRetry(() =>
              prisma.$queryRaw`
                INSERT INTO "SpeakingCriterionLog" ("userId","speakingAnswerId",criterion,score,"createdAt")
                VALUES (${uid},${sid},${crit},${cs},${ca})
              `
            )
          }
        }

        process.stdout.write('\r  ' + skill + ': ' + done + '/' + n)
      } catch (e) {
        process.stdout.write('\n  skip ' + i + ': ' + e.message.slice(0, 70) + '\n')
      }
    }
    console.log('\n  done: ' + done + '/' + n)
  }

  // Verification
  console.log('\n=== RESULTS ===')
  const cts = await withRetry(() =>
    prisma.$queryRaw`
      SELECT e.skill, COUNT(a.id)::int as n, ROUND(AVG(a.score)::numeric,2) as avg
      FROM "Attempt" a JOIN "Exam" e ON a."examId"=e.id
      WHERE a."isSeeded"=true GROUP BY e.skill ORDER BY e.skill
    `
  )
  cts.forEach((r) => console.log(' ' + r.skill + ': ' + r.n + ' attempts | avg band: ' + r.avg))

  const bd = await withRetry(() =>
    prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN score < 4 THEN 1 END)::int            AS l4,
        COUNT(CASE WHEN score >= 4 AND score < 5 THEN 1 END)::int AS f45,
        COUNT(CASE WHEN score >= 5 AND score < 6 THEN 1 END)::int AS f56,
        COUNT(CASE WHEN score >= 6 AND score < 7 THEN 1 END)::int AS f67,
        COUNT(CASE WHEN score >= 7 AND score < 8 THEN 1 END)::int AS f78,
        COUNT(CASE WHEN score >= 8 THEN 1 END)::int           AS f8p
      FROM "Attempt" WHERE "isSeeded"=true AND score IS NOT NULL
    `
  )
  const b = bd[0]
  console.log(
    '\n  Band dist: <4=' + b.l4 +
    ' | 4-5=' + b.f45 +
    ' | 5-6=' + b.f56 +
    ' | 6-7=' + b.f67 +
    ' | 7-8=' + b.f78 +
    ' | 8+=' + b.f8p
  )

  console.log('\nTotal created:', totalCreated, '| Users affected:', affectedUsers.size)
}

// ── Entry ─────────────────────────────────────────────────────────────────────
;(process.argv.includes('--cleanup') ? cleanup : seed)()
  .catch((e) => { console.error('\nFatal:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
