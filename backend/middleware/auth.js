const jwt = require('jsonwebtoken')
const { verifySession } = require('../lib/authUser')

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'Chưa đăng nhập' })
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ' })
  }

  try {
    const problem = await verifySession(decoded)
    if (problem) return res.status(problem.status).json({ message: problem.message, ...(problem.code ? { code: problem.code } : {}) })
  } catch {
    return res.status(503).json({ message: 'Không kiểm tra được phiên đăng nhập, vui lòng thử lại' })
  }

  req.user = decoded
  next()
}
