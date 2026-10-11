// One-off & khôi phục: resize ảnh BÌA / THUMBNAIL từ bản gốc trong _originals/
// Sử dụng COVER_WIDTH và WEBP_QUALITY mới nhất từ backend/lib/imageResize.js.
//
// QUY TẮC:
// 1. Khi có --apply: nếu tìm thấy bản gốc tương ứng trong uploads/_originals/
//    thì resize lại từ bản gốc bằng COVER_WIDTH (1200) và WEBP_QUALITY (88).
// 2. Khi không có bản gốc: bỏ qua ảnh đó, KHÔNG resize lại từ bản 400px đã lưu,
//    ghi tên vào danh sách "cần upload lại".
// 3. Chế độ mặc định (không có --apply): chỉ in kế hoạch, không ghi file.
// 4. Ghi đè: chỉ ghi đè khi bản mới có kích thước pixel lớn hơn bản đang lưu.
// 5. Đường dẫn trong cơ sở dữ liệu: giữ nguyên coverImageUrl / thumbnailUrl,
//    không đổi tên file.
// 6. Cuối script: in bảng gồm tên bộ đề, kích thước trước, kích thước sau,
//    dung lượng trước, dung lượng sau, trạng thái; và in danh sách cần upload lại.

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const prisma = require('../lib/prisma')
const { uploadsDir } = require('../lib/adminUploads')
const { COVER_WIDTH, WEBP_QUALITY } = require('../lib/imageResize')
const { printDbBanner } = require('../lib/dbInfo')

const APPLY = process.argv.includes('--apply')
const RESIZABLE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const BACKUP_ROOT = path.join(uploadsDir, '_originals')

sharp.cache(false)

const TARGETS = [
  {
    model: 'bookCover',
    delegate: prisma.bookCover,
    field: 'coverImageUrl',
    select: { id: true, bookNumber: true, coverImageUrl: true, series: { select: { name: true } } },
    getName: (r) => `${r.series?.name || 'Bộ đề'} — Cuốn ${r.bookNumber}`
  },
  {
    model: 'exam',
    delegate: prisma.exam,
    field: 'coverImageUrl',
    select: { id: true, title: true, coverImageUrl: true },
    getName: (r) => r.title || `Exam #${r.id}`
  },
  {
    model: 'practiceExam',
    delegate: prisma.practiceExam,
    field: 'thumbnailUrl',
    select: { id: true, title: true, thumbnailUrl: true },
    getName: (r) => r.title || `Practice #${r.id}`
  },
  {
    model: 'writingSample',
    delegate: prisma.writingSample,
    field: 'thumbnailUrl',
    select: { id: true, title: true, thumbnailUrl: true },
    getName: (r) => r.title || `Writing #${r.id}`
  },
  {
    model: 'speakingSample',
    delegate: prisma.speakingSample,
    field: 'thumbnailUrl',
    select: { id: true, title: true, thumbnailUrl: true },
    getName: (r) => r.title || `Speaking #${r.id}`
  },
]

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

// URL "/uploads/covers/x.webp" -> đường dẫn đĩa tuyệt đối
function urlToPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null
  const rel = url.slice('/uploads/'.length)
  const full = path.join(uploadsDir, rel)
  if (fs.existsSync(full)) return full
  const flat = path.join(uploadsDir, path.basename(url))
  if (fs.existsSync(flat)) return flat
  return full
}

// Tìm file gốc trong uploads/_originals/
function findOriginalFile(url) {
  const base = path.basename(url, path.extname(url))
  const exts = ['.jpg', '.jpeg', '.png', '.webp']

  // 1. Kiểm tra theo cấu trúc thư mục con nếu url có
  if (url.startsWith('/uploads/')) {
    const rel = url.slice('/uploads/'.length)
    const relBase = path.join(path.dirname(rel), base)
    for (const ext of exts) {
      const p = path.join(BACKUP_ROOT, relBase + ext)
      if (fs.existsSync(p)) return p
    }
  }

  // 2. Kiểm tra phẳng tại gốc _originals/
  for (const ext of exts) {
    const p = path.join(BACKUP_ROOT, base + ext)
    if (fs.existsSync(p)) return p
  }

  // 3. Kiểm tra trong các thư mục con đã biết
  for (const sub of ['covers', 'thumbnails']) {
    for (const ext of exts) {
      const p = path.join(BACKUP_ROOT, sub, base + ext)
      if (fs.existsSync(p)) return p
    }
  }

  return null
}

async function run() {
  printDbBanner('resize-existing-covers.js')
  console.log(`=== KHÔI PHỤC & RESIZE ẢNH BÌA/THUMBNAIL TỪ BẢN GỐC ===`)
  console.log(`    Chế độ: ${APPLY ? '⚡ APPLY (thực thi ghi file)' : '🔍 DRY-RUN (chỉ in kế hoạch, KHÔNG ghi file)'}`)
  console.log(`    Cấu hình mục tiêu: width=${COVER_WIDTH}px | quality=${WEBP_QUALITY}`)
  console.log(`    Thư mục bản gốc: ${BACKUP_ROOT}\n`)

  // Thu thập các URL từ DB
  const byUrl = new Map() // url -> { names: Set, refs: [] }
  for (const t of TARGETS) {
    const rows = await t.delegate.findMany({ select: t.select })
    for (const row of rows) {
      const url = row[t.field]
      if (!url) continue
      if (!byUrl.has(url)) byUrl.set(url, { names: new Set(), refs: [] })
      const entry = byUrl.get(url)
      entry.names.add(t.getName(row))
      entry.refs.push({ model: t.model, id: row.id })
    }
  }

  const tableRows = []
  const needsReupload = []
  let countUpdated = 0
  let countWouldUpdate = 0
  let countSkipped = 0
  let totalBytesBefore = 0
  let totalBytesAfter = 0

  for (const [url, { names, refs }] of byUrl) {
    const displayName = Array.from(names).join(' | ')
    const ext = path.extname(url).toLowerCase()

    if (!RESIZABLE_EXT.has(ext)) {
      countSkipped++
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': 'N/A',
        'Kích thước sau': 'N/A',
        'Dung lượng trước': 'N/A',
        'Dung lượng sau': 'N/A',
        'Trạng thái': 'Bỏ qua (định dạng không hỗ trợ)'
      })
      continue
    }

    const currentDiskPath = urlToPath(url)
    const currentExists = currentDiskPath && fs.existsSync(currentDiskPath)
    let metaCurrent = null
    let sizeCurrent = 0
    if (currentExists) {
      try {
        metaCurrent = await sharp(fs.readFileSync(currentDiskPath)).metadata()
        sizeCurrent = fs.statSync(currentDiskPath).size
      } catch (err) {
        // Lỗi đọc metadata file hiện tại
      }
    }

    const sizeBeforeStr = metaCurrent ? `${metaCurrent.width}x${metaCurrent.height}` : 'N/A'
    const bytesBeforeStr = sizeCurrent ? kb(sizeCurrent) : '0 KB'

    // Tìm file gốc trong _originals/
    const origPath = findOriginalFile(url)

    if (!origPath) {
      // KHÔNG CÓ BẢN GỐC: TUYỆT ĐỐI KHÔNG RESIZE TỪ BẢN 400px ĐÃ LƯU
      needsReupload.push({
        name: displayName,
        url,
        currentSize: sizeBeforeStr,
        reason: 'Không tìm thấy file gốc trong _originals/'
      })
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': sizeBeforeStr,
        'Kích thước sau': sizeBeforeStr,
        'Dung lượng trước': bytesBeforeStr,
        'Dung lượng sau': bytesBeforeStr,
        'Trạng thái': '⚠️ Cần upload lại (thiếu bản gốc)'
      })
      continue
    }

    // Đã tìm thấy bản gốc: đọc metadata bản gốc và tiến hành resize thử
    let origBuffer, metaOrig
    try {
      origBuffer = fs.readFileSync(origPath)
      metaOrig = await sharp(origBuffer).metadata()
    } catch (err) {
      needsReupload.push({
        name: displayName,
        url,
        currentSize: sizeBeforeStr,
        reason: `Lỗi đọc file gốc: ${err.message}`
      })
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': sizeBeforeStr,
        'Kích thước sau': 'Lỗi',
        'Dung lượng trước': bytesBeforeStr,
        'Dung lượng sau': 'Lỗi',
        'Trạng thái': '❌ Lỗi đọc file gốc'
      })
      continue
    }

    // Resize từ bản gốc bằng thông số COVER_WIDTH và WEBP_QUALITY mới
    let resizedBuffer, metaResized
    try {
      resizedBuffer = await sharp(origBuffer)
        .rotate()
        .resize({ width: COVER_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer()
      metaResized = await sharp(resizedBuffer).metadata()
    } catch (err) {
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': sizeBeforeStr,
        'Kích thước sau': 'Lỗi',
        'Dung lượng trước': bytesBeforeStr,
        'Dung lượng sau': 'Lỗi',
        'Trạng thái': `❌ Lỗi resize: ${err.message}`
      })
      continue
    }

    const currentPixels = (metaCurrent?.width || 0) * (metaCurrent?.height || 0)
    const newPixels = (metaResized.width || 0) * (metaResized.height || 0)
    const isLarger = newPixels > currentPixels

    if (!isLarger) {
      countSkipped++
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': sizeBeforeStr,
        'Kích thước sau': `${metaResized.width}x${metaResized.height}`,
        'Dung lượng trước': bytesBeforeStr,
        'Dung lượng sau': kb(resizedBuffer.length),
        'Trạng thái': 'Bỏ qua (bản lưu đã >= kích thước mới)'
      })
      continue
    }

    // Bản mới có kích thước lớn hơn bản lưu
    totalBytesBefore += sizeCurrent
    totalBytesAfter += resizedBuffer.length

    const sizeAfterStr = `${metaResized.width}x${metaResized.height}`
    const bytesAfterStr = kb(resizedBuffer.length)

    if (APPLY) {
      // Thực thi ghi đè: giữ nguyên coverImageUrl, không đổi tên file
      const rel = url.slice('/uploads/'.length)
      const targetCanonicalPath = path.join(uploadsDir, rel)
      fs.mkdirSync(path.dirname(targetCanonicalPath), { recursive: true })
      fs.writeFileSync(targetCanonicalPath, resizedBuffer)

      // Nếu đĩa local đang lưu phẳng ở uploadsDir thì cũng cập nhật file phẳng
      if (currentDiskPath && path.resolve(currentDiskPath) !== path.resolve(targetCanonicalPath)) {
        fs.writeFileSync(currentDiskPath, resizedBuffer)
      }

      countUpdated++
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': sizeBeforeStr,
        'Kích thước sau': sizeAfterStr,
        'Dung lượng trước': bytesBeforeStr,
        'Dung lượng sau': bytesAfterStr,
        'Trạng thái': '✅ Đã cập nhật'
      })
    } else {
      countWouldUpdate++
      tableRows.push({
        'Tên bộ đề / mục': displayName,
        'Kích thước trước': sizeBeforeStr,
        'Kích thước sau': sizeAfterStr,
        'Dung lượng trước': bytesBeforeStr,
        'Dung lượng sau': bytesAfterStr,
        'Trạng thái': '📋 Sẽ cập nhật (kế hoạch)'
      })
    }
  }

  // In bảng kết quả
  console.log('\n--- BẢNG KẾT QUẢ XỬ LÝ ẢNH BÌA & THUMBNAIL ---')
  console.table(tableRows)

  // In danh sách cần upload lại
  console.log('\n--- DANH SÁCH ẢNH CẦN UPLOAD LẠI ---')
  if (needsReupload.length === 0) {
    console.log('  Không có ảnh nào cần upload lại.')
  } else {
    for (const item of needsReupload) {
      console.log(`  • ${item.name}`)
      console.log(`    URL: ${item.url}`)
      console.log(`    Kích thước hiện tại: ${item.currentSize}`)
      console.log(`    Lý do: ${item.reason}\n`)
    }
  }

  console.log('--- TỔNG KẾT ---')
  if (APPLY) {
    console.log(`  Số ảnh đã cập nhật thành công: ${countUpdated}`)
  } else {
    console.log(`  Số ảnh trong kế hoạch cập nhật: ${countWouldUpdate}`)
  }
  console.log(`  Số ảnh bỏ qua / giữ nguyên:    ${countSkipped}`)
  console.log(`  Số ảnh cần upload lại:         ${needsReupload.length}`)
  if (totalBytesBefore > 0) {
    console.log(`  Tổng dung lượng: ${kb(totalBytesBefore)} -> ${kb(totalBytesAfter)}`)
  }
}

run()
  .catch((err) => { console.error('❌ Lỗi:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
