import { describe, it, expect } from 'vitest'
const { speakingAttempts, writingAttempts, pickAttempt } = require('./attemptGroups')

const at = h => new Date(Date.UTC(2026, 9, 1, h)).toISOString()

describe('attemptGroups', () => {
  it('starts a new speaking attempt at every Part 1 and lists newest first', () => {
    const groups = speakingAttempts([
      { id: 1, partId: 10, partNumber: 1, createdAt: at(1) },
      { id: 2, partId: 11, partNumber: 2, createdAt: at(1) },
      { id: 3, partId: 12, partNumber: 3, createdAt: at(2) },
      { id: 4, partId: 10, partNumber: 1, createdAt: at(5) },
    ])
    expect(groups.map(g => g.id)).toEqual([4, 1])
    expect(Object.keys(groups[0].items)).toEqual(['10'])
    expect(Object.keys(groups[1].items)).toEqual(['10', '11', '12'])
  })

  it('keeps a re-submission of a failed part inside the same attempt', () => {
    const groups = speakingAttempts([
      { id: 1, partId: 10, partNumber: 1, createdAt: at(1) },
      { id: 2, partId: 11, partNumber: 2, createdAt: at(1), status: 'failed' },
      { id: 3, partId: 11, partNumber: 2, createdAt: at(2), status: 'graded' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].items[11].id).toBe(3)
  })

  it('splits writing attempts when a task repeats or after a long gap', () => {
    const groups = writingAttempts([
      { id: 1, taskId: 3, createdAt: at(1) },
      { id: 2, taskId: 4, createdAt: at(1) },
      { id: 3, taskId: 3, createdAt: at(2) },
      { id: 4, taskId: 4, createdAt: at(12) },
    ])
    expect(groups.map(g => Object.values(g.items).map(a => a.id))).toEqual([[4], [3], [1, 2]])
  })

  it('picks the requested attempt or falls back to the latest', () => {
    const groups = writingAttempts([
      { id: 1, taskId: 3, createdAt: at(1) },
      { id: 2, taskId: 3, createdAt: at(2) },
    ])
    expect(pickAttempt(groups, '1').id).toBe(1)
    expect(pickAttempt(groups, 99).id).toBe(2)
    expect(pickAttempt(groups).id).toBe(2)
    expect(pickAttempt([], 1)).toBeNull()
  })
})
