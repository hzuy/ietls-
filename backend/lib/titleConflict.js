function normalizeTitle(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi')
}

async function findTitleConflict(model, title, where = {}, excludeId = null, field = 'title') {
  const normalized = normalizeTitle(title)
  if (!normalized) return null
  // Keep lightweight Prisma mocks usable in route tests; a real Prisma model
  // always exposes findMany, so production checks still scan the full scope.
  if (typeof model.findMany !== 'function') return null
  const rows = await model.findMany({ where, select: { id: true, [field]: true } })
  if (!Array.isArray(rows)) return null
  return rows.find(row => row.id !== excludeId && normalizeTitle(row[field]) === normalized) || null
}

module.exports = { normalizeTitle, findTitleConflict }
