'use strict'

const { roundBand, ieltsOverall } = require('./scoreUtils')
const { speakingAttempts, writingAttempts } = require('./attemptGroups')

const RECENT_COUNT = 3
const SKILLS = ['reading', 'listening', 'writing', 'speaking']

function objectiveBand(attempt) {
  if (attempt.score == null || !attempt.finishedAt) return null
  if (attempt.correctCount === 0) return null
  if (attempt.correctCount == null && !(attempt.score > 0)) return null
  return attempt.score
}

function groupBand(group) {
  const scores = Object.values(group.items)
    .filter(a => a.status === 'graded' && typeof a.aiScore === 'number' && a.aiScore > 0)
    .map(a => a.aiScore)
  if (!scores.length) return null
  return scores.reduce((s, v) => s + v, 0) / scores.length
}

function groupByExam(answers, examIdOf) {
  const byExam = {}
  for (const a of answers || []) {
    const examId = examIdOf(a)
    if (examId != null) (byExam[examId] ||= []).push(a)
  }
  return Object.values(byExam)
}

function collectSubmissions({ attempts = [], writingAnswers = [], speakingAnswers = [] }) {
  const out = []
  for (const a of attempts) {
    if (!a.finishedAt) continue
    out.push({ skill: a.exam?.skill ?? null, finishedAt: new Date(a.finishedAt), band: objectiveBand(a) })
  }
  for (const list of groupByExam(writingAnswers, a => a.task?.examId)) {
    for (const g of writingAttempts(list)) {
      out.push({ skill: 'writing', finishedAt: new Date(g.finishedAt), band: groupBand(g) })
    }
  }
  const speaking = (speakingAnswers || []).map(a => ({ ...a, partNumber: a.part?.number }))
  for (const list of groupByExam(speaking, a => a.part?.examId)) {
    for (const g of speakingAttempts(list)) {
      out.push({ skill: 'speaking', finishedAt: new Date(g.finishedAt), band: groupBand(g) })
    }
  }
  return out.sort((a, b) => b.finishedAt - a.finishedAt)
}

function currentBands(submissions, recentCount = RECENT_COUNT) {
  const bandBySkill = {}
  const sampleBySkill = {}
  for (const skill of SKILLS) {
    const recent = submissions.filter(s => s.skill === skill && s.band != null).slice(0, recentCount)
    sampleBySkill[skill] = recent.length
    bandBySkill[skill] = recent.length ? roundBand(recent.reduce((s, v) => s + v.band, 0) / recent.length) : null
  }
  const active = Object.values(bandBySkill).filter(v => v !== null)
  return { bandBySkill, sampleBySkill, avgBand: active.length ? ieltsOverall(active) : 0 }
}

async function loadSubmissionsByUser(prisma, userIds) {
  const ids = [...new Set(userIds)]
  const byUser = Object.fromEntries(ids.map(id => [id, { attempts: [], writingAnswers: [], speakingAnswers: [] }]))
  if (!ids.length) return {}
  const [attempts, writingAnswers, speakingAnswers] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId: { in: ids }, finishedAt: { not: null } },
      select: { userId: true, score: true, correctCount: true, finishedAt: true, exam: { select: { skill: true } } },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.writingAnswer.findMany({
      where: { userId: { in: ids } },
      select: { id: true, userId: true, taskId: true, aiScore: true, status: true, createdAt: true, task: { select: { examId: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.speakingAnswer.findMany({
      where: { userId: { in: ids } },
      select: { id: true, userId: true, partId: true, aiScore: true, status: true, createdAt: true, part: { select: { examId: true, number: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  for (const a of attempts) byUser[a.userId]?.attempts.push(a)
  for (const a of writingAnswers) byUser[a.userId]?.writingAnswers.push(a)
  for (const a of speakingAnswers) byUser[a.userId]?.speakingAnswers.push(a)
  return Object.fromEntries(ids.map(id => [id, collectSubmissions(byUser[id])]))
}

function bandSummary(submissions) {
  const { bandBySkill, sampleBySkill, avgBand } = currentBands(submissions)
  const hasBand = Object.values(bandBySkill).some(v => v !== null)
  return {
    bandBySkill,
    sampleBySkill,
    avgBand: hasBand ? avgBand : null,
    submissionCount: submissions.length,
    lastSubmittedAt: submissions[0]?.finishedAt ?? null,
  }
}

module.exports = { collectSubmissions, currentBands, objectiveBand, groupBand, loadSubmissionsByUser, bandSummary, RECENT_COUNT }
