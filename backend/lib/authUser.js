const prisma = require('./prisma')

const TTL_MS = 15 * 1000
const cache = new Map()

async function loadUser(userId) {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isLocked: true, deletedAt: true },
  })
  cache.set(userId, { at: Date.now(), user })
  return user
}

async function verifySession(decoded) {
  const userId = Number(decoded?.userId)
  if (!Number.isInteger(userId) || userId <= 0) return { status: 401, message: 'Token không hợp lệ' }
  const user = await loadUser(userId)
  if (!user || user.deletedAt) return { status: 401, message: 'Tài khoản không còn tồn tại' }
  if (user.isLocked) return { status: 403, code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa' }
  if (user.role !== decoded.role) return { status: 401, message: 'Quyền tài khoản đã thay đổi, vui lòng đăng nhập lại' }
  return null
}

function invalidateAuthUser(userId) {
  cache.delete(Number(userId))
}

module.exports = { verifySession, invalidateAuthUser }
