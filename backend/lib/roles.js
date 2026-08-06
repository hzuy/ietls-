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

module.exports = { adminOnly, teacherOrAdmin, teacherOnly }
