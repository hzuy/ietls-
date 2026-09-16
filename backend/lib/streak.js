// Tính streak (số ngày liên tiếp có bài hoàn thành) theo NGÀY LỊCH VIỆT NAM —
// dùng chung giữa routes/user.js (GET /user/stats) và routes/chatbot.js
// (buildUserContext), trước đây hai nơi lặp lại y hệt logic này neo theo UTC
// (setUTCHours) thay vì giờ VN. Xem lib/vnDate.js + CLAUDE.md mục "Quy ước timezone".

const { vnCalendarParts, vnStartOfDay } = require('./vnDate')

function vnDateKey(date) {
  const { year, month, day } = vnCalendarParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// finishedDates: mảng Date (Attempt.finishedAt), thứ tự bất kỳ.
// Trả về số ngày liên tiếp tính đến hôm nay hoặc hôm qua (giờ VN) — 0 nếu
// không có bài nào hoàn thành hôm nay lẫn hôm qua (chuỗi đã đứt).
function computeStreak(finishedDates) {
  const dateSet = new Set(finishedDates.map(vnDateKey))
  const now = new Date()
  const todayKey = vnDateKey(now)
  // Instant ngay trước 00:00 VN hôm nay = 23:59:59.999 VN hôm qua.
  const yesterdayInstant = new Date(vnStartOfDay(now).getTime() - 1)
  const yesterdayKey = vnDateKey(yesterdayInstant)

  let streak = 0
  if (dateSet.has(todayKey) || dateSet.has(yesterdayKey)) {
    let cursor = dateSet.has(todayKey) ? now : yesterdayInstant
    while (dateSet.has(vnDateKey(cursor))) {
      streak++
      cursor = new Date(vnStartOfDay(cursor).getTime() - 1) // lùi sang ngày lịch VN trước đó
    }
  }
  return streak
}

module.exports = { computeStreak, vnDateKey }
