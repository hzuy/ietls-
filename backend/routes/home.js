const express = require('express')
const router = express.Router()
const {
  getPracticeListCached,
  getSampleListCached,
  getFullTestsCached,
} = require('../lib/publicContent')

// ─── GET /api/home ───────────────────────────────────────────────────────────
// Gộp 5 request mà trang chủ (Home.jsx) trước đây bắn riêng lẻ thành 1.
// Mỗi phần đi qua đúng SWR cache đã có ở lib/publicContent.js (cùng cache key
// với các endpoint lẻ /practice/*, /samples/*, /admin/full-tests — vẫn giữ),
// nên không thêm tải DB, chỉ bớt số round-trip client → Cloudflare → origin.
//
// limit=4: khớp với tham số Home.jsx dùng (practice mặc định 4, samples ?limit=4)
// → chia sẻ cache entry với endpoint lẻ.
router.get('/', async (req, res) => {
  try {
    const [fullTests, reading, listening, writingSamples, speakingSamples] = await Promise.all([
      getFullTestsCached(),
      getPracticeListCached('reading', 4),
      getPracticeListCached('listening', 4),
      getSampleListCached('writing', 4),
      getSampleListCached('speaking', 4),
    ])
    res.json({ fullTests, reading, listening, writingSamples, speakingSamples })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

module.exports = router
