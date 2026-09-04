import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getOrRevalidate, invalidate, clearAll } = require('./swrCache')

const tick = () => new Promise(r => setTimeout(r, 0))

describe('swrCache', () => {
  beforeEach(() => clearAll())

  it('memoise: gọi fetcher 1 lần cho các hit trong TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 })
    const a = await getOrRevalidate('k', fetcher, 1000)
    const b = await getOrRevalidate('k', fetcher, 1000)
    expect(a).toEqual({ n: 1 })
    expect(b).toEqual({ n: 1 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stampede: nhiều request đồng thời lúc cold chỉ chạy fetcher 1 lần', async () => {
    let resolve
    const fetcher = vi.fn().mockImplementation(() => new Promise(r => { resolve = r }))
    const p1 = getOrRevalidate('k', fetcher, 1000)
    const p2 = getOrRevalidate('k', fetcher, 1000)
    resolve('data')
    expect(await p1).toBe('data')
    expect(await p2).toBe('data')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stale-while-revalidate: trả data cũ ngay, refresh nền', async () => {
    let call = 0
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(++call))
    const first = await getOrRevalidate('k', fetcher, 5) // ttl 5ms
    expect(first).toBe(1)

    await new Promise(r => setTimeout(r, 20)) // để cache stale

    const stale = await getOrRevalidate('k', fetcher, 5)
    expect(stale).toBe(1) // vẫn trả data cũ ngay lập tức
    await tick()
    await tick()

    const fresh = await getOrRevalidate('k', fetcher, 5000)
    expect(fresh).toBe(2) // lần refresh nền đã cập nhật
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidate(prefix): xoá mọi key bắt đầu bằng prefix', async () => {
    const f = vi.fn().mockResolvedValue('x')
    await getOrRevalidate('practice:reading:4', f, 10000)
    await getOrRevalidate('practice:listening:0', f, 10000)
    await getOrRevalidate('samples:writing:4', f, 10000)
    expect(f).toHaveBeenCalledTimes(3)

    invalidate('practice:')

    await getOrRevalidate('practice:reading:4', f, 10000)   // miss -> refetch
    await getOrRevalidate('samples:writing:4', f, 10000)    // vẫn hit
    expect(f).toHaveBeenCalledTimes(4)
  })

  it('invalidate: không truyền gì thì không xoá nhầm', async () => {
    const f = vi.fn().mockResolvedValue('x')
    await getOrRevalidate('k', f, 10000)
    invalidate()
    invalidate('')
    await getOrRevalidate('k', f, 10000)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
