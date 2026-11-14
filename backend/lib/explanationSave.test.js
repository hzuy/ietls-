import { describe, expect, it, vi } from 'vitest'
const { saveExplanationBatch, explanationFailureResponse } = require('./explanationSave')
describe('explanation save failure contract', () => {
  it('caps waiting and transaction runtime within the 48-second request deadline', async () => {
    const now = Date.now()
    const prisma = { $transaction: vi.fn(async (fn, options) => {
      expect(options.maxWait + options.timeout).toBeLessThanOrEqual(7500)
      return fn({})
    }) }
    await expect(saveExplanationBatch(prisma, async () => 'saved', { startTime: now - 40000, target: 'test fixture' })).resolves.toBe('saved')
  })
  it('exposes a structured saving error without raw database details', async () => {
    const prisma = { $transaction: vi.fn().mockRejectedValue(Object.assign(new Error('SQL and private details'), { code: 'P2028' })) }
    const error = await saveExplanationBatch(prisma, async () => {}, { startTime: Date.now(), target: 'fixture' }).catch(e => e)
    const response = explanationFailureResponse(error)
    expect(response).toMatchObject({ status: 503, body: { code: 'AI_SAVE_FAILED', phase: 'saving', causeCode: 'P2028', generatedCount: 0 } })
    expect(JSON.stringify(response)).not.toContain('private details')
  })
  it('does not open a transaction if the request has no time left to save', async () => {
    const prisma = { $transaction: vi.fn() }
    await expect(saveExplanationBatch(prisma, async () => {}, { startTime: Date.now() - 48000, target: 'fixture' }))
      .rejects.toMatchObject({ code: 'AI_SAVE_FAILED', causeCode: 'AI_SAVE_BUDGET' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
