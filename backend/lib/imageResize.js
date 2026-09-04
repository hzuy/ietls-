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

const COVER_WIDTH = 400
const WEBP_QUALITY = 80
// Chỉ xử lý ảnh raster phổ biến; .gif (có thể động) và .svg (vector) giữ nguyên.
const RESIZABLE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

/**
 * Resize file ảnh mà multer VỪA lưu xuống đĩa, ghi đè bằng bản .webp và xoá
 * file gốc. Không phóng to ảnh nhỏ hơn COVER_WIDTH. Lỗi sharp → giữ nguyên file
 * gốc (không chặn upload).
 *
 * Đọc ảnh vào buffer trước khi đưa cho sharp để không giữ file handle (tránh
 * EBUSY khi ghi đè trên Windows, và cho phép xử lý tại chỗ khi input đã là webp).
 *
 * @param {{ filename: string, path?: string }} file  req.file của multer
 * @param {{ dir: string, urlPrefix: string }} opts    thư mục chứa file + prefix URL
 * @returns {Promise<{ filename: string, url: string }>}  tên + URL cuối cùng
 */
async function resizeUploadedCover(file, { dir, urlPrefix }) {
  const originalName = file.filename
  const ext = path.extname(originalName).toLowerCase()
  const passthrough = { filename: originalName, url: `${urlPrefix}/${originalName}` }

  if (!RESIZABLE_EXT.has(ext)) return passthrough

  const srcPath = file.path || path.join(dir, originalName)
  const outName = `${path.basename(originalName, ext)}.webp`
  const outPath = path.join(dir, outName)

  try {
    const input = fs.readFileSync(srcPath)
    const resized = await sharp(input)
      .rotate() // tôn trọng EXIF orientation trước khi bỏ metadata
      .resize({ width: COVER_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    fs.writeFileSync(outPath, resized)
    if (path.resolve(outPath) !== path.resolve(srcPath) && fs.existsSync(srcPath)) {
      fs.unlinkSync(srcPath)
    }
    return { filename: outName, url: `${urlPrefix}/${outName}` }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[resizeUploadedCover]', err.message)
    return passthrough
  }
}

module.exports = { resizeUploadedCover, COVER_WIDTH, WEBP_QUALITY }
