import { describe, it, expect, vi, beforeEach } from 'vitest'
const {
  get,
  set,
  del,
  flushAll,
  getOrSet,
  invalidateExamCaches,
  TTL_CAMBRIDGE,
  TTL_FULLTEST,
  TTL_EXAM_DETAIL,
} = require('./cache')

describe('backend/utils/cache', () => {
  beforeEach(() => {
    flushAll()
  })

  it('lưu và lấy giá trị qua get/set', () => {
    set('testKey', { id: 1, name: 'Cambridge 18' }, 60)
    const val = get('testKey')
    expect(val).toEqual({ id: 1, name: 'Cambridge 18' })
  })

  it('xóa giá trị qua del', () => {
    set('testKey', 'value', 60)
    del('testKey')
    expect(get('testKey')).toBeUndefined()
  })

  it('getOrSet gọi fetcher khi chưa có trong cache và tái sử dụng khi hit cache', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'ok', score: 8.5 })

    // Lần 1: miss -> fetch
    const res1 = await getOrSet('exam:reading:99', fetcher, 60)
    expect(res1).toEqual({ status: 'ok', score: 8.5 })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Lần 2: hit -> không gọi lại fetcher
    const res2 = await getOrSet('exam:reading:99', fetcher, 60)
    expect(res2).toEqual({ status: 'ok', score: 8.5 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('invalidateExamCaches xóa các cache liên quan đến examId và namespace', async () => {
    set('exam:reading:10', { title: 'Test 10' })
    set('exam:listening:10', { title: 'Listening 10' })
    set('fulltests:all', [{ id: 1 }])
    set('other:key', 'keep me')

    invalidateExamCaches(10)

    expect(get('exam:reading:10')).toBeUndefined()
    expect(get('exam:listening:10')).toBeUndefined()
    expect(get('fulltests:all')).toBeUndefined()
    expect(get('other:key')).toBe('keep me')
  })

  it('cung cấp các hằng số TTL chuẩn', () => {
    expect(TTL_CAMBRIDGE).toBe(600)
    expect(TTL_FULLTEST).toBe(600)
    expect(TTL_EXAM_DETAIL).toBe(900)
  })
})
