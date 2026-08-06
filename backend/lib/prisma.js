const { PrismaClient } = require('@prisma/client')

// Singleton PrismaClient với pgbouncer transaction mode
// connection_limit=1 trong URL đủ; log chỉ warn/error để tránh noise
const prisma = new PrismaClient({
  log: ['warn', 'error'],
})

module.exports = prisma
