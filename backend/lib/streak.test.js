import { describe, it, expect, afterEach, vi } from 'vitest'
const { computeStreak } = require('./streak')

// Bản sao logic streak CŨ (trước khi sửa lỗi múi giờ) — neo theo ngày lịch UTC
// (setUTCHours) thay vì giờ VN. Dùng làm baseline "before fix" để chứng minh
// bug có thật: cùng input, kết quả cũ khác kết quả mới (computeStreak).
function legacyComputeStreak(finishedDates) {
  const dateSet = new Set(finishedDates.map(d => d.toISOString().split('T')[0]))
  const toDateStr = d => d.toISOString().split('T')[0]
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = toDateStr(today)
  const yesterdayStr = toDateStr(new Date(today.getTime() - 86400000))

  let streak = 0
  if (dateSet.has(todayStr) || dateSet.has(yesterdayStr)) {
    const cursor = new Date(dateSet.has(todayStr) ? today : today.getTime() - 86400000)
    while (dateSet.has(toDateStr(cursor))) {
      streak++
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    }
  }
  return streak
}

describe('lib/streak — streak theo ngày lịch Việt Nam', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hoạt động lúc 00:30 giờ VN được tính là HÔM NAY, không phải hôm qua', () => {
    // now = VN 2026-09-16 09:00 (UTC 2026-09-16T02:00Z); bài thi hoàn thành lúc
    // VN 2026-09-16 00:30 (UTC 2026-09-15T17:30Z) — cùng 1 ngày lịch VN.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T02:00:00.000Z'))

    const streak = computeStreak([new Date('2026-09-15T17:30:00.000Z')])
    expect(streak).toBe(1)
  })

  it('4 mốc biên VN 00:00/06:59/07:01/23:59 trong CÙNG 1 ngày chỉ tính là 1 ngày streak', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T20:00:00.000Z')) // VN 2026-09-17 03:00 — "hôm qua" theo VN là 16/09

    const finishedDates = [
      new Date('2026-09-15T17:00:00.000Z'), // VN 16/09 00:00
      new Date('2026-09-15T23:59:00.000Z'), // VN 16/09 06:59
      new Date('2026-09-16T00:01:00.000Z'), // VN 16/09 07:01
      new Date('2026-09-16T16:59:00.000Z'), // VN 16/09 23:59
    ]
    // Tất cả 4 điểm đều thuộc ngày lịch VN 16/09 = "hôm qua" so với now (VN 17/09
    // 03:00) → streak vẫn tính (chuỗi chưa đứt) và đúng bằng 1 ngày duy nhất.
    expect(computeStreak(finishedDates)).toBe(1)
  })

  it('regression: 1 ngày lịch VN bị UTC-anchor cắt làm 2 → thuật toán cũ đếm thiếu, thuật toán mới đếm đúng 2 ngày liên tiếp', () => {
    // VN 15/09 22:00 và VN 16/09 03:00 là 2 NGÀY LỊCH VN liên tiếp (15 và 16),
    // nhưng cả hai cùng rơi vào NGÀY UTC 15/09 (22:00 UTC+7 → 15:00 UTC cùng
    // ngày; 03:00 VN 16/09 → 20:00 UTC ngày 15/09) — thuật toán cũ gộp nhầm
    // thành 1 ngày, thuật toán mới phải tách đúng thành 2 ngày liên tiếp.
    const finishedDates = [
      new Date('2026-09-15T15:00:00.000Z'), // VN 15/09 22:00
      new Date('2026-09-15T20:00:00.000Z'), // VN 16/09 03:00
    ]
    const now = new Date('2026-09-16T08:00:00.000Z') // VN 16/09 15:00

    vi.useFakeTimers()
    vi.setSystemTime(now)

    const legacy = legacyComputeStreak(finishedDates)
    const fixed = computeStreak(finishedDates)

    expect(legacy).toBe(1) // bug: gộp nhầm 2 ngày VN liên tiếp thành 1 do UTC-anchor
    expect(fixed).toBe(2) // đúng: 2 ngày lịch VN liên tiếp (15/09, 16/09)
    expect(fixed).not.toBe(legacy)
  })

  it('không có bài nào hôm nay lẫn hôm qua (giờ VN) → streak = 0, chuỗi đã đứt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T08:00:00.000Z')) // VN 16/09 15:00

    // Bài cuối cùng cách đây 3 ngày lịch VN — không phải hôm nay (16/09) hay hôm qua (15/09).
    const streak = computeStreak([new Date('2026-09-13T10:00:00.000Z')])
    expect(streak).toBe(0)
  })

  it('chuỗi nhiều ngày liên tiếp giờ VN được đếm đúng, dừng đúng chỗ có khoảng trống', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T08:00:00.000Z')) // VN 16/09 15:00

    const finishedDates = [
      new Date('2026-09-16T02:00:00.000Z'), // VN 16/09 09:00 — hôm nay
      new Date('2026-09-15T02:00:00.000Z'), // VN 15/09 09:00 — hôm qua
      new Date('2026-09-14T02:00:00.000Z'), // VN 14/09 09:00 — hôm kia
      // khoảng trống ngày 13/09
      new Date('2026-09-12T02:00:00.000Z'), // VN 12/09 09:00 — không nối tiếp
    ]
    expect(computeStreak(finishedDates)).toBe(3)
  })
})
