import { describe, it, expect } from 'vitest'
import { deriveCorrectIndices, correctAnswerFromIndices, reindexAfterRemoval } from './mcqAnswer'

describe('deriveCorrectIndices', () => {
  it('maps stored answer texts to option positions', () => {
    const opts = ['London', 'Paris', 'Rome', 'Berlin']
    expect(deriveCorrectIndices('Paris,Berlin', opts)).toEqual([1, 3])
  })

  it('ignores whitespace around stored texts and options', () => {
    expect(deriveCorrectIndices(' Paris , Rome ', ['London', 'Paris', 'Rome'])).toEqual([1, 2])
  })

  it('gives each stored text a distinct option index when options repeat (legacy data)', () => {
    // "a" appears twice, answer wants it twice -> indices 0 and 1, not [0, 0]
    expect(deriveCorrectIndices('a,a', ['a', 'a', 'b'])).toEqual([0, 1])
    // answer wants "a" once -> only the first
    expect(deriveCorrectIndices('a', ['a', 'a', 'b'])).toEqual([0])
  })

  it('drops texts that match no option', () => {
    expect(deriveCorrectIndices('Paris,Madrid', ['London', 'Paris'])).toEqual([1])
  })

  it('returns [] for empty / missing input', () => {
    expect(deriveCorrectIndices('', ['a', 'b'])).toEqual([])
    expect(deriveCorrectIndices(null, ['a', 'b'])).toEqual([])
    expect(deriveCorrectIndices('a', null)).toEqual([])
  })

  it('distinguishes near-duplicates that are not exactly equal', () => {
    // Cyrillic 'а' vs Latin 'a' — different strings, must resolve to their own index
    expect(deriveCorrectIndices('а', ['a', 'а', 'b'])).toEqual([1])
  })
})

describe('correctAnswerFromIndices', () => {
  it('serializes indices back to comma-joined option text, ordered by position', () => {
    expect(correctAnswerFromIndices([3, 1], ['London', 'Paris', 'Rome', 'Berlin'])).toBe('Paris,Berlin')
  })

  it('skips blank / missing options', () => {
    expect(correctAnswerFromIndices([0, 1, 2], ['a', '  ', 'c'])).toBe('a,c')
    expect(correctAnswerFromIndices([0, 5], ['a', 'b'])).toBe('a')
  })

  it('round-trips with deriveCorrectIndices for distinct options', () => {
    const opts = ['A. one', 'B. two', 'C. three']
    const stored = 'A. one,C. three'
    expect(correctAnswerFromIndices(deriveCorrectIndices(stored, opts), opts)).toBe(stored)
  })
})

describe('reindexAfterRemoval', () => {
  it('drops the removed index and shifts later ones down by one', () => {
    expect(reindexAfterRemoval([0, 2, 3], 1)).toEqual([0, 1, 2])
  })

  it('drops the removed index itself', () => {
    expect(reindexAfterRemoval([1, 2], 1)).toEqual([1])
  })

  it('leaves earlier indices untouched', () => {
    expect(reindexAfterRemoval([0, 1], 2)).toEqual([0, 1])
  })
})
