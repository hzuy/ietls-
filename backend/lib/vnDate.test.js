import { describe, it, expect, afterEach, vi } from 'vitest'

// Không require ở top-level bằng import tĩnh vì cần re-require sau khi đổi
// process.env.TZ (để chứng minh module KHÔNG phụ thuộc TZ tiến trình — đọc
// lib/vnDate.js để hiểu vì sao: chỉ dùng epoch-millis + Date.UTC/getUTC*,
// không dùng new Date(y,m,d)/setHours/getFullYear kiểu local).
function loadFresh() {
  vi.resetModules()
  return require('./vnDate')
}

describe('lib/vnDate — ngày lịch Việt Nam (UTC+7), neo tường minh', () => {
  const originalTZ = process.env.TZ

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
    vi.resetModules()
  })

  describe.each(['UTC', 'Asia/Saigon', 'America/Los_Angeles'])('với process.env.TZ=%s', (tz) => {
    it('vnStartOfDay/vnEndOfDay cho cùng 1 ngày lịch VN bất kể TZ tiến trình', () => {
      process.env.TZ = tz
      const { vnStartOfDay, vnEndOfDay } = loadFresh()

      // Ngày lịch VN 2026-09-16: 00:00 VN = 2026-09-15T17:00:00.000Z,
      // 23:59:59.999 VN = 2026-09-16T16:59:59.999Z
      expect(vnStartOfDay('2026-09-16').toISOString()).toBe('2026-09-15T17:00:00.000Z')
      expect(vnEndOfDay('2026-09-16').toISOString()).toBe('2026-09-16T16:59:59.999Z')
    })

    it('4 mốc biên VN 00:00/06:59/07:01/23:59 gộp đúng về 2 ngày lịch VN liền kề', () => {
      process.env.TZ = tz
      const { vnStartOfDay } = loadFresh()

      // Cả 4 instant test thực trên postgres-dev trong phiên khảo sát trước:
      // VN_00:00 và VN_06:59 (ngày 16) đều phải quy về CÙNG 1 mốc đầu-ngày VN,
      // khác với VN_07:01 xử lý sai trước đây (bị coi khác ngày do UTC).
      const startOfVnDay16 = vnStartOfDay('2026-09-16').toISOString()

      expect(vnStartOfDay(new Date('2026-09-15T17:00:00.000Z')).toISOString()).toBe(startOfVnDay16) // VN 00:00
      expect(vnStartOfDay(new Date('2026-09-15T23:59:00.000Z')).toISOString()).toBe(startOfVnDay16) // VN 06:59
      expect(vnStartOfDay(new Date('2026-09-16T00:01:00.000Z')).toISOString()).toBe(startOfVnDay16) // VN 07:01
      expect(vnStartOfDay(new Date('2026-09-16T16:59:00.000Z')).toISOString()).toBe(startOfVnDay16) // VN 23:59
    })

    it('vnStartOfMonth: tháng hiện tại và lùi 1 tháng (kể cả qua năm)', () => {
      process.env.TZ = tz
      const { vnStartOfMonth } = loadFresh()

      const nowInSept = new Date('2026-09-16T08:00:00.000Z') // VN 2026-09-16 15:00
      expect(vnStartOfMonth(nowInSept).toISOString()).toBe('2026-08-31T17:00:00.000Z') // VN 2026-09-01 00:00
      expect(vnStartOfMonth(nowInSept, 1).toISOString()).toBe('2026-07-31T17:00:00.000Z') // VN 2026-08-01 00:00

      // Biên VN 00:00-07:00: instant này là UTC 2026-01-01 05:00 → VN 2026-01-01 12:00,
      // vẫn thuộc tháng 1/2026 chứ KHÔNG lùi về tháng 12/2025 bởi lệch UTC.
      const nowAtYearBoundary = new Date('2026-01-01T05:00:00.000Z')
      expect(vnStartOfMonth(nowAtYearBoundary).toISOString()).toBe('2025-12-31T17:00:00.000Z') // VN 2026-01-01 00:00
      expect(vnStartOfMonth(nowAtYearBoundary, 1).toISOString()).toBe('2025-11-30T17:00:00.000Z') // VN 2025-12-01 00:00
    })

    it('vnStartOfToday/vnEndOfToday bám theo "now" giả lập', () => {
      process.env.TZ = tz
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-09-16T08:00:00.000Z')) // VN 2026-09-16 15:00
      const { vnStartOfToday, vnEndOfToday } = loadFresh()

      expect(vnStartOfToday().toISOString()).toBe('2026-09-15T17:00:00.000Z')
      expect(vnEndOfToday().toISOString()).toBe('2026-09-16T16:59:59.999Z')
      vi.useRealTimers()
    })
  })

  it('ném lỗi rõ ràng khi chuỗi ngày sai định dạng', () => {
    const { vnStartOfDay } = loadFresh()
    expect(() => vnStartOfDay('16-09-2026')).toThrow(/YYYY-MM-DD/)
    expect(() => vnStartOfDay('2026/09/16')).toThrow(/YYYY-MM-DD/)
  })

  it('vnCalendarParts trả đúng {year, month, day} theo giờ VN cho cả Date và chuỗi', () => {
    const { vnCalendarParts } = loadFresh()
    expect(vnCalendarParts(new Date('2026-09-15T23:59:00.000Z'))).toEqual({ year: 2026, month: 9, day: 16 })
    expect(vnCalendarParts('2026-09-16')).toEqual({ year: 2026, month: 9, day: 16 })
  })
})
