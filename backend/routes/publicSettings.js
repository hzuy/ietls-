const express = require('express')
const prisma = require('../lib/prisma')
const { sendServerError } = require('../lib/httpErrors')

const router = express.Router()
const PUBLIC_SETTING_KEYS = [
  'site_name',
  'system_announcement',
  'reading_time',
  'listening_time',
  'writing_time',
]

router.get('/', async (_req, res) => {
  try {
    const settings = await prisma.setting.findMany({ where: { key: { in: PUBLIC_SETTING_KEYS } } })
    res.json(Object.fromEntries(settings.map(({ key, value }) => [key, value])))
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

module.exports = router
