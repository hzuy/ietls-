const prisma = require('../lib/prisma')

async function main() {
  try {
    console.log('Testing connection to DB...')
    const result = await prisma.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename = 'Attempt';`
    console.log('Current indexes on Attempt table:')
    console.log(result)
  } catch (err) {
    console.error('DB Query Error:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
