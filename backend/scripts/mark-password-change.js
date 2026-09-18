// Script: đánh dấu requirePasswordChange = true cho tất cả user hiện có
// Dùng: node mark-password-change.js [email-admin-giữ-nguyên]
// Ví dụ: node mark-password-change.js admin@example.com

// Đường dẫn require dưới đây trước đây là './lib/prisma' (sai — chạy sẽ luôn
// MODULE_NOT_FOUND, script chưa từng chạy được). Sửa thành '../lib/prisma'.
const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')

async function main() {
  printDbBanner('mark-password-change.js')
  const excludeEmail = process.argv[2] || null

  const where = excludeEmail
    ? { email: { not: excludeEmail } }
    : {}

  const result = await prisma.user.updateMany({
    where,
    data: { requirePasswordChange: true },
  })

  console.log(`Đã đánh dấu ${result.count} tài khoản cần đổi mật khẩu.`)
  if (excludeEmail) {
    console.log(`Bỏ qua: ${excludeEmail}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
