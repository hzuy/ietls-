const express = require('express')
const cors = require('cors')
const compression = require('compression')
const multer = require('multer')
const path = require('path')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const readingRoutes = require('./routes/reading')
const listeningRoutes = require('./routes/listening')
const writingRoutes = require('./routes/writing')
const speakingRoutes = require('./routes/speaking')
const adminRoutes = require('./routes/admin')
const fulltestRoutes = require('./routes/fulltest')
const practiceRoutes = require('./routes/practice')
const samplesRoutes  = require('./routes/samples')
const homeRoutes = require('./routes/home')
const userRoutes = require('./routes/user')
const statsRoutes = require('./routes/stats')
const { router: chatbotRoutes } = require('./routes/chatbot')

const app = express()
app.disable('x-powered-by')

// Build CORS allowlist:
//   - Always include localhost (dev)
//   - If FRONTEND_URL is set in .env (e.g. https://hzuy.net), add it too
const CORS_ORIGINS = [
  'http://localhost:5173',
]
if (process.env.FRONTEND_URL) {
  CORS_ORIGINS.push(process.env.FRONTEND_URL)
}

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))

// Serve uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/reading', readingRoutes)
app.use('/api/listening', listeningRoutes)
app.use('/api/writing', writingRoutes)
app.use('/api/speaking', speakingRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/full-test', fulltestRoutes)
app.use('/api/practice',  practiceRoutes)
app.use('/api/samples',   samplesRoutes)
app.use('/api/home',      homeRoutes)
app.use('/api/user', userRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/chatbot', chatbotRoutes)
app.use('/uploads/thumbnails', express.static(path.join(__dirname, 'uploads', 'thumbnails')))

app.get('/', (req, res) => res.json({ message: 'IELTS App API đang chạy!' }))

// ─── Upload error handler ────────────────────────────────────────────────────
// Lỗi từ multer (vượt size, sai định dạng file) mặc định lọt thành HTML/plain 500,
// khiến frontend chỉ thấy "Lỗi lưu" chung chung. Bắt riêng, trả JSON { message }.
// Mọi lỗi khác giữ nguyên (chuyển tiếp cho error handler mặc định của Express).
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File vượt quá dung lượng cho phép' })
    }
    return res.status(400).json({ message: err.message || 'Lỗi tải file' })
  }
  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ message: err.message })
  }
  next(err)
})

const PORT = process.env.PORT || 3001
if (require.main === module) {
  const { printDbBanner } = require('./lib/dbInfo')
  printDbBanner('server.js')

  const httpServer = app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`))

  // Không có handler này, cổng đã bị chiếm (vd tiến trình server cũ chưa tắt
  // hẳn) sẽ ném lỗi 'error' không bắt được — trên Windows qua nodemon, thông
  // báo dễ bị chìm/khó nhận biết, khiến tưởng nhầm server mới đã chạy trong
  // khi thực ra request đang rơi vào tiến trình cũ (đã có sự cố thật do việc
  // này: tiến trình cũ trỏ production trả lời thay tiến trình mới trỏ dev).
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Cổng ${PORT} đã có tiến trình khác đang dùng — rất có thể là một server cũ chưa tắt hẳn.`)
      console.error(`   Kiểm tra và tắt tiến trình đó trước khi chạy lại (đừng giả định server mới đã chạy đúng).\n`)
    } else {
      console.error('\n❌ Lỗi khởi động server:', err.message, '\n')
    }
    process.exit(1)
  })
}

module.exports = app
