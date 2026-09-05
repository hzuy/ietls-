// One-off: sắp xếp lại backend/uploads/ (hiện đang phẳng, audio + ảnh trộn lẫn)
// vào các thư mục con theo loại nội dung, dựa trên đúng 7 trường URL dưới đây.
// KHÔNG quét thư mục, KHÔNG đụng ảnh nhúng trong RichTextEditor (HTML content
// của WritingSample/SpeakingSample/passage/notes) — parse & rewrite <img src>
// trong HTML rủi ro cao hơn lợi ích, nên nhóm đó giữ nguyên ở uploads/ gốc.
//
//   exam.coverImageUrl            uploads/<f>  -> uploads/covers/<f>
//   bookCover.coverImageUrl       uploads/<f>  -> uploads/covers/<f>
//   listeningSection.audioUrl     uploads/<f>  -> uploads/audio/<f>
//   practiceExam.audioUrl         uploads/<f>  -> uploads/audio/<f>
//   question.imageUrl             uploads/<f>  -> uploads/questions/<f>
//   questionGroup.imageUrl        uploads/<f>  -> uploads/questions/<f>
//   writingTask.imageUrl          uploads/<f>  -> uploads/questions/<f>
//
// uploads/thumbnails/ (practiceExam/writingSample/speakingSample.thumbnailUrl)
// đã tách sẵn từ đợt perf/cache-and-images — GIỮ NGUYÊN, không đụng.
//
// An toàn theo mặc định: chạy trơn chỉ PREVIEW (in bảng mapping), không copy
// file, không đụng DB. Pass --apply để thực thi. Khi --apply:
//   1. COPY (không move) file sang thư mục con mới, giữ nguyên tên file
//   2. update URL trong DB cho từng record trỏ tới file đó
//   3. KHÔNG xoá file ở đường dẫn cũ — dọn dẹp để làm riêng, sau khi đã xác
//      nhận ổn định qua thực tế (ít nhất vài ngày), để rollback dễ nếu có sự cố
//
//   node scripts/reorganize-uploads.js            # dry-run
//   node scripts/reorganize-uploads.js --apply    # thực thi
//
// LƯU Ý: DB (Supabase) dùng chung giữa local & prod, nhưng backend/uploads/ là
// ổ đĩa RIÊNG từng máy (.gitignored). --apply đổi DB ngay lập tức cho MỌI máy,
// nhưng bước COPY file chỉ có tác dụng trên máy đang chạy script. Nếu file gốc
// không đủ trên máy đang chạy (vd local mới đồng bộ 1 phần từ prod), --apply sẽ
// làm DB trỏ sang thư mục mới trong khi máy KHÁC (prod, nơi thật sự phục vụ
// traffic) chưa có file ở đó -> 404 hàng loạt. CHỈ chạy --apply trên máy có đủ
// file gốc (thực tế là phải SSH vào lab46 — xem báo cáo dry-run kèm theo).

const fs = require('fs')
const path = require('path')
const prisma = require('../lib/prisma')
const { uploadsDir } = require('../lib/adminUploads')

const APPLY = process.argv.includes('--apply')

const TARGETS = [
  { model: 'exam',             delegate: prisma.exam,             field: 'coverImageUrl', destDir: 'covers' },
  { model: 'bookCover',        delegate: prisma.bookCover,        field: 'coverImageUrl', destDir: 'covers' },
  { model: 'listeningSection', delegate: prisma.listeningSection, field: 'audioUrl',      destDir: 'audio' },
  { model: 'practiceExam',     delegate: prisma.practiceExam,     field: 'audioUrl',      destDir: 'audio' },
  { model: 'question',         delegate: prisma.question,         field: 'imageUrl',      destDir: 'questions' },
  { model: 'questionGroup',    delegate: prisma.questionGroup,    field: 'imageUrl',      destDir: 'questions' },
  { model: 'writingTask',      delegate: prisma.writingTask,      field: 'imageUrl',      destDir: 'questions' },
]

const kb = (n) => `${(n / 1024).toFixed(1)}KB`

// URL "/uploads/x.jpg" -> đường dẫn đĩa tuyệt đối (hoặc null nếu không phải local upload)
function urlToPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null
  return path.join(uploadsDir, url.slice('/uploads/'.length))
}

async function run() {
  console.log(`--- Tổ chức lại backend/uploads/: ${APPLY ? 'APPLY' : 'DRY-RUN (không ghi gì)'} ---\n`)

  // Gom theo url -> refs (dedupe theo file — 1 file vật lý có thể được nhiều
  // record cùng model tham chiếu, vd nhiều exam share chung 1 coverImageUrl)
  const byUrl = new Map()
  for (const t of TARGETS) {
    const rows = await t.delegate.findMany({ select: { id: true, [t.field]: true } })
    for (const row of rows) {
      const url = row[t.field]
      if (!url) continue
      if (!byUrl.has(url)) byUrl.set(url, { destDir: t.destDir, refs: [] })
      byUrl.get(url).refs.push({ ...t, id: row.id })
    }
  }

  let toMove = 0, alreadyThere = 0, missing = 0, conflicts = 0, bytesTotal = 0
  const byDest = {}

  for (const [url, { destDir, refs }] of byUrl) {
    const refLabel = refs.map(r => `${r.model}#${r.id}`).join(', ')
    const srcPath = urlToPath(url)
    if (!srcPath) continue // URL tuyệt đối / ngoài uploads

    if (path.dirname(srcPath) === path.join(uploadsDir, destDir)) {
      alreadyThere++
      continue
    }

    const filename = path.basename(srcPath)
    const destPath = path.join(uploadsDir, destDir, filename)
    const newUrl = `/uploads/${destDir}/${filename}`

    if (!fs.existsSync(srcPath)) {
      missing++
      console.log(`  [MISSING]  ${url}  <- ${refLabel}`)
      continue
    }

    if (fs.existsSync(destPath)) {
      conflicts++
      console.log(`  [CONFLICT] ${url} -> ${newUrl}  (file đã tồn tại ở đích, bỏ qua)  <- ${refLabel}`)
      continue
    }

    const size = fs.statSync(srcPath).size
    bytesTotal += size
    byDest[destDir] = (byDest[destDir] || 0) + 1
    toMove++
    console.log(`  ${APPLY ? '[DONE]' : '[WOULD]'}  ${url} -> ${newUrl}  (${kb(size)})  <- ${refLabel}`)

    if (!APPLY) continue

    fs.mkdirSync(path.join(uploadsDir, destDir), { recursive: true })
    fs.copyFileSync(srcPath, destPath)
    for (const r of refs) {
      await r.delegate.update({ where: { id: r.id }, data: { [r.field]: newUrl } })
    }
  }

  console.log('\n--- Tổng kết ---')
  console.log(`  file cần chuyển: ${toMove}`)
  for (const [dir, count] of Object.entries(byDest)) console.log(`    -> uploads/${dir}/ : ${count}`)
  console.log(`  đã ở đúng chỗ:    ${alreadyThere}`)
  console.log(`  file thiếu:       ${missing}`)
  console.log(`  trùng tên ở đích: ${conflicts}`)
  if (toMove) console.log(`  tổng dung lượng sẽ copy: ${kb(bytesTotal)}`)

  if (!APPLY && toMove) {
    console.log(`\n  Chạy lại với --apply để thực thi (COPY file + update DB, KHÔNG xoá file cũ):`)
    console.log(`    node scripts/reorganize-uploads.js --apply`)
  }
  if (APPLY && toMove) {
    console.log(`\n  ⚠️  File cũ ở đường dẫn gốc CHƯA bị xoá (cố ý, để rollback dễ). Xoá thủ`)
    console.log(`     công sau khi đã xác nhận ổn định qua thực tế (vài ngày).`)
    console.log(`  ⚠️  Server đang chạy có SWR cache in-memory (TTL 120s) giữ URL CŨ. Restart`)
    console.log(`     backend để thấy URL mới ngay: docker compose restart backend`)
  }
}

run()
  .catch((err) => { console.error('❌ Lỗi:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
