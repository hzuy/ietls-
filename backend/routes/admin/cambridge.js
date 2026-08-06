const express = require('express')
const router = express.Router()
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { adminOnly } = require('../../lib/roles')
const { cambridgeExtractSchema, cambridgeExtractSaveSchema } = require('../../validators/adminExamValidator')

const {
  pdfUpload,
  extractAllPages,
  savePagesJson,
  readPagesJson
} = require('../../services/cambridge/pdfExtractor')

const {
  analyzeBookStructure,
  extractTestContent,
  extractTestContentForSave
} = require('../../services/cambridge/aiQuestionParser')

const { createExamFromExtracted } = require('../../services/cambridge/examBuilder')

// Phase 1: Upload PDF → detect structure (with AI Phase 1)
router.post('/cambridge/upload', authMiddleware, adminOnly, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file PDF' })
    if (process.env.NODE_ENV !== 'production') console.log('[Cambridge] File received:', req.file.filename, req.file.size, 'bytes')

    const pages = await extractAllPages(req.file.path)
    const totalPages = pages.length
    if (process.env.NODE_ENV !== 'production') console.log('[Cambridge] Total pages extracted:', totalPages)

    // Store pages for later extraction
    const dataFile = savePagesJson(req.file.filename, pages)

    // AI Phase 1: Analyze structure
    const structure = await analyzeBookStructure(pages, req.file.originalname)

    res.json({ dataFile, originalName: req.file.originalname, structure })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[Cambridge] ERROR:', err)
    res.status(500).json({ message: 'Lỗi phân tích PDF', error: err.message, stack: err.stack?.substring(0, 500) })
  }
})

// Phase 2: Extract specific test + skill (Preview only)
router.post('/cambridge/extract', authMiddleware, adminOnly, validate(cambridgeExtractSchema), async (req, res) => {
  try {
    const { dataFile, testNumber, skill, startPage, endPage, answerStart, answerEnd, bookTitle } = req.body

    const pages = readPagesJson(dataFile)
    if (!pages) return res.status(404).json({ message: 'File không tồn tại, upload lại PDF' })

    const totalPages = pages.length
    const effStart = (startPage > 0) ? startPage : 1
    const effEnd   = (endPage   > 0) ? endPage   : totalPages

    if (process.env.NODE_ENV !== 'production') console.log('[Cambridge] Extracting', skill, 'test', testNumber, 'pages', effStart, '-', effEnd, '/', totalPages)

    const sectionText = pages
      .slice(Math.max(0, effStart - 1), effEnd)
      .map((p, i) => `=== PAGE ${effStart + i} ===\n${p}`)
      .join('\n\n')
    if (process.env.NODE_ENV !== 'production') console.log('[Cambridge] Section text length:', sectionText.length)

    let answerText = ''
    if (answerStart > 0 && answerEnd > 0) {
      answerText = pages
        .slice(Math.max(0, answerStart - 1), answerEnd)
        .map((p, i) => `=== PAGE ${answerStart + i} ===\n${p}`)
        .join('\n\n')
        .substring(0, 8000)
      if (process.env.NODE_ENV !== 'production') console.log('[Cambridge] Answer text length:', answerText.length)
    }

    let result
    try {
      result = await extractTestContent({ skill, testNumber, sectionText, answerText, bookTitle })
    } catch (parseErr) {
      if (process.env.NODE_ENV !== 'production') console.error('[Cambridge] JSON parse error:', parseErr.message)
      return res.status(422).json({
        message: 'AI trả về dữ liệu không hợp lệ. Hãy thử điều chỉnh lại số trang hoặc thử lại.',
        raw: parseErr.raw ? parseErr.raw.substring(0, 800) : ''
      })
    }

    res.json({ extracted: result.extracted })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[Cambridge] Extract error:', err)
    res.status(500).json({ message: 'Lỗi trích xuất nội dung', error: err.message })
  }
})

// SIMPLIFIED UPLOAD (No AI Phase 1)
router.post('/cambridge/upload-pdf', authMiddleware, adminOnly, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file PDF' })
    if (process.env.NODE_ENV !== 'production') console.log('[PDF Upload] File:', req.file.originalname, req.file.size, 'bytes')

    const pages = await extractAllPages(req.file.path)
    const pageCount = pages.length
    if (process.env.NODE_ENV !== 'production') console.log('[PDF Upload] Pages extracted:', pageCount)

    const dataFile = savePagesJson(req.file.filename, pages)

    res.json({ dataFile, originalName: req.file.originalname, pageCount })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[PDF Upload] ERROR:', err)
    res.status(500).json({ message: 'Lỗi đọc PDF: ' + err.message })
  }
})

// EXTRACT + SAVE TO DB (Groq AI)
router.post('/cambridge/extract-save', authMiddleware, adminOnly, validate(cambridgeExtractSaveSchema), async (req, res) => {
  try {
    const { dataFile, bookNumber, testNumber, skill, startPage, endPage, answerStart, answerEnd, seriesId } = req.body
    if (process.env.NODE_ENV !== 'production') console.log('[Extract] skill=%s test=%s pages=%s-%s answers=%s-%s', skill, testNumber, startPage, endPage, answerStart, answerEnd)

    const pages = readPagesJson(dataFile)
    if (!pages) return res.status(404).json({ message: 'File không tồn tại, upload lại PDF' })

    const total = pages.length
    const s = (startPage > 0) ? startPage : 1
    const e = (endPage   > 0) ? endPage   : total

    const contentText = pages.slice(s - 1, e).map((p, i) => `=== PAGE ${s + i} ===\n${p}`).join('\n\n')
    let answerText = ''
    if (answerStart > 0 && answerEnd > 0) {
      answerText = pages.slice(answerStart - 1, answerEnd).map((p, i) => `=== PAGE ${answerStart + i} ===\n${p}`).join('\n\n').substring(0, 6000)
    }
    if (process.env.NODE_ENV !== 'production') console.log('[Extract] Content chars:', contentText.length, '| Answer chars:', answerText.length)

    let parsed
    try {
      parsed = await extractTestContentForSave({ skill, bookNumber, testNumber, contentText, answerText, seriesId, s, e })
    } catch (parseErr) {
      if (process.env.NODE_ENV !== 'production') console.error('[Extract] JSON parse error:', parseErr.message)
      return res.status(422).json({
        message: `AI trả về JSON không hợp lệ: ${parseErr.message}. Hãy thử điều chỉnh phạm vi trang hoặc giảm số trang.`,
        raw: parseErr.raw ? parseErr.raw.substring(0, 800) : ''
      })
    }

    const { extracted, title: examTitle } = parsed

    // Validate content before saving
    if (skill === 'reading' && (!extracted.passages || extracted.passages.length === 0)) {
      return res.status(422).json({ message: 'AI không trích xuất được passage nào. Hãy kiểm tra lại phạm vi trang.', raw: '' })
    }
    if (skill === 'listening' && (!extracted.sections || extracted.sections.length === 0)) {
      return res.status(422).json({ message: 'AI không trích xuất được section nào. Hãy kiểm tra lại phạm vi trang.', raw: '' })
    }

    if (process.env.NODE_ENV !== 'production') console.log('[Extract] Parsed OK —', skill === 'reading' ? `${extracted.passages?.length} passages` : skill === 'listening' ? `${extracted.sections?.length} sections` : 'tasks OK')

    const finalTitle = extracted.title || examTitle
    const { examId, questionCount } = await createExamFromExtracted(skill, bookNumber, testNumber, finalTitle, extracted, seriesId)
    if (process.env.NODE_ENV !== 'production') console.log('[Extract] Created exam', examId, 'skill=', skill, 'questions=', questionCount)

    res.json({ examId, title: finalTitle, questionCount, skill, testNumber: parseInt(testNumber) })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[Extract] ERROR:', err)
    res.status(500).json({ message: 'Lỗi trích xuất: ' + err.message })
  }
})

module.exports = router
