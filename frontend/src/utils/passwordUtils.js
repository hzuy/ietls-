export const PASSWORD_CHANGED_MESSAGE = 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'

export function validatePasswordChange(currentPassword, newPassword, confirmPassword) {
  if (!currentPassword) return 'Vui lòng nhập mật khẩu hiện tại'
  if (newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự'
  if (new Blob([newPassword]).size > 72) return 'Mật khẩu mới không được vượt quá 72 byte UTF-8'
  if (newPassword !== confirmPassword) return 'Mật khẩu xác nhận không khớp'
  if (newPassword === currentPassword) return 'Mật khẩu mới phải khác mật khẩu hiện tại'
  return ''
}

export function passwordErrorMessage(error) {
  const data = error.response?.data
  return data?.errors?.[0]?.message || data?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra kết nối và thử lại.'
}
