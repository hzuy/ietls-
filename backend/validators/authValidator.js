const { z } = require('zod')

// 1. Đăng ký tài khoản
const registerSchema = z.object({
  email: z.string({ message: 'Email là bắt buộc' }).email({ message: 'Email không đúng định dạng' }),
  password: z.string({ message: 'Mật khẩu là bắt buộc' }).min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' }),
  name: z.string({ message: 'Tên là bắt buộc' }).trim().min(1, { message: 'Tên không được để trống' }),
})

// 2. Đăng nhập
const loginSchema = z.object({
  email: z.string({ message: 'Email là bắt buộc' }).min(1, { message: 'Email không được để trống' }),
  password: z.string({ message: 'Mật khẩu là bắt buộc' }).min(1, { message: 'Mật khẩu không được để trống' }),
})

// 3. Đổi mật khẩu người dùng
const changePasswordSchema = z.object({
  oldPassword: z.string({ message: 'Mật khẩu cũ là bắt buộc' }).min(1, { message: 'Thiếu thông tin mật khẩu cũ' }),
  newPassword: z.string({ message: 'Mật khẩu mới là bắt buộc' }).min(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' }),
})

// 4. Cập nhật profile người dùng
const updateProfileSchema = z.object({
  name: z.string({ message: 'Tên là bắt buộc' }).trim().min(1, { message: 'Tên không được để trống' }),
})

// 5. Đổi mật khẩu admin/teacher
const adminChangePasswordSchema = z.object({
  currentPassword: z.string({ message: 'Mật khẩu hiện tại là bắt buộc' }).min(1, { message: 'Thiếu thông tin mật khẩu hiện tại' }),
  newPassword: z.string({ message: 'Mật khẩu mới là bắt buộc' }).min(6, { message: 'Mật khẩu mới phải ít nhất 6 ký tự' }),
})

// 6. Tạo tài khoản staff/admin
const createAccountSchema = z.object({
  name: z.string({ message: 'Tên là bắt buộc' }).trim().min(1, { message: 'Tên không được để trống' }),
  email: z.string({ message: 'Email là bắt buộc' }).email({ message: 'Email không đúng định dạng' }),
  password: z.string({ message: 'Mật khẩu là bắt buộc' }).min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' }),
  role: z.enum(['admin', 'teacher'], { message: 'Role không hợp lệ' }),
})

// 7. Cập nhật tài khoản staff/admin
const updateAccountSchema = z.object({
  name: z.string().trim().min(1, { message: 'Tên không được để trống' }).optional(),
  role: z.enum(['admin', 'teacher'], { message: 'Role không hợp lệ' }).optional(),
  isLocked: z.boolean({ message: 'isLocked phải là kiểu boolean' }).optional(),
  password: z.string().refine(val => !val || val.length >= 8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' }).optional(),
})

// 8. Thao tác ID nhân sự (make-admin, make-teacher, remove-staff)
const userIdSchema = z.object({
  userId: z.coerce.number({ message: 'userId phải là số' }).int({ message: 'userId phải là số nguyên' }).positive({ message: 'Thiếu userId hợp lệ' }),
})

// 9. Cập nhật cài đặt hệ thống (object key-value)
const updateSettingsSchema = z.record(z.string(), z.any(), { message: 'Cài đặt phải là một object' }).refine(
  obj => typeof obj === 'object' && obj !== null && !Array.isArray(obj),
  { message: 'Cài đặt phải là một object hợp lệ' }
)

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  adminChangePasswordSchema,
  createAccountSchema,
  updateAccountSchema,
  userIdSchema,
  updateSettingsSchema,
}
