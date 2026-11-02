const { z } = require('zod')

function passwordSchema(label = 'Mật khẩu mới') {
  return z.string({ message: `${label} là bắt buộc` })
    .min(8, { message: `${label} phải có ít nhất 8 ký tự` })
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, {
      message: `${label} không được vượt quá 72 byte UTF-8`,
    })
}

module.exports = { passwordSchema }
