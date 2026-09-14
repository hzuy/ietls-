import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveDraft,
  loadDraft,
  checkDraft,
  getLatestDraft,
  purgeExpiredDrafts,
  DRAFT_TTL_MS,
} from './draftService'

// Ghi 1 draft rồi chỉnh tay `savedAt` trong localStorage (mô phỏng draft cũ).
function writeDraftWithAge(userId, examId, skillType, ageMs, data = { 1: 'A' }) {
  saveDraft({ userId, examId, skillType, data, timeRemaining: 600 })
  const key = `ielts_draft_${userId}_${examId}_${skillType}`
  const draft = JSON.parse(localStorage.getItem(key))
  draft.savedAt = new Date(Date.now() - ageMs).toISOString()
  localStorage.setItem(key, JSON.stringify(draft))
  return key
}

describe('draftService — TTL', () => {
  beforeEach(() => localStorage.clear())

  it('draft mới (savedAt gần đây) → loadDraft trả về bình thường', () => {
    writeDraftWithAge('u1', '10', 'reading', 60 * 1000) // 1 phút trước
    const d = loadDraft('u1', '10', 'reading')
    expect(d).not.toBeNull()
    expect(d.data).toEqual({ 1: 'A' })
    expect(checkDraft('u1', '10', 'reading').hasDraft).toBe(true)
  })

  it('draft quá hạn (> 7 ngày) → loadDraft trả null, checkDraft.hasDraft false', () => {
    writeDraftWithAge('u1', '10', 'reading', DRAFT_TTL_MS + 60 * 1000)
    expect(loadDraft('u1', '10', 'reading')).toBeNull()
    expect(checkDraft('u1', '10', 'reading').hasDraft).toBe(false)
  })

  it('draft sát mốc nhưng CÒN hạn (6 ngày) → vẫn nạp được', () => {
    writeDraftWithAge('u1', '10', 'writing', 6 * 24 * 60 * 60 * 1000,
      { essays: { 5: 'x' }, submittedTaskIds: [] })
    expect(loadDraft('u1', '10', 'writing')).not.toBeNull()
  })

  it('savedAt không parse được → KHÔNG coi là hết hạn (giữ an toàn)', () => {
    saveDraft({ userId: 'u1', examId: '10', skillType: 'reading', data: { 1: 'A' }, timeRemaining: 600 })
    const key = 'ielts_draft_u1_10_reading'
    const draft = JSON.parse(localStorage.getItem(key))
    draft.savedAt = 'not-a-date'
    localStorage.setItem(key, JSON.stringify(draft))
    expect(loadDraft('u1', '10', 'reading')).not.toBeNull()
    expect(checkDraft('u1', '10', 'reading').hasDraft).toBe(true)
  })
})

describe('draftService — purgeExpiredDrafts', () => {
  beforeEach(() => localStorage.clear())

  it('xoá đúng key quá hạn, giữ nguyên key còn hạn', () => {
    const oldKey = writeDraftWithAge('u1', '1', 'reading', DRAFT_TTL_MS + 10_000)
    const freshKey = writeDraftWithAge('u1', '2', 'listening', 5 * 60 * 1000)

    purgeExpiredDrafts()

    expect(localStorage.getItem(oldKey)).toBeNull()
    expect(localStorage.getItem(freshKey)).not.toBeNull()
  })

  it('không crash và không đụng key rác / JSON hỏng / key không phải draft', () => {
    const oldKey = writeDraftWithAge('u1', '1', 'writing', DRAFT_TTL_MS + 10_000,
      { essays: { 1: 'x' }, submittedTaskIds: [] })
    localStorage.setItem('ielts_draft_broken', '{ not valid json')
    localStorage.setItem('some_other_app_key', 'keep me')

    expect(() => purgeExpiredDrafts()).not.toThrow()

    expect(localStorage.getItem(oldKey)).toBeNull()
    expect(localStorage.getItem('ielts_draft_broken')).toBe('{ not valid json') // giữ an toàn
    expect(localStorage.getItem('some_other_app_key')).toBe('keep me')
  })

  it('localStorage rỗng → no-op, không throw', () => {
    expect(() => purgeExpiredDrafts()).not.toThrow()
  })
})

describe('draftService — getLatestDraft', () => {
  beforeEach(() => localStorage.clear())

  it('trả về draft mới nhất còn hạn và có nội dung', () => {
    writeDraftWithAge('u1', '1', 'reading', 10 * 60 * 1000, { 1: 'A' }) // 10 phút trước
    writeDraftWithAge('u1', '2', 'listening', 2 * 60 * 1000, { 1: 'B', 2: 'C' }) // 2 phút trước (mới hơn)

    const latest = getLatestDraft('u1')
    expect(latest).not.toBeNull()
    expect(latest.examId).toBe('2')
    expect(latest.skillType).toBe('listening')
  })

  it('lưu và giữ đúng examTitle và totalQuestions', () => {
    saveDraft({
      userId: 'u1',
      examId: 'cam-19-1',
      skillType: 'reading',
      data: { 1: 'A', 2: 'B' },
      timeRemaining: 2400,
      examTitle: 'Cambridge 19 · Test 1 Reading',
      totalQuestions: 40,
    })

    const latest = getLatestDraft('u1')
    expect(latest).not.toBeNull()
    expect(latest.examTitle).toBe('Cambridge 19 · Test 1 Reading')
    expect(latest.totalQuestions).toBe(40)
  })

  it('bỏ qua draft quá hạn hoặc rỗng', () => {
    writeDraftWithAge('u1', '1', 'reading', DRAFT_TTL_MS + 10_000, { 1: 'A' }) // quá hạn
    saveDraft({ userId: 'u1', examId: '2', skillType: 'listening', data: {} }) // rỗng

    expect(getLatestDraft('u1')).toBeNull()
  })
})
