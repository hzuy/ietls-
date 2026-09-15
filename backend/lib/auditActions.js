// Danh sách action type dùng cho AuditLog — import từ đây thay vì viết chuỗi tự do ở route.
// Mỗi key ứng với 1 giá trị chuỗi "đối_tượng.thao_tác" lưu vào AuditLog.action.

const AUDIT_ACTIONS = Object.freeze({
  EXAM_CREATE: 'exam.create',
  EXAM_UPDATE: 'exam.update',
  EXAM_DELETE: 'exam.delete',
  EXAM_RESTORE: 'exam.restore',
  EXAM_PURGE: 'exam.purge',

  SERIES_CREATE: 'series.create',
  SERIES_UPDATE: 'series.update',
  SERIES_DELETE: 'series.delete',

  BOOK_CREATE: 'book.create',
  BOOK_UPDATE: 'book.update',
  BOOK_DELETE: 'book.delete',

  PRACTICE_CREATE: 'practice.create',
  PRACTICE_UPDATE: 'practice.update',
  PRACTICE_DELETE: 'practice.delete',
  PRACTICE_RESTORE: 'practice.restore',

  SAMPLE_CREATE: 'sample.create',
  SAMPLE_UPDATE: 'sample.update',
  SAMPLE_DELETE: 'sample.delete',
  SAMPLE_RESTORE: 'sample.restore',

  USER_LOCK: 'user.lock',
  USER_UNLOCK: 'user.unlock',
  USER_DELETE: 'user.delete',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_PASSWORD_RESET: 'user.password_reset',

  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE: 'staff.delete',

  TRASH_RESTORE: 'trash.restore',
  TRASH_PURGE_ONE: 'trash.purge_one',
  TRASH_PURGE_ALL: 'trash.purge_all',
  TRASH_AUTO_PURGE: 'trash.auto_purge',

  SETTING_UPDATE: 'setting.update',
})

// Nhãn tiếng Việt hiển thị trên giao diện (dùng ở giai đoạn làm UI sau) — key khớp
// với giá trị chuỗi trong AUDIT_ACTIONS, không phải tên biến.
const AUDIT_ACTION_LABELS = Object.freeze({
  [AUDIT_ACTIONS.EXAM_CREATE]: 'Tạo đề thi',
  [AUDIT_ACTIONS.EXAM_UPDATE]: 'Sửa đề thi',
  [AUDIT_ACTIONS.EXAM_DELETE]: 'Xóa đề thi',
  [AUDIT_ACTIONS.EXAM_RESTORE]: 'Khôi phục đề thi',
  [AUDIT_ACTIONS.EXAM_PURGE]: 'Xóa vĩnh viễn đề thi',

  [AUDIT_ACTIONS.SERIES_CREATE]: 'Tạo bộ đề',
  [AUDIT_ACTIONS.SERIES_UPDATE]: 'Sửa bộ đề',
  [AUDIT_ACTIONS.SERIES_DELETE]: 'Xóa bộ đề',

  [AUDIT_ACTIONS.BOOK_CREATE]: 'Tạo cuốn sách',
  [AUDIT_ACTIONS.BOOK_UPDATE]: 'Sửa cuốn sách',
  [AUDIT_ACTIONS.BOOK_DELETE]: 'Xóa cuốn sách',

  [AUDIT_ACTIONS.PRACTICE_CREATE]: 'Tạo đề luyện tập',
  [AUDIT_ACTIONS.PRACTICE_UPDATE]: 'Sửa đề luyện tập',
  [AUDIT_ACTIONS.PRACTICE_DELETE]: 'Xóa đề luyện tập',
  [AUDIT_ACTIONS.PRACTICE_RESTORE]: 'Khôi phục đề luyện tập',

  [AUDIT_ACTIONS.SAMPLE_CREATE]: 'Tạo bài mẫu',
  [AUDIT_ACTIONS.SAMPLE_UPDATE]: 'Sửa bài mẫu',
  [AUDIT_ACTIONS.SAMPLE_DELETE]: 'Xóa bài mẫu',
  [AUDIT_ACTIONS.SAMPLE_RESTORE]: 'Khôi phục bài mẫu',

  [AUDIT_ACTIONS.USER_LOCK]: 'Khóa tài khoản',
  [AUDIT_ACTIONS.USER_UNLOCK]: 'Mở khóa tài khoản',
  [AUDIT_ACTIONS.USER_DELETE]: 'Xóa tài khoản',
  [AUDIT_ACTIONS.USER_ROLE_CHANGE]: 'Đổi quyền tài khoản',
  [AUDIT_ACTIONS.USER_PASSWORD_RESET]: 'Đặt lại mật khẩu',

  [AUDIT_ACTIONS.STAFF_CREATE]: 'Tạo tài khoản nhân sự',
  [AUDIT_ACTIONS.STAFF_UPDATE]: 'Sửa tài khoản nhân sự',
  [AUDIT_ACTIONS.STAFF_DELETE]: 'Xóa tài khoản nhân sự',

  [AUDIT_ACTIONS.TRASH_RESTORE]: 'Khôi phục từ thùng rác',
  [AUDIT_ACTIONS.TRASH_PURGE_ONE]: 'Xóa vĩnh viễn 1 mục',
  [AUDIT_ACTIONS.TRASH_PURGE_ALL]: 'Xóa vĩnh viễn toàn bộ thùng rác',
  [AUDIT_ACTIONS.TRASH_AUTO_PURGE]: 'Tự động xóa vĩnh viễn (hệ thống)',

  [AUDIT_ACTIONS.SETTING_UPDATE]: 'Sửa cài đặt hệ thống',
})

module.exports = { AUDIT_ACTIONS, AUDIT_ACTION_LABELS }
