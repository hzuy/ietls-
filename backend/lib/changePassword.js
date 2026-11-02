const bcrypt = require('bcryptjs')
const prisma = require('./prisma')
const { passwordSchema } = require('./passwordPolicy')
const newPasswordPolicy = passwordSchema()

// Both public endpoints retain their request shape but use the same safeguards.
async function changePassword(session, currentPassword, newPassword) {
  const { userId } = session
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) return { status: 401, code: 'SESSION_REVOKED', message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.' }
  if (user.isLocked) return { status: 403, code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa' }
  if ((session.tokenVersion ?? 0) !== (user.tokenVersion ?? 0) || session.role !== user.role) {
    return { status: 401, code: 'SESSION_REVOKED', message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.' }
  }
  if (!user.password) return { status: 400, code: 'PASSWORD_NOT_SET', message: 'Tài khoản này đăng nhập bằng Google, chưa có mật khẩu để đổi' }
  if (!await bcrypt.compare(currentPassword, user.password)) {
    return { status: 400, code: 'CURRENT_PASSWORD_INCORRECT', message: 'Mật khẩu hiện tại không đúng' }
  }
  const validation = newPasswordPolicy.safeParse(newPassword)
  if (!validation.success) {
    return {
      status: 400,
      code: 'PASSWORD_POLICY_INVALID',
      message: validation.error.issues[0].message,
      errors: [{ field: 'newPassword', message: validation.error.issues[0].message }],
    }
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return { status: 400, code: 'PASSWORD_UNCHANGED', message: 'Mật khẩu mới phải khác mật khẩu hiện tại' }
  }
  const password = await bcrypt.hash(newPassword, 10)
  const result = await prisma.user.updateMany({
    where: { id: userId, password: user.password, tokenVersion: user.tokenVersion ?? 0, isLocked: false, deletedAt: null, role: user.role },
    data: { password, requirePasswordChange: false, tokenVersion: { increment: 1 } },
  })
  if (result.count !== 1) {
    return { status: 409, code: 'PASSWORD_CHANGE_CONFLICT', message: 'Tài khoản đã thay đổi trong lúc xử lý. Vui lòng đăng nhập lại.' }
  }
  return { status: 200, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' }
}

module.exports = { changePassword }
