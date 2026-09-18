require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { printDbBanner } = require('../lib/dbInfo')
const prisma = new PrismaClient()

const EMAIL = 'test@gmail.com' // ← đổi thành email của bạn

async function main() {
  printDbBanner('make-admin.js')
  const user = await prisma.user.update({
    where: { email: EMAIL },
    data: { role: 'admin' }
  })
  console.log(`✓ Đã set admin cho: ${user.name} (${user.email})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
