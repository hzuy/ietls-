const path = require('path')
const fs = require('fs')
const multer = require('multer')
const pdfParse = require('pdf-parse')

const pdfsDir = path.join(__dirname, '..', '..', 'uploads', 'pdfs')

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(pdfsDir, { recursive: true })
    cb(null, pdfsDir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + '.pdf')
  }
})

const pdfUpload = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true)
    else cb(new Error('Chỉ chấp nhận file PDF'))
  },
  limits: { fileSize: 300 * 1024 * 1024 }
})

// Extract all pages with position-based sorting (handles two-column layouts)
async function extractAllPages(filePath) {
  const buf = fs.readFileSync(filePath)
  const pages = []

  await pdfParse(buf, {
    pagerender: (pageData) =>
      pageData.getTextContent({ normalizeWhitespace: true }).then(tc => {
        const items = tc.items.filter(i => i.str && i.str.trim())
        if (!items.length) { pages.push(''); return '' }

        // Detect two-column layout by x-coordinate distribution
        const xValues = items.map(i => i.transform[4])
        const xMin = Math.min(...xValues), xMax = Math.max(...xValues)
        const xMid = (xMin + xMax) / 2
        const leftCount = items.filter(i => i.transform[4] < xMid).length
        const rightCount = items.filter(i => i.transform[4] >= xMid).length
        const isTwoCol = leftCount > 8 && rightCount > 8 && Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount) > 0.25

        let ordered
        if (isTwoCol) {
          // Sort each column by y (top=high y in PDF coords), concat left then right
          const byY = arr => arr.slice().sort((a, b) => b.transform[5] - a.transform[5])
          ordered = [
            ...byY(items.filter(i => i.transform[4] < xMid)),
            ...byY(items.filter(i => i.transform[4] >= xMid))
          ]
        } else {
          // Single column: top-to-bottom, left-to-right
          ordered = items.slice().sort((a, b) => {
            const dy = b.transform[5] - a.transform[5]
            return Math.abs(dy) > 4 ? dy : a.transform[4] - b.transform[4]
          })
        }

        // Group items on same line (within 4pt vertically)
        const lines = []
        let line = [], lastY = null
        for (const item of ordered) {
          const y = item.transform[5]
          if (lastY !== null && Math.abs(y - lastY) > 4) {
            lines.push(line.join(' '))
            line = []
          }
          line.push(item.str.trim())
          lastY = y
        }
        if (line.length) lines.push(line.join(' '))

        const text = lines
          .filter(l => l.trim())
          .join('\n')
          // Remove common Cambridge PDF noise
          .replace(/\bGo on to the next page\.?\s*/gi, '')
          .replace(/\bTurn over( for.*)?\s*/gi, '')
          .replace(/\bPlease turn over\.?\s*/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        pages.push(text)
        return text
      })
  })

  return pages
}

function savePagesJson(filename, pages) {
  const dataFile = filename.replace('.pdf', '.json')
  fs.writeFileSync(path.join(pdfsDir, dataFile), JSON.stringify(pages))
  return dataFile
}

function readPagesJson(dataFile) {
  const dataPath = path.join(pdfsDir, dataFile)
  if (!fs.existsSync(dataPath)) return null
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
}

module.exports = {
  pdfsDir,
  pdfUpload,
  extractAllPages,
  savePagesJson,
  readPagesJson
}
