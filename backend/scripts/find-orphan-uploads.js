// Audit-only: liệt kê file trong backend/uploads/ KHÔNG được record DB nào tham
// chiếu tới ("mồ côi") — vd ảnh/audio cũ bị thay thế nhưng file cũ chưa dọn.
// KHÔNG xoá gì. Chỉ in danh sách + tổng dung lượng. Việc xoá để quyết định sau,
// bằng tay hoặc 1 script riêng, sau khi đã xem kỹ danh sách này.
//
//   node scripts/find-orphan-uploads.js
//
// So khớp với TOÀN BỘ trường URL trỏ vào /uploads/ đã biết trong schema (cover,
// audio, ảnh minh hoạ câu hỏi, thumbnail) — xem TARGET_FIELDS bên dưới.
//
// uploads/_originals/ (backup ảnh gốc từ scripts/resize-existing-covers.js) bị
// LOẠI KHỎI kết quả — đó là backup có chủ đích, không phải mồ côi.
//
// LƯU Ý: kết quả chỉ đúng nghĩa "mồ côi thật" khi chạy trên máy có ĐẦY ĐỦ file
// thật (prod, qua SSH lab46) — DB dùng chung nhưng backend/uploads/ là ổ đĩa
// riêng từng máy. Chạy trên local (chỉ có 1 phần file, hoặc file cũ từ những
// lần dev khác nhau) sẽ ra danh sách "mồ côi" không phản ánh đúng thực tế trên
// server đang phục vụ traffic.

const fs = require('fs')
const path = require('path')
const prisma = require('../lib/prisma')
const { uploadsDir } = require('../lib/adminUploads')

const EXCLUDE_DIRS = new Set(['_originals'])

const TARGET_FIELDS = [
  { model: 'exam',             delegate: prisma.exam,             field: 'coverImageUrl' },
  { model: 'bookCover',        delegate: prisma.bookCover,        field: 'coverImageUrl' },
  { model: 'listeningSection', delegate: prisma.listeningSection, field: 'audioUrl' },
  { model: 'practiceExam',     delegate: prisma.practiceExam,     field: 'audioUrl' },
  { model: 'practiceExam',     delegate: prisma.practiceExam,     field: 'thumbnailUrl' },
  { model: 'question',         delegate: prisma.question,         field: 'imageUrl' },
  { model: 'questionGroup',    delegate: prisma.questionGroup,    field: 'imageUrl' },
  { model: 'writingTask',      delegate: prisma.writingTask,      field: 'imageUrl' },
  { model: 'writingSample',    delegate: prisma.writingSample,    field: 'thumbnailUrl' },
  { model: 'speakingSample',   delegate: prisma.speakingSample,   field: 'thumbnailUrl' },
]

const kb = (n) => `${(n / 1024).toFixed(1)}KB`
const mb = (n) => `${(n / (1024 * 1024)).toFixed(1)}MB`

function walk(dir, base = '') {
  let out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (base === '' && EXCLUDE_DIRS.has(entry.name)) continue
      out = out.concat(walk(path.join(dir, entry.name), base ? `${base}/${entry.name}` : entry.name))
    } else if (entry.isFile() && entry.name !== '.gitkeep') {
      out.push(base ? `${base}/${entry.name}` : entry.name)
    }
  }
  return out
}

async function run() {
  console.log('--- Tìm file mồ côi trong backend/uploads/ (chỉ audit, KHÔNG xoá) ---\n')

  const referenced = new Set()
  for (const t of TARGET_FIELDS) {
    const rows = await t.delegate.findMany({ select: { [t.field]: true } })
    for (const row of rows) {
      const url = row[t.field]
      if (typeof url === 'string' && url.startsWith('/uploads/')) referenced.add(url.slice('/uploads/'.length))
    }
  }

  const onDisk = walk(uploadsDir)

  // Cảnh báo (không abort — script này không ghi gì nên không có gì nguy hiểm
  // để chặn) nếu phần lớn URL trong DB không thấy trên đĩa, dấu hiệu đang chạy
  // sai máy (thiếu file thật) → kết quả "mồ côi" bên dưới sẽ không đáng tin.
  const missingOnDisk = [...referenced].filter(f => !onDisk.includes(f)).length
  if (referenced.size > 0 && missingOnDisk / referenced.size > 0.3) {
    console.log(
      `⚠️  ${missingOnDisk}/${referenced.size} URL trong DB không thấy file trên đĩa máy này.\n` +
      `   Có thể đang chạy trên máy thiếu file thật (không phải nơi phục vụ traffic thật).\n` +
      `   Danh sách "mồ côi" dưới đây có thể KHÔNG phản ánh đúng thực tế production.\n`
    )
  }

  const orphans = onDisk.filter(f => !referenced.has(f))

  const byDir = {}
  let totalBytes = 0
  for (const f of orphans) {
    const size = fs.statSync(path.join(uploadsDir, f)).size
    totalBytes += size
    const dir = f.includes('/') ? f.split('/')[0] : '(gốc)'
    byDir[dir] = byDir[dir] || { count: 0, bytes: 0 }
    byDir[dir].count++
    byDir[dir].bytes += size
    console.log(`  ${f}  (${kb(size)})`)
  }

  console.log('\n--- Tổng kết ---')
  console.log(`  Tổng file trên đĩa (trừ _originals): ${onDisk.length}`)
  console.log(`  Tổng URL tham chiếu trong DB:         ${referenced.size}`)
  console.log(`  File mồ côi:                          ${orphans.length}`)
  for (const [dir, s] of Object.entries(byDir)) {
    console.log(`    ${dir}/: ${s.count} file, ${kb(s.bytes)}`)
  }
  if (orphans.length) console.log(`  Tổng dung lượng mồ côi: ${mb(totalBytes)}`)
  console.log('\n  Không có gì bị xoá. Xem lại danh sách rồi quyết định dọn thủ công hoặc\n  viết script xoá riêng (có xác nhận) sau khi đã chắc chắn.')
}

run()
  .catch((err) => { console.error('❌ Lỗi:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
