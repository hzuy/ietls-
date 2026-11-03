import { describe, it, expect, vi } from 'vitest'

const { normalizeTitle, findTitleConflict } = require('./titleConflict')

describe('title conflict normalization', () => {
  it('trims, collapses whitespace, applies compatibility normalization and case folding', () => {
    expect(normalizeTitle('  Ｃambridge   18 ')).toBe('cambridge 18')
  })

  it('detects normalized conflicts and excludes the edited record', async () => {
    const model = { findMany: vi.fn().mockResolvedValue([
      { id: 1, title: 'Reading   Test 1' },
      { id: 2, title: 'Other title' },
    ]) }
    await expect(findTitleConflict(model, ' reading test 1 ')).resolves.toEqual({ id: 1, title: 'Reading   Test 1' })
    await expect(findTitleConflict(model, 'READING TEST 1', {}, 1)).resolves.toBeNull()
  })
})
