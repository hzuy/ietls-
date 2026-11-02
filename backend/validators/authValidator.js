const { z } = require('zod')
const { passwordSchema } = require('../lib/passwordPolicy')

// 1. Đăng ký tài khoản
const registerSchema = z.object({
  email: z.string({ message: 'Email là bắt buộc' }).email({ message: 'Email không đúng định dạng' }),
  password: passwordSchema('Mật khẩu'),
  name: z.string({ message: 'Tên là bắt buộc' }).trim().min(1, { message: 'Tên không được để trống' }),
})

// 2. Đăng nhập
const loginSchema = z.object({
  email: z.string({ message: 'Email là bắt buộc' }).min(1, { message: 'Email không được để trống' }),
  password: z.string({ message: 'Mật khẩu là bắt buộc' }).min(1, { message: 'Mật khẩu không được để trống' }),
})

// 3. Đăng nhập / đăng ký bằng Google (Google Identity Services ID Token hoặc OAuth2 Access Token)
const googleAuthSchema = z.object({
  credential: z.string().min(1, { message: 'Credential không hợp lệ' }).optional(),
  accessToken: z.string().min(1, { message: 'AccessToken không hợp lệ' }).optional(),
}).refine(data => Boolean(data.credential || data.accessToken), {
  message: 'Cần credential hoặc accessToken từ Google',
})

const verifyEmailSchema = z.object({
  email: z.string({ message: 'Email là bắt buộc' }).email({ message: 'Email không đúng định dạng' }),
  code: z.string({ message: 'Mã xác thực là bắt buộc' }).trim().regex(/^\d{6}$/, { message: 'Mã xác thực gồm 6 chữ số' }),
})

const resendVerificationSchema = z.object({
  email: z.string({ message: 'Email là bắt buộc' }).email({ message: 'Email không đúng định dạng' }),
})

// 4. Đổi mật khẩu người dùng
const changePasswordSchema = z.object({
  oldPassword: z.string({ message: 'Mật khẩu cũ là bắt buộc' }).min(1, { message: 'Thiếu thông tin mật khẩu cũ' }),
  newPassword: passwordSchema(),
})

// 5. Cập nhật profile người dùng
const updateProfileSchema = z.object({
  name: z.string({ message: 'Tên là bắt buộc' }).trim().min(1, { message: 'Tên không được để trống' }),
})

// 6. Đổi mật khẩu admin/teacher
const adminChangePasswordSchema = z.object({
  currentPassword: z.string({ message: 'Mật khẩu hiện tại là bắt buộc' }).min(1, { message: 'Thiếu thông tin mật khẩu hiện tại' }),
  newPassword: passwordSchema(),
})

// Validate request shape first. The service checks the current password before
// applying the new-password policy, so policy errors cannot mask wrong credentials.
const newPasswordInput = z.string({ message: 'Mật khẩu mới là bắt buộc' }).min(1, { message: 'Vui lòng nhập mật khẩu mới' })
const changePasswordInputSchema = changePasswordSchema.extend({ newPassword: newPasswordInput })
const adminChangePasswordInputSchema = adminChangePasswordSchema.extend({ newPassword: newPasswordInput })

// 7. Tạo tài khoản staff/admin
const createAccountSchema = z.object({
  name: z.string({ message: 'Tên là bắt buộc' }).trim().min(1, { message: 'Tên không được để trống' }),
  email: z.string({ message: 'Email là bắt buộc' }).email({ message: 'Email không đúng định dạng' }),
  password: passwordSchema('Mật khẩu'),
  role: z.enum(['admin', 'teacher'], { message: 'Role không hợp lệ' }),
})

// 8. Cập nhật tài khoản staff/admin
const updateAccountSchema = z.object({
  name: z.string().trim().min(1, { message: 'Tên không được để trống' }).optional(),
  role: z.enum(['admin', 'teacher'], { message: 'Role không hợp lệ' }).optional(),
  isLocked: z.boolean({ message: 'isLocked phải là kiểu boolean' }).optional(),
  password: z.union([z.literal(''), passwordSchema()]).optional(),
})

// 9. Thao tác ID nhân sự (make-admin, make-teacher, remove-staff)
const userIdSchema = z.object({
  userId: z.coerce.number({ message: 'userId phải là số' }).int({ message: 'userId phải là số nguyên' }).positive({ message: 'Thiếu userId hợp lệ' }),
})

// 10. Cập nhật cài đặt hệ thống (object key-value)
const updateSettingsSchema = z.record(z.string(), z.any(), { message: 'Cài đặt phải là một object' }).refine(
  obj => typeof obj === 'object' && obj !== null && !Array.isArray(obj),
  { message: 'Cài đặt phải là một object hợp lệ' }
)

module.exports = {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  changePasswordSchema,
  changePasswordInputSchema,
  adminChangePasswordInputSchema,
  updateProfileSchema,
  adminChangePasswordSchema,
  createAccountSchema,
  updateAccountSchema,
  userIdSchema,
  updateSettingsSchema,
}
