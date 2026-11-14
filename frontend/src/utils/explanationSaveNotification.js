import { showAlert } from './alertUtils'

// Call only once at the end of a user action, never after an individual chunk.
export function notifyExplanationSaved(report, hasConflicts = false) {
  if (!report || report.status !== 'done' || !(report.generated > 0)
    || report.rows?.length || report.needsRetry?.length || hasConflicts) return false
  showAlert('Đã lưu giải thích thành công.', 'success')
  return true
}
