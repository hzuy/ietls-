import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyExplanationSaved } from './explanationSaveNotification'

beforeEach(() => vi.spyOn(window, 'alert').mockImplementation(() => {}).mockClear())
describe('saved explanation alert', () => {
  const saved = { status: 'done', generated: 2, rows: [], needsRetry: [] }
  it('announces a confirmed save once', () => {
    expect(notifyExplanationSaved(saved)).toBe(true)
    expect(window.alert).toHaveBeenCalledExactlyOnceWith('Đã lưu giải thích thành công.')
  })
  it.each([
    { ...saved, status: 'running' }, { ...saved, status: 'cancelled' },
    { ...saved, status: 'partial' }, { ...saved, generated: 0 },
    { ...saved, rows: [{ number: 1 }] }, { ...saved, needsRetry: [{ number: 1 }] },
    null,
  ])('does not announce unfinished or unsuccessful work: %j', report => {
    expect(notifyExplanationSaved(report)).toBe(false)
    expect(window.alert).not.toHaveBeenCalled()
  })
  it('waits for conflicts to be confirmed', () => {
    expect(notifyExplanationSaved(saved, true)).toBe(false)
    expect(window.alert).not.toHaveBeenCalled()
  })
})
