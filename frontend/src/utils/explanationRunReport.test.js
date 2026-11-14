import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  RUN_KINDS,
  makeRunReportKey,
  extractQuestionNumbers,
  classifyRunError,
  createRunReport,
  createBlockedReport,
  addRunOutcome, updateRunProgress, getRunProgress, redactRunTechnical, eligibleExplanationNumbers,
  finishRunReport,
  getRunReportCounts,
  retryableNumbers,
  saveRunReport,
  loadRunReport,
  clearRunReport,
  copyRunReportText,
} from './explanationRunReport'

const group = {
  id: 201,
  qNumberStart: 1,
  qNumberEnd: 2,
  questions: [
    { number: 1, correctAnswer: 'TRUE' },
    { number: 2, correctAnswer: 'FALSE' },
  ],
}

describe('explanationRunReport', () => {
  it('counts only eligible questions when protected explanations are kept', () => {
    const protectedGroup = { questions: [
      { number: 1, explanation: { status: 'teacher_reviewed' } },
      { number: 2 }, { number: 3, explanation: { status: 'teacher_edited' } },
    ] }
    expect(eligibleExplanationNumbers(protectedGroup)).toEqual([2])
    expect(eligibleExplanationNumbers(protectedGroup, { overwriteProtected: true })).toEqual([1, 2, 3])
    expect(eligibleExplanationNumbers(protectedGroup, { resolveChoices: { 1: 'input' } })).toEqual([1, 2])
  })
  it('replaces provisional chunks with final counts without counting generation twice', () => {
    const initial = createRunReport({ examId: 10, totalQuestions: 3 })
    const first = updateRunProgress(initial, { group, sentNumbers: [1, 2, 3], data: {
      generatedCount: 1, remainingQuestionNumbers: [3], errors: [{ number: 2, code: 'AI_QUESTION_TIMEOUT', message: 'timeout' }],
    } })
    expect(first.generated).toBe(1)
    expect(first.rows[0].message).toMatch(/quá lâu/)
    expect(getRunProgress(first)).toMatchObject({ processed: 2, remaining: 1, percent: 67 })
    const second = updateRunProgress(first, { group, sentNumbers: [1, 2, 3], data: { generatedCount: 1, remainingQuestionNumbers: [] } })
    const final = addRunOutcome(second, { group, sentNumbers: [1, 2, 3], loopResult: { totalGenerated: 2,
      errors: [{ number: 2, message: 'timeout' }], remainingQuestionNumbers: [] } })
    expect(final.generated).toBe(2)
    expect(final.finishedGroups).toBe(1)
    expect(getRunProgress(final)).toMatchObject({ processed: 3, remaining: 0, percent: 100 })
  })

  it('retains errors outside a scoped retry without adding them to its progress', () => {
    const old = addRunOutcome(createRunReport({ examId: 10, totalQuestions: 3 }), { group, sentNumbers: [1, 2, 3],
      loopResult: { errors: [{ number: 2, message: 'timeout' }, { number: 3, message: 'timeout' }] } })
    const retry = createRunReport({ examId: 10, scope: 'retry', totalQuestions: 1, questionNumbers: [2], previousReport: old })
    expect(retry.rows.map(row => row.number)).toEqual([3])
    expect(getRunProgress(retry)).toMatchObject({ processed: 0, remaining: 1 })
    const final = addRunOutcome(retry, { group, sentNumbers: [2], loopResult: { totalGenerated: 1 } })
    expect(final.rows.map(row => row.number)).toEqual([3])
    expect(getRunProgress(final)).toMatchObject({ processed: 1, remaining: 0 })
  })

  it('does not count a service failure affecting queued questions as processed questions', () => {
    const report = addRunOutcome(createRunReport({ examId: 10, totalQuestions: 3 }), {
      group, sentNumbers: [1, 2, 3], loopResult: { totalGenerated: 1, remainingQuestionNumbers: [2, 3], errors: [{ status: 429, message: 'quota' }] },
    })
    expect(report.rows).toHaveLength(2)
    expect(getRunProgress(report)).toMatchObject({ processed: 1, remaining: 2 })
  })

  it('redacts credentials before storing or copying a provider error', () => {
    const raw = 'Gemini https://example.com?key=private-key Bearer secret-token postgresql://user:pass@host/db'
    const error = classifyRunError({ message: raw })
    expect(error.technical).not.toMatch(/private-key|secret-token|user:pass/)
    expect(redactRunTechnical(raw)).toContain('[đã ẩn]')
  })
  it('identifies a numbered AI deadline as timeout rather than a generic provider outage', () => {
    expect(classifyRunError({ number: 1, status: 504, code: 'AI_QUESTION_TIMEOUT', message: 'AI xử lý câu 1 quá 20 giây nên đã dừng yêu cầu.' }))
      .toMatchObject({ kind: RUN_KINDS.TIMEOUT, retryable: true })
  })
  it('retries only unfinished questions after a group-level timeout', () => {
    const report = addRunOutcome(createRunReport({ examId: 10, skill: 'reading' }), {
      group, sentNumbers: [1, 2],
      loopResult: { totalGenerated: 1, remainingQuestionNumbers: [2], errors: [{ message: 'timeout' }] },
    })
    expect(retryableNumbers(report)).toEqual([2])
    expect(report.rows[0].number).toBe(2)
  })

  it('offers all sent questions when the first request fails without a response', () => {
    const report = addRunOutcome(createRunReport({ examId: 10, skill: 'reading' }), {
      group, sentNumbers: [1, 2], loopResult: { errors: [{ status: 503, message: 'Unavailable' }] },
    })
    expect(retryableNumbers(report)).toEqual([1, 2])
  })
  it('preserves native Error messages when expanding a group failure', () => {
    const report = addRunOutcome(createRunReport({ examId: 10, skill: 'reading' }), {
      group, loopResult: { errors: [new Error('timeout')] },
    })
    expect(report.rows[0].kind).toBe(RUN_KINDS.TIMEOUT)
    expect(report.rows[0].technical).toBe('timeout')
  })
  beforeEach(() => {
    sessionStorage.clear()
    vi.useRealTimers()
  })

  it('builds a stable session-scoped key per skill and exam', () => {
    expect(makeRunReportKey('reading', 10)).toBe('ai_exp_report_reading_10')
    expect(makeRunReportKey('listening', 20)).toBe('ai_exp_report_listening_20')
  })

  it('extracts question numbers from a Vietnamese message', () => {
    expect(extractQuestionNumbers('Các câu 12, 13, 14 chưa có đáp án đúng.')).toEqual([12, 13, 14])
    expect(extractQuestionNumbers('Không có số nào')).toEqual([])
  })

  it('classifies infrastructure failures without leaking raw text into the main message', () => {
    const busy = classifyRunError({ response: { status: 409, data: { message: 'Đang có tác vụ khác' } } })
    expect(busy.kind).toBe(RUN_KINDS.BUSY)
    expect(busy.retryable).toBe(true)
    expect(busy.technical).toBe('Đang có tác vụ khác')

    const rateLimited = classifyRunError({
      response: { status: 429, data: { message: '429 Too Many Requests from provider gemini' } },
    })
    expect(rateLimited.kind).toBe(RUN_KINDS.RATE_LIMITED)
    expect(rateLimited.message).not.toMatch(/gemini|429/i)

    const missingAnswer = classifyRunError({ message: 'Câu 5, 6 chưa có đáp án đúng nên không thể giải thích.' })
    expect(missingAnswer.kind).toBe(RUN_KINDS.MISSING_ANSWER)
    expect(missingAnswer.retryable).toBe(false)
    expect(missingAnswer.questionNumbers).toEqual([5, 6])
    expect(missingAnswer.message).toContain('5, 6')
  })

  it('never throws for unknown error shapes', () => {
    for (const input of [null, undefined, 'boom', new Error('boom'), { status: 500 }]) {
      const info = classifyRunError(input)
      expect(Object.values(RUN_KINDS)).toContain(info.kind)
      expect(typeof info.message).toBe('string')
    }
  })

  it('creates a blocked report when validation fails', () => {
    const report = createBlockedReport({
      examId: 10,
      skill: 'reading',
      message: 'Có 2 lỗi cần sửa trước khi sinh giải thích.',
      details: ['Thiếu đáp án câu 1', 'Thiếu đáp án câu 2'],
    })
    expect(report.status).toBe('blocked')
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0].technical).toContain('Thiếu đáp án câu 1')
    const counts = getRunReportCounts(report)
    expect(counts.errors).toBe(1)
    expect(counts.retryable).toBe(0)
  })

  it('aggregates a group outcome: generated count, errors and needs-retry markers', () => {
    const report = createRunReport({ examId: 10, skill: 'reading', totalGroups: 2, totalQuestions: 4 })
    const next = addRunOutcome(report, {
      group,
      sentNumbers: [1, 2],
      loopResult: {
        totalGenerated: 1,
        errors: [{ number: 2, message: 'AI phản hồi quá lâu (timeout)' }],
        needsRetryQuestions: [{ number: 1, reason: 'Kết quả dự phòng' }],
      },
    })

    expect(next).not.toBe(report) // không mutate đầu vào
    expect(report.rows).toHaveLength(0)
    expect(next.finishedGroups).toBe(1)
    expect(next.generated).toBe(1)

    const counts = getRunReportCounts(next)
    expect(counts.errors).toBe(1)
    expect(counts.retryable).toBe(1)
    expect(counts.needsRetry).toBe(1)
    expect(retryableNumbers(next)).toEqual([2])
  })

  it('marks partial vs done vs cancelled status', () => {
    const base = createRunReport({ examId: 10, skill: 'reading', totalQuestions: 2 })

    const done = finishRunReport(base)
    expect(done.status).toBe('done')

    const partial = finishRunReport(addRunOutcome(base, {
      group,
      loopResult: { totalGenerated: 0, errors: [{ number: 1, message: 'lỗi' }] },
    }))
    expect(partial.status).toBe('partial')

    expect(finishRunReport(base, { cancelled: true }).status).toBe('cancelled')
  })

  it('round-trips a report through sessionStorage and expires after 24h', () => {
    const key = makeRunReportKey('reading', 10)
    const report = createRunReport({ examId: 10, skill: 'reading', totalQuestions: 2 })

    saveRunReport(key, report)
    expect(loadRunReport(key)).toMatchObject({ examId: 10, totalQuestions: 2 })

    // Báo cáo "đang chạy" khi nạp lại = tab trước đã đóng.
    expect(loadRunReport(key).status).toBe('interrupted')

    const stale = { ...report, status: 'partial', savedAt: Date.now() - 25 * 60 * 60 * 1000 }
    sessionStorage.setItem(key, JSON.stringify(stale))
    expect(loadRunReport(key)).toBeNull()
    expect(sessionStorage.getItem(key)).toBeNull()

    clearRunReport(key)
    expect(loadRunReport(key)).toBeNull()
  })

  it('ignores corrupt stored reports instead of crashing', () => {
    const key = makeRunReportKey('reading', 10)
    sessionStorage.setItem(key, '{not json')
    expect(loadRunReport(key)).toBeNull()
    expect(loadRunReport(null)).toBeNull()
  })

  it('produces a plain-text report that includes causes and technical details', () => {
    const report = finishRunReport(addRunOutcome(
      createRunReport({ examId: 10, skill: 'reading', totalQuestions: 2 }),
      {
        group,
        loopResult: {
          totalGenerated: 1,
          errors: [{ number: 2, message: 'AI phản hồi quá lâu' }],
          needsRetryQuestions: [{ number: 1, reason: 'Kết quả dự phòng' }],
        },
      }
    ))

    const text = copyRunReportText(report)
    expect(text).toContain('Báo cáo sinh giải thích AI')
    expect(text).toContain('Câu 2')
    expect(text).toContain('AI phản hồi quá lâu')
    expect(text).toContain('cần kiểm tra lại')
  })
})
