function validate(schema, target = 'body') {
  return (req, res, next) => {
    const dataToValidate = target === 'query' ? req.query : req.body
    const result = schema.safeParse(dataToValidate)
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.') || target,
        message: issue.message
      }))
      return res.status(400).json({
        message: 'Dữ liệu không hợp lệ',
        errors
      })
    }
    if (target === 'query') {
      req.query = result.data
    } else {
      req.body = result.data
    }
    next()
  }
}

module.exports = validate
