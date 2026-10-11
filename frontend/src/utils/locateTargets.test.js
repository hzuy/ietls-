import { describe, it, expect } from 'vitest'
import { buildLocateSpec, resolveTargets } from './locateTargets'

const explanation = {
  v: 2,
  locate: { keywords: ['69 hectares'], paragraph: 0 },
  evidence: {
    parts: [{ text: 'Altogether, the park covers 170 acres, that’s 69 hectares.', paragraph: 0 }],
    chunks: [
      { text: 'the park covers 170 acres', part: 0 },
      { text: "that's 69 hectares", part: 0 },
    ],
  },
}

describe('locate targets', () => {
  it('finds the paragraph by text even when the stored index is stale', () => {
    const texts = ['[00:00 - 00:19] Speaker A', 'Part one. You will hear a teaching assistant.', 'Please first of course. Altogether, the park covers 170 acres, that\'s 69 hectares. There are three main types of habitat.']
    const targets = resolveTargets(buildLocateSpec(explanation), texts)
    expect(Object.keys(targets)).toEqual(['2'])
    expect(targets[2].map(m => m.kind)).toEqual(['evidence', 'keyword'])
  })

  it('falls back to the short chunks when the quote is split across utterances', () => {
    const texts = ['Altogether, the park covers 170 acres,', "that's 69 hectares. There are three main types."]
    const targets = resolveTargets(buildLocateSpec(explanation), texts)
    expect(targets[0][0]).toEqual({ text: 'the park covers 170 acres', kind: 'evidence' })
    expect(targets[1].some(m => m.kind === 'evidence')).toBe(true)
    expect(targets[1].some(m => m.kind === 'keyword')).toBe(true)
  })

  it('uses keywords alone when no evidence can be found', () => {
    const texts = ['Something else entirely.', 'It is roughly 69 hectares in total.']
    const targets = resolveTargets(buildLocateSpec(explanation), texts)
    expect(targets).toEqual({ 1: [{ text: '69 hectares', kind: 'keyword' }] })
  })

  it('returns null for legacy explanations or empty text', () => {
    expect(buildLocateSpec({ restatement: 'x' })).toBeNull()
    expect(resolveTargets(buildLocateSpec(explanation), [])).toBeNull()
    expect(resolveTargets(buildLocateSpec(explanation), ['nothing matches here'])).toBeNull()
  })
})
