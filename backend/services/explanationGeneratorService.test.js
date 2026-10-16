import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAnswerMatch } from './explanationGeneratorService'

describe('explanationGeneratorService', () => {
  describe('isAnswerMatch', () => {
    it('matches exact answers case-insensitively', () => {
      expect(isAnswerMatch('TRUE', 'true')).toBe(true)
      expect(isAnswerMatch('FALSE', 'False')).toBe(true)
      expect(isAnswerMatch('patient', 'PATIENT')).toBe(true)
    })

    it('matches alternative answers separated by slash', () => {
      expect(isAnswerMatch('center/centre', 'centre')).toBe(true)
      expect(isAnswerMatch('color', 'colour/color')).toBe(true)
    })

    it('detects mismatch accurately', () => {
      expect(isAnswerMatch('TRUE', 'FALSE')).toBe(false)
      expect(isAnswerMatch('peers', 'patients')).toBe(false)
      expect(isAnswerMatch('A', 'B')).toBe(false)
    })
  })
})
