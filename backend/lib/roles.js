// Role-based middleware for admin routes

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

const teacherOrAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Không có quyền truy cập' })
  }
  next()
}

const learnerOnly = requireRoles('user')
const teacherStrict = requireRoles('teacher')

module.exports = { adminOnly, teacherOrAdmin, teacherOnly, requireRoles, learnerOnly, teacherStrict }
