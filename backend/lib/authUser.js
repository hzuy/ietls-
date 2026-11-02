const prisma = require('./prisma')

async function loadUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isLocked: true, deletedAt: true, tokenVersion: true, requirePasswordChange: true, password: true },
  })
}

async function verifySession(decoded, { allowPasswordChange = false } = {}) {
  const userId = Number(decoded?.userId)
  if (!Number.isInteger(userId) || userId <= 0) return { status: 401, message: 'Token không hợp lệ' }
  const user = await loadUser(userId)
  if (!user || user.deletedAt) return { status: 401, message: 'Tài khoản không còn tồn tại' }
  if (user.isLocked) return { status: 403, code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa' }
  if (user.role !== decoded.role) return { status: 401, message: 'Quyền tài khoản đã thay đổi, vui lòng đăng nhập lại' }
  // Tokens issued before this migration represent version zero only.
  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return { status: 401, code: 'SESSION_REVOKED', message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.' }
  }
  if (user.requirePasswordChange && user.password && !allowPasswordChange) {
    return { status: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Vui lòng đổi mật khẩu để tiếp tục.' }
  }
  return null
}

module.exports = { verifySession }
