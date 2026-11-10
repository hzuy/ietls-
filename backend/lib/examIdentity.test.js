import { describe, it, expect } from 'vitest'
const { matchExistingGroup, ExamIdentityConflict } = require('./examIdentity')
const old = [{ id: 10 }, { id: 20 }]
describe('exam group identity', () => {
  it('does not reuse the group at an inserted new group position', () => {
    expect(matchExistingGroup({ isNew: true }, 0, old, new Set())).toBeNull()
    expect(matchExistingGroup({ id: 10 }, 1, old, new Set())).toBe(old[0])
  })
  it('rejects foreign/stale IDs and duplicate identities', () => {
    expect(() => matchExistingGroup({ id: 99 }, 0, old, new Set())).toThrow(ExamIdentityConflict)
    expect(() => matchExistingGroup({ id: 10 }, 0, old, new Set([10]))).toThrow(ExamIdentityConflict)
    expect(() => matchExistingGroup({ id: 10, isNew: true }, 0, old, new Set())).toThrow(ExamIdentityConflict)
  })
  it('retains legacy positional behavior only when no identity is supplied', () => {
    expect(matchExistingGroup({}, 1, old, new Set())).toBe(old[1])
  })
})
