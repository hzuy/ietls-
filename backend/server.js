const express = require('express')
const cors = require('cors')
const compression = require('compression')
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
const seriesRoutes = require('./routes/series')
const userRoutes = require('./routes/user')

const app = express()

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://ietls-gamma.vercel.app',
  ],
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
app.use('/api/series', seriesRoutes)
app.use('/api/user', userRoutes)
app.use('/uploads/thumbnails', express.static(path.join(__dirname, 'uploads', 'thumbnails')))

app.get('/', (req, res) => res.json({ message: 'IELTS App API đang chạy!' }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`))
