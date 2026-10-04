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
  MCQ: 'Đây là câu trắc nghiệm. "question_chunks" là phần thân câu hỏi. "distractors" PHẢI liệt kê TỪNG lựa chọn sai (ghi cả chữ cái, ví dụ "B. ...") kèm lý do sai dựa trên bài.',
  TFNG: 'Đây là câu True/False/Not Given hoặc Yes/No/Not Given. "question_chunks" là nhận định cần xét. Trong "reasoning" phân biệt rõ "bài nói ngược lại" (False/No) với "bài không đề cập" (Not Given). Nếu đáp án là NOT GIVEN và bài không có câu nào liên quan trực tiếp thì để "evidence_quote" là chuỗi rỗng. "distractors" là 2 đáp án còn lại kèm lý do loại.',
  MATCHING: 'Đây là câu nối thông tin. "question_chunks" là nhận định/câu hỏi cần nối. "distractors" là 1-3 lựa chọn dễ nhầm nhất trong danh sách để nối, kèm lý do không phù hợp.',
  COMPLETION: 'Đây là câu điền từ. "question_chunks" là câu chứa chỗ trống, viết chỗ trống thành "<số câu>. ___". "full_sentence" là câu hoàn chỉnh sau khi điền đáp án, "translation" là bản dịch tiếng Việt của câu đó. Trong "reasoning" nhắc giới hạn số từ nếu đề có. "distractors" là 1-3 từ trong bài dễ điền nhầm, kèm lý do.',
  IMAGE: 'Đây là câu dạng sơ đồ/bản đồ có HÌNH ẢNH minh họa mà bạn KHÔNG nhìn thấy được — chỉ dựa vào câu hỏi và đáp án đúng để đưa ra giải thích hợp lý nhất có thể, và trong "reasoning" PHẢI nêu rõ giới hạn "không có hình ảnh, đây là suy luận gián tiếp" để người học biết mức độ tin cậy.',
  GENERIC: 'Hãy giải thích dựa trên những thông tin có sẵn bên dưới.',
}

function normalizeText(s) {
  return String(s || '')
    .replace(/[‘’ʼ`'"“”]/g, '')
    .replace(/[–—‑]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function splitParagraphs(text) {
  return String(text || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean)
}

function findParagraph(paragraphs, phrase) {
  const target = normalizeText(phrase)
  if (!target) return -1
  return paragraphs.findIndex(p => normalizeText(p).includes(target))
}

function cleanString(v, max = 600) {
  return typeof v === 'string'
    ? v.replace(/^\s*STEP\s*0?\d\s*[—–:-]\s*/i, '').replace(/\[Q:(\d+)\]/g, '$1. ___').trim().slice(0, max)
    : ''
}

function cleanChunks(list, max = 10) {
  if (!Array.isArray(list)) return []
  return list
    .map(c => ({ text: cleanString(c?.text, 200), label: cleanString(c?.label, 80) }))
    .filter(c => c.text)
    .slice(0, max)
}

class ExplanationValidationError extends Error {}

function enrichExplanation(raw, ctx, correctAnswer, family = 'GENERIC') {
  if (!raw || typeof raw !== 'object') throw new ExplanationValidationError('JSON trả về không phải object')
  const questionChunks = cleanChunks(raw.question_chunks, 12)
  const predict = cleanString(raw.predict)
  const reasoning = cleanString(raw.reasoning, 900)
  if (!questionChunks.length) throw new ExplanationValidationError('Thiếu "question_chunks"')
  if (!predict) throw new ExplanationValidationError('Thiếu "predict"')
  if (!reasoning) throw new ExplanationValidationError('Thiếu "reasoning"')

  const paragraphs = splitParagraphs(ctx.sourceText)
  const hasSource = paragraphs.length > 0

  let evidence = null
  const quote = cleanString(raw.evidence_quote, 1200)
  if (quote && hasSource) {
    const parts = []
    for (const piece of quote.split(/\s*\|\s*/).filter(Boolean)) {
      const whole = findParagraph(paragraphs, piece)
      if (whole !== -1) {
        parts.push({ text: piece, paragraph: whole })
        continue
      }
      for (const sentence of piece.split(/(?<=[.!?;])\s+/).filter(Boolean)) {
        const found = findParagraph(paragraphs, sentence)
        if (found === -1) {
          throw new ExplanationValidationError(`"evidence_quote" không có nguyên văn trong bài: "${sentence.slice(0, 120)}"`)
        }
        parts.push({ text: sentence, paragraph: found })
      }
    }
    const normParts = parts.map(p => normalizeText(p.text))
    const chunks = cleanChunks(raw.evidence_chunks, 10)
      .map(c => {
        const target = normalizeText(c.text)
        const part = normParts.findIndex(np => np.includes(target))
        return { ...c, part, pos: part === -1 ? -1 : normParts[part].indexOf(target) }
      })
      .filter(c => c.part !== -1)
      .sort((a, b) => a.part - b.part || a.pos - b.pos)
      .map(({ text, label, part }) => ({ text, label, part }))
    evidence = { parts, paragraph: parts[0].paragraph, chunks }
  }

  const keywords = (Array.isArray(raw.locate_keywords) ? raw.locate_keywords : [])
    .map(k => cleanString(k, 120))
    .filter(k => k && (!hasSource || findParagraph(paragraphs, k) !== -1))
    .slice(0, 4)

  const locateParagraph = evidence
    ? evidence.paragraph
    : (keywords.length && hasSource ? findParagraph(paragraphs, keywords[0]) : null)

  const paraphrases = (Array.isArray(raw.paraphrases) ? raw.paraphrases : [])
    .map(p => ({
      question: cleanString(p?.question, 160),
      question_label: cleanString(p?.question_label, 80),
      passage: cleanString(p?.passage, 160),
      passage_label: cleanString(p?.passage_label, 80),
    }))
    .filter(p => p.question && p.passage && (!hasSource || findParagraph(paragraphs, p.passage) !== -1))
    .slice(0, 5)

  const distractors = (Array.isArray(raw.distractors) ? raw.distractors : [])
    .map(d => ({ option: cleanString(d?.option, 160), label: cleanString(d?.label, 80), reason: cleanString(d?.reason, 400) }))
    .filter(d => d.option && d.reason)
    .filter(d => family !== 'COMPLETION' || !hasSource || findParagraph(paragraphs, d.option) !== -1)
    .slice(0, 4)

  return {
    v: 2,
    question_chunks: questionChunks,
    predict,
    locate: {
      note: cleanString(raw.locate_note),
      keywords,
      paragraph: locateParagraph === -1 ? null : locateParagraph,
    },
    evidence,
    answer: cleanString(raw.answer, 200) || String(correctAnswer || ''),
    full_sentence: cleanString(raw.full_sentence),
    translation: cleanString(raw.translation),
    reasoning,
    paraphrases,
    distractors,
  }
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
  return { skill, parts, sourceText: passageText }
}

function buildPrompt(q, family, ctx, previousError = null) {
  const skillLabel = ctx.skill === 'reading' ? 'Reading' : ctx.skill === 'listening' ? 'Listening' : 'Practice'
  const sourceName = ctx.skill === 'listening' ? 'transcript' : 'bài đọc'
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

  const retryBlock = previousError
    ? `\nLẦN TRẢ LỜI TRƯỚC BỊ LOẠI VÌ: ${previousError}\nHãy sửa lỗi này. Mọi cụm trích từ ${sourceName} phải chép NGUYÊN VĂN từng chữ.\n`
    : ''

  return `Bạn là gia sư IELTS, giải thích theo phương pháp "Linear thinking": tách câu thành từng cụm ý ngắn, gắn nghĩa tiếng Việt cho từng cụm, rồi đối chiếu câu hỏi với ${sourceName} theo 4 bước. Đề thi ${skillLabel}.

${TYPE_INSTRUCTION[family]}

THÔNG TIN CÂU HỎI:
- Số câu: ${q.number ?? '(không rõ)'}
- Loại câu hỏi: ${q.type || '(không rõ)'}
- Câu hỏi: ${q.questionText || '(không có sẵn — xem ngữ cảnh bên dưới, câu hỏi nằm trong đó)'}
${optionsBlock}- Đáp án đúng: ${q.correctAnswer}

${contextBlock}
${retryBlock}
Trả về DUY NHẤT một JSON, không thêm chữ nào ngoài JSON. Phần giải thích viết bằng tiếng Việt, ngắn gọn, xưng "ta". Các trường:
{
  "question_chunks": [{ "text": "cụm tiếng Anh của câu hỏi", "label": "nghĩa/vai trò của cụm, 2-6 từ tiếng Việt" }],
  "predict": "1-2 câu: câu hỏi cần thông tin gì, dự đoán loại đáp án",
  "locate_note": "1-2 câu: ý nào trong câu hỏi giúp tìm vùng cần đọc, tìm thấy ở đâu",
  "locate_keywords": ["1-3 cụm NGUYÊN VĂN trong ${sourceName} giúp định vị"],
  "evidence_quote": "1-2 câu liên tiếp chép NGUYÊN VĂN từ ${sourceName} chứa thông tin trả lời, không viết tắt, không dùng dấu ... — nếu cần nhiều chỗ khác nhau trong ${sourceName}, chép riêng từng chỗ và ngăn cách bằng \\" | \\"",
  "evidence_chunks": [{ "text": "cụm quan trọng NGUYÊN VĂN nằm trong evidence_quote", "label": "nghĩa tiếng Việt 2-8 từ" }],
  "answer": "đáp án đúng như cách viết trong đề",
  "full_sentence": "câu hoàn chỉnh sau khi điền đáp án (chỉ cho câu điền từ, còn lại để rỗng)",
  "translation": "dịch tiếng Việt của full_sentence (để rỗng nếu full_sentence rỗng)",
  "reasoning": "2-3 câu: vì sao đáp án đúng, khớp với dự đoán ra sao",
  "paraphrases": [{ "question": "cụm trong câu hỏi", "question_label": "nghĩa", "passage": "cụm NGUYÊN VĂN trong ${sourceName}", "passage_label": "nghĩa" }],
  "distractors": [{ "option": "lựa chọn/từ dễ nhầm", "label": "nghĩa ngắn", "reason": "1-2 câu vì sao sai" }]
}

Ví dụ ngắn (câu điền từ, đáp án "timber"):
question_chunks: [{"text":"the grandfather","label":"người ông"},{"text":"built his wealth on two things:","label":"gây dựng của cải từ hai nguồn"},{"text":"1. ___","label":"nguồn còn thiếu"},{"text":"and the carrying of cargo by ship","label":"nguồn thứ hai: chở hàng bằng tàu"}]
evidence_chunks: [{"text":"made his fortune","label":"gây dựng cơ nghiệp"},{"text":"in the timber and shipping trades","label":"từ ngành gỗ và vận tải biển"}]
paraphrases: [{"question":"built his wealth","question_label":"gây dựng của cải","passage":"made his fortune","passage_label":"tạo dựng cơ nghiệp"}]`
}

function rateLimitWaitMs(err) {
  if (err?.status == null && /connection|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(`${err?.name} ${err?.message}`)) return 5000
  if (err?.status !== 429) return null
  const header = Number(err?.headers?.['retry-after'])
  if (Number.isFinite(header) && header > 0) return header * 1000 + 500
  const match = /try again in ([\d.]+)(ms|s)/i.exec(err?.message || '')
  if (match) return Math.ceil(parseFloat(match[1]) * (match[2] === 'ms' ? 1 : 1000)) + 1000
  return 20000
}

async function callGroq(prompt, { maxRateLimitRetries = 6 } = {}) {
  const groq = getGroqClient()
  let completion
  for (let attempt = 0; ; attempt++) {
    try {
      completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: getGroqModel(),
        temperature: 0.3,
      })
      break
    } catch (err) {
      const wait = rateLimitWaitMs(err)
      if (wait === null || attempt >= maxRateLimitRetries) throw err
      console.log(`   … Groq giới hạn tốc độ hoặc mất kết nối, chờ ${Math.round(wait / 1000)}s rồi thử lại`)
      await sleep(wait)
    }
  }
  const responseText = completion.choices[0]?.message?.content || ''
  const finishReason = completion.choices[0]?.finish_reason || null
  const cleaned = repairTruncatedJson(responseText, finishReason)
  return JSON.parse(cleaned)
}

async function generateExplanation(q, family, ctx) {
  let previousError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGroq(buildPrompt(q, family, ctx, previousError))
    try {
      return enrichExplanation(raw, ctx, q.correctAnswer, family)
    } catch (err) {
      if (!(err instanceof ExplanationValidationError) || attempt === 1) throw err
      previousError = err.message
    }
  }
  return null
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
  const explanation = await generateExplanation(q, family, ctx)
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
  const explanation = await generateExplanation(q, family, ctx)
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
  generateExplanation,
  enrichExplanation,
  normalizeText,
  splitParagraphs,
  ExplanationValidationError,
  extractPracticeQuestionText,
  processQuestion,
  processPracticeQuestion,
  main,
  SKIP_FAMILIES,
}
