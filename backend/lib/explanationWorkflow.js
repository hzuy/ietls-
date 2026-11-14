'use strict'
const { createHash, randomUUID } = require('crypto')

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  return value
}
const fingerprint = value => createHash('sha256').update(JSON.stringify(stable(value)) ?? 'null').digest('hex')
const isWorkflow = value => value?.workflowVersion === 3 && Object.hasOwn(value, 'published')
const versionOf = value => isWorkflow(value) ? (value.draft?.version || value.publishedVersion || null) : value ? `legacy:${fingerprint(value)}` : null

function adminView(value) {
  if (!isWorkflow(value)) return value
  const draft = value.draft
  const stale = value.status === 'possibly_stale'
  const payload = draft?.payload || value.published || {}
  return {
    ...payload,
    workflowVersion: 3,
    status: stale ? 'possibly_stale' : draft ? (draft.issue ? 'needs_regeneration' : 'draft_ready') : 'published',
    hasDraft: Boolean(draft), draftVersion: draft?.version || null,
    sourceHash: draft?.sourceHash || value.publishedSourceHash || null,
    publishedExplanation: stale || value.publishedStale ? null : value.published || null,
    publishedVersion: value.publishedVersion || null,
    validationIssue: draft?.issue || null,
    needsRegenerationReason: draft?.issue || undefined,
    staleReason: value.staleReason,
    updatedAt: draft?.payload?.updatedAt || value.published?.updatedAt,
  }
}

function publishedView(value) {
  if (!isWorkflow(value)) return value
  if (value.status === 'possibly_stale' || value.publishedStale) return null
  return value.published || null
}

function draftEnvelope(previous, payload, sourceHash, issue = null) {
  const prior = isWorkflow(previous) ? previous : {
    workflowVersion: 3, published: previous && (!previous.status || ['ai_generated', 'teacher_reviewed', 'teacher_edited'].includes(previous.status)) ? previous : null,
    publishedVersion: previous ? `legacy:${fingerprint(previous)}` : null,
  }
  return { ...prior, workflowVersion: 3,
    // Keep a stale published version hidden until this new source is approved.
    status: undefined,
    publishedStale: Boolean(prior.publishedStale || prior.status === 'possibly_stale' || (prior.publishedSourceHash && prior.publishedSourceHash !== sourceHash)),
    draft: { version: randomUUID(), sourceHash, issue, payload: { ...payload, updatedAt: new Date().toISOString() } },
  }
}

function workflowError(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status })
}

module.exports = { fingerprint, isWorkflow, versionOf, adminView, publishedView, draftEnvelope, workflowError }
