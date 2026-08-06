/**
 * One-time script: recalculate all Reading & Listening attempt scores
 * using the correct IELTS band conversion tables.
 *
 * Run from the backend directory:
 *   node recalculate-scores.js
 */

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function getListeningBand(correct) {
  if (correct >= 39) return 9.0
  if (correct >= 37) return 8.5
  if (correct >= 35) return 8.0
  if (correct >= 32) return 7.5
  if (correct >= 30) return 7.0
  if (correct >= 26) return 6.5
  if (correct >= 23) return 6.0
  if (correct >= 18) return 5.5
  if (correct >= 16) return 5.0
  if (correct >= 13) return 4.5
  if (correct >= 10) return 4.0
  if (correct >= 8)  return 3.5
  if (correct >= 6)  return 3.0
  if (correct >= 4)  return 2.5
  return 0
}

function getReadingBand(correct) {
  if (correct >= 39) return 9.0
  if (correct >= 37) return 8.5
  if (correct >= 35) return 8.0
  if (correct >= 33) return 7.5
  if (correct >= 30) return 7.0
  if (correct >= 27) return 6.5
  if (correct >= 23) return 6.0
  if (correct >= 19) return 5.5
  if (correct >= 15) return 5.0
  if (correct >= 13) return 4.5
  if (correct >= 10) return 4.0
  if (correct >= 8)  return 3.5
  if (correct >= 6)  return 3.0
  if (correct >= 4)  return 2.5
  return 0
}

async function recalculate() {
  const attempts = await prisma.attempt.findMany({
    where: { exam: { skill: { in: ['reading', 'listening'] } } },
    include: {
      exam: {
        select: {
          skill: true,
          passages: {
            include: {
              questions: { where: { groupId: null } },
              questionGroups: { include: { questions: true } }
            }
          },
          listeningSections: {
            include: {
              questions: { where: { groupId: null } },
              questionGroups: { include: { questions: true } }
            }
          }
        }
      }
    }
  })

  console.log(`Found ${attempts.length} attempt(s) to process.\n`)

  let updated = 0
  let skipped = 0

  for (const attempt of attempts) {
    if (!attempt.answers) { skipped++; continue }

    let answers
    try { answers = JSON.parse(attempt.answers) } catch { skipped++; continue }

    const skill = attempt.exam.skill
    const containers = skill === 'reading'
      ? attempt.exam.passages
      : attempt.exam.listeningSections

    let correct = 0

    for (const container of containers) {
      // Flat questions (not in a group)
      for (const q of container.questions) {
        const userAnswer = (answers[q.id] || '').trim().toLowerCase()
        const accepted = q.correctAnswer.split('/').map(a => a.trim().toLowerCase())
        if (accepted.includes(userAnswer)) correct++
      }
      // Group questions
      for (const g of container.questionGroups) {
        const maxC = g.maxChoices || 2
        const activeQs = g.type === 'mcq_multi'
          ? g.questions
          : g.questions.filter(q => q.number >= g.qNumberStart && q.number <= g.qNumberEnd)
        for (const q of activeQs) {
          const userAnswer = (answers[q.id] || '').trim().toLowerCase()
          const accepted = q.correctAnswer.split('/').map(a => a.trim().toLowerCase())
          if (accepted.includes(userAnswer)) correct += (g.type === 'mcq_multi' ? maxC : 1)
        }
      }
    }

    const newBand = skill === 'listening' ? getListeningBand(correct) : getReadingBand(correct)
    const oldBand = attempt.score

    if (newBand !== oldBand) {
      await prisma.attempt.update({ where: { id: attempt.id }, data: { score: newBand } })
      console.log(`[UPDATED] Attempt #${attempt.id} (${skill}): ${oldBand} → ${newBand}  (correct: ${correct})`)
      updated++
    } else {
      console.log(`[OK]      Attempt #${attempt.id} (${skill}): ${oldBand} (correct: ${correct})`)
    }
  }

  console.log(`\n=== Done ===`)
  console.log(`Updated : ${updated}`)
  console.log(`Skipped : ${skipped}`)
  console.log(`Unchanged: ${attempts.length - updated - skipped}`)
  await prisma.$disconnect()
}

recalculate().catch(e => { console.error(e); process.exit(1) })
