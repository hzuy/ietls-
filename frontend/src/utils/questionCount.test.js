import { describe, it, expect } from 'vitest'
import {
  getGroupSlots,
  getSectionSlots,
  getPassageSlots,
  isSlotAnswered
} from './questionCount'

describe('questionCount utility', () => {
  describe('getGroupSlots', () => {
    it('returns empty array when group is null or undefined', () => {
      expect(getGroupSlots(null)).toEqual([])
      expect(getGroupSlots(undefined)).toEqual([])
    })

    it('creates slots for standard question groups', () => {
      const group = {
        type: 'note_completion',
        qNumberStart: 1,
        qNumberEnd: 3,
        questions: [
          { id: 101, number: 1 },
          { id: 102, number: 2 },
          { id: 103, number: 3 },
        ],
      }
      const slots = getGroupSlots(group)
      expect(slots).toEqual([
        { number: 1, qId: 101, isMultiChoice: false, multiIndex: 0 },
        { number: 2, qId: 102, isMultiChoice: false, multiIndex: 0 },
        { number: 3, qId: 103, isMultiChoice: false, multiIndex: 0 },
      ])
    })

    it('handles mcq_multi where 1 question covers multiple choices/slots', () => {
      const group = {
        type: 'mcq_multi',
        maxChoices: 2,
        qNumberStart: 20,
        qNumberEnd: 23,
        questions: [
          { id: 201, number: 20 },
          { id: 202, number: 22 },
        ],
      }
      const slots = getGroupSlots(group)
      expect(slots).toEqual([
        { number: 20, qId: 201, isMultiChoice: true, multiIndex: 0 },
        { number: 21, qId: 201, isMultiChoice: true, multiIndex: 1 },
        { number: 22, qId: 202, isMultiChoice: true, multiIndex: 0 },
        { number: 23, qId: 202, isMultiChoice: true, multiIndex: 1 },
      ])
    })
  })

  describe('getPassageSlots', () => {
    it('returns empty array for empty passage', () => {
      expect(getPassageSlots(null)).toEqual([])
      expect(getPassageSlots({})).toEqual([])
    })

    it('corrects out-of-order groups and sorts slots strictly ascending (e.g. 37-40 before 31-36)', () => {
      const passage = {
        number: 3,
        questionGroups: [
          {
            type: 'mcq',
            qNumberStart: 27,
            qNumberEnd: 30,
            questions: [
              { id: 1, number: 27 },
              { id: 2, number: 28 },
              { id: 3, number: 29 },
              { id: 4, number: 30 },
            ],
          },
          {
            type: 'yes_no_ng',
            qNumberStart: 37,
            qNumberEnd: 40,
            questions: [
              { id: 11, number: 37 },
              { id: 12, number: 38 },
              { id: 13, number: 39 },
              { id: 14, number: 40 },
            ],
          },
          {
            type: 'drag_word_bank',
            qNumberStart: 31,
            qNumberEnd: 36,
            questions: [
              { id: 5, number: 31 },
              { id: 6, number: 32 },
              { id: 7, number: 33 },
              { id: 8, number: 34 },
              { id: 9, number: 35 },
              { id: 10, number: 36 },
            ],
          },
        ],
      }

      const slots = getPassageSlots(passage)
      const numbers = slots.map(s => s.number)
      expect(numbers).toEqual([27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40])
    })

    it('merges direct questions and groups without duplicates', () => {
      const passage = {
        number: 1,
        questions: [
          { id: 99, number: 1 },
          { id: 100, number: 2 },
        ],
        questionGroups: [
          {
            type: 'short_answer',
            qNumberStart: 2,
            qNumberEnd: 4,
            questions: [
              { id: 100, number: 2 },
              { id: 101, number: 3 },
              { id: 102, number: 4 },
            ],
          },
        ],
      }

      const slots = getPassageSlots(passage)
      expect(slots.map(s => s.number)).toEqual([1, 2, 3, 4])
    })
  })

  describe('getSectionSlots', () => {
    it('returns empty array when section is null or undefined', () => {
      expect(getSectionSlots(null)).toEqual([])
      expect(getSectionSlots(undefined)).toEqual([])
    })

    it('returns sorted deduplicated array of slots for listening section', () => {
      const section = {
        number: 1,
        questionGroups: [
          {
            type: 'fill_blank',
            qNumberStart: 1,
            qNumberEnd: 5,
            questions: [
              { id: 1, number: 1 },
              { id: 2, number: 2 },
              { id: 3, number: 3 },
              { id: 4, number: 4 },
              { id: 5, number: 5 },
            ],
          },
        ],
      }
      const slots = getSectionSlots(section)
      expect(slots.map(s => s.number)).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('isSlotAnswered', () => {
    it('returns false for null slot, missing qId, or empty answers', () => {
      expect(isSlotAnswered(null, {})).toBe(false)
      expect(isSlotAnswered({ number: 1 }, {})).toBe(false)
      expect(isSlotAnswered({ number: 1, qId: 10 }, {})).toBe(false)
      expect(isSlotAnswered({ number: 1, qId: 10 }, { 10: '' })).toBe(false)
      expect(isSlotAnswered({ number: 1, qId: 10 }, { 10: '   ' })).toBe(false)
    })

    it('returns true for standard question when answer has non-empty text', () => {
      const slot = { number: 1, qId: 10, isMultiChoice: false, multiIndex: 0 }
      expect(isSlotAnswered(slot, { 10: 'TRUE' })).toBe(true)
      expect(isSlotAnswered(slot, { 10: 'Answer' })).toBe(true)
    })

    it('accurately counts mcq_multi choices based on multiIndex', () => {
      const slot1 = { number: 20, qId: 201, isMultiChoice: true, multiIndex: 0 }
      const slot2 = { number: 21, qId: 201, isMultiChoice: true, multiIndex: 1 }

      // 0 choices selected
      expect(isSlotAnswered(slot1, { 201: '' })).toBe(false)
      expect(isSlotAnswered(slot2, { 201: '' })).toBe(false)

      // 1 choice selected: slot 1 is answered, slot 2 is NOT answered
      expect(isSlotAnswered(slot1, { 201: 'A' })).toBe(true)
      expect(isSlotAnswered(slot2, { 201: 'A' })).toBe(false)

      // 2 choices selected: both slot 1 and slot 2 are answered
      expect(isSlotAnswered(slot1, { 201: 'A,B' })).toBe(true)
      expect(isSlotAnswered(slot2, { 201: 'A,B' })).toBe(true)

      // Extra choices (e.g. maxChoices = 3, multiIndex = 2)
      const slot3 = { number: 22, qId: 201, isMultiChoice: true, multiIndex: 2 }
      expect(isSlotAnswered(slot3, { 201: 'A,B' })).toBe(false)
      expect(isSlotAnswered(slot3, { 201: 'A,B,C' })).toBe(true)
    })
  })
})
