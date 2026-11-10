import {beforeEach, describe, expect, it, vi} from 'vitest'
import {getSubmissionTicket, clearSubmissionTicket} from './submissionTicket'

describe('objective submission identity across lost ACK and refresh (TC-042)', () => {
  beforeEach(() => localStorage.clear())
  it('persists both identity and submitted payload across module reload', async () => {
    const first = getSubmissionTicket(1, 10, 'reading', {42:'blue'})
    vi.resetModules()
    const reloaded = await import('./submissionTicket')
    const retry = reloaded.getSubmissionTicket(1, 10, 'reading', {42:'red'})
    expect(retry).toEqual(first)
    expect(retry.answers).toEqual({42:'blue'})
    expect(first.key).toMatch(/^[\w-]{8,100}$/)
  })
  it('isolates users, skills and exams and permits a new attempt after ACK', () => {
    const first = getSubmissionTicket(1,10,'reading',{})
    expect(getSubmissionTicket(2,10,'reading',{}).key).not.toBe(first.key)
    expect(getSubmissionTicket(1,11,'reading',{}).key).not.toBe(first.key)
    expect(getSubmissionTicket(1,10,'listening',{}).key).not.toBe(first.key)
    clearSubmissionTicket(1,10,'reading')
    expect(getSubmissionTicket(1,10,'reading',{}).key).not.toBe(first.key)
  })
  it('fails before sending when persistence is unavailable', () => {
    const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage full')})
    try { expect(()=>getSubmissionTicket(1,10,'reading',{})).toThrow('storage full') }
    finally {spy.mockRestore()}
  })
})
