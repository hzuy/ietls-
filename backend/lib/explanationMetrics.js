'use strict'

// Small in-memory ring buffer of recent explanation runs. It exists so the team
// can measure queue wait / provider / save time without a metrics stack. No
// prompt text, source content or credentials are stored.

const MAX_RUNS = 200
const runs = []

function recordRun(summary) {
  if (!summary || typeof summary !== 'object') return null
  const entry = { ...summary, recordedAt: new Date().toISOString() }
  runs.push(entry)
  while (runs.length > MAX_RUNS) runs.shift()
  return entry
}

function listRuns(limit = 50) {
  const take = Math.max(1, Math.min(MAX_RUNS, Number(limit) || 50))
  return runs.slice(-take).reverse()
}

function numeric(entry, key) {
  const value = Number(entry?.[key])
  return Number.isFinite(value) ? value : null
}

function aggregate(limit = 50) {
  const sample = listRuns(limit)
  const total = key => {
    const values = sample.map(entry => numeric(entry, key)).filter(value => value !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  const median = key => {
    const values = sample.map(entry => numeric(entry, key)).filter(value => value !== null).sort((a, b) => a - b)
    if (!values.length) return null
    return values[Math.floor((values.length - 1) / 2)]
  }
  return {
    sampleSize: sample.length,
    committedDrafts: total('committed'),
    failedQuestions: total('failed'),
    needsReviewQuestions: total('needsReview'),
    durationMs: total('durationMs'),
    queueWaitMs: total('queueWaitMs'),
    providerMs: total('providerMs'),
    saveMs: total('saveMs'),
    medianProviderP95Ms: median('providerP95Ms'),
    medianDurationMs: median('durationMs'),
  }
}

function clearRuns() {
  runs.length = 0
}

module.exports = { recordRun, listRuns, aggregate, clearRuns, MAX_RUNS }
