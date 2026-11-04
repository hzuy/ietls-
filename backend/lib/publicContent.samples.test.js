import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  writingSample: { findMany: vi.fn(), count: vi.fn() },
  speakingSample: { findMany: vi.fn(), count: vi.fn() },
}

const prismaPath = require.resolve('./prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }
const { listSamplePage } = require('./publicContent')
const { clearAll } = require('./swrCache')

describe('publicContent.listSamplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAll()
    prismaMock.writingSample.findMany.mockImplementation(async args => args.distinct
      ? [{ examType: 'Opinion essay' }, { examType: null }, { examType: 'Bar chart' }]
      : [{ id: 13, title: 'A sample', tags: '["education"]' }])
    prismaMock.writingSample.count.mockResolvedValue(25)
    prismaMock.speakingSample.findMany.mockResolvedValue([])
    prismaMock.speakingSample.count.mockResolvedValue(0)
  })

  it('queries a bounded page, filters by title/level/type, sorts, and returns total metadata', async () => {
    const result = await listSamplePage('writing', {
      page: 2, pageSize: 12, search: 'education', level: 'task2', examType: 'Opinion essay', sort: 'title-asc',
    })

    const pageQuery = prismaMock.writingSample.findMany.mock.calls.find(([args]) => !args.distinct)[0]
    expect(pageQuery.where).toEqual({
      deletedAt: null,
      level: 'task2',
      examType: 'Opinion essay',
      title: { contains: 'education', mode: 'insensitive' },
    })
    expect(pageQuery.skip).toBe(12)
    expect(pageQuery.take).toBe(12)
    expect(pageQuery.orderBy).toEqual([{ title: 'asc' }, { id: 'desc' }])
    expect(result.items[0].tags).toEqual(['education'])
    expect(result.pagination).toEqual({ page: 2, pageSize: 12, total: 25, totalPages: 3 })
    expect(result.examTypes).toEqual(['Bar chart', 'Opinion essay'])
  })

  it('selects the Speaking model and defaults to newest first', async () => {
    await listSamplePage('speaking', { page: 1, pageSize: 12 })
    expect(prismaMock.speakingSample.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 12,
    }))
    expect(prismaMock.writingSample.findMany).not.toHaveBeenCalled()
  })
})
