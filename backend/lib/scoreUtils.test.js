import { describe, it, expect } from 'vitest'
const { getReadingBand, getListeningBand, ieltsOverall, roundBand } = require('./scoreUtils')

describe('scoreUtils', () => {
  describe('roundBand', () => {
    it('rounds to the nearest valid IELTS 0.5 step', () => {
      expect(roundBand(6.1)).toBe(6.0)   // < .25 down
      expect(roundBand(6.24)).toBe(6.0)
      expect(roundBand(6.25)).toBe(6.5)  // .25 up
      expect(roundBand(6.5)).toBe(6.5)
      expect(roundBand(6.74)).toBe(6.5)
      expect(roundBand(6.75)).toBe(7.0)  // .75 up
      expect(roundBand(0.1)).toBe(0)     // "0.1" bug — must not stay 0.1
      expect(roundBand(0.6)).toBe(0.5)   // "0.6" bug
    })
    it('passes null / NaN through and clamps to [0, 9]', () => {
      expect(roundBand(null)).toBe(null)
      expect(roundBand(undefined)).toBe(null)
      expect(roundBand(NaN)).toBe(null)
      expect(roundBand(9.4)).toBe(9)
      expect(roundBand(-1)).toBe(0)
    })
  })

  describe('ieltsOverall', () => {
    it('Case 1: avg = 6.25 (.25 rounds to .5) -> 6.5', () => {
      expect(ieltsOverall([6.5, 6.5, 6.0, 6.0])).toBe(6.5)
    })

    it('Case 2: avg = 6.125 (< .25 rounds to .0) -> 6.0', () => {
      expect(ieltsOverall([6.5, 6.0, 6.0, 6.0])).toBe(6.0)
    })

    it('Case 3: avg = 6.375 (.25 - .75 rounds to .5) -> 6.5', () => {
      expect(ieltsOverall([6.5, 6.5, 6.5, 6.0])).toBe(6.5)
    })

    it('Case 4: avg = 6.75 (.75 rounds to next .0) -> 7.0', () => {
      expect(ieltsOverall([7.0, 7.0, 6.5, 6.5])).toBe(7.0)
    })

    it('Case 5: avg = 6.625 (.25 - .75 rounds to .5) -> 6.5', () => {
      expect(ieltsOverall([7.0, 6.5, 6.5, 6.5])).toBe(6.5)
    })

    it('Case 6: avg = 6.875 (>= .75 rounds to next .0) -> 7.0', () => {
      expect(ieltsOverall([7.0, 7.0, 7.0, 6.5])).toBe(7.0)
    })

    it('Edge Case 1: Empty or null array returns 0 without crashing', () => {
      expect(ieltsOverall([])).toBe(0)
      expect(ieltsOverall(null)).toBe(0)
      expect(ieltsOverall(undefined)).toBe(0)
      expect(ieltsOverall(['invalid', null])).toBe(0)
    })

    it('Edge Case 2: Scores > 9.0 are clamped at 9.0', () => {
      expect(ieltsOverall([10, 9.5, 10, 9])).toBe(9.0)
    })

    it('Edge Case 3: Floating point precision (0.1 + 0.2 accumulation)', () => {
      // 5.5 + 5.5 + 6.0 + 6.0 = 23 / 4 = 5.75 -> 6.0
      expect(ieltsOverall([5.5, 5.5, 6.0, 6.0])).toBe(6.0)
    })
  })

  describe('getReadingBand', () => {
    it('correctly maps Reading raw scores to Band scores', () => {
      expect(getReadingBand(40)).toBe(9.0)
      expect(getReadingBand(39)).toBe(9.0)
      expect(getReadingBand(37)).toBe(8.5)
      expect(getReadingBand(30)).toBe(7.0)
      expect(getReadingBand(23)).toBe(6.0)
      expect(getReadingBand(15)).toBe(5.0)
      expect(getReadingBand(3)).toBe(0)
    })
  })

  describe('getListeningBand', () => {
    it('correctly maps Listening raw scores to Band scores', () => {
      expect(getListeningBand(40)).toBe(9.0)
      expect(getListeningBand(39)).toBe(9.0)
      expect(getListeningBand(32)).toBe(7.5)
      expect(getListeningBand(30)).toBe(7.0)
      expect(getListeningBand(26)).toBe(6.5)
      expect(getListeningBand(18)).toBe(5.5)
      expect(getListeningBand(3)).toBe(0)
    })
  })
})
