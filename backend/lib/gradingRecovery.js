// TC-048 — phục hồi job chấm Writing bị mồ côi.
//
// Trước đây process chấm AI chạy fire-and-forget trong bộ nhớ. Nếu process
// restart (deploy/crash) giữa lúc answer đang 'pending'/'grading', bản ghi sẽ
// treo vĩnh viễn: retry chỉ chấp nhận 'failed', nên người học không có đường
// thoát. Module này đánh dấu các job đó thành 'failed' (retriable) để:
//   - endpoint retry hiện có hoạt động lại,
//   - UI hiện banner lỗi + nút "Thử chấm điểm lại".
//
// Phạm vi: single-instance deployment (đúng với cấu hình hiện tại). Nếu chạy
// nhiều replica, đặt GRADING_RECONCILE_ON_STARTUP=stale để không đụng job của
// replica khác.

const DEFAULT_STALE_MS = 15 * 60 * 1000

function staleWhere(olderThanMs, now) {
  const where = { status: { in: ['pending', 'grading'] } }
  if (olderThanMs > 0) {
    const cutoff = new Date(now.getTime() - olderThanMs)
    where.OR = [
      { gradingStartedAt: { lt: cutoff } },
      // Bản ghi cũ trước khi có gradingStartedAt.
      { gradingStartedAt: null, createdAt: { lt: cutoff } },
    ]
  }
  return where
}

async function reconcileStaleWritingGrading(prisma, { olderThanMs = 0, now = new Date() } = {}) {
  const result = await prisma.writingAnswer.updateMany({
    where: staleWhere(olderThanMs, now),
    data: { status: 'failed', error: 'grading_interrupted' },
  })
  return result?.count ?? 0
}

function startGradingRecovery(prisma, { logger = console } = {}) {
  const mode = process.env.GRADING_RECONCILE_ON_STARTUP || 'all'
  const initialOlderThanMs = mode === 'stale'
    ? (parseInt(process.env.GRADING_STALE_MS, 10) || DEFAULT_STALE_MS)
    : 0

  const run = (olderThanMs, label) => reconcileStaleWritingGrading(prisma, { olderThanMs })
    .then(count => {
      if (count > 0) logger.warn(`[grading-recovery] ${label}: marked ${count} orphaned Writing job(s) as failed`)
      return count
    })
    .catch(err => logger.error('[grading-recovery]', err.message))

  const ready = run(initialOlderThanMs, 'startup')

  const intervalMs = parseInt(process.env.GRADING_RECOVERY_INTERVAL_MS, 10) || 60 * 1000
  const timer = setInterval(() => {
    run(parseInt(process.env.GRADING_STALE_MS, 10) || DEFAULT_STALE_MS, 'periodic')
  }, intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
  timer.ready = ready

  return timer
}

module.exports = { reconcileStaleWritingGrading, startGradingRecovery, DEFAULT_STALE_MS }
