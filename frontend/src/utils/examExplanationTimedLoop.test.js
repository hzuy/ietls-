import { describe, it, expect, vi } from 'vitest'
import { executeTimedAIGenerationLoop } from './examExplanationUtils'

describe('executeTimedAIGenerationLoop', () => {
  it('loops until remainingQuestionNumbers is empty and aggregates results', async () => {
    const fetchChunk = vi.fn()
      // First chunk: returns 3 generated, 2 remaining
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 3,
        totalQuestions: 5,
        remainingQuestionNumbers: [4, 5],
        conflicts: [],
      })
      // Second chunk: returns 2 generated, 0 remaining
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 2,
        totalQuestions: 5,
        remainingQuestionNumbers: [],
        conflicts: [],
      })

    const onProgress = vi.fn()
    const onChunkSuccess = vi.fn()

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
      basePayload: { force: true },
      onProgress,
      onChunkSuccess,
    })

    expect(fetchChunk).toHaveBeenCalledTimes(2)
    // First call passed questionNumbers: null
    expect(fetchChunk).toHaveBeenNthCalledWith(1, { force: true, questionNumbers: null }, { signal: null })
    // Second call passed remaining questions [4, 5]
    expect(fetchChunk).toHaveBeenNthCalledWith(2, { force: true, questionNumbers: [4, 5] }, { signal: null })

    expect(result.ok).toBe(true)
    expect(result.totalGenerated).toBe(5)
    expect(result.totalQuestions).toBe(5)
    expect(result.cancelled).toBe(false)
    expect(result.hasConflicts).toBe(false)

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({ current: 3, total: 5, remainingCount: 2 }))
    expect(onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({ current: 5, total: 5, remainingCount: 0 }))

    expect(onChunkSuccess).toHaveBeenCalledTimes(2)
  })

  it('stops immediately when aborted via AbortSignal', async () => {
    const abortController = new AbortController()

    const fetchChunk = vi.fn().mockImplementation(async () => {
      // User clicks cancel during chunk 1
      abortController.abort()
      return {
        ok: true,
        generatedCount: 2,
        totalQuestions: 6,
        remainingQuestionNumbers: [3, 4, 5, 6],
      }
    })

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
      signal: abortController.signal,
    })

    expect(fetchChunk).toHaveBeenCalledTimes(1)
    expect(result.cancelled).toBe(true)
    expect(result.totalGenerated).toBe(2)
  })

  it('accumulates conflicts across multiple chunks into a single list', async () => {
    const conflictQ1 = { number: 1, inputAnswer: 'A', aiAnswer: 'B' }
    const conflictQ3 = { number: 3, inputAnswer: 'C', aiAnswer: 'D' }

    const fetchChunk = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        hasConflicts: true,
        generatedCount: 2,
        totalQuestions: 4,
        remainingQuestionNumbers: [3, 4],
        conflicts: [conflictQ1],
      })
      .mockResolvedValueOnce({
        ok: false,
        hasConflicts: true,
        generatedCount: 2,
        totalQuestions: 4,
        remainingQuestionNumbers: [],
        conflicts: [conflictQ3],
      })

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
    })

    expect(result.hasConflicts).toBe(true)
    expect(result.conflicts).toHaveLength(2)
    expect(result.conflicts[0].number).toBe(1)
    expect(result.conflicts[1].number).toBe(3)
  })

  it('Requirement 3.3(a): stops and reports Vietnamese error when 2 consecutive requests make no progress', async () => {
    const fetchChunk = vi.fn()
      // Request 1: generates 1, remaining [2, 3]
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 1,
        totalQuestions: 3,
        remainingQuestionNumbers: [2, 3],
      })
      // Request 2: generates 0, remaining still [2, 3] (stall 1)
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 0,
        totalQuestions: 3,
        remainingQuestionNumbers: [2, 3],
      })
      // Request 3: generates 0, remaining still [2, 3] (stall 2 -> must break)
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 0,
        totalQuestions: 3,
        remainingQuestionNumbers: [2, 3],
      })

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
    })

    expect(fetchChunk).toHaveBeenCalledTimes(3)
    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('AI không phản hồi hoặc không có tiến triển')
    expect(result.totalGenerated).toBe(1)
  })

  it('Requirement 3.3(b): limits loop execution to maximum iterations (e.g. maxIterations = 20)', async () => {
    const fetchChunk = vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      generatedCount: 1,
      totalQuestions: 100,
      remainingQuestionNumbers: [20, 21, 22],
    }))

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
      maxIterations: 5,
    })

    expect(fetchChunk).toHaveBeenCalledTimes(5)
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toContain('Đã đạt giới hạn tối đa 5 vòng')
  })

  it('Requirement 3.3(c): treats request as complete without error if legacy backend does not return remainingQuestionNumbers', async () => {
    const fetchChunk = vi.fn().mockResolvedValueOnce({
      ok: true,
      generatedCount: 4,
      totalQuestions: 4,
      // remainingQuestionNumbers is undefined (legacy backend)
    })

    const onProgress = vi.fn()
    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
      onProgress,
    })

    expect(fetchChunk).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    expect(result.totalGenerated).toBe(4)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      current: 4,
      total: 4,
      remainingCount: 0,
    }))
  })

  it('Requirement 3.3(d): handles 409 Conflict with Vietnamese message and stops without retrying', async () => {
    const error409 = new Error('Request failed with status code 409')
    error409.response = {
      status: 409,
      data: {
        message: 'Hệ thống đang tạo giải thích AI cho đề thi này ở phiên khác. Vui lòng chờ vài giây rồi thử lại.',
      },
    }

    const fetchChunk = vi.fn().mockRejectedValueOnce(error409)

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
    })

    expect(fetchChunk).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].status).toBe(409)
    expect(result.errors[0].message).toContain('Hệ thống đang tạo giải thích AI cho đề thi này ở phiên khác')
  })

  it('Requirement 3.3(e): tracks needsRetryQuestions from backend fallback safety (Phan 1)', async () => {
    const fetchChunk = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 1,
        totalQuestions: 2,
        remainingQuestionNumbers: [2],
        needsRetryQuestions: [{ number: 1, reason: 'AI chính đang bận, kết quả dự phòng chưa đủ tin cậy, hãy thử lại sau' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        generatedCount: 1,
        totalQuestions: 2,
        remainingQuestionNumbers: [],
      })

    const result = await executeTimedAIGenerationLoop({
      fetchChunk,
    })

    expect(result.needsRetryCount).toBe(1)
    expect(result.needsRetryQuestions).toHaveLength(1)
    expect(result.needsRetryQuestions[0].number).toBe(1)
  })
})
