'use strict'

const WRITING_SESSION_GAP_MS = 6 * 60 * 60 * 1000

function time(a) {
  return new Date(a.createdAt).getTime()
}

function groupAttempts(answers, { keyOf, isStart = () => false, gapMs = Infinity }) {
  const sorted = [...(answers || [])].sort((a, b) => time(a) - time(b) || (a.id ?? 0) - (b.id ?? 0))
  const out = []
  let cur = null
  for (const a of sorted) {
    const key = keyOf(a)
    const t = time(a)
    const prev = cur?.items[key]
    const replacesFailed = prev && prev.status === 'failed'
    const startNew = !cur || isStart(a) || (prev && !replacesFailed) || t - cur.lastAt > gapMs
    if (startNew) {
      cur = { id: a.id, startedAt: a.createdAt, finishedAt: a.createdAt, lastAt: t, items: {} }
      out.push(cur)
    }
    cur.items[key] = a
    cur.finishedAt = a.createdAt
    cur.lastAt = t
  }
  return out.reverse()
}

function speakingAttempts(answers) {
  return groupAttempts(answers, { keyOf: a => a.partId, isStart: a => a.partNumber === 1 })
}

function writingAttempts(answers) {
  return groupAttempts(answers, { keyOf: a => a.taskId, gapMs: WRITING_SESSION_GAP_MS })
}

function pickAttempt(groups, attemptId) {
  if (attemptId != null) {
    const id = Number(attemptId)
    const found = groups.find(g => g.id === id)
    if (found) return found
  }
  return groups[0] || null
}

module.exports = { groupAttempts, speakingAttempts, writingAttempts, pickAttempt, WRITING_SESSION_GAP_MS }
