/**
 * Làm tròn score theo quy tắc IELTS: về 0.5 gần nhất
 * Ví dụ: 0.74 → 0.5, 0.75 → 1.0, 6.24 → 6.0, 6.25 → 6.5
 */
export function roundIELTS(score) {
  if (score == null || score <= 0) return null
  return Math.round(score * 2) / 2
}

/**
 * Format band score thành chuỗi hiển thị (ví dụ: "6.5" hoặc "—")
 */
export function formatBand(score) {
  const r = roundIELTS(score)
  return r != null ? r.toFixed(1) : '—'
}
