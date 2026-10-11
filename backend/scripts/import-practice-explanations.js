const fs = require('fs')
const path = require('path')
const prisma = require('../lib/prisma')
const { printDbBanner } = require('../lib/dbInfo')
const { classifyFamily, buildContext, enrichExplanation } = require('./generate-explanations')

const GROUP_QUESTION_TYPE = {
  note_completion: 'fill_blank',
  table_completion: 'table_completion',
  sentence_completion: 'fill_blank',
  summary_completion: 'fill_blank',
}

function parseArgs(argv) {
  const out = { dir: null, dryRun: false, force: false }
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--force') out.force = true
    else if (arg.startsWith('--dir=')) out.dir = arg.slice('--dir='.length)
  }
  return out
}

function loadFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(file => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    if (!Number.isInteger(data.examId) || !data.items || typeof data.items !== 'object') {
      throw new Error(`${file}: cần dạng { "examId": <số>, "items": { "<số câu>": {...} } }`)
    }
    return { file, ...data }
  })
}

function parseGroup(row) {
  try { return JSON.parse(row.content) } catch { return null }
}

function practiceQuestionContext(exam, group, number) {
  const question = (group.questions || []).find(q => Number(q.number) === Number(number))
  if (!question) return null
  const type = question.type || GROUP_QUESTION_TYPE[group.type] || group.type
  const noteSections = (group.noteSections || []).map(ns => ({
    ...ns,
    lines: (ns.lines || []).map(l => ({ ...l, contentWithTokens: l.contentWithTokens || l.content || '' })),
  }))
  const sectionText = exam.transcript || exam.passage || ''
  return {
    number: Number(number),
    type,
    questionText: question.questionText || '',
    options: question.options ? JSON.stringify(question.options) : null,
    correctAnswer: String(question.correctAnswer ?? ''),
    group: {
      type: group.type,
      instruction: group.instruction,
      noteSections,
      matchingOptions: group.matchingOptions || [],
      passage: exam.skill === 'reading' ? { body: sectionText } : null,
      section: exam.skill === 'listening' ? { transcript: sectionText } : null,
    },
    exam: { skill: exam.skill },
  }
}

async function importPracticeFile(entry, { dryRun = false, force = false } = {}) {
  const exam = await prisma.practiceExam.findUnique({
    where: { id: entry.examId },
    include: { questions: { orderBy: { orderNum: 'asc' } } },
  })
  if (!exam) throw new Error(`Không có đề practice #${entry.examId}`)

  const result = { saved: [], skipped: [], failed: [] }
  const updates = new Map()
  for (const [number, raw] of Object.entries(entry.items)) {
    const row = exam.questions.find(r => {
      const g = parseGroup(r)
      return g && (g.questions || []).some(q => Number(q.number) === Number(number))
    })
    if (!row) {
      result.failed.push({ number, reason: 'Không tìm thấy câu này trong đề' })
      continue
    }
    const current = updates.get(row.id) || { ...(row.explanation?.byNumber || {}) }
    if (current[number] && !force) {
      result.skipped.push({ number, reason: 'Đã có giải thích (dùng --force để ghi đè)' })
      continue
    }
    try {
      const q = practiceQuestionContext(exam, parseGroup(row), number)
      if (!q) throw new Error('Không dựng được ngữ cảnh câu hỏi')
      const family = classifyFamily(q.type)
      const explanation = enrichExplanation(raw, buildContext(q, family), q.correctAnswer, family)
      current[number] = explanation
      updates.set(row.id, current)
      result.saved.push({ number })
    } catch (err) {
      result.failed.push({ number, reason: err.message })
    }
  }

  if (!dryRun) {
    for (const [rowId, byNumber] of updates) {
      await prisma.practiceQuestion.update({ where: { id: rowId }, data: { explanation: { byNumber } } })
    }
  }
  return result
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.dir) throw new Error('Thiếu --dir=<thư mục chứa các file .json>')
  printDbBanner('import-practice-explanations.js')
  for (const entry of loadFiles(opts.dir)) {
    const r = await importPracticeFile(entry, opts)
    for (const f of r.failed) console.error(`LỖI [${entry.file}] câu ${f.number}: ${f.reason}`)
    for (const s of r.skipped) console.log(`BỎ QUA [${entry.file}] câu ${s.number}: ${s.reason}`)
    console.log(`${entry.file} (đề #${entry.examId}): ${r.saved.length} ${opts.dryRun ? 'hợp lệ' : 'đã ghi'}, ${r.skipped.length} bỏ qua, ${r.failed.length} lỗi`)
    if (r.failed.length) process.exitCode = 1
  }
  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
}

module.exports = { parseArgs, loadFiles, practiceQuestionContext, importPracticeFile }
