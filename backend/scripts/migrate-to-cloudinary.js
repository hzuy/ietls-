/**
 * migrate-to-cloudinary.js
 * 
 * Quét toàn bộ media đang lưu ở dạng cục bộ (/uploads/...) trong Database
 * và đẩy lên Cloudinary CDN, sau đó cập nhật URL trong DB thành Cloudinary HTTPS URL.
 * 
 * Hỗ trợ tự động tải file từ https://hzuy.net/uploads/... nếu file không có trên ổ đĩa local.
 * 
 * Chạy:
 *   node scripts/migrate-to-cloudinary.js          # Dry-run (chỉ kiểm tra, không ghi gì)
 *   node scripts/migrate-to-cloudinary.js --apply  # Thực thi migrate thật
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const os = require('os')
const prisma = require('../lib/prisma')
const { uploadsDir } = require('../lib/adminUploads')
const { isCloudConfigured, uploadToCloudinary } = require('../services/storageService')
const { invalidate } = require('../lib/swrCache')

const APPLY = process.argv.includes('--apply')
const REMOTE_FALLBACK_BASE = (process.env.REMOTE_UPLOADS_URL || 'https://hzuy.net/uploads').replace(/\/$/, '')

const TARGET_FIELDS = [
  { model: 'exam',             delegate: prisma.exam,             field: 'coverImageUrl', folder: 'covers',    type: 'image' },
  { model: 'bookCover',        delegate: prisma.bookCover,        field: 'coverImageUrl', folder: 'covers',    type: 'image' },
  { model: 'listeningSection', delegate: prisma.listeningSection, field: 'audioUrl',      folder: 'audio',     type: 'video' },
  { model: 'practiceExam',     delegate: prisma.practiceExam,     field: 'audioUrl',      folder: 'audio',     type: 'video' },
  { model: 'practiceExam',     delegate: prisma.practiceExam,     field: 'thumbnailUrl',  folder: 'thumbnails', type: 'image' },
  { model: 'question',         delegate: prisma.question,         field: 'imageUrl',      folder: 'questions', type: 'image' },
  { model: 'questionGroup',    delegate: prisma.questionGroup,    field: 'imageUrl',      folder: 'questions', type: 'image' },
  { model: 'writingTask',      delegate: prisma.writingTask,      field: 'imageUrl',      folder: 'questions', type: 'image' },
  { model: 'writingSample',    delegate: prisma.writingSample,    field: 'thumbnailUrl',  folder: 'thumbnails', type: 'image' },
  { model: 'speakingSample',   delegate: prisma.speakingSample,   field: 'thumbnailUrl',  folder: 'thumbnails', type: 'image' },
]

async function downloadRemoteFile(remoteUrl, tempPath) {
  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new Error(`Remote HTTP ${res.status}: ${res.statusText}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  fs.writeFileSync(tempPath, Buffer.from(arrayBuffer))
}

async function run() {
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('  MIGRATE LOCAL UPLOADS TO CLOUDINARY')
  console.log(`  Chế độ: ${APPLY ? '🚀 THỰC THI (--apply)' : '🔍 DRY-RUN (chỉ kiểm tra)'}`)
  console.log('══════════════════════════════════════════════════════════════════\n')

  if (!isCloudConfigured()) {
    console.error('❌ LỖI: Chưa cấu hình Cloudinary credentials trong .env!')
    console.error('   Vui lòng thêm biến sau vào file backend/.env:')
    console.error('   CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>\n')
    console.error('   Hoặc 3 biến riêng lẻ:')
    console.error('   CLOUDINARY_CLOUD_NAME=...')
    console.error('   CLOUDINARY_API_KEY=...')
    console.error('   CLOUDINARY_API_SECRET=...\n')
    process.exit(1)
  }

  let totalFound = 0
  let totalMigrated = 0
  let totalErrors = 0
  const tempFilesToClean = []

  try {
    for (const target of TARGET_FIELDS) {
      const rows = await target.delegate.findMany({
        where: { [target.field]: { startsWith: '/uploads/' } },
        select: { id: true, [target.field]: true }
      })

      if (rows.length === 0) continue

      console.log(`\n📦 Mô hình [${target.model}] - Trường [${target.field}]: tìm thấy ${rows.length} mục`)

      for (const row of rows) {
        totalFound++
        const originalUrl = row[target.field]
        const relPath = originalUrl.slice('/uploads/'.length)
        const localPath = path.join(uploadsDir, relPath)

        let fileToUpload = null
        let isTemp = false

        if (fs.existsSync(localPath)) {
          const ext = path.extname(relPath) || '.tmp'
          const tempPath = path.join(os.tmpdir(), `migrate-local-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
          fs.copyFileSync(localPath, tempPath)
          fileToUpload = tempPath
        } else {
          // File không có trên local -> thử download từ remote server
          const remoteUrl = `${REMOTE_FALLBACK_BASE}/${relPath}`
          const ext = path.extname(relPath) || '.tmp'
          const tempPath = path.join(os.tmpdir(), `migrate-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
          try {
            await downloadRemoteFile(remoteUrl, tempPath)
            fileToUpload = tempPath
            isTemp = true
            tempFilesToClean.push(tempPath)
          } catch (dlErr) {
            console.warn(`  ⚠️ [${target.model} #${row.id}] Không tìm thấy file ở local và không tải được từ remote (${remoteUrl}): ${dlErr.message}`)
            totalErrors++
            continue
          }
        }

        console.log(`  • #${row.id}: ${originalUrl} (${isTemp ? 'Tải từ ' + REMOTE_FALLBACK_BASE : 'Từ ổ đĩa local'})`)

        if (APPLY) {
          try {
            const uploadRes = await uploadToCloudinary(fileToUpload, {
              folder: target.folder,
              resourceType: target.type
            })

            // Cập nhật database
            await target.delegate.update({
              where: { id: row.id },
              data: { [target.field]: uploadRes.url }
            })

            console.log(`    ✅ Đã đẩy lên Cloudinary: ${uploadRes.url}`)
            totalMigrated++
          } catch (uploadErr) {
            console.error(`    ❌ Lỗi upload Cloudinary: ${uploadErr.message}`)
            totalErrors++
          }
        }
      }
    }

    if (APPLY) {
      // Invalidate relevant caches
      invalidate('practice:')
      invalidate('fulltests:')
      invalidate('samples:')
      console.log('\n🧹 Đã xoá cache SWR liên quan.')
    }

    console.log('\n──────────────────────────────────────────────────────────────────')
    console.log('TỔNG KẾT:')
    console.log(`  - Tổng số file local cần migrate: ${totalFound}`)
    if (APPLY) {
      console.log(`  - Đã migrate thành công:           ${totalMigrated}`)
      console.log(`  - Thất bại:                        ${totalErrors}`)
    } else {
      console.log('  - Chế độ DRY-RUN: chưa có thay đổi nào được ghi vào Database.')
      console.log('  - Chạy lại với cờ `--apply` để thực thi upload và cập nhật DB:')
      console.log('      node scripts/migrate-to-cloudinary.js --apply')
    }
    console.log('──────────────────────────────────────────────────────────────────\n')

  } finally {
    // Dọn dẹp temp files
    for (const tmp of tempFilesToClean) {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch {}
    }
    await prisma.$disconnect()
  }
}

run().catch((err) => {
  console.error('\n❌ Lỗi ngoài dự kiến:', err)
  process.exit(1)
})
