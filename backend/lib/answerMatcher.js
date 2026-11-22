'use strict'

/**
 * Chuẩn hóa & so khớp đáp án ngắn/điền từ cho IELTS Reading & Listening
 * (dùng chung cho Full Test Reading, Full Test Listening và Practice).
 *
 * Quy tắc an toàn (tránh false positive):
 * - Trim, lowercase, gộp nhiều khoảng trắng thành 1.
 * - Chuẩn hóa dấu nháy cong/gạch ngang.
 * - Bỏ dấu câu thừa ở đầu/cuối (?, !, ,, ;, ., :) — vd học viên lỡ gõ thừa dấu "?".
 * - Hỗ trợ biến thể cách nhau bởi "/" (khi allowSlash=true).
 * - Hỗ trợ từ tùy chọn trong ngoặc đơn, vd "(the) library" hoặc "11(.00)".
 * - Hỗ trợ tương đương định dạng giờ:
 *     • 11.00 ↔ 11:00 ↔ 11 (chỉ rút gọn khi phần phút là :00/.00; 11.30 KHÔNG khớp 11)
 *     • 9.30 ↔ 9:30
 *     • 11.00 am ↔ 11:00am ↔ 11 am ↔ 11am (và a.m. / p.m.)
 */

function normalizeBasic(raw) {
  if (raw == null) return ''
  let s = String(raw)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

  // Bỏ dấu câu thừa ở đầu và cuối (vd thừa '?', '.', ',', '!', ';', ':')
  s = s.replace(/^[?!,;.:'"\s]+/, '').replace(/[?!,;.:'"\s]+$/, '').trim()
  return s
}

/**
 * Chuẩn hóa hậu tố a.m. / p.m. / am / pm về dạng thống nhất (có và không khoảng trắng).
 */
function canonicalMeridiem(m) {
  if (!m) return ''
  const cleaned = m.replace(/\./g, '').toLowerCase()
  return cleaned === 'am' ? 'am' : cleaned === 'pm' ? 'pm' : ''
}

/**
 * Tách một chuỗi nếu nó là định dạng giờ kiểu "11.00", "11:00", "9.30am", "11:00 a.m.".
 * Trả về { hour, minute, meridiem } hoặc null.
 */
function parseTimeExpression(s) {
  const m = s.match(/^(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*(a\.?m\.?|p\.?m\.?))?$/i)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  const minute = m[2]
  const minuteNum = parseInt(minute, 10)
  if (hour < 0 || hour > 24 || minuteNum < 0 || minuteNum > 59) return null
  return { hour: String(hour), minute, meridiem: canonicalMeridiem(m[3]) }
}

/**
 * Tách một chuỗi giờ nguyên kèm am/pm, vd "11 am", "11am", "11 a.m".
 */
function parseBareHourWithMeridiem(s) {
  const m = s.match(/^(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)$/i)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  if (hour < 0 || hour > 24) return null
  return { hour: String(hour), meridiem: canonicalMeridiem(m[2]) }
}

/**
 * Sinh các biến thể giờ hợp lệ từ 1 đáp án chuẩn đã normalize.
 * Lưu ý: KHÔNG mở rộng số nguyên thuần túy (vd "11") sang "11:00" để tránh ảnh hưởng câu hỏi số lượng.
 */
function expandTimeVariants(norm) {
  const out = new Set([norm])

  const parsed = parseTimeExpression(norm)
  if (parsed) {
    const { hour, minute, meridiem } = parsed
    const suffixes = meridiem ? [` ${meridiem}`, meridiem] : ['']
    for (const suf of suffixes) {
      out.add(`${hour}:${minute}${suf}`)
      out.add(`${hour}.${minute}${suf}`)
      if (hour.length === 1) {
        out.add(`0${hour}:${minute}${suf}`)
        out.add(`0${hour}.${minute}${suf}`)
      }
      // Chỉ rút gọn bỏ :00 / .00 khi phút đúng bằng 00
      if (minute === '00') {
        out.add(`${hour}${suf}`)
      }
    }
    return out
  }

  const bare = parseBareHourWithMeridiem(norm)
  if (bare) {
    const { hour, meridiem } = bare
    for (const suf of [` ${meridiem}`, meridiem]) {
      out.add(`${hour}${suf}`)
      out.add(`${hour}:00${suf}`)
      out.add(`${hour}.00${suf}`)
    }
  }

  return out
}

/**
 * Mở rộng các từ tùy chọn trong ngoặc đơn: "(the) library" -> ["the library", "library"].
 * Giới hạn tối đa 3 cặp ngoặc để tránh bùng nổ tổ hợp.
 */
function expandOptionalParentheses(raw) {
  const results = [raw]
  const regex = /\(([^()]+)\)/
  let iterations = 0
  while (iterations < 3) {
    let changed = false
    const next = []
    for (const item of results) {
      const m = item.match(regex)
      if (!m) {
        next.push(item)
        continue
      }
      changed = true
      const withInner = item.replace(regex, m[1])
      const withoutInner = item.replace(regex, '')
      next.push(withInner, withoutInner)
    }
    results.length = 0
    results.push(...next)
    if (!changed) break
    iterations++
  }
  return results
}

/**
 * Chuẩn hóa chuỗi người dùng nhập để so khớp: ngoài normalizeBasic,
 * cũng chuẩn hóa "a.m." / "p.m." thành "am" / "pm" ở cuối chuỗi thời gian.
 */
function normalizeUserForCompare(raw) {
  const base = normalizeBasic(raw)
  if (!base) return ''
  const parsed = parseTimeExpression(base)
  if (parsed) {
    const suf = parsed.meridiem ? ` ${parsed.meridiem}` : ''
    return `${parsed.hour}:${parsed.minute}${suf}`
  }
  const bare = parseBareHourWithMeridiem(base)
  if (bare) {
    return `${bare.hour} ${bare.meridiem}`
  }
  return base
}

/**
 * Trả về tập hợp các chuỗi chuẩn hóa được chấp nhận cho `expectedAnswer`.
 */
function buildAcceptedSet(expectedAnswer, { allowSlash = true } = {}) {
  const accepted = new Set()
  const rawExpected = String(expectedAnswer ?? '').trim()
  if (!rawExpected) return accepted

  const parts = allowSlash ? rawExpected.split('/') : [rawExpected]
  for (const part of parts) {
    for (const expanded of expandOptionalParentheses(part)) {
      const norm = normalizeBasic(expanded)
      if (!norm) continue
      for (const variant of expandTimeVariants(norm)) {
        accepted.add(variant)
        const canonical = normalizeUserForCompare(variant)
        if (canonical) accepted.add(canonical)
      }
    }
  }
  return accepted
}

/**
 * Kiểm tra đáp án người dùng nhập có khớp với đáp án chuẩn hay không.
 */
function isAnswerMatch(userAnswer, expectedAnswer, { allowSlash = true } = {}) {
  const rawNorm = normalizeBasic(userAnswer)
  if (!rawNorm) return false
  const accepted = buildAcceptedSet(expectedAnswer, { allowSlash })
  if (accepted.size === 0) return false
  if (accepted.has(rawNorm)) return true
  const canonical = normalizeUserForCompare(userAnswer)
  return Boolean(canonical) && accepted.has(canonical)
}

module.exports = {
  normalizeBasic,
  buildAcceptedSet,
  isAnswerMatch,
}
