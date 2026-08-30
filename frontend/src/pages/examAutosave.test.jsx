import { render, act, cleanup } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useExitGuard } from '../hooks/useExitGuard'
import { saveDraft, loadDraft, clearDraft, checkDraft, isDataEmpty } from '../services/draftService'

/**
 * Bảo vệ pattern autosave dùng chung ở Reading/Listening/Writing/Speaking exam runner.
 *
 * Bug đã sửa: effect autosave 30s từng có state hay đổi (timeLeft mỗi giây,
 * answers/essays/transcripts mỗi thao tác) trong dependency array → effect bị
 * teardown + setup lại liên tục → interval 30s không bao giờ đạt mốc để fire.
 *
 * Pattern đúng: interval effect deps chỉ [phase] (+previewMode/id), đọc state mới
 * nhất qua ref (sync mỗi render bằng 1 effect không deps).
 */

// Replica tối giản của pattern trong runner thật. `answers` do test truyền qua prop
// (mô phỏng người dùng gõ) — KHÔNG mutate prop/harness.
function MiniExam({ phase, onSave, onSetup, answers = {} }) {
  const [tick, setTick] = useState(0) // ~ đồng hồ đếm ngược: đổi mỗi giây

  // Đồng hồ 1s — deps [phase, tick] giống runner thật (tick ~ timeLeft)
  useEffect(() => {
    if (phase !== 'exam') return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [phase, tick])

  // Sync ref mỗi render → luôn phản ánh giá trị mới nhất tại thời điểm callback chạy
  const latestRef = useRef(null)
  useEffect(() => {
    latestRef.current = { answers, tick }
  })

  // Autosave: MỘT interval sống suốt phiên — deps CHỈ [phase]
  useEffect(() => {
    if (phase !== 'exam') return
    onSetup?.()
    const i = setInterval(() => onSave(latestRef.current), 30000)
    return () => clearInterval(i)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

describe('exam autosave pattern (deps=[phase], đọc state qua ref)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('interval setup đúng 1 lần và fire ~mỗi 30s dù đồng hồ tick mỗi giây', async () => {
    const onSave = vi.fn()
    const onSetup = vi.fn()
    await act(async () => { render(<MiniExam phase="exam" onSave={onSave} onSetup={onSetup} />) })

    for (let s = 0; s < 90; s++) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }

    expect(onSetup).toHaveBeenCalledTimes(1)  // KHÔNG teardown + setup lại
    expect(onSave.mock.calls.length).toBe(3)  // fire tại t=30s, 60s, 90s
  })

  it('fire vẫn đúng khi state đổi LIÊN TỤC (mô phỏng gõ không ngừng)', async () => {
    const onSave = vi.fn()
    const onSetup = vi.fn()
    let rerender
    await act(async () => {
      const r = render(<MiniExam phase="exam" onSave={onSave} onSetup={onSetup} answers={{}} />)
      rerender = r.rerender
    })

    for (let s = 0; s < 35; s++) {
      await act(async () => {
        rerender(<MiniExam phase="exam" onSave={onSave} onSetup={onSetup} answers={{ q1: `typing-${s}` }} />)
        vi.advanceTimersByTime(1000)
      })
    }

    expect(onSetup).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1) // đã qua mốc 30s
  })

  it('callback đọc GIÁ TRỊ MỚI NHẤT tại thời điểm fire (không stale closure)', async () => {
    const onSave = vi.fn()
    let rerender
    await act(async () => {
      const r = render(<MiniExam phase="exam" onSave={onSave} answers={{}} />)
      rerender = r.rerender
    })

    for (let s = 0; s < 29; s++) {
      await act(async () => {
        rerender(<MiniExam phase="exam" onSave={onSave} answers={{ q1: `old-${s}` }} />)
        vi.advanceTimersByTime(1000)
      })
    }
    await act(async () => {
      rerender(<MiniExam phase="exam" onSave={onSave} answers={{ q1: 'FINAL' }} />) // ngay trước mốc 30s
    })
    await act(async () => { vi.advanceTimersByTime(1000) })                          // chạm mốc 30s

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].answers).toEqual({ q1: 'FINAL' }) // không phải old-*
  })

  it('phase != exam → không setup interval, không fire', async () => {
    const onSave = vi.fn()
    const onSetup = vi.fn()
    await act(async () => { render(<MiniExam phase="start" onSave={onSave} onSetup={onSetup} />) })

    for (let s = 0; s < 60; s++) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }

    expect(onSetup).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('REGRESSION GUARD: state hay đổi trong deps interval → KHÔNG BAO GIỜ fire', async () => {
    // Mô phỏng chính xác bug đã sửa — test này phải luôn xanh để chặn tái phạm.
    function Broken({ onSave }) {
      const [tick, setTick] = useState(0)
      useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000)
        return () => clearInterval(t)
      }, [tick])
      useEffect(() => {
        const i = setInterval(() => onSave(), 30000)
        return () => clearInterval(i)
      }, [tick]) // ← BUG: state đổi mỗi giây trong deps → interval reset mỗi giây
      return null
    }
    const onSave = vi.fn()
    await act(async () => { render(<Broken onSave={onSave} />) })
    for (let s = 0; s < 90; s++) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }
    expect(onSave).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// useExitGuard.onBeforeExit — "lưu draft NGAY khi thoát bài"
// ─────────────────────────────────────────────────────────────────────────────

function GuardHarness({ enabled, onBeforeExit, onGuard }) {
  const g = useExitGuard(enabled, onBeforeExit)
  useEffect(() => { onGuard(g) }) // đưa API guard ra test qua callback (không mutate prop)
  return null
}

describe('useExitGuard(onBeforeExit) — lưu draft ngay tại điểm thoát', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  const flushDisarm = () => act(async () => { vi.advanceTimersByTime(300) })

  it('gọi onBeforeExit khi beforeunload (trước dialog gốc trình duyệt)', async () => {
    const onBeforeExit = vi.fn()
    let guard // eslint-disable-line no-unused-vars
    await act(async () => {
      render(<GuardHarness enabled onBeforeExit={onBeforeExit} onGuard={g => { guard = g }} />)
    })
    await act(async () => { window.dispatchEvent(new Event('beforeunload')) })
    expect(onBeforeExit).toHaveBeenCalledTimes(1)
  })

  it('gọi onBeforeExit khi leave() (Back/Forward → modal → "Thoát")', async () => {
    const onBeforeExit = vi.fn()
    let guard
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await act(async () => {
      render(<GuardHarness enabled onBeforeExit={onBeforeExit} onGuard={g => { guard = g }} />)
    })
    await act(async () => { guard.leave() })
    expect(onBeforeExit).toHaveBeenCalledTimes(1)
    expect(backSpy).toHaveBeenCalled() // vẫn thả điều hướng
  })

  it('gọi onBeforeExit khi disarm() (✕ → "Thoát" / nộp bài)', async () => {
    const onBeforeExit = vi.fn()
    let guard
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await act(async () => {
      render(<GuardHarness enabled onBeforeExit={onBeforeExit} onGuard={g => { guard = g }} />)
    })
    let resolved = false
    act(() => { guard.disarm().then(() => { resolved = true }) })
    expect(onBeforeExit).toHaveBeenCalledTimes(1) // chạy SYNC ngay đầu disarm()
    await flushDisarm()
    expect(resolved).toBe(true)
  })

  it('KHÔNG gọi onBeforeExit khi stay() (ở lại làm tiếp)', async () => {
    const onBeforeExit = vi.fn()
    let guard
    await act(async () => {
      render(<GuardHarness enabled onBeforeExit={onBeforeExit} onGuard={g => { guard = g }} />)
    })
    await act(async () => { guard.stay() })
    expect(onBeforeExit).not.toHaveBeenCalled()
  })

  it('lỗi trong onBeforeExit KHÔNG chặn leave()/disarm()', async () => {
    const onBeforeExit = vi.fn(() => { throw new Error('localStorage full') })
    let guard
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await act(async () => {
      render(<GuardHarness enabled onBeforeExit={onBeforeExit} onGuard={g => { guard = g }} />)
    })

    await act(async () => { guard.leave() })
    expect(backSpy).toHaveBeenCalled() // leave() vẫn hoàn tất dù throw

    let resolved = false
    act(() => { guard.disarm().then(() => { resolved = true }) })
    await flushDisarm()
    expect(resolved).toBe(true)         // disarm() vẫn resolve dù throw
    expect(onBeforeExit).toHaveBeenCalledTimes(2)
  })

  it('không truyền onBeforeExit → leave()/disarm() vẫn chạy bình thường', async () => {
    let guard
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await act(async () => {
      render(<GuardHarness enabled onGuard={g => { guard = g }} />)
    })
    await act(async () => { guard.leave() })
    let resolved = false
    act(() => { guard.disarm().then(() => { resolved = true }) })
    await flushDisarm()
    expect(backSpy).toHaveBeenCalled()
    expect(resolved).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// persistDraftNow (bản Writing/Reading) chạy trên draftService THẬT + localStorage
// ─────────────────────────────────────────────────────────────────────────────

describe('persistDraftNow — P3-2 khi lưu-ngay-khi-thoát', () => {
  beforeEach(() => localStorage.clear())

  // Bản sao logic persistDraftNow (Writing) — dùng draftService thật
  const makeWritingPersist = (getData, userId, examId) => () => {
    const data = getData()
    if (isDataEmpty(data)) {
      const existing = loadDraft(userId, examId, 'writing')
      if (existing && !isDataEmpty(existing.data)) return
    }
    saveDraft({ userId, examId, skillType: 'writing', data, timeRemaining: null })
  }

  it('content RỖNG → KHÔNG ghi đè draft cũ không rỗng', () => {
    saveDraft({ userId: 'u1', examId: '10', skillType: 'writing',
      data: { essays: { 5: 'bài đã gõ' }, submittedTaskIds: [] }, timeRemaining: 1000 })
    const persist = makeWritingPersist(() => ({ essays: {}, submittedTaskIds: [] }), 'u1', '10')
    persist()
    expect(loadDraft('u1', '10', 'writing').data)
      .toEqual({ essays: { 5: 'bài đã gõ' }, submittedTaskIds: [] })
    expect(checkDraft('u1', '10', 'writing').hasDraft).toBe(true)
  })

  it('content CÓ → ghi đè bình thường', () => {
    saveDraft({ userId: 'u1', examId: '10', skillType: 'writing',
      data: { essays: { 5: 'cũ' }, submittedTaskIds: [] }, timeRemaining: 1000 })
    const persist = makeWritingPersist(() => ({ essays: { 5: 'MỚI' }, submittedTaskIds: [] }), 'u1', '10')
    persist()
    expect(loadDraft('u1', '10', 'writing').data.essays).toEqual({ 5: 'MỚI' })
  })

  it('content rỗng + KHÔNG có draft cũ → checkDraft vẫn hasDraft:false', () => {
    const persist = makeWritingPersist(() => ({ essays: {}, submittedTaskIds: [] }), 'u1', '10')
    persist()
    expect(checkDraft('u1', '10', 'writing').hasDraft).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Thứ tự doSubmit (Reading/Listening): disarm() → clearDraft() → net = draft bị xoá
// ─────────────────────────────────────────────────────────────────────────────

describe('nộp bài R/L: disarm() rồi clearDraft() → draft KHÔNG sống lại', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  const U = 'u1', E = '20', SKILL = 'reading'

  // Bản sao persistDraftNow (Reading) — answers lúc nộp là { q1: 'A' }
  const persistOnSubmit = vi.fn(() => {
    saveDraft({ userId: U, examId: E, skillType: SKILL, data: { q1: 'A' }, timeRemaining: 500 })
  })

  it('thứ tự ĐÚNG (disarm trước, clearDraft sau) → loadDraft = null', async () => {
    persistOnSubmit.mockClear()
    saveDraft({ userId: U, examId: E, skillType: SKILL, data: { q1: 'A' }, timeRemaining: 500 }) // draft từ autosave
    let guard
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await act(async () => {
      render(<GuardHarness enabled onBeforeExit={persistOnSubmit} onGuard={g => { guard = g }} />)
    })

    // mô phỏng doSubmit đã sửa: await disarm()  →  clearDraft()
    let done = false
    act(() => { guard.disarm().then(() => { done = true }) })
    expect(persistOnSubmit).toHaveBeenCalledTimes(1) // persist chạy sync trong disarm
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(done).toBe(true)
    clearDraft(U, E, SKILL) // SAU disarm

    expect(loadDraft(U, E, SKILL)).toBeNull() // draft đã xoá, không sống lại
  })

  it('đối chứng — thứ tự SAI (clearDraft trước, disarm sau) → draft SỐNG LẠI', () => {
    persistOnSubmit.mockClear()
    saveDraft({ userId: U, examId: E, skillType: SKILL, data: { q1: 'A' }, timeRemaining: 500 })
    clearDraft(U, E, SKILL)      // clearDraft TRƯỚC (bug cũ)
    persistOnSubmit()            // disarm → persist chạy SAU khi đã clear
    expect(loadDraft(U, E, SKILL)).not.toBeNull() // ← draft mồ côi cho bài đã nộp
  })
})
