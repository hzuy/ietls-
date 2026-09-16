import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  user: {
    count: vi.fn().mockResolvedValue(100),
    findMany: vi.fn().mockResolvedValue([])
  },
  attempt: {
    count: vi.fn().mockResolvedValue(50),
    aggregate: vi.fn().mockResolvedValue({ _avg: { score: 6.5 } }),
    groupBy: vi.fn().mockResolvedValue([]),
    findMany: vi.fn().mockResolvedValue([])
  },
  exam: {
    count: vi.fn().mockResolvedValue(20),
    findMany: vi.fn().mockResolvedValue([])
  },
  $queryRaw: vi.fn().mockImplementation(() => {
    return Promise.resolve([
      { c0: 2, c1: 5, c2: 10, c3: 15, c4: 12, c5: 6, date: '2026-03-26', count: 5 }
    ])
  })
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock
}

const app = require('../server')

describe('Dashboard Router & Optimizations', () => {
  const adminToken = jwt.sign({ userId: 1, email: 'admin@example.com', role: 'admin' }, 'test_secret_key', { expiresIn: '1h' })
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/admin/dashboard returns valid aggregated statistics with SWR & Raw SQL', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('stats')
    expect(res.body.stats.totalUsers).toBe(100)
    expect(res.body.stats.totalExams).toBe(20)
    expect(res.body).toHaveProperty('bandDistribution')
    expect(Array.isArray(res.body.bandDistribution)).toBe(true)
    expect(res.body.bandDistribution.length).toBe(6)
    expect(res.body).toHaveProperty('registrationsByDay')
    expect(res.body).toHaveProperty('attemptsByDay')
  })

  it('GET /api/admin/analytics returns valid analytics data with SWR & Raw SQL', async () => {
    const res = await request(app)
      .get('/api/admin/analytics?period=week')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('overview')
    expect(res.body).toHaveProperty('bandDistribution')
    expect(res.body).toHaveProperty('attemptsByDay')
  })

  it('GET /api/admin/attempts rejects invalid scoreMin string "e" with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/admin/attempts?scoreMin=e')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(400)

    expect(res.body).toHaveProperty('message')
    expect(res.body.message).toBe('Dữ liệu không hợp lệ')
  })

  it('GET /api/admin/attempts forwards validated query filters to Prisma (B3)', async () => {
    await request(app)
      .get('/api/admin/attempts?search=alice&skill=writing&seriesId=4&scoreMin=6&scoreMax=8&sortBy=score&sortOrder=asc&page=3&limit=10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.attempt.findMany.mock.calls.at(-1)[0]
    expect(call.skip).toBe(20) // (page 3 - 1) * limit 10
    expect(call.take).toBe(10)
    expect(call.orderBy).toEqual({ score: { sort: 'asc', nulls: 'last' } })
    expect(call.where.exam).toEqual({ skill: 'writing', seriesId: 4 })
    expect(call.where.score).toEqual({ gte: 6, lte: 8 })
    expect(call.where.user.OR[0].name.contains).toBe('alice')
  })

  it('GET /api/admin/attempts applies default page/limit/sort when no query given', async () => {
    await request(app)
      .get('/api/admin/attempts')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.attempt.findMany.mock.calls.at(-1)[0]
    expect(call.skip).toBe(0)
    expect(call.take).toBe(20)
    expect(call.orderBy).toEqual({ createdAt: 'desc' })
    expect(call.where).toEqual({ finishedAt: { not: null } })
  })

  it('POST /api/admin/attempts/export rejects empty attemptIds with 400', async () => {
    const res = await request(app)
      .post('/api/admin/attempts/export')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ attemptIds: [] })
      .expect(400)

    expect(res.body.message).toMatch(/chọn ít nhất 1 lượt thi/i)
  })

  it('POST /api/admin/attempts/export rejects more than 1000 attemptIds with 400', async () => {
    const res = await request(app)
      .post('/api/admin/attempts/export')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ attemptIds: Array.from({ length: 1001 }, (_, i) => i + 1) })
      .expect(400)

    expect(res.body.message).toMatch(/tối đa 1000/i)
  })

  it('POST /api/admin/attempts/export streams an xlsx for a valid selection', async () => {
    const res = await request(app)
      .post('/api/admin/attempts/export')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ attemptIds: [1, 2, 3] })
      .expect(200)

    expect(res.headers['content-type']).toContain('spreadsheetml')
    expect(prismaMock.attempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [1, 2, 3] } }) })
    )
  })
})

// ─── Timezone: ngày lịch Việt Nam (UTC+7), neo tường minh — xem lib/vnDate.js
// + CLAUDE.md mục "Quy ước timezone". Test này khẳng định các route dùng đúng
// mốc VN, không còn UTC/local-Node-TZ như trước khi sửa (bug đã xác nhận bằng
// dữ liệu thật trên postgres-dev: bản ghi VN 00:00 và 06:59 bị bộ lọc "hôm nay"/
// dateFrom/dateTo cũ bỏ sót).
describe('Dashboard/Attempts/Analytics — mốc thời gian theo ngày lịch VN', () => {
  const { vnStartOfDay, vnEndOfDay, vnStartOfToday, vnStartOfMonth } = require('../lib/vnDate')
  const { clearAll: clearSwrCache } = require('../lib/swrCache')
  const adminToken = jwt.sign({ userId: 1, email: 'admin@example.com', role: 'admin' }, 'test_secret_key', { expiresIn: '1h' })
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    // /admin/dashboard và /admin/analytics đi qua SWR cache (lib/swrCache.js,
    // TTL 60s) — xoá sạch mỗi test để đảm bảo fetcher LUÔN được gọi lại với
    // "now" đã fake ở từng test, không trả nhầm data cache "ấm" từ describe khác.
    clearSwrCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('GET /admin/attempts?dateFrom=X&dateTo=X dùng đúng vnStartOfDay/vnEndOfDay (không phải UTC-midnight/local setHours)', async () => {
    await request(app)
      .get('/api/admin/attempts?dateFrom=2026-09-16&dateTo=2026-09-16')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.attempt.findMany.mock.calls.at(-1)[0]
    expect(call.where.createdAt.gte.toISOString()).toBe(vnStartOfDay('2026-09-16').toISOString())
    expect(call.where.createdAt.gte.toISOString()).toBe('2026-09-15T17:00:00.000Z')
    expect(call.where.createdAt.lte.toISOString()).toBe(vnEndOfDay('2026-09-16').toISOString())
    expect(call.where.createdAt.lte.toISOString()).toBe('2026-09-16T16:59:59.999Z')
  })

  it('GET /admin/attempts với chỉ dateFrom hoặc chỉ dateTo vẫn dùng đúng mốc VN', async () => {
    await request(app)
      .get('/api/admin/attempts?dateFrom=2026-09-16')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)
    let call = prismaMock.attempt.findMany.mock.calls.at(-1)[0]
    expect(call.where.createdAt).toEqual({ gte: vnStartOfDay('2026-09-16') })

    vi.clearAllMocks()
    await request(app)
      .get('/api/admin/attempts?dateTo=2026-09-16')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)
    call = prismaMock.attempt.findMany.mock.calls.at(-1)[0]
    expect(call.where.createdAt).toEqual({ lte: vnEndOfDay('2026-09-16') })
  })

  it('GET /admin/dashboard — "Hôm nay"/"Tháng này" dùng vnStartOfToday/vnStartOfMonth, không phải local Date của tiến trình Node', async () => {
    vi.useFakeTimers()
    // "now" cố định ngay trong khung giờ 00:00-07:00 VN dễ gây lệch nhất:
    // UTC 2026-09-16T02:00:00Z = VN 2026-09-16 09:00 (đã qua mốc 07:00 VN).
    vi.setSystemTime(new Date('2026-09-16T02:00:00.000Z'))

    await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const attemptsTodayCall = prismaMock.attempt.count.mock.calls.find(
      c => c[0]?.where?.finishedAt?.gte
    )
    expect(attemptsTodayCall).toBeDefined()
    expect(attemptsTodayCall[0].where.finishedAt.gte.toISOString()).toBe(vnStartOfToday().toISOString())
    expect(attemptsTodayCall[0].where.finishedAt.gte.toISOString()).toBe('2026-09-15T17:00:00.000Z')

    const usersThisMonthCall = prismaMock.user.count.mock.calls.find(
      c => c[0]?.where?.createdAt?.gte && !c[0]?.where?.createdAt?.lt
    )
    expect(usersThisMonthCall).toBeDefined()
    expect(usersThisMonthCall[0].where.createdAt.gte.toISOString()).toBe(vnStartOfMonth(new Date()).toISOString())
    expect(usersThisMonthCall[0].where.createdAt.gte.toISOString()).toBe('2026-08-31T17:00:00.000Z')
  })

  it('GET /admin/analytics?period=today dùng vnStartOfToday', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T02:00:00.000Z')) // VN 2026-09-16 09:00

    await request(app)
      .get('/api/admin/analytics?period=today')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.attempt.count.mock.calls.find(c => c[0]?.where?.createdAt?.gte)
    expect(call).toBeDefined()
    expect(call[0].where.createdAt.gte.toISOString()).toBe('2026-09-15T17:00:00.000Z')
  })

  it('GET /admin/analytics?from=X&to=X (custom range) dùng vnStartOfDay/vnEndOfDay', async () => {
    await request(app)
      .get('/api/admin/analytics?from=2026-09-16&to=2026-09-16')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.attempt.count.mock.calls.find(c => c[0]?.where?.createdAt?.gte)
    expect(call).toBeDefined()
    expect(call[0].where.createdAt.gte.toISOString()).toBe('2026-09-15T17:00:00.000Z')
    expect(call[0].where.createdAt.lte.toISOString()).toBe('2026-09-16T16:59:59.999Z')
  })
})
