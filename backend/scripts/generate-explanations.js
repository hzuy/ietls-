// generate-explanations.js — sinh giải thích AI cho từng câu hỏi Reading/Listening
// (model Question) và Practice (model PracticeQuestion), MỘT LẦN cho mỗi câu,
// lưu vào cột `explanation` (Json?) để dùng chung cho mọi người dùng và mọi lượt
// xem — KHÔNG bao giờ gọi AI lúc người dùng mở trang kết quả.
//
// Idempotent & chạy lại được: điều kiện lọc luôn là `explanation IS NULL`, nên
// tiến độ chính là trạng thái trong DB — không cần file checkpoint riêng. Nếu
// script bị dừng giữa chừng (lỗi mạng, Ctrl+C...), chạy lại lệnh y hệt sẽ tự
// tiếp tục từ những câu chưa có giải thích.
//
// Mỗi câu xử lý độc lập trong try/catch riêng — một câu lỗi (Groq lỗi, JSON trả
// về không hợp lệ...) chỉ bị bỏ qua (log lỗi), không làm dừng cả script.
//
// Cách chạy (luôn qua with-dev-db.js trong giai đoạn này — KHÔNG chạy thẳng lên
// backend/.env, vốn trỏ chung Supabase production):
//   node scripts/with-dev-db.js -- node scripts/generate-explanations.js [flags]
//
// Flags:
//   --limit=N       chỉ xử lý N câu đầu tiên (mặc định: không giới hạn)
//   --delay=MS      độ trễ giữa các lần gọi Groq, tránh dồn dập (mặc định 400)
//   --skill=X       lọc theo skill: reading | listening (chỉ áp dụng cho Question)
//   --practice      xử lý PracticeQuestion thay vì Question
//   --dry-run       gọi AI và IN ra kết quả nhưng KHÔNG ghi vào DB — dùng để
//                   chạy thử/đánh giá chất lượng trước khi chạy thật
//   --ids=1,2,3     chỉ xử lý đúng các id này (bỏ qua điều kiện explanation IS
//                   NULL) — dùng để chạy thử trên vài câu cụ thể thuộc nhiều loại

const prisma = require('../lib/prisma')
const { Prisma } = require('@prisma/client')
const { getGroqClient, getGroqModel } = require('../lib/groqClient')
const { cleanJsonRaw, repairTruncatedJson } = require('../services/json/jsonSanitizer')
const { printDbBanner } = require('../lib/dbInfo')

function parseArgs(argv) {
  const out = { limit: null, delay: 400, skill: null, practice: false, dryRun: false, ids: null }
  for (const arg of argv) {
    if (arg === '--practice') out.practice = true
    else if (arg === '--dry-run') out.dryRun = true
    else if (arg.startsWith('--limit=')) out.limit = parseInt(arg.slice('--limit='.length), 10)
    else if (arg.startsWith('--delay=')) out.delay = parseInt(arg.slice('--delay='.length), 10)
    else if (arg.startsWith('--skill=')) out.skill = arg.slice('--skill='.length)
    else if (arg.startsWith('--ids=')) out.ids = arg.slice('--ids='.length).split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite)
  }
  return out
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// ─── Phân họ loại câu hỏi — quyết định ngữ cảnh nào cần gửi kèm + chỉ dẫn nào
// cho AI. Chung 1 schema JSON đầu ra cho mọi họ (đã xác nhận với người dùng).
const FAMILY = {
  MCQ: ['mcq', 'mcq_multi', 'choose_title', 'list_selection'],
  TFNG: ['true_false_ng', 'yes_no_ng'],
  MATCHING: ['matching', 'matching_headings', 'matching_features', 'matching_paragraph', 'matching_endings'],
  COMPLETION: ['fill_blank', 'short_answer', 'table_completion'],
  // diagram_label: xác nhận có thật trong dữ liệu production (không có trong comment
  // schema.prisma lẫn getTypeName của routes/reading.js|listening.js — có lẽ sinh ra
  // ngoài các map hiện có) — cùng họ với diagram_completion/map_diagram.
  IMAGE: ['diagram_completion', 'diagram_label', 'map_diagram'],
}

function classifyFamily(type) {
  for (const [family, types] of Object.entries(FAMILY)) {
    if (types.includes(type)) return family
  }
  return 'GENERIC'
}

const TYPE_INSTRUCTION = {
  MCQ: 'Đây là câu trắc nghiệm — trong "evidence", đối chiếu TỪNG lựa chọn sai với ngữ cảnh để giải thích vì sao chúng sai, không chỉ giải thích riêng đáp án đúng.',
  TFNG: 'Đây là câu Đúng/Sai/Không có thông tin — trong "reasoning", phân biệt rõ giữa "thông tin trái ngược với đoạn văn" (False/No) và "đoạn văn không đề cập tới" (Not Given).',
  MATCHING: 'Đây là câu nối thông tin — trong "evidence", chỉ rõ vì sao lựa chọn được nối là đúng, và vì sao (các) lựa chọn gần giống dễ gây nhầm lẫn lại không phù hợp.',
  COMPLETION: 'Đây là câu điền từ/bảng — trong "evidence", trích đúng cụm từ trong ngữ cảnh khớp với chỗ trống; nếu đề có giới hạn số từ thì nhắc lại giới hạn đó.',
  IMAGE: 'Đây là câu dạng sơ đồ/bản đồ có HÌNH ẢNH minh họa mà bạn KHÔNG nhìn thấy được — chỉ dựa vào câu hỏi và đáp án đúng để đưa ra giải thích hợp lý nhất có thể, và trong "reasoning" PHẢI nêu rõ giới hạn "không có hình ảnh, đây là suy luận gián tiếp" để người học biết mức độ tin cậy.',
  GENERIC: 'Hãy giải thích dựa trên những thông tin có sẵn bên dưới.',
}

// Tìm đoạn NoteSection (giữ nguyên token [Q:n]) chứa đúng câu hỏi này — nguồn
// ngữ cảnh thật cho câu điền từ/bảng, KHÔNG phải Question.questionText (các
// editor như NoteCompletionEditor.jsx không set trường này).
function findNoteSectionContext(group, questionNumber) {
  if (!group?.noteSections) return null
  const token = `[Q:${questionNumber}]`
  for (const section of group.noteSections) {
    const text = (section.lines || []).map(l => l.contentWithTokens || '').join('\n')
    if (text.includes(token)) return text
  }
  return null
}

function buildContext(q, family) {
  // 313/313 câu Question thật trong production đi qua groupId — Question.passageId
  // và Question.listeningSectionId trực tiếp đều rỗng (đã xác nhận bằng query đếm).
  // Đoạn văn/transcript luôn phải lấy qua group.passage / group.section.
  const passage = q.passage || q.group?.passage || null
  const listeningSection = q.listeningSection || q.group?.section || null
  const skill = passage ? 'reading' : (listeningSection ? 'listening' : (q.exam?.skill || 'reading'))
  const passageText = passage?.body || listeningSection?.transcript || listeningSection?.context || q.exam?.passage || null

  const parts = []
  if (family === 'COMPLETION') {
    const noteText = findNoteSectionContext(q.group, q.number)
    if (noteText) parts.push({ label: 'ĐOẠN GHI CHÚ CHỨA CHỖ TRỐNG (giữ nguyên nhãn [Q:n], chỗ trống cần giải thích là ' + `[Q:${q.number}]` + ')', text: noteText })
  }
  if (family === 'MATCHING' && q.group?.matchingOptions?.length) {
    const opts = q.group.matchingOptions.map(o => `${o.optionLetter}. ${o.optionText}`).join('\n')
    parts.push({ label: 'DANH SÁCH LỰA CHỌN ĐỂ NỐI', text: opts })
  }
  if (passageText) {
    parts.push({ label: skill === 'reading' ? 'ĐOẠN VĂN' : 'TRANSCRIPT (BÀI NGHE)', text: passageText })
  } else if (family !== 'IMAGE') {
    parts.push({ label: 'NGỮ CẢNH', text: '(không có — chỉ dựa vào câu hỏi và đáp án đúng bên dưới)' })
  }
  return { skill, parts }
}

function buildPrompt(q, family, ctx) {
  const skillLabel = ctx.skill === 'reading' ? 'Reading' : ctx.skill === 'listening' ? 'Listening' : 'Practice'
  let optionsBlock = ''
  if (q.options) {
    try {
      const opts = JSON.parse(q.options)
      if (Array.isArray(opts) && opts.length) {
        optionsBlock = `- Các lựa chọn: ${opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}\n`
      }
    } catch { /* options không parse được — bỏ qua, không chặn cả câu */ }
  }

  const contextBlock = ctx.parts.map(p => `${p.label}:\n${p.text}`).join('\n\n')

  return `Bạn là gia sư IELTS. Viết giải thích ngắn gọn, súc tích cho MỘT câu hỏi trong đề thi ${skillLabel}, giúp người học hiểu vì sao đáp án đúng lại đúng.

${TYPE_INSTRUCTION[family]}

THÔNG TIN CÂU HỎI:
- Loại câu hỏi: ${q.type || '(không rõ)'}
- Câu hỏi: ${q.questionText || '(không có sẵn — xem ngữ cảnh bên dưới, câu hỏi nằm trong đó)'}
${optionsBlock}- Đáp án đúng: ${q.correctAnswer}

${contextBlock}

Trả về DUY NHẤT một JSON với đúng 4 trường sau, không thêm chữ nào khác ngoài JSON, viết bằng tiếng Việt, mỗi trường 1-3 câu ngắn gọn, không lặp lại nguyên văn đáp án ở nhiều trường:
{
  "restatement": "Diễn đạt lại câu hỏi đang kiểm tra điều gì",
  "evidence": "Trích dẫn/đối chiếu cụ thể với ngữ cảnh phía trên",
  "reasoning": "Các bước suy luận từ ngữ cảnh tới đáp án",
  "conclusion": "Kết luận ngắn gọn vì sao đáp án đúng là như trên"
}`
}

async function callGroq(prompt) {
  const groq = getGroqClient()
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: getGroqModel(),
    temperature: 0.3,
  })
  const responseText = completion.choices[0]?.message?.content || ''
  const finishReason = completion.choices[0]?.finish_reason || null
  const cleaned = repairTruncatedJson(responseText, finishReason)
  const parsed = JSON.parse(cleaned)
  for (const field of ['restatement', 'evidence', 'reasoning', 'conclusion']) {
    if (typeof parsed[field] !== 'string' || !parsed[field].trim()) {
      throw new Error(`Thiếu hoặc sai kiểu trường "${field}" trong JSON trả về`)
    }
  }
  return parsed
}

async function fetchQuestions({ limit, skill, ids }) {
  const where = ids ? { id: { in: ids } } : { explanation: { equals: Prisma.DbNull } }
  // Question.passageId/listeningSectionId trực tiếp luôn rỗng trong dữ liệu thật
  // (mọi câu đi qua groupId) — lọc theo skill phải đi qua group.passage/group.section.
  if (!ids && skill === 'reading') where.group = { passage: { isNot: null } }
  if (!ids && skill === 'listening') where.group = { section: { isNot: null } }

  return prisma.question.findMany({
    where,
    select: {
      id: true, number: true, type: true, questionText: true, options: true, correctAnswer: true,
      passage: { select: { body: true } },
      listeningSection: { select: { transcript: true, context: true } },
      group: {
        select: {
          type: true,
          passage: { select: { body: true } },
          section: { select: { transcript: true, context: true } },
          matchingOptions: { select: { optionLetter: true, optionText: true }, orderBy: { sortOrder: 'asc' } },
          noteSections: {
            select: { lines: { select: { contentWithTokens: true }, orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  })
}

async function fetchPracticeQuestions({ limit, ids }) {
  const where = ids ? { id: { in: ids } } : { explanation: { equals: Prisma.DbNull } }
  return prisma.practiceQuestion.findMany({
    where,
    select: {
      id: true, content: true, type: true, options: true, correctAnswer: true,
      exam: { select: { skill: true, passage: true } },
    },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  })
}

// PracticeQuestion.content đôi khi là JSON.stringify của cả object câu hỏi
// (routes/practice.js create/update) — cố gắng lấy phần text đọc được, nếu
// không parse được thì dùng nguyên văn (an toàn, không throw).
function extractPracticeQuestionText(content) {
  if (!content) return ''
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') return obj.questionText || obj.content || obj.text || content
  } catch { /* không phải JSON — dùng nguyên văn */ }
  return content
}

// Nhóm IMAGE (diagram_label/diagram_completion/map_diagram) hầu như luôn thiếu
// hoàn toàn ngữ cảnh văn bản (đã xác nhận trên dữ liệu thật: context/transcript
// rỗng, matchingOptions không có text — chỉ là nhãn vị trí trên hình ảnh gốc).
// Test thực tế cho thấy AI BỊA ĐẶT bằng chứng không có thật khi ép nó giải thích
// trong tình huống này (vd "cửa hàng nằm gần trại bò, vườn rau" — không hề có
// trong dữ liệu) — không siết được bằng prompt một cách đáng tin cậy, nên bỏ
// qua hẳn nhóm này thay vì chấp nhận rủi ro dạy sai cho người học. Các câu này
// giữ nguyên explanation = null — UI (bước 9) không hiện khu vực giải thích,
// không hiện lỗi, hoạt động bình thường.
const SKIP_FAMILIES = new Set(['IMAGE'])

async function processQuestion(q, { dryRun }) {
  const family = classifyFamily(q.type)
  if (SKIP_FAMILIES.has(family)) return { skipped: true }
  const ctx = buildContext(q, family)
  const prompt = buildPrompt(q, family, ctx)
  const explanation = await callGroq(prompt)
  if (!dryRun) {
    await prisma.question.update({ where: { id: q.id }, data: { explanation } })
  }
  return { skipped: false, explanation }
}

async function processPracticeQuestion(pq, { dryRun }) {
  const family = classifyFamily(pq.type)
  if (SKIP_FAMILIES.has(family)) return { skipped: true }
  const q = {
    id: pq.id,
    number: null,
    type: pq.type,
    questionText: extractPracticeQuestionText(pq.content),
    options: pq.options,
    correctAnswer: pq.correctAnswer || '(không có đáp án lưu sẵn)',
    passage: null,
    listeningSection: null,
    group: null,
    exam: pq.exam,
  }
  const ctx = buildContext(q, family)
  const prompt = buildPrompt(q, family, ctx)
  const explanation = await callGroq(prompt)
  if (!dryRun) {
    await prisma.practiceQuestion.update({ where: { id: pq.id }, data: { explanation } })
  }
  return { skipped: false, explanation }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  printDbBanner('generate-explanations.js')
  console.log('=== generate-explanations.js ===')
  console.log('Options:', opts)

  const rows = opts.practice
    ? await fetchPracticeQuestions(opts)
    : await fetchQuestions(opts)

  const label = opts.practice ? 'PracticeQuestion' : 'Question'
  console.log(`Tìm thấy ${rows.length} ${label} cần xử lý.\n`)

  let ok = 0, failed = 0, skipped = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const tag = `[${i + 1}/${rows.length}] ${label}#${row.id} (type=${row.type || '?'})`
    try {
      const result = opts.practice
        ? await processPracticeQuestion(row, opts)
        : await processQuestion(row, opts)
      if (result.skipped) {
        skipped++
        console.log(`${tag} SKIP — nhóm loại câu hỏi không đủ ngữ cảnh (xem SKIP_FAMILIES)`)
      } else {
        ok++
        console.log(`${tag} OK${opts.dryRun ? ' (dry-run, chưa ghi DB)' : ''}`)
        if (opts.dryRun) console.log(JSON.stringify(result.explanation, null, 2))
      }
    } catch (err) {
      failed++
      console.error(`${tag} LỖI — bỏ qua: ${err.message}`)
    }
    if (i < rows.length - 1 && opts.delay > 0) await sleep(opts.delay)
  }

  console.log(`\nHoàn tất: ${ok} thành công, ${skipped} bỏ qua (thiếu ngữ cảnh), ${failed} lỗi, ${rows.length} tổng.`)
  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
}

module.exports = {
  parseArgs,
  classifyFamily,
  findNoteSectionContext,
  buildContext,
  buildPrompt,
  callGroq,
  extractPracticeQuestionText,
  processQuestion,
  processPracticeQuestion,
  main,
  SKIP_FAMILIES,
}
