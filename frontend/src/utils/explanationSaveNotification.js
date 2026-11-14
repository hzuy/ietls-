import { showAlert } from './alertUtils'

// Call only once at the end of a user action, never after an individual chunk.
export function notifyExplanationSaved(report, hasConflicts = false) {
  if (!report || report.status !== 'done' || !(report.generated > 0)
    || report.rows?.length || report.needsRetry?.length || hasConflicts) return false
  showAlert('Đã lưu bản nháp. Kiểm tra và chọn Sử dụng lời giải để áp dụng cho học sinh.', 'success')
  return true
}
