const multer = require('multer')
const path = require('path')
const fs = require('fs')

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(Object.assign(new Error('Chỉ chấp nhận file audio (mp3/wav/ogg/m4a/aac)'), { code: 'INVALID_FILE_TYPE' }))
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
})

const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(Object.assign(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp, svg)'), { code: 'INVALID_FILE_TYPE' }))
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
})

// Multer luôn lưu file vào uploadsDir (top-level) trước, vì các route dùng
// chung 1 multer instance (`upload`/`imageUpload`) nhưng muốn thư mục con đích
// khác nhau (audio/, questions/...). Hàm này move file đã lưu sang thư mục con
// đúng chỗ + trả về URL tương ứng.
function moveToSubdir(file, subdir) {
  const destDir = path.join(uploadsDir, subdir)
  fs.mkdirSync(destDir, { recursive: true })
  const destPath = path.join(destDir, file.filename)
  fs.renameSync(file.path, destPath)
  return `/uploads/${subdir}/${file.filename}`
}

module.exports = { uploadsDir, storage, upload, imageUpload, moveToSubdir }
