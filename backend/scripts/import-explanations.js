const fs = require('fs')
const path = require('path')
const { Prisma } = require('@prisma/client')
const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')
const {
  classifyFamily,
  buildContext,
  enrichExplanation,
  fetchQuestions,
  SKIP_FAMILIES,
} = require('./generate-explanations')

function parseArgs(argv) {
  const out = { dir: null, dryRun: false, force: false, allowImage: false }
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--force') out.force = true
    else if (arg === '--allow-image') out.allowImage = true
    else if (arg.startsWith('--dir=')) out.dir = arg.slice('--dir='.length)
  }
  return out
}

function loadEntries(dir) {
  const entries = {}
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    for (const [id, raw] of Object.entries(data)) {
      if (entries[id]) throw new Error(`Câu #${id} xuất hiện ở nhiều file (${file})`)
      entries[id] = { raw, file }
    }
  }
  return entries
}

async function importEntries(entries, { dryRun = false, force = false, allowImage = false } = {}) {
  const ids = Object.keys(entries).map(Number)
  const rows = await fetchQuestions({ ids })
  const byId = new Map(rows.map(r => [r.id, r]))
  const existing = await prisma.question.findMany({
    where: { id: { in: ids }, explanation: { not: Prisma.DbNull } },
    select: { id: true },
  })
  const hasExplanation = new Set(existing.map(e => e.id))

  const result = { saved: [], skipped: [], failed: [] }
  for (const id of ids) {
    const row = byId.get(id)
    if (!row) {
      result.failed.push({ id, reason: 'Không có câu hỏi này trong DB' })
      continue
    }
    const family = classifyFamily(row.type)
    if (SKIP_FAMILIES.has(family) && !allowImage) {
      result.skipped.push({ id, reason: 'Dạng sơ đồ/bản đồ' })
      continue
    }
    if (hasExplanation.has(id) && !force) {
      result.skipped.push({ id, reason: 'Đã có giải thích (dùng --force để ghi đè)' })
      continue
    }
    try {
      const ctx = buildContext(row, family)
      const explanation = enrichExplanation(entries[id].raw, ctx, row.correctAnswer, family)
      if (!dryRun) await prisma.question.update({ where: { id }, data: { explanation } })
      result.saved.push({ id, number: row.number })
    } catch (err) {
      result.failed.push({ id, number: row.number, file: entries[id].file, reason: err.message })
    }
  }
  return result
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.dir) throw new Error('Thiếu --dir=<thư mục chứa các file .json>')
  printDbBanner('import-explanations.js')
  const entries = loadEntries(opts.dir)
  console.log(`Đọc ${Object.keys(entries).length} câu từ ${opts.dir}${opts.dryRun ? ' (dry-run, không ghi DB)' : ''}`)

  const result = await importEntries(entries, opts)
  for (const f of result.failed) console.error(`LỖI #${f.id}${f.number ? ` (câu ${f.number})` : ''}${f.file ? ` [${f.file}]` : ''}: ${f.reason}`)
  for (const s of result.skipped) console.log(`BỎ QUA #${s.id}: ${s.reason}`)
  console.log(`\nHoàn tất: ${result.saved.length} đã ${opts.dryRun ? 'hợp lệ' : 'ghi'}, ${result.skipped.length} bỏ qua, ${result.failed.length} lỗi.`)
  await prisma.$disconnect()
  if (result.failed.length) process.exitCode = 1
}

if (require.main === module) {
  main().catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
}

module.exports = { parseArgs, loadEntries, importEntries }
