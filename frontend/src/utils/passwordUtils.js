export const PASSWORD_CHANGED_MESSAGE = 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'

export function readPasswordForm(form) {
  const values = new FormData(form)
  return {
    currentPassword: String(values.get('currentPassword') ?? ''),
    newPassword: String(values.get('newPassword') ?? ''),
    confirmation: String(values.get('confirmPassword') ?? ''),
  }
}

export function validatePasswordChange(currentPassword, newPassword, confirmPassword) {
  if (!currentPassword) return 'Vui lòng nhập mật khẩu hiện tại'
  if (!newPassword) return 'Vui lòng nhập mật khẩu mới'
  if (newPassword !== confirmPassword) return 'Mật khẩu xác nhận không khớp'
  return ''
}

export function validateNewPassword(password, label = 'Mật khẩu') {
  if (password.length < 8) return `${label} phải có ít nhất 8 ký tự`
  if (new Blob([password]).size > 72) return `${label} không được vượt quá 72 byte UTF-8`
  return ''
}

export function passwordErrorMessage(error, fallback = 'Không thể đổi mật khẩu. Vui lòng kiểm tra kết nối và thử lại.') {
  const data = error.response?.data
  return data?.errors?.[0]?.message || data?.message || fallback
}
