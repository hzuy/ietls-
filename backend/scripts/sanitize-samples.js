// One-off cleanup: run every existing WritingSample / SpeakingSample `content`
// through the same sanitizer the write routes now use (backend/lib/sanitizeHtml.js),
// so rows created BEFORE the stored-XSS guard was added get cleaned too.
//
// Safe by default: a plain run only PREVIEWS what would change and writes nothing.
// Pass --apply to actually persist. Only rows whose content actually changes are
// updated; identical rows are skipped.
//
//   node scripts/sanitize-samples.js            # dry-run (preview only)
//   node scripts/sanitize-samples.js --apply    # write changes to DB
//
// Note: processes ALL rows, including soft-deleted ones (deletedAt != null), so a
// later "restore from Trash" cannot bring back unsanitized HTML.

const prisma = require('../lib/prisma')
const { sanitizeRichText } = require('../lib/sanitizeHtml')

const APPLY = process.argv.includes('--apply')

// crude tag/attr census so the log shows WHAT got stripped, not just byte counts
const census = (html) => {
  const s = String(html || '')
  const tags = {}
  for (const m of s.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)) {
    const t = m[1].toLowerCase()
    tags[t] = (tags[t] || 0) + 1
  }
  const attrs = {}
  for (const m of s.matchAll(/\s([a-zA-Z][a-zA-Z0-9:-]*)\s*=/g)) {
    const a = m[1].toLowerCase()
    attrs[a] = (attrs[a] || 0) + 1
  }
  return { tags, attrs }
}

const dropped = (before, after) => {
  const b = census(before)
  const a = census(after)
  const diff = (bx, ax) =>
    Object.keys(bx)
      .filter((k) => (bx[k] || 0) > (ax[k] || 0))
      .map((k) => `${k}(-${(bx[k] || 0) - (ax[k] || 0)})`)
  return {
    tags: diff(b.tags, a.tags),
    attrs: diff(b.attrs, a.attrs),
  }
}

async function run() {
  console.log(
    `--- Sanitize samples: ${APPLY ? 'APPLY (ghi vào DB)' : 'DRY-RUN (chỉ xem trước, không ghi)'} ---\n`
  )

  const models = [
    { name: 'WritingSample', delegate: prisma.writingSample },
    { name: 'SpeakingSample', delegate: prisma.speakingSample },
  ]

  let totalChanged = 0

  for (const { name, delegate } of models) {
    const rows = await delegate.findMany({ select: { id: true, title: true, content: true } })
    console.log(`[${name}] ${rows.length} bản ghi`)

    const changedIds = []
    for (const row of rows) {
      const before = row.content
      if (before == null || before === '') continue

      const after = sanitizeRichText(before)
      if (after === before) continue

      changedIds.push(row.id)
      const d = dropped(before, after)
      console.log(
        `  #${row.id} ${JSON.stringify(String(row.title).slice(0, 60))}\n` +
          `     bytes ${before.length} -> ${after.length} (-${before.length - after.length})\n` +
          `     tag bị bỏ:  ${d.tags.length ? d.tags.join(' ') : '(không)'}\n` +
          `     attr bị bỏ: ${d.attrs.length ? d.attrs.join(' ') : '(không)'}`
      )

      if (APPLY) {
        await delegate.update({ where: { id: row.id }, data: { content: after } })
      }
    }

    console.log(
      `  => ${changedIds.length} bản ghi ${APPLY ? 'đã cập nhật' : 'sẽ cập nhật'}` +
        (changedIds.length ? ` (id: ${changedIds.join(', ')})` : '') +
        '\n'
    )
    totalChanged += changedIds.length
  }

  if (!APPLY && totalChanged > 0) {
    console.log(`Chạy lại với --apply để ghi ${totalChanged} thay đổi vào DB:`)
    console.log('  node scripts/sanitize-samples.js --apply\n')
  }
  console.log(`--- Hoàn tất. ${totalChanged} bản ghi ${APPLY ? 'đã sửa' : 'cần sửa'}. ---`)
}

run()
  .catch((err) => {
    console.error('❌ Lỗi:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
