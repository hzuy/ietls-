'use strict'

// Per-run diagnostics for one explanation generation request. Provider telemetry
// is global (one queue for the whole process), so events are matched by the
// runId carried in `meta`. Never stores prompt or explanation content.

const { addGeminiTelemetryListener, removeGeminiTelemetryListener } = require('./geminiRateLimiter')

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

function createRunTelemetry(runId) {
  const calls = []
  const saveDurations = []
  let cooldownMs = 0

  const listener = event => {
    if (!runId || event?.meta?.runId !== runId) return
    if (event.type === 'call') {
      calls.push({ queueWaitMs: Number(event.queueWaitMs) || 0, providerMs: Number(event.apiMs) || 0, ok: event.ok !== false })
    } else if (event.type === 'cooldown') {
      cooldownMs += Number(event.waitMs) || 0
    }
  }
  addGeminiTelemetryListener(listener)

  return {
    recordSave(durationMs) {
      if (Number.isFinite(durationMs) && durationMs >= 0) saveDurations.push(Math.round(durationMs))
    },
    summary(extra = {}) {
      const providerTimes = calls.map(call => call.providerMs)
      const queueWaits = calls.map(call => call.queueWaitMs)
      return {
        ...extra,
        providerCalls: calls.length,
        failedCalls: calls.filter(call => !call.ok).length,
        queueWaitMs: sum(queueWaits),
        queueWaitMaxMs: queueWaits.length ? Math.max(...queueWaits) : 0,
        providerMs: sum(providerTimes),
        providerP50Ms: percentile(providerTimes, 50),
        providerP95Ms: percentile(providerTimes, 95),
        saveCalls: saveDurations.length,
        saveMs: sum(saveDurations),
        saveMaxMs: saveDurations.length ? Math.max(...saveDurations) : 0,
        cooldownMs,
      }
    },
    dispose() {
      removeGeminiTelemetryListener(listener)
    },
  }
}

module.exports = { createRunTelemetry, percentile, sum }
