import { describe, expect, it } from 'vitest'
const { fingerprint, isWorkflow, versionOf, adminView, publishedView, draftEnvelope } = require('./explanationWorkflow')
const old = { v: 2, status: 'teacher_reviewed', answer: 'nine', reasoning: 'Existing published reasoning' }
const next = { v: 2, answer: 'nine', reasoning: 'New draft reasoning' }

describe('explanation draft/publication envelope', () => {
  it('fingerprints content independently from object key order', () => {
    expect(fingerprint({ a: 1, nested: { z: 2, b: 3 } })).toBe(fingerprint({ nested: { b: 3, z: 2 }, a: 1 }))
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }))
  })
  it('keeps the current published explanation isolated from a newly generated draft', () => {
    const envelope = draftEnvelope(old, next, 'source-1')
    expect(isWorkflow(envelope)).toBe(true)
    expect(publishedView(envelope)).toEqual(old)
    expect(adminView(envelope)).toMatchObject({ status: 'draft_ready', hasDraft: true, publishedExplanation: old, reasoning: next.reasoning })
    expect(next).not.toHaveProperty('updatedAt')
    expect(old.reasoning).toBe('Existing published reasoning')
  })
  it('never exposes the first unapproved draft to learners', () => {
    const envelope = draftEnvelope(null, next, 'source-1')
    expect(publishedView(envelope)).toBeNull()
    expect(adminView(envelope).draftVersion).toBeTruthy()
  })
  it('does not treat an old unresolved conflict as published', () => {
    const envelope = draftEnvelope({ ...old, status: 'conflict_pending' }, next, 'source-1')
    expect(publishedView(envelope)).toBeNull()
  })
  it('preserves an already visible legacy AI explanation without marking it teacher-reviewed', () => {
    const legacy = { ...old, status: 'ai_generated' }
    const envelope = draftEnvelope(legacy, next, 'source-1')
    expect(publishedView(envelope)).toEqual(legacy)
    expect(publishedView(envelope).status).toBe('ai_generated')
    expect(versionOf(legacy)).toMatch(/^legacy:/)
  })
  it('marks missing evidence as a draft issue while retaining the previous published content', () => {
    const envelope = draftEnvelope(old, next, 'source-1', 'Missing evidence')
    expect(adminView(envelope)).toMatchObject({ status: 'needs_regeneration', validationIssue: 'Missing evidence' })
    expect(publishedView(envelope)).toEqual(old)
  })
  it('changes draft versions on a new saved revision', () => {
    const first = draftEnvelope(old, next, 'source-1')
    const second = draftEnvelope(first, { ...next, reasoning: 'Teacher edit' }, 'source-1')
    expect(versionOf(second)).not.toBe(versionOf(first))
    expect(publishedView(second)).toEqual(old)
  })
  it('hides a published explanation after its source changes but allows a new draft to be reviewed', () => {
    const envelope = draftEnvelope({ workflowVersion: 3, published: old, publishedSourceHash: 'old-source', draft: null }, next, 'new-source')
    expect(envelope.publishedStale).toBe(true)
    expect(publishedView(envelope)).toBeNull()
    expect(adminView(envelope)).toMatchObject({ status: 'draft_ready', publishedExplanation: null })
  })
  it('keeps a stale envelope hidden until regenerated or edited for the current source', () => {
    const envelope = { ...draftEnvelope(old, next, 'source-1'), status: 'possibly_stale' }
    expect(publishedView(envelope)).toBeNull()
    expect(adminView(envelope).status).toBe('possibly_stale')
  })
})
