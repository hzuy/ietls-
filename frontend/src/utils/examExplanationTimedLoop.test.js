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
})
