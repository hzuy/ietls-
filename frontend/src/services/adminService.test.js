import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the axios instance the service talks to.
vi.mock('../utils/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from '../utils/axios'
import { getTrashCount, onTrashChanged, notifyTrashChanged } from './adminService'

describe('trash count — cache + change notifications', () => {
  let offs = []
  const track = (fn) => { const off = onTrashChanged(fn); offs.push(off); return off }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })
  afterEach(() => {
    offs.forEach(off => off())
    offs = []
    sessionStorage.clear()
  })

  it('getTrashCount caches within TTL, refetches when forced', async () => {
    api.get.mockResolvedValue({ data: { count: 3 } })

    expect(await getTrashCount()).toBe(3)
    expect(await getTrashCount()).toBe(3)          // served from sessionStorage
    expect(api.get).toHaveBeenCalledTimes(1)

    api.get.mockResolvedValue({ data: { count: 7 } })
    expect(await getTrashCount({ force: true })).toBe(7)
    expect(api.get).toHaveBeenCalledTimes(2)
    // forced result is written back to the cache
    expect(await getTrashCount()).toBe(7)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('notifyTrashChanged clears the cache and calls every listener', async () => {
    api.get.mockResolvedValue({ data: { count: 5 } })
    await getTrashCount()
    expect(JSON.parse(sessionStorage.getItem('__trashCount__')).count).toBe(5)

    const a = vi.fn()
    const b = vi.fn()
    const offA = track(a)
    track(b)

    notifyTrashChanged()
    expect(sessionStorage.getItem('__trashCount__')).toBeNull()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    offA()
    notifyTrashChanged()
    expect(a).toHaveBeenCalledTimes(1)   // unsubscribed
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('a throwing listener does not stop the others', () => {
    const bad = vi.fn(() => { throw new Error('boom') })
    const good = vi.fn()
    track(bad)
    track(good)
    expect(() => notifyTrashChanged()).not.toThrow()
    expect(good).toHaveBeenCalled()
  })
})
