'use strict'

// Generation already spent most of the HTTP budget. Bound both connection wait
// and transaction runtime; never inherit Prisma's 5-second batch-save default.
async function saveExplanationBatch(prisma, callback, { startTime, target }) {
  const remaining = 48000 - (Date.now() - startTime) - 500
  const maxWait = Math.max(1, Math.min(2000, Math.floor(remaining / 4)))
  const timeout = Math.max(1, Math.min(10000, remaining - maxWait))
  try {
    if (remaining < 100) throw Object.assign(new Error('Save budget exhausted'), { code: 'AI_SAVE_BUDGET' })
    return await prisma.$transaction(callback, { maxWait, timeout })
  } catch (cause) {
    if (cause?.name === 'AbortError' || ['SOURCE_CHANGED', 'DRAFT_CHANGED'].includes(cause?.code)) throw cause
    const causeCode = /^P\d{4}$/.test(cause?.code || '') ? cause.code : cause?.code === 'AI_SAVE_BUDGET' ? cause.code : 'DATABASE_ERROR'
    const failure = Object.assign(new Error(causeCode === 'P2028' || causeCode === 'AI_SAVE_BUDGET'
      ? 'AI đã tạo kết quả nhưng bước lưu cơ sở dữ liệu hết thời gian. Lời giải đã lưu trước đó được giữ nguyên.'
      : 'Chưa xác nhận lưu được kết quả AI vào cơ sở dữ liệu. Tải lại để kiểm tra trước khi thử lại.'), {
      code: 'AI_SAVE_FAILED', phase: 'saving', causeCode, failedAt: new Date().toISOString(),
      timeoutMs: timeout, generatedCount: 0,
    })
    console.error('[AI_SAVE_FAILED]', { target, causeCode, timeoutMs: timeout, elapsedMs: Date.now() - startTime })
    throw failure
  }
}

function explanationFailureResponse(error) {
  if (error?.code !== 'AI_SAVE_FAILED') return null
  return { status: 503, body: {
    code: error.code, phase: 'saving', causeCode: error.causeCode,
    failedAt: error.failedAt, timeoutMs: error.timeoutMs, generatedCount: 0, message: error.message,
  } }
}

module.exports = { saveExplanationBatch, explanationFailureResponse }
