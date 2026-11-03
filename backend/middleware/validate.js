function restoreOmissions(source, parsed) {
  if (Array.isArray(source) && Array.isArray(parsed)) return parsed.map((value, index) => restoreOmissions(source[index], value))
  if (!source || !parsed || typeof source !== 'object' || typeof parsed !== 'object' || Array.isArray(source) || Array.isArray(parsed)) return parsed
  for (const key of Object.keys(parsed)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) delete parsed[key]
    else parsed[key] = restoreOmissions(source[key], parsed[key])
  }
  return parsed
}

function validate(schema, target = 'body', { preserveOmissions = false } = {}) {
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
      // Express 5: req.query is a getter-only property — assigning to it is
      // silently ignored. Expose the validated/coerced data on a new field
      // and have query-validated routes read from req.validatedQuery.
      req.validatedQuery = result.data
    } else {
      req.body = preserveOmissions ? restoreOmissions(dataToValidate, result.data) : result.data
    }
    next()
  }
}

module.exports = validate
