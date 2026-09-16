// Mốc "ngày lịch" theo giờ Việt Nam (UTC+7), neo TƯỜNG MINH bằng epoch-millis
// arithmetic — KHÔNG dùng bất kỳ hàm Date nào đọc/ghi theo local timezone của
// tiến trình Node (new Date(y,m,d), setHours, getFullYear/getMonth/getDate...)
// vì kết quả của các hàm đó phụ thuộc TZ hệ điều hành/process.env.TZ, và máy
// dev (thường set Asia/Saigon) cho kết quả khác hẳn container production
// (mặc định UTC, không set TZ) dù chạy cùng một đoạn code.
//
// Chỉ dùng cho boundary NGÀY LỊCH (đầu/cuối ngày, đầu/cuối tháng) — KHÔNG dùng
// cho các cơ chế retention tính lùi theo ĐỘ DÀI thời gian (Trash 30 ngày ở
// routes/admin/trash.js, AuditLog 365 ngày ở lib/auditLogRetention.js — cả hai
// tính `Date.now() - N*ms`, không neo theo ngày lịch nên không áp dụng/không
// cần quy ước này). Xem CLAUDE.md mục "Quy ước timezone".

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// {year, month (1-12), day} theo lịch Việt Nam.
// input: Date (một thời điểm cụ thể, vd `new Date()`) | chuỗi 'YYYY-MM-DD'
// (một ngày lịch, không kèm giờ — từ query param dateFrom/dateTo) | undefined
// (mặc định thời điểm hiện tại).
function vnCalendarParts(input) {
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
    if (!m) throw new Error(`vnDate: chuỗi ngày không hợp lệ, cần dạng 'YYYY-MM-DD': ${input}`)
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  }
  const date = input instanceof Date ? input : new Date()
  // Cộng offset rồi đọc lại bằng getter UTC — không dùng getter local vì local
  // phụ thuộc TZ tiến trình Node (xem comment đầu file).
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

function vnDayStartInstant({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - VN_OFFSET_MS)
}

// Mốc 00:00:00.000 giờ VN của ngày chứa `input` — trả về Date (UTC instant tương ứng).
function vnStartOfDay(input) {
  return vnDayStartInstant(vnCalendarParts(input))
}

// Mốc 23:59:59.999 giờ VN của ngày chứa `input`.
function vnEndOfDay(input) {
  return new Date(vnStartOfDay(input).getTime() + DAY_MS - 1)
}

// Mốc đầu/cuối "hôm nay" giờ VN tại thời điểm gọi — tương đương
// vnStartOfDay()/vnEndOfDay() không truyền input, tách riêng cho rõ ý ở nơi gọi.
function vnStartOfToday() {
  return vnStartOfDay(new Date())
}

function vnEndOfToday() {
  return vnEndOfDay(new Date())
}

// Mốc 00:00:00.000 giờ VN ngày 1 của tháng chứa `input`, lùi thêm `monthsAgo`
// tháng (0 = tháng hiện tại, 1 = tháng trước, ...).
function vnStartOfMonth(input, monthsAgo = 0) {
  const { year, month } = vnCalendarParts(input)
  const totalMonths = year * 12 + (month - 1) - monthsAgo
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths - y * 12 + 1
  return vnDayStartInstant({ year: y, month: m, day: 1 })
}

module.exports = {
  vnCalendarParts,
  vnStartOfDay,
  vnEndOfDay,
  vnStartOfToday,
  vnEndOfToday,
  vnStartOfMonth,
}
