import { render, act, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { usePracticeDraft } from './usePracticeDraft'
import { saveDraft, loadDraft } from '../services/draftService'

/**
 * Bảo vệ hook autosave/resume dùng chung cho màn làm bài luyện tập lẻ
 * (PracticeExamPage → ReadingPracticeExam / ListeningPracticeExam).
 *
 * Trọng tâm:
 *  - interval 30s setup ĐÚNG 1 LẦN, fire đều dù answers/timeLeft đổi mỗi render
 *    (bug "interval teardown mỗi giây" đã sửa ở 4 skill chính — không tái phạm).
 *  - guard P3-2: đáp án rỗng không đè draft cũ còn nội dung.
 *  - namespace 'practice-*' KHÔNG đụng key của skill chính cùng examId.
 *  - resume: checkDraftOnMount trả data + markSaved đồng bộ hasUnsavedChanges.
 */

// Harness: render hook, đẩy API + giá trị ra test qua onState (KHÔNG mutate prop).
function Harness({ examId = 16, skillType = 'practice-reading', answers = {}, timeLeft = 1200, userId = 'u1', enabled = false, onState }) {
  const api = usePracticeDraft({ examId, skillType, answers, timeLeft, userId, enabled })
  useEffect(() => { onState?.(api) })
  return null
}

describe('usePracticeDraft — interval autosave (deps ổn định, đọc state qua ref)', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('enabled=true → draft được ghi ~mỗi 30s; interval KHÔNG teardown liên tục', async () => {
    let rerender
    await act(async () => {
      const r = render(<Harness enabled answers={{ q1: 'A' }} timeLeft={1200} />)
      rerender = r.rerender
    })

    // Mô phỏng đồng hồ đếm ngược: rerender với timeLeft giảm mỗi giây trong 95s.
    // rerender và advance tách 2 act → effect sync ref flush xong trước khi timer fire.
    for (let s = 1; s <= 95; s++) {
      await act(async () => { rerender(<Harness enabled answers={{ q1: 'A' }} timeLeft={1200 - s} />) })
      await act(async () => { vi.advanceTimersByTime(1000) })
    }

    const draft = loadDraft('u1', 16, 'practice-reading')
    expect(draft).not.toBeNull()
    // Fire tại t=30/60/90s → lần cuối đọc timeLeft của render s=90 = 1200-90 = 1110
    expect(draft.timeRemaining).toBe(1110)
    expect(draft.data).toEqual({ q1: 'A' })
  })

  it('callback đọc GIÁ TRỊ MỚI NHẤT tại thời điểm fire (không stale closure)', async () => {
    let rerender
    await act(async () => {
      const r = render(<Harness enabled answers={{ q1: 'old' }} timeLeft={1200} />)
      rerender = r.rerender
    })
    for (let s = 1; s <= 29; s++) {
      await act(async () => {
        rerender(<Harness enabled answers={{ q1: `old-${s}` }} timeLeft={1200 - s} />)
        vi.advanceTimersByTime(1000)
      })
    }
    await act(async () => {
      rerender(<Harness enabled answers={{ q1: 'FINAL' }} timeLeft={1170} />) // ngay trước mốc 30s
    })
    await act(async () => { vi.advanceTimersByTime(1000) }) // chạm 30s

    expect(loadDraft('u1', 16, 'practice-reading').data).toEqual({ q1: 'FINAL' })
  })

  it('enabled=false → KHÔNG ghi draft dù thời gian trôi', async () => {
    let rerender
    await act(async () => {
      const r = render(<Harness enabled={false} answers={{ q1: 'A' }} />)
      rerender = r.rerender
    })
    for (let s = 1; s <= 90; s++) {
      await act(async () => {
        rerender(<Harness enabled={false} answers={{ q1: 'A' }} timeLeft={1200 - s} />)
        vi.advanceTimersByTime(1000)
      })
    }
    expect(loadDraft('u1', 16, 'practice-reading')).toBeNull()
  })

  it('userId falsy → hook bất hoạt, không ghi gì', async () => {
    await act(async () => { render(<Harness enabled answers={{ q1: 'A' }} userId={null} />) })
    await act(async () => { vi.advanceTimersByTime(60000) })
    expect(localStorage.length).toBe(0)
  })
})

describe('usePracticeDraft — persistDraftNow + guard P3-2', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('đáp án rỗng + có draft cũ không rỗng → KHÔNG ghi đè', async () => {
    saveDraft({ userId: 'u1', examId: 16, skillType: 'practice-reading', data: { q1: 'đã làm' }, timeRemaining: 900 })
    let api
    await act(async () => { render(<Harness answers={{}} onState={a => { api = a }} />) })

    act(() => { api.persistDraftNow() })

    expect(loadDraft('u1', 16, 'practice-reading').data).toEqual({ q1: 'đã làm' })
  })

  it('đáp án có nội dung → ghi đè bình thường', async () => {
    saveDraft({ userId: 'u1', examId: 16, skillType: 'practice-reading', data: { q1: 'cũ' }, timeRemaining: 900 })
    let api
    await act(async () => { render(<Harness answers={{ q1: 'MỚI', q2: 'B' }} timeLeft={800} onState={a => { api = a }} />) })

    act(() => { api.persistDraftNow() })

    const d = loadDraft('u1', 16, 'practice-reading')
    expect(d.data).toEqual({ q1: 'MỚI', q2: 'B' })
    expect(d.timeRemaining).toBe(800)
  })

  it('đáp án rỗng + KHÔNG có draft cũ → vẫn không tạo draft "ma"', async () => {
    let api
    await act(async () => { render(<Harness answers={{}} onState={a => { api = a }} />) })
    act(() => { api.persistDraftNow() })
    expect(api.checkDraftOnMount().hasDraft).toBe(false)
  })
})

describe('usePracticeDraft — namespace practice-* không đụng skill chính', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('examId=19 trùng cả PracticeExam lẫn Exam(listening) → 2 key độc lập', async () => {
    // Draft của bài thi Listening CHÍNH id 19 (skillType 'listening')
    saveDraft({ userId: 'u1', examId: 19, skillType: 'listening', data: { 1: 'main-answer' }, timeRemaining: 500 })

    let api
    await act(async () => {
      render(<Harness examId={19} skillType="practice-listening" answers={{ 1: 'practice-answer' }} timeLeft={600} onState={a => { api = a }} />)
    })
    act(() => { api.persistDraftNow() })

    // 2 draft cùng tồn tại, không đè nhau
    expect(loadDraft('u1', 19, 'listening').data).toEqual({ 1: 'main-answer' })
    expect(loadDraft('u1', 19, 'practice-listening').data).toEqual({ 1: 'practice-answer' })
    expect(localStorage.getItem('ielts_draft_u1_19_listening')).not.toBeNull()
    expect(localStorage.getItem('ielts_draft_u1_19_practice-listening')).not.toBeNull()
  })
})

describe('usePracticeDraft — checkDraftOnMount / hasUnsavedChanges / markSaved / clearDraft', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('checkDraftOnMount trả savedAt + timeRemaining + data khi có draft', async () => {
    saveDraft({ userId: 'u1', examId: 16, skillType: 'practice-reading', data: { q1: 'A', q2: 'B' }, timeRemaining: 742 })
    let api
    await act(async () => { render(<Harness onState={a => { api = a }} />) })

    const d = api.checkDraftOnMount()
    expect(d.hasDraft).toBe(true)
    expect(d.timeRemaining).toBe(742)
    expect(d.data).toEqual({ q1: 'A', q2: 'B' })
    expect(typeof d.savedAt).toBe('string')
  })

  it('checkDraftOnMount → hasDraft:false khi draft rỗng nội dung', async () => {
    saveDraft({ userId: 'u1', examId: 16, skillType: 'practice-reading', data: {}, timeRemaining: 100 })
    let api
    await act(async () => { render(<Harness onState={a => { api = a }} />) })
    expect(api.checkDraftOnMount().hasDraft).toBe(false)
  })

  it('hasUnsavedChanges: false lúc đầu → true khi answers đổi → false sau persist', async () => {
    let api, rerender
    await act(async () => {
      const r = render(<Harness answers={{}} onState={a => { api = a }} />)
      rerender = r.rerender
    })
    expect(api.hasUnsavedChanges).toBe(false)

    await act(async () => { rerender(<Harness answers={{ q1: 'A' }} onState={a => { api = a }} />) })
    expect(api.hasUnsavedChanges).toBe(true)

    await act(async () => { api.persistDraftNow() })
    await act(async () => { rerender(<Harness answers={{ q1: 'A' }} onState={a => { api = a }} />) })
    expect(api.hasUnsavedChanges).toBe(false)
  })

  it('markSaved đồng bộ snapshot (guard không nổ nhầm sau resume) + set lastSavedAt', async () => {
    const savedAt = '2026-09-03T08:15:00.000Z'
    let api, rerender
    await act(async () => {
      const r = render(<Harness answers={{}} onState={a => { api = a }} />)
      rerender = r.rerender
    })
    // resume: caller prefill answers + gọi markSaved với chính bộ đó
    await act(async () => {
      api.markSaved({ q1: 'resumed', q2: 'x' }, savedAt)
      rerender(<Harness answers={{ q1: 'resumed', q2: 'x' }} onState={a => { api = a }} />)
    })
    expect(api.hasUnsavedChanges).toBe(false)
    expect(api.lastSavedAt).toBeInstanceOf(Date)
    expect(api.lastSavedAt.toISOString()).toBe(savedAt)
  })

  it('clearDraft xoá key + reset lastSavedAt về null', async () => {
    saveDraft({ userId: 'u1', examId: 16, skillType: 'practice-reading', data: { q1: 'A' }, timeRemaining: 900 })
    let api, rerender
    await act(async () => {
      const r = render(<Harness answers={{ q1: 'A' }} onState={a => { api = a }} />)
      rerender = r.rerender
    })
    await act(async () => { api.persistDraftNow() })
    await act(async () => { api.clearDraft() })
    await act(async () => { rerender(<Harness answers={{ q1: 'A' }} onState={a => { api = a }} />) })

    expect(loadDraft('u1', 16, 'practice-reading')).toBeNull()
    expect(api.lastSavedAt).toBeNull()
  })
})
