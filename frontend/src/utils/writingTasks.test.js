import { describe, it, expect } from 'vitest'
import { isTaskComplete, countUnsubmitted } from './writingTasks'

/**
 * Hợp đồng của auto-submit khi hết giờ (P4, W-b):
 * chỉ nộp task CHƯA xong; task đã nộp (có result HOẶC trong submittedTaskIds,
 * kể cả phiên trước) không bị đụng lại.
 */
describe('isTaskComplete', () => {
  it('true khi có kết quả chấm', () => {
    expect(isTaskComplete(10, { 10: { overall: 6 } }, [])).toBe(true)
  })

  it('true khi nằm trong submittedTaskIds (đã nộp, chưa chấm xong)', () => {
    expect(isTaskComplete(10, {}, [10])).toBe(true)
  })

  it('false khi chưa có gì', () => {
    expect(isTaskComplete(10, {}, [])).toBe(false)
    expect(isTaskComplete(10, { 11: { overall: 6 } }, [12])).toBe(false)
  })
})

describe('countUnsubmitted', () => {
  const tasks = [{ id: 10 }, { id: 11 }, { id: 12 }]

  it('đếm tất cả khi chưa nộp gì', () => {
    expect(countUnsubmitted(tasks, {}, [])).toBe(3)
  })

  it('bỏ qua task đã có result', () => {
    expect(countUnsubmitted(tasks, { 10: { overall: 6 } }, [])).toBe(2)
  })

  it('bỏ qua task trong submittedTaskIds', () => {
    expect(countUnsubmitted(tasks, {}, [11])).toBe(2)
  })

  it('bỏ qua cả 2 nguồn, không đếm trùng', () => {
    expect(countUnsubmitted(tasks, { 10: { overall: 6 } }, [10, 11])).toBe(1)
  })

  it('0 khi mọi task đã xong', () => {
    expect(countUnsubmitted(tasks, { 10: {}, 11: {}, 12: {} }, [])).toBe(0)
  })
})
