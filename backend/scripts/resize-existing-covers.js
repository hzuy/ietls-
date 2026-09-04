// One-off: resize ảnh BÌA / THUMBNAIL đã upload TRƯỚC khi route upload tự resize
// (backend/lib/imageResize.js). Chỉ đụng file được tham chiếu trong DB qua 5
// trường dưới đây — KHÔNG quét thư mục, nên ảnh RichTextEditor / map / chart /
// diagram (cùng nằm trong uploads/) và audio KHÔNG bị đụng tới.
//
//   bookCover.coverImageUrl      -> uploads/<f>
//   exam.coverImageUrl           -> uploads/<f>
//   practiceExam.thumbnailUrl    -> uploads/thumbnails/<f>
//   writingSample.thumbnailUrl   -> uploads/thumbnails/<f>
//   speakingSample.thumbnailUrl  -> uploads/thumbnails/<f>
//
// An toàn theo mặc định: chạy trơn chỉ PREVIEW, không ghi file, không đụng DB.
// Pass --apply để thực thi. Khi --apply:
//   1. copy ảnh gốc -> uploads/_originals/<relpath>   (để rollback)
//   2. ghi <base>.webp (400px, q80) cùng thư mục
//   3. nếu đổi tên (.jpg -> .webp): cập nhật trường DB + xoá file cũ
//   4. nếu vốn đã .webp: ghi đè tại chỗ, DB không đổi
// Idempotent: ảnh đã là webp & rộng <= 400 sẽ bị bỏ qua ở lần chạy sau.
//
//   node scripts/resize-existing-covers.js            # dry-run
//   node scripts/resize-existing-covers.js --apply    # thực thi
//
// LƯU Ý: uploads/ nằm trên volume của server (lab46), KHÔNG có ở máy local.
// Script này phải chạy TRÊN SERVER (trong container hoặc cùng máy, trỏ đúng
// backend/.env). DB dùng chung nên bước cập nhật DB có hiệu lực ngay với prod.

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const prisma = require('../lib/prisma')
const { uploadsDir } = require('../lib/adminUploads')
const { COVER_WIDTH, WEBP_QUALITY } = require('../lib/imageResize')

const APPLY = process.argv.includes('--apply')
const RESIZABLE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const BACKUP_ROOT = path.join(uploadsDir, '_originals')

sharp.cache(false)

const TARGETS = [
  { model: 'bookCover',      delegate: prisma.bookCover,      field: 'coverImageUrl' },
  { model: 'exam',           delegate: prisma.exam,           field: 'coverImageUrl' },
  { model: 'practiceExam',   delegate: prisma.practiceExam,   field: 'thumbnailUrl' },
  { model: 'writingSample',  delegate: prisma.writingSample,  field: 'thumbnailUrl' },
  { model: 'speakingSample', delegate: prisma.speakingSample, field: 'thumbnailUrl' },
]

const kb = (n) => `${(n / 1024).toFixed(1)}KB`

// URL "/uploads/thumbnails/x.jpg" -> đường dẫn đĩa tuyệt đối (hoặc null nếu không phải local upload)
function urlToPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null
  return path.join(uploadsDir, url.slice('/uploads/'.length))
}

async function run() {
  console.log(`--- Resize ảnh bìa/thumbnail cũ: ${APPLY ? 'APPLY' : 'DRY-RUN (không ghi gì)'} ---`)
  console.log(`    width=${COVER_WIDTH}px  quality=${WEBP_QUALITY}  backup=${BACKUP_ROOT}\n`)

  if (APPLY) fs.mkdirSync(BACKUP_ROOT, { recursive: true })

  // Gom mọi (url) cần xử lý -> danh sách trường DB trỏ vào nó (dedupe theo file)
  const byUrl = new Map() // url -> [{ model, delegate, field, id }]
  for (const t of TARGETS) {
    const rows = await t.delegate.findMany({ select: { id: true, [t.field]: true } })
    for (const row of rows) {
      const url = row[t.field]
      if (!url) continue
      if (!byUrl.has(url)) byUrl.set(url, [])
      byUrl.get(url).push({ ...t, id: row.id })
    }
  }

  // Chặn thảm hoạ: nếu chạy nhầm chỗ (vd máy local — uploads/ trống) thì phần
  // lớn file sẽ "missing". KHÔNG cho --apply ghi DB trong tình huống đó, vì đổi
  // URL sang .webp trong khi file .webp chưa tồn tại = mọi ảnh bìa 404.
  {
    const total = byUrl.size
    let onDisk = 0
    for (const url of byUrl.keys()) {
      const p = urlToPath(url)
      if (p && fs.existsSync(p)) onDisk++
    }
    if (APPLY && total > 0 && onDisk / total < 0.5) {
      console.error(
        `\n❌ ABORT: chỉ ${onDisk}/${total} file ảnh có trên đĩa. Có vẻ script đang\n` +
        `   chạy sai chỗ (uploads/ phải là volume của server). Không ghi gì.\n`
      )
      process.exitCode = 1
      return
    }
  }

  let processed = 0, skipped = 0, missing = 0, renamedCount = 0, bytesBefore = 0, bytesAfter = 0
  const errors = []

  for (const [url, refs] of byUrl) {
    const refLabel = refs.map(r => `${r.model}#${r.id}`).join(', ')
    const srcPath = urlToPath(url)
    if (!srcPath) { skipped++; continue } // URL tuyệt đối / ngoài uploads

    const ext = path.extname(srcPath).toLowerCase()
    if (!RESIZABLE_EXT.has(ext)) { skipped++; continue }

    if (!fs.existsSync(srcPath)) {
      missing++
      console.log(`  [MISSING] ${url}  <- ${refLabel}`)
      continue
    }

    let meta
    try {
      meta = await sharp(fs.readFileSync(srcPath)).metadata()
    } catch (e) {
      errors.push(`${url}: ${e.message}`)
      console.log(`  [ERROR]   ${url}  (${e.message})`)
      continue
    }

    const already = meta.format === 'webp' && (meta.width || 0) <= COVER_WIDTH
    if (already) { skipped++; continue }

    const beforeSize = fs.statSync(srcPath).size
    const outName = `${path.basename(srcPath, ext)}.webp`
    const outPath = path.join(path.dirname(srcPath), outName)
    const newUrl = `${url.slice(0, url.length - path.basename(url).length)}${outName}`
    const renamed = outName !== path.basename(srcPath)

    let resized
    try {
      resized = await sharp(fs.readFileSync(srcPath))
        .rotate()
        .resize({ width: COVER_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer()
    } catch (e) {
      errors.push(`${url}: ${e.message}`)
      console.log(`  [ERROR]   ${url}  (${e.message})`)
      continue
    }

    processed++
    bytesBefore += beforeSize
    bytesAfter += resized.length
    console.log(
      `  ${APPLY ? '[DONE]' : '[WOULD]'} ${url}` +
      (renamed ? ` -> ${newUrl}` : ' (in-place)') +
      `  ${kb(beforeSize)} -> ${kb(resized.length)}  (${meta.width}px -> <=${COVER_WIDTH})  <- ${refLabel}`
    )

    if (!APPLY) continue

    // 1. backup ảnh gốc
    const rel = path.relative(uploadsDir, srcPath)
    const backupPath = path.join(BACKUP_ROOT, rel)
    fs.mkdirSync(path.dirname(backupPath), { recursive: true })
    if (!fs.existsSync(backupPath)) fs.copyFileSync(srcPath, backupPath)

    // 2. ghi .webp
    fs.writeFileSync(outPath, resized)

    // 3. cập nhật DB + xoá file cũ nếu đổi tên
    if (renamed) {
      renamedCount++
      for (const r of refs) {
        await r.delegate.update({ where: { id: r.id }, data: { [r.field]: newUrl } })
      }
      if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath)
    }
  }

  console.log('\n--- Tổng kết ---')
  console.log(`  ảnh xử lý:   ${processed}`)
  console.log(`  bỏ qua:      ${skipped}  (đã tối ưu / không phải ảnh raster / URL ngoài)`)
  console.log(`  file thiếu:  ${missing}`)
  console.log(`  lỗi:         ${errors.length}`)
  if (processed) {
    console.log(`  dung lượng:  ${kb(bytesBefore)} -> ${kb(bytesAfter)}  (giảm ${kb(bytesBefore - bytesAfter)}, -${Math.round((1 - bytesAfter / bytesBefore) * 100)}%)`)
  }
  if (!APPLY && processed) {
    console.log(`\n  Chạy lại với --apply để thực thi:`)
    console.log(`    node scripts/resize-existing-covers.js --apply`)
  }
  if (APPLY && renamedCount > 0) {
    console.log(`\n  ⚠️  ${renamedCount} URL đã đổi (.jpg/.png -> .webp). Server đang chạy có`)
    console.log(`     SWR cache in-memory (routes practice/samples/full-tests, TTL 120s) giữ URL`)
    console.log(`     CŨ → ảnh 404 tới khi cache hết hạn. RESTART backend để xoá cache ngay:`)
    console.log(`         docker compose restart backend      # hoặc: docker restart ielts-app-backend`)
  }
  if (APPLY) {
    console.log(`\n  Ảnh gốc đã backup ở ${BACKUP_ROOT} (xoá thủ công sau khi xác nhận OK).`)
  }
}

run()
  .catch((err) => { console.error('❌ Lỗi:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
