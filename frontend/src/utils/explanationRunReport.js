/**
 * Báo cáo một lần sinh giải thích AI — phạm vi Cambridge Exam (Reading/Listening).
 *
 * Ràng buộc thiết kế:
 * - CHỈ UI: không ghi DB, không đổi schema. Báo cáo sống trong sessionStorage
 *   (mất khi đóng trình duyệt, giữ được khi F5 trong cùng phiên).
 * - Không hiển thị message hạ tầng thô (429, tên model, URL provider) ở giao diện
 *   chính; message gốc chỉ nằm trong `technical` và được ẩn sau <details>.
 * - Báo cáo chỉ ghi nhận sự thật quan sát được từ response hiện có
 *   (`errors`, `needsRetryQuestions`, `generatedCount`, `remainingQuestionNumbers`).
 */

const REPORT_VERSION = 1
const REPORT_PREFIX = 'ai_exp_report_'
const REPORT_TTL_MS = 24 * 60 * 60 * 1000

export const RUN_KINDS = Object.freeze({
  BUSY: 'busy',
  RATE_LIMITED: 'rate_limited',
  TIMEOUT: 'timeout',
  PROVIDER: 'provider',
  MISSING_ANSWER: 'missing_answer',
  MISSING_IMAGE: 'missing_image',
  STALLED: 'stalled',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown',
})

const KIND_META = Object.freeze({
  [RUN_KINDS.BUSY]: {
    message: 'Đang có một tiến trình sinh AI khác chạy cho đề này.',
    hint: 'Chờ tiến trình kia xong rồi thử lại.',
    retryable: true,
  },
  [RUN_KINDS.RATE_LIMITED]: {
    message: 'Hệ thống AI đang quá tải nên tạm dừng để tránh gửi thêm yêu cầu.',
    hint: 'Thử lại sau ít phút.',
    retryable: true,
  },
  [RUN_KINDS.TIMEOUT]: {
    message: 'AI phản hồi quá lâu nên chưa có kết quả cho phần này.',
    hint: 'Thử lại các câu lỗi; các câu đã xong vẫn được giữ nguyên.',
    retryable: true,
  },
  [RUN_KINDS.PROVIDER]: {
    message: 'Dịch vụ AI tạm thời gián đoạn.',
    hint: 'Thử lại sau ít phút; nếu vẫn lỗi, báo kỹ thuật kèm chi tiết bên dưới.',
    retryable: true,
  },
  [RUN_KINDS.MISSING_ANSWER]: {
    message: 'Một số câu chưa có đáp án đúng nên AI không thể giải thích.',
    hint: 'Bổ sung đáp án cho các câu được liệt kê rồi thử lại.',
    retryable: false,
  },
  [RUN_KINDS.MISSING_IMAGE]: {
    message: 'Nhóm câu hình ảnh/bản đồ chưa có ảnh đính kèm.',
    hint: 'Tải ảnh cho nhóm câu rồi thử lại.',
    retryable: false,
  },
  [RUN_KINDS.STALLED]: {
    message: 'AI không tạo thêm được câu nào trong nhiều lượt liên tiếp.',
    hint: 'Các câu đã xong được giữ lại. Thử lại các câu còn thiếu.',
    retryable: true,
  },
  [RUN_KINDS.VALIDATION]: {
    message: 'Đề chưa hợp lệ để sinh giải thích bằng AI.',
    hint: 'Sửa các lỗi được liệt kê rồi bấm "AI giải thích" lại.',
    retryable: false,
  },
  [RUN_KINDS.UNKNOWN]: {
    message: 'Không thể tạo giải thích cho phần này.',
    hint: 'Thử lại; nếu lỗi lặp lại, gửi chi tiết kỹ thuật cho người phụ trách.',
    retryable: true,
  },
})

/** Khoá sessionStorage cho một đề. `skill` là 'reading' | 'listening'. */
export function makeRunReportKey(skill, examId) {
  return `${REPORT_PREFIX}${skill}_${examId}`
}

function asMessage(input) {
  if (input == null) return ''
  if (typeof input === 'string') return input.trim()
  return String(
    input.response?.data?.message
    || input.message
    || input.error
    || ''
  ).trim()
}

/** Rút các số câu từ câu thông báo dạng "… chưa có đáp án đúng: Câu 12, 13." */
export function extractQuestionNumbers(message) {
  const text = String(message || '')
  const numbers = new Set()
  const matches = text.matchAll(/câu\s*([0-9][0-9\s,;–-]*)/gi)
  for (const match of matches) {
    for (const part of String(match[1]).split(/[^0-9]+/)) {
      const num = Number(part)
      if (Number.isInteger(num) && num > 0) numbers.add(num)
    }
  }
  return [...numbers]
}

function looksLikeFriendlyVietnamese(text) {
  if (!text || text.length > 180) return false
  if (/https?:\/\//i.test(text)) return false
  if (/[{}[\]<>]/.test(text)) return false
  // Có dấu tiếng Việt hoặc là câu tiếng Việt thông thường không chứa thuật ngữ hạ tầng.
  return /[àáảãạăâđêôơưýỳỷỹỵ]/i.test(text)
}

/**
 * Phân loại một lỗi sinh giải thích thành thông tin hiển thị được cho giáo viên.
 * @param {unknown} input Lỗi axios, Error, hoặc object { status, message }.
 * @param {{ group?: object }} [ctx]
 */
export function classifyRunError(input, _ctx = {}) {
  const status = Number(input?.response?.status || input?.status || 0)
  const raw = asMessage(input)

  let kind = RUN_KINDS.UNKNOWN

  if (status === 409) kind = RUN_KINDS.BUSY
  else if (status === 429 || /quá tải|qua tai|rate.?limit|too many requests|\b429\b/i.test(raw)) kind = RUN_KINDS.RATE_LIMITED
  else if (status === 502 || status === 503 || status === 504) kind = RUN_KINDS.PROVIDER
  else if (/timeout|timed out|quá lâu|qua lau|ETIMEDOUT|AI_TIMEOUT|AbortError/i.test(raw)) kind = RUN_KINDS.TIMEOUT
  else if (/chưa có đáp án đúng/i.test(raw)) kind = RUN_KINDS.MISSING_ANSWER
  else if (/hình ảnh|bản đồ|thiếu ảnh|chưa có ảnh/i.test(raw)) kind = RUN_KINDS.MISSING_IMAGE
  else if (/không có tiến triển|không phản hồi|giới hạn tối đa/i.test(raw)) kind = RUN_KINDS.STALLED
  else if (/gemini|groq|openai|anthropic|api\.|ECONN|ENOTFOUND|\b5\d\d\b|model|provider|json/i.test(raw)) kind = RUN_KINDS.PROVIDER

  const meta = KIND_META[kind]
  const questionNumbers = kind === RUN_KINDS.MISSING_ANSWER ? extractQuestionNumbers(raw) : []

  let message = meta.message
  if (kind === RUN_KINDS.MISSING_ANSWER && questionNumbers.length > 0) {
    message = `Các câu ${questionNumbers.join(', ')} chưa có đáp án đúng nên AI không thể giải thích.`
  } else if (kind === RUN_KINDS.UNKNOWN && looksLikeFriendlyVietnamese(raw)) {
    message = raw
  }

  return {
    kind,
    message,
    hint: meta.hint,
    retryable: meta.retryable,
    technical: raw || null,
    questionNumbers,
  }
}

function enumerateGroupNumbers(group) {
  if (!group) return []
  if (Array.isArray(group.questions) && group.questions.length > 0) {
    return group.questions.map(q => Number(q?.number)).filter(Boolean)
  }
  const start = Number(group.qNumberStart)
  const end = Number(group.qNumberEnd)
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return []
  const list = []
  for (let num = start; num <= end; num++) list.push(num)
  return list
}

export function groupLabelOf(group) {
  if (!group) return null
  if (group.qNumberStart == null || group.qNumberEnd == null) return null
  return `Nhóm câu ${group.qNumberStart}–${group.qNumberEnd}`
}

export function createRunReport({ examId, skill, scope = 'all', totalGroups = 0, totalQuestions = 0 }) {
  return {
    version: REPORT_VERSION,
    examId: Number(examId) || null,
    skill: skill || 'reading',
    scope,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    totalGroups,
    finishedGroups: 0,
    totalQuestions,
    generated: 0,
    rows: [],
    needsRetry: [],
  }
}

export function createBlockedReport({ examId, skill, scope = 'all', message, details = [] }) {
  const technical = Array.isArray(details) && details.length > 0
    ? details.join('\n')
    : (message || null)
  return {
    ...createRunReport({ examId, skill, scope }),
    status: 'blocked',
    finishedAt: new Date().toISOString(),
    rows: [{
      id: 'validation',
      number: null,
      groupId: null,
      groupLabel: null,
      kind: RUN_KINDS.VALIDATION,
      message: message || KIND_META[RUN_KINDS.VALIDATION].message,
      hint: KIND_META[RUN_KINDS.VALIDATION].hint,
      retryable: false,
      technical,
      questionNumbers: [],
    }],
  }
}

/**
 * Gộp kết quả một lượt gọi (một nhóm câu) vào báo cáo.
 * Không mutate đầu vào.
 */
export function addRunOutcome(report, { group, loopResult, sentNumbers = null }) {
  if (!report) return report
  const sent = Array.isArray(sentNumbers) ? sentNumbers : enumerateGroupNumbers(group)
  const unfinished = Array.isArray(loopResult?.remainingQuestionNumbers)
    ? loopResult.remainingQuestionNumbers.filter(number => sent.includes(Number(number)))
    : sent
  const rowsByKey = new Map()
  for (const row of report.rows || []) {
    rowsByKey.set(`${row.groupId ?? 'none'}:${row.number ?? row.id}`, row)
  }

  const errors = (loopResult?.errors || []).flatMap(err => {
    if (Number(err?.number)) return [err]
    return unfinished.length > 0
      ? unfinished.map(number => ({ ...err, message: asMessage(err), number: Number(number) }))
      : [err]
  })
  for (const err of errors) {
    const info = classifyRunError(err, { group })
    const number = Number(err?.number) || null
    const key = `${group?.id ?? group?._id ?? 'none'}:${number ?? `g${report.finishedGroups}`}`
    rowsByKey.set(key, {
      id: key,
      number,
      groupId: group?.id ?? group?._id ?? null,
      groupLabel: groupLabelOf(group),
      ...info,
    })
  }

  const needsRetry = [...(report.needsRetry || [])]
  for (const item of loopResult?.needsRetryQuestions || []) {
    const number = Number(typeof item === 'object' ? item?.number : item) || null
    if (!number) continue
    if (needsRetry.some(entry => entry.number === number && entry.groupId === (group?.id ?? null))) continue
    needsRetry.push({
      number,
      groupId: group?.id ?? group?._id ?? null,
      groupLabel: groupLabelOf(group),
      message: (typeof item === 'object' && item?.reason)
        || 'Kết quả dự phòng chưa đủ tin cậy, nên kiểm tra lại câu này.',
    })
  }

  return {
    ...report,
    finishedGroups: (report.finishedGroups || 0) + 1,
    generated: (report.generated || 0) + (Number(loopResult?.totalGenerated) || 0),
    totalQuestions: report.totalQuestions || sent.length,
    rows: [...rowsByKey.values()],
    needsRetry,
  }
}

export function finishRunReport(report, { cancelled = false } = {}) {
  if (!report) return report
  const hasRows = (report.rows || []).length > 0
  const status = cancelled ? 'cancelled' : hasRows ? 'partial' : 'done'
  return {
    ...report,
    status,
    finishedAt: new Date().toISOString(),
  }
}

export function getRunReportCounts(report) {
  if (!report) {
    return { errors: 0, retryable: 0, needsRetry: 0, generated: 0, totalQuestions: 0 }
  }
  const rows = report.rows || []
  return {
    errors: rows.length,
    retryable: rows.filter(row => row.retryable && Number(row.number)).length,
    needsRetry: (report.needsRetry || []).length,
    generated: Number(report.generated) || 0,
    totalQuestions: Number(report.totalQuestions) || 0,
  }
}

/** Số câu có thể đưa vào lần "Thử lại câu lỗi". */
export function retryableNumbers(report) {
  const set = new Set()
  for (const row of report?.rows || []) {
    const number = Number(row?.number)
    if (row?.retryable && Number.isInteger(number) && number > 0) set.add(number)
  }
  return [...set].sort((a, b) => a - b)
}

export function saveRunReport(key, report) {
  if (!key || !report) return
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...report, savedAt: Date.now() }))
  } catch { /* sessionStorage đầy hoặc bị chặn: báo cáo vẫn còn trong state */ }
}

export function loadRunReport(key) {
  if (!key) return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== REPORT_VERSION) return null
    if (parsed.savedAt && Date.now() - parsed.savedAt > REPORT_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    // Một báo cáo "đang chạy" được nạp lại nghĩa là tab trước đã đóng/mất kết nối.
    if (parsed.status === 'running') return { ...parsed, status: 'interrupted' }
    return parsed
  } catch {
    return null
  }
}

export function clearRunReport(key) {
  if (!key) return
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}

export function copyRunReportText(report) {
  if (!report) return ''
  const counts = getRunReportCounts(report)
  const lines = [
    'Báo cáo sinh giải thích AI',
    `Phạm vi: ${report.scope === 'retry' ? 'thử lại câu lỗi' : report.scope === 'group' ? 'một nhóm câu' : 'cả đề'}`,
    `Kết quả: ${counts.generated}/${counts.totalQuestions || '?'} câu đã sinh · ${counts.errors} lỗi · ${counts.needsRetry} cần kiểm tra`,
  ]
  if (report.startedAt) lines.push(`Bắt đầu: ${new Date(report.startedAt).toLocaleString('vi-VN')}`)
  if (report.finishedAt) lines.push(`Kết thúc: ${new Date(report.finishedAt).toLocaleString('vi-VN')}`)

  for (const row of report.rows || []) {
    lines.push('')
    lines.push(`- ${row.number ? `Câu ${row.number}` : 'Cả đề'}${row.groupLabel ? ` (${row.groupLabel})` : ''}`)
    lines.push(`  Lý do: ${row.message}`)
    if (row.hint) lines.push(`  Gợi ý: ${row.hint}`)
    if (row.technical) lines.push(`  Kỹ thuật: ${row.technical}`)
  }
  for (const item of report.needsRetry || []) {
    lines.push('')
    lines.push(`- Câu ${item.number}${item.groupLabel ? ` (${item.groupLabel})` : ''}: cần kiểm tra lại`)
    if (item.message) lines.push(`  Ghi chú: ${item.message}`)
  }
  return lines.join('\n')
}
