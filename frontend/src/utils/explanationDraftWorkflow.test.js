import { describe, expect, it } from 'vitest'
import { canUseExplanation, draftSaveMetadata, explanationPublishMetadata } from './explanationDraftWorkflow'

describe('explanation draft workflow', () => {
  it('sends all concurrency tokens while keeping legacy saves compatible', () => {
    expect(draftSaveMetadata(null)).toEqual({ expectedDraftVersion: null, expectedSourceHash: null, expectedPublishedVersion: null })
    const explanation = { draftVersion: 'draft-2', sourceHash: 'source-1', publishedVersion: 'published-1' }
    expect(draftSaveMetadata(explanation)).toEqual({ expectedDraftVersion: 'draft-2', expectedSourceHash: 'source-1', expectedPublishedVersion: 'published-1' })
    expect(explanationPublishMetadata(explanation)).toEqual({ draftVersion: 'draft-2', sourceHash: 'source-1' })
  })

  it('only allows a validated current draft to be used', () => {
    const draft = { workflowVersion: 3, hasDraft: true, status: 'draft_ready', draftVersion: 'draft-1', sourceHash: 'source-1' }
    expect(canUseExplanation(draft)).toBe(true)
    expect(canUseExplanation({ ...draft, validationIssue: 'Missing evidence' })).toBe(false)
    expect(canUseExplanation({ ...draft, status: 'needs_regeneration' })).toBe(false)
    expect(canUseExplanation({ ...draft, draftVersion: null })).toBe(false)
    expect(canUseExplanation({ ...draft, hasDraft: false, status: 'published' })).toBe(false)
  })
})
