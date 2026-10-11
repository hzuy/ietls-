const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// ─── RESIZE ẢNH BÌA / THUMBNAIL KHI UPLOAD ───────────────────────────────────
// Bìa sách + thumbnail practice/sample hiển thị tối đa ~200px trên UI nhưng
// admin thường upload ảnh gốc 150-180KB. Resize về COVER_WIDTH px + convert
// webp q80 ngay lúc upload → ~10-25KB.
//
// CHỈ áp cho ảnh bìa/thumbnail. KHÔNG dùng cho ảnh trong RichTextEditor / ảnh
// minh hoạ câu hỏi (map, chart, diagram) — những ảnh đó cần giữ nguyên độ phân
// giải (route /admin/upload-image không gọi hàm này).

const COVER_WIDTH = 1200
const WEBP_QUALITY = 88
// Chỉ xử lý ảnh raster phổ biến; .gif (có thể động) và .svg (vector) giữ nguyên.
const RESIZABLE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

/**
 * Resize file ảnh mà multer VỪA lưu xuống đĩa, ghi đè bằng bản .webp và
 * chuyển file gốc vào backend/uploads/_originals/ (không xóa). Không phóng to
 * ảnh nhỏ hơn COVER_WIDTH. Lỗi sharp → giữ nguyên file gốc (không chặn upload).
 *
 * Đọc ảnh vào buffer trước khi đưa cho sharp để không giữ file handle (tránh
 * EBUSY khi ghi đè trên Windows, và cho phép xử lý tại chỗ khi input đã là webp).
 *
 * @param {{ filename: string, path?: string }} file  req.file của multer
 * @param {{ dir: string, urlPrefix: string, originalsDir?: string }} opts    thư mục chứa file + prefix URL
 * @returns {Promise<{ filename: string, url: string }>}  tên + URL cuối cùng
 */
async function resizeUploadedCover(file, { dir, urlPrefix, originalsDir }) {
  const originalName = file.filename
  const ext = path.extname(originalName).toLowerCase()
  const passthrough = { filename: originalName, url: `${urlPrefix}/${originalName}` }

  fs.mkdirSync(dir, { recursive: true })
  const srcPath = file.path || path.join(dir, originalName)

  if (!RESIZABLE_EXT.has(ext)) {
    // .gif/.svg giữ nguyên (không resize) nhưng vẫn phải nằm ở `dir` khớp với
    // `urlPrefix` trả về — multer có thể đã lưu ở thư mục khác (route dùng
    // chung 1 multer instance cho nhiều đích khác nhau).
    const destPath = path.join(dir, originalName)
    if (path.resolve(destPath) !== path.resolve(srcPath) && fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath)
    }
    return passthrough
  }

  const outName = `${path.basename(originalName, ext)}.webp`
  const outPath = path.join(dir, outName)

  try {
    const input = fs.readFileSync(srcPath)
    const resized = await sharp(input)
      .rotate() // tôn trọng EXIF orientation trước khi bỏ metadata
      .resize({ width: COVER_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    // Chuyển file gốc vào backend/uploads/_originals/ thay vì xoá
    const uploadsDir = path.join(__dirname, '..', 'uploads')
    const baseOrigDir = originalsDir || path.join(uploadsDir, '_originals')
    const rel = path.relative(uploadsDir, dir)
    const targetOrigDir = (rel && !rel.startsWith('..') && !path.isAbsolute(rel))
      ? path.join(baseOrigDir, rel)
      : baseOrigDir
    fs.mkdirSync(targetOrigDir, { recursive: true })
    const origBackupPath = path.join(targetOrigDir, originalName)

    if (fs.existsSync(srcPath) && path.resolve(origBackupPath) !== path.resolve(srcPath)) {
      try {
        fs.renameSync(srcPath, origBackupPath)
      } catch (err) {
        if (err.code === 'EXDEV') {
          fs.copyFileSync(srcPath, origBackupPath)
          fs.unlinkSync(srcPath)
        } else {
          throw err
        }
      }
    }

    fs.writeFileSync(outPath, resized)

    return { filename: outName, url: `${urlPrefix}/${outName}` }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[resizeUploadedCover]', err.message)
    return passthrough
  }
}

module.exports = { resizeUploadedCover, COVER_WIDTH, WEBP_QUALITY }
