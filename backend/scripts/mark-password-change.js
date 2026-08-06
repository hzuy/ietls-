// Script: đánh dấu requirePasswordChange = true cho tất cả user hiện có
// Dùng: node mark-password-change.js [email-admin-giữ-nguyên]
// Ví dụ: node mark-password-change.js admin@example.com

const prisma = require('./lib/prisma')

async function main() {
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
