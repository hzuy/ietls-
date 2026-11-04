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
const { getGroqClient, getGroqModel, requestGeminiJson } = require('../lib/groqClient')
const { cleanJsonRaw, repairTruncatedJson } = require('../services/json/jsonSanitizer')
const { printDbBanner } = require('../lib/dbInfo')
// Dùng chung bộ chuyển ảnh (local /uploads + Cloudinary URL) sang data URI với
// phần chấm Writing Task 1 — tránh viết lại logic đọc file.
const { resolveImageToDataUri } = require('../lib/writingGrading')

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
  COMPLETION: [
    'fill_blank',
    'short_answer',
    'table_completion',
    'note_completion',
    'sentence_completion',
    'summary_completion',
    'flow_chart_completion',
  ],
  // diagram_label: xác nhận có thật trong dữ liệu production (không có trong comment
  // schema.prisma lẫn getTypeName của routes/reading.js|listening.js — có lẽ sinh ra
  // ngoài các map hiện có) — cùng họ với diagram_completion/map_diagram.
  // Nhóm này BẮT BUỘC phải có ảnh (group.imageUrl hoặc question.imageUrl) vì đề bài
  // nằm trong hình; ảnh được gửi kèm cho Gemini vision (xem buildContext).
  IMAGE: ['diagram_completion', 'diagram_label', 'map_diagram'],
}

const IMAGE_FAMILY = 'IMAGE'

function classifyFamily(type) {
  for (const [family, types] of Object.entries(FAMILY)) {
    if (types.includes(type)) return family
  }
  return 'GENERIC'
}

// ─── Hình ảnh của câu hỏi (bản đồ / sơ đồ) ───────────────────────────────────
// Ảnh có thể nằm ở cấp câu hỏi (Question.imageUrl) hoặc cấp nhóm câu hỏi
// (QuestionGroup.imageUrl). Với Practice, group được dựng lại từ JSON nên
// practiceQuestionContext cũng phải copy imageUrl sang qCtx.group.
function collectQuestionImages(q) {
  if (!q || typeof q !== 'object') return []
  const candidates = [q.imageUrl, q.group?.imageUrl]
  const seen = new Set()
  const out = []
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const url = value.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

// Cache nhỏ (theo tiến trình) để 5 câu cùng một bản đồ không phải tải/đọc ảnh 5 lần.
const IMAGE_DATA_URI_CACHE = new Map()
const IMAGE_DATA_URI_CACHE_LIMIT = 8

async function resolveContextImages(urls = []) {
  const resolved = []
  for (const url of urls) {
    let dataUri = IMAGE_DATA_URI_CACHE.get(url)
    if (dataUri === undefined) {
      dataUri = await resolveImageToDataUri(url)
      if (IMAGE_DATA_URI_CACHE.size >= IMAGE_DATA_URI_CACHE_LIMIT) {
        IMAGE_DATA_URI_CACHE.delete(IMAGE_DATA_URI_CACHE.keys().next().value)
      }
      IMAGE_DATA_URI_CACHE.set(url, dataUri)
    }
    if (dataUri) resolved.push(dataUri)
  }
  return resolved
}

// Câu thuộc họ IMAGE mà không có ảnh nào thì KHÔNG thể giải thích đúng (đề bài nằm
// trong hình). Trả về true để nơi gọi bỏ qua thay vì để AI bịa vị trí.
function isUnsupportedExplanationQuestion(q, family) {
  if (family !== IMAGE_FAMILY) return false
  return collectQuestionImages(q).length === 0
}

const TYPE_INSTRUCTION = {
  MCQ: 'Đây là câu trắc nghiệm. "question_chunks" là phần thân câu hỏi. Nếu câu hỏi yêu cầu chọn nhiều chữ cái (như Choose TWO letters hoặc loại câu mcq_multi), "answer" PHẢI ghi đầy đủ các chữ cái cách nhau bằng dấu phẩy theo thứ tự chữ cái (ví dụ "B, C"). "distractors" PHẢI liệt kê TỪNG lựa chọn sai (ghi cả chữ cái, ví dụ "B. ...") kèm lý do sai dựa trên bài.',
  TFNG: 'Đây là câu True/False/Not Given hoặc Yes/No/Not Given. "question_chunks" là nhận định cần xét. Trong "reasoning" phân biệt rõ "bài nói ngược lại" (False/No) với "bài không đề cập" (Not Given). Nếu đáp án là NOT GIVEN và bài không có câu nào liên quan trực tiếp thì để "evidence_quote" là chuỗi rỗng. "distractors" là 2 đáp án còn lại kèm lý do loại.',
  MATCHING: 'Đây là câu nối thông tin. "question_chunks" là nhận định/câu hỏi cần nối. "distractors" là 1-3 lựa chọn dễ nhầm nhất trong danh sách để nối, kèm lý do không phù hợp.',
  COMPLETION: 'Đây là câu điền từ. "question_chunks" là câu chứa chỗ trống, viết chỗ trống thành "<số câu>. ___". "full_sentence" là câu hoàn chỉnh sau khi điền đáp án, "translation" là bản dịch tiếng Việt của câu đó. Trong "reasoning" nhắc giới hạn số từ nếu đề có. "distractors" là 1-3 từ trong bài dễ điền nhầm, kèm lý do.',
  IMAGE: 'Đây là câu LABEL MAP/DIAGRAM: đề bài nằm trong HÌNH ẢNH bản đồ/sơ đồ được đính kèm trong tin nhắn này. BẮT BUỘC quan sát hình để xác định chỗ trống/vị trí của câu hỏi (chữ cái A, B, C... hoặc chỗ trống trên sơ đồ), rồi đối chiếu với transcript/bài đọc để chọn đáp án đúng. Trong "reasoning" PHẢI nêu rõ vị trí trên hình (ví dụ: "vị trí G nằm ở góc trái phía trên khu Old Stables, ngay trên bãi đỗ xe") để người học đối chiếu được với hình. Tuyệt đối KHÔNG bịa vị trí/chi tiết không có trên hình; nếu không xác định được vị trí của câu hỏi trên hình, nói rõ điều đó trong "reasoning".',
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

const ROMAN_NUMERALS = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
])

function stripTrailingPunctuation(str) {
  if (typeof str !== 'string') return ''
  return str.trim().replace(/[.,;:!?]+$/, '').trim()
}

function extractOptionPairs(rawOptions) {
  if (!rawOptions) return []
  let opts = rawOptions
  if (typeof opts === 'string') {
    try { opts = JSON.parse(opts) } catch { return [] }
  }
  if (!Array.isArray(opts)) return []

  return opts.map((item, index) => {
    const defaultLetter = String.fromCharCode(65 + index)
    if (typeof item === 'string') {
      const trimmed = item.trim()
      // Check Roman numeral prefix: "iv. Heading text"
      const romanMatch = trimmed.match(/^(x{0,3}(?:ix|iv|v?i{1,3}))[\.\:\)]\s*(.*)$/i)
      if (romanMatch && ROMAN_NUMERALS.has(romanMatch[1].toLowerCase())) {
        return { letter: romanMatch[1].toLowerCase(), text: stripTrailingPunctuation(romanMatch[2]) }
      }
      // Check letter prefix: "A. Option text"
      const letterMatch = trimmed.match(/^([A-Za-z])[\.\:\)]\s*(.*)$/)
      if (letterMatch) {
        return { letter: letterMatch[1].toUpperCase(), text: stripTrailingPunctuation(letterMatch[2]) }
      }
      return { letter: defaultLetter, text: stripTrailingPunctuation(trimmed) }
    }
    if (item && typeof item === 'object') {
      const rawLetter = String(item.optionLetter || item.letter || defaultLetter).trim()
      const isRoman = ROMAN_NUMERALS.has(rawLetter.toLowerCase())
      const letter = isRoman ? rawLetter.toLowerCase() : rawLetter.toUpperCase()
      const text = stripTrailingPunctuation(item.optionText || item.text || '')
      return { letter, text }
    }
    return { letter: defaultLetter, text: String(item || '') }
  }).filter(Boolean)
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

const VIETNAMESE_DIACRITICS_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

function isVietnameseTranslation(text) {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  if (trimmed.length < 2) return false

  const letters = trimmed.match(/[\p{L}]/gu) || []
  if (letters.length === 0) return false

  let accentedCount = 0
  for (const ch of letters) {
    if (VIETNAMESE_DIACRITICS_REGEX.test(ch)) {
      accentedCount++
    }
  }

  // 1. Phải có ít nhất 1 ký tự mang dấu thanh/ký tự đặc trưng tiếng Việt
  if (accentedCount === 0) return false

  // 2. Tỷ lệ ký tự có dấu trên tổng số chữ cái:
  // Tiếng Việt chuẩn có tỷ lệ ký tự có dấu từ 15% - 40%.
  // Nếu tỷ lệ ký tự có dấu < 12% trên chuỗi dài >= 15 chữ cái -> chuỗi lai tạp hoặc câu tiếng Anh bị chèn vài từ.
  const accentedRatio = accentedCount / letters.length
  if (letters.length >= 15 && accentedRatio < 0.12) {
    return false
  }

  // 3. Phân tách theo mệnh đề / câu độc lập:
  // (a) Kiểm tra các cụm trong ngoặc (...) hoặc [...]:
  //     - Thuật ngữ ngắn (<= 4 từ hoặc < 25 chữ cái) được phép (thuật ngữ khoa học đối chiếu).
  //     - Nếu trong ngoặc là cả một câu tiếng Anh dài (>= 5 từ và >= 25 chữ cái) không có dấu -> từ chối.
  const parentheticalMatches = trimmed.match(/\([^\)]+\)|\[[^\]]+\]/g) || []
  for (const p of parentheticalMatches) {
    const inner = p.slice(1, -1).trim()
    const pLetters = inner.match(/[\p{L}]/gu) || []
    const pWords = inner.split(/\s+/).filter(Boolean)
    if (pWords.length >= 5 && pLetters.length >= 25) {
      const hasDiacritic = pLetters.some((ch) => VIETNAMESE_DIACRITICS_REGEX.test(ch))
      if (!hasDiacritic) {
        return false
      }
    }
  }

  // (b) Loại bỏ các cụm trong ngoặc trước khi kiểm tra các mệnh đề chính
  const textWithoutParens = trimmed.replace(/\([^\)]+\)|\[[^\]]+\]/g, ' ')
  const clauses = textWithoutParens.split(/[\.\!\?;\:\n\r—–]|\s+-\s+/).map((s) => s.trim()).filter(Boolean)
  for (const clause of clauses) {
    const clauseLetters = clause.match(/[\p{L}]/gu) || []
    const clauseWords = clause.split(/\s+/).filter(Boolean)
    if (clauseLetters.length >= 12 && clauseWords.length >= 3) {
      const hasDiacritic = clauseLetters.some((ch) => VIETNAMESE_DIACRITICS_REGEX.test(ch))
      if (!hasDiacritic) {
        return false
      }
    }
  }

  return true
}

function enrichExplanation(raw, ctx, correctAnswer, family = 'GENERIC', { attempt = 0 } = {}) {
  if (!raw || typeof raw !== 'object') throw new ExplanationValidationError('JSON trả về không phải object')
  const questionChunks = cleanChunks(raw.question_chunks, 12)
  const predict = cleanString(raw.predict)
  const reasoning = cleanString(raw.reasoning, 900)
  if (!questionChunks.length) throw new ExplanationValidationError('Thiếu "question_chunks"')
  if (!predict) throw new ExplanationValidationError('Thiếu "predict"')
  if (!reasoning) throw new ExplanationValidationError('Thiếu "reasoning"')

  const answer = cleanString(raw.answer, 200)
  if (!answer) {
    throw new ExplanationValidationError('Thiếu hoặc rỗng trường "answer" trong kết quả AI')
  }

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

  let fullSentence = ''
  let translation = ''

  if (family === 'COMPLETION') {
    const rawTranslation = cleanString(raw.translation)
    const rawFullSentence = cleanString(raw.full_sentence)

    if (rawTranslation && isVietnameseTranslation(rawTranslation)) {
      fullSentence = rawFullSentence
      translation = rawTranslation
    } else {
      if (attempt === 0) {
        throw new ExplanationValidationError(
          'Bản dịch (translation) cho câu điền từ phải là câu tiếng Việt hoàn chỉnh có dấu thanh, không được để tiếng Anh hoặc ghép cả hai ngôn ngữ.'
        )
      } else {
        // Sau khi retry tối đa vẫn vi phạm -> bỏ trường translation / full_sentence thay vì lưu nội dung sai
        fullSentence = ''
        translation = ''
      }
    }
  }

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
    answer,
    full_sentence: fullSentence,
    translation,
    reasoning,
    teacher_note: cleanString(raw.teacher_note, 1000) || null,
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
  const images = collectQuestionImages(q)

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
  if (images.length) {
    parts.push({
      label: 'HÌNH ẢNH ĐÍNH KÈM',
      text: `Có ${images.length} hình ảnh bản đồ/sơ đồ của nhóm câu hỏi được đính kèm ngay sau tin nhắn này. Hãy quan sát hình để xác định vị trí/chỗ trống của câu hỏi.`,
    })
  } else if (family === 'IMAGE') {
    parts.push({ label: 'HÌNH ẢNH ĐÍNH KÈM', text: '(không có ảnh — không thể xác định vị trí trên bản đồ/sơ đồ)' })
  }
  return { skill, parts, sourceText: passageText, images }
}

function buildPrompt(q, family, ctx, previousError = null, teacherFeedback = null, optionsOrFixed = {}) {
  const isFixedMode = Boolean(optionsOrFixed?.isFixedMode)
  const targetAnswer = optionsOrFixed?.targetAnswer != null ? String(optionsOrFixed.targetAnswer).trim() : null
  const skillLabel = ctx.skill === 'reading' ? 'Reading' : ctx.skill === 'listening' ? 'Listening' : 'Practice'
  const sourceName = ctx.skill === 'listening' ? 'transcript' : 'bài đọc'

  let optionsBlock = ''
  const pairs = extractOptionPairs(q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null))
  if (pairs.length > 0) {
    optionsBlock = `- Các lựa chọn: ${pairs.map(p => `${p.letter}. ${p.text}`).join(' | ')}\n`
  }

  const contextBlock = ctx.parts.map(p => `${p.label}:\n${p.text}`).join('\n\n')

  const hasSource = Boolean(ctx.sourceText && String(ctx.sourceText).trim())
  const hasImages = Array.isArray(ctx.images) && ctx.images.length > 0
  const imageBlock = hasImages
    ? `\nHÌNH ẢNH: ${ctx.images.length} hình ảnh bản đồ/sơ đồ của nhóm câu hỏi được đính kèm ngay sau tin nhắn này. Hãy QUAN SÁT hình để định vị chỗ trống/chữ cái của câu hỏi, rồi mới giải thích.\n`
    : ''
  const noSourceBlock = hasSource
    ? ''
    : `\nLƯU Ý: Câu hỏi này KHÔNG có transcript/bài đọc đi kèm, nên "evidence_quote", "locate_keywords" và "paraphrases" hãy để rỗng — TUYỆT ĐỐI không bịa dẫn chứng.\n`

  const retryBlock = previousError
    ? `\nLẦN TRẢ LỜI TRƯỚC BỊ LOẠI VÌ: ${previousError}\nHãy sửa lỗi này. Mọi cụm trích từ ${sourceName} phải chép NGUYÊN VĂN từng chữ.\n`
    : ''

  const feedbackBlock = teacherFeedback
    ? `\nGÓP Ý / HƯỚNG DẪN TỪ GIÁO VIÊN: "${teacherFeedback}"\n(LƯU Ý: Góp ý này chỉ định hướng cách giải thích và trọng tâm cần làm rõ. Mọi dẫn chứng bắt buộc phải trích NGUYÊN VĂN từ ${sourceName}, không được bịa đặt dẫn chứng.)\n`
    : ''

  let modeInstruction = ''
  let jsonFieldsInstruction = ''

  if (isFixedMode && targetAnswer) {
    modeInstruction = `CHẾ ĐỘ GIẢI THÍCH THEO ĐÁP ÁN ĐÃ CHỐT:
1. Đáp án đã chốt cho câu hỏi này là: "${targetAnswer}".
2. Bạn hãy đóng vai gia sư IELTS giải thích theo phương pháp Linear thinking vì sao đáp án "${targetAnswer}" là đúng dựa trên ${sourceName}.
3. Mọi bằng chứng trích dẫn trong "evidence_quote" bắt buộc phải chép NGUYÊN VĂN từ ${sourceName}.
4. QUY TẮC BẮT BUỘC VỀ "no_support":
   - Nếu ${sourceName} trực tiếp mâu thuẫn/bác bỏ đáp án "${targetAnswer}", HOẶC ${sourceName} KHÔNG CÓ bất kỳ bằng chứng nào ủng hộ "${targetAnswer}": bạn PHẢI đặt "no_support": true và TUYỆT ĐỐI KHÔNG BỊA ĐẶT DẪN CHỨNG.
   - Chỉ đặt "no_support": false khi bạn THỰC SỰ tìm được câu trong ${sourceName} chứng tỏ "${targetAnswer}" đúng.
   - Khi "no_support": true, điền "support_note" giải thích ngắn gọn bài đang ủng hộ đáp án nào / vì sao bài không ủng hộ "${targetAnswer}".`

    jsonFieldsInstruction = `{
  "no_support": false,
  "support_note": "nếu no_support=true: giải thích ngắn gọn bài không ủng hộ đáp án đã chốt; nếu no_support=false thì để rỗng",
  "question_chunks": [{ "text": "cụm tiếng Anh của câu hỏi", "label": "nghĩa/vai trò của cụm, 2-6 từ tiếng Việt" }],
  "predict": "1-2 câu: câu hỏi cần thông tin gì, dự đoán loại đáp án",
  "locate_note": "1-2 câu: ý nào trong câu hỏi giúp tìm vùng cần đọc, tìm thấy ở đâu",
  "locate_keywords": ["1-3 cụm NGUYÊN VĂN trong ${sourceName} giúp định vị"],
  "evidence_quote": "1-2 câu liên tiếp chép NGUYÊN VĂN từ ${sourceName} chứa thông tin trả lời",
  "evidence_chunks": [{ "text": "cụm quan trọng NGUYÊN VĂN nằm trong evidence_quote", "label": "nghĩa tiếng Việt 2-8 từ" }],
  "answer": "${targetAnswer}",
  "full_sentence": "câu hoàn chỉnh sau khi điền đáp án (chỉ cho câu điền từ, còn lại để rỗng)",
  "translation": "dịch tiếng Việt của full_sentence (để rỗng nếu full_sentence rỗng)",
  "reasoning": "2-3 câu: chứng minh mạch tư duy vì sao đáp án này đúng theo ${sourceName}. Dành cho học sinh đọc — TUYỆT ĐỐI KHÔNG nhắc người dùng, người nhập, giáo viên, ngộ nhận.",
  "paraphrases": [{ "question": "cụm trong câu hỏi", "question_label": "nghĩa", "passage": "cụm NGUYÊN VĂN trong ${sourceName}", "passage_label": "nghĩa" }],
  "distractors": [{ "option": "lựa chọn/từ dễ nhầm", "label": "nghĩa ngắn", "reason": "1-2 câu vì sao sai" }]
}`
  } else {
    modeInstruction = `QUY TẮC TỰ GIẢI ĐỘC LẬP:
1. Bạn là chuyên gia IELTS có TƯ DUY PHẢN BIỆN ĐỘC LẬP. Bạn PHẢI tự mình giải câu hỏi độc lập 100% dựa trên bằng chứng trong ${sourceName}.
2. Trường "answer": PHẢI là đáp án THỰC TẾ CHÍNH XÁC NHẤT theo ${sourceName} (nếu có lựa chọn A/B/C/D hoặc số La Mã, ghi đúng ký hiệu lựa chọn. Nếu câu hỏi yêu cầu chọn từ 2 chữ cái trở lên hoặc loại câu mcq_multi, ghi đầy đủ các chữ cái cách nhau bằng dấu phẩy theo thứ tự chữ cái, ví dụ: "B, C").
3. Trường "reasoning": 2-3 câu chứng minh mạch tư duy vì sao đáp án đúng theo phương pháp Linear thinking. Đây là phần DÀNH CHO HỌC SINH ĐỌC. TUYỆT ĐỐI KHÔNG nhắc đến "người dùng", "người nhập", "giáo viên", "ngộ nhận", "thử thách", và KHÔNG phán xét người nhập. Chỉ tập trung vào dữ liệu ${sourceName} và mạch suy luận để ra đáp án đúng.
4. Trường "distractors": Phân tích trung thực lý do các phương án nhiễu khác bị sai.`

    jsonFieldsInstruction = `{
  "question_chunks": [{ "text": "cụm tiếng Anh của câu hỏi", "label": "nghĩa/vai trò của cụm, 2-6 từ tiếng Việt" }],
  "predict": "1-2 câu: câu hỏi cần thông tin gì, dự đoán loại đáp án",
  "locate_note": "1-2 câu: ý nào trong câu hỏi giúp tìm vùng cần đọc, tìm thấy ở đâu",
  "locate_keywords": ["1-3 cụm NGUYÊN VĂN trong ${sourceName} giúp định vị"],
  "evidence_quote": "1-2 câu liên tiếp chép NGUYÊN VĂN từ ${sourceName} chứa thông tin trả lời, không viết tắt, không dùng dấu ... — nếu cần nhiều chỗ khác nhau trong ${sourceName}, chép riêng từng chỗ và ngăn cách bằng \\" | \\"",
  "evidence_chunks": [{ "text": "cụm quan trọng NGUYÊN VĂN nằm trong evidence_quote", "label": "nghĩa tiếng Việt 2-8 từ" }],
  "answer": "đáp án thực tế chính xác nhất theo ${sourceName} (ghi rõ chữ cái hoặc số La Mã và nội dung nếu là trắc nghiệm/nối; nếu chọn nhiều chữ cái ghi dạng \\"B, C\\")",
  "full_sentence": "câu hoàn chỉnh sau khi điền đáp án (chỉ cho câu điền từ, còn lại để rỗng)",
  "translation": "dịch tiếng Việt của full_sentence (để rỗng nếu full_sentence rỗng)",
  "reasoning": "2-3 câu: chứng minh mạch tư duy vì sao đáp án này đúng theo ${sourceName}. Dành cho học sinh đọc — TUYỆT ĐỐI KHÔNG nhắc người dùng, người nhập, giáo viên, ngộ nhận.",
  "paraphrases": [{ "question": "cụm trong câu hỏi", "question_label": "nghĩa", "passage": "cụm NGUYÊN VĂN trong ${sourceName}", "passage_label": "nghĩa" }],
  "distractors": [{ "option": "lựa chọn/từ dễ nhầm", "label": "nghĩa ngắn", "reason": "1-2 câu vì sao sai" }]
}`
  }

  return `Bạn là gia sư IELTS, giải thích theo phương pháp "Linear thinking": tách câu thành từng cụm ý ngắn, gắn nghĩa tiếng Việt cho từng cụm, rồi đối chiếu câu hỏi với ${sourceName} theo 4 bước. Đề thi ${skillLabel}.

${TYPE_INSTRUCTION[family]}
${imageBlock}${noSourceBlock}
THÔNG TIN CÂU HỎI:
- Số câu: ${q.number ?? '(không rõ)'}
- Loại câu hỏi: ${q.type || '(không rõ)'}
- Câu hỏi: ${q.questionText || '(không có sẵn — xem ngữ cảnh bên dưới, câu hỏi nằm trong đó)'}
${optionsBlock}
${modeInstruction}
${feedbackBlock}
${contextBlock}
${retryBlock}
Trả về DUY NHẤT một JSON, không thêm chữ nào ngoài JSON. Phần giải thích viết bằng tiếng Việt, ngắn gọn, xưng "ta". Các trường:
${jsonFieldsInstruction}

Ví dụ ngắn (câu điền từ, đáp án "timber"):
question_chunks: [{"text":"the grandfather","label":"người ông"},{"text":"built his wealth on two things:","label":"gây dựng của cải từ hai nguồn"},{"text":"1. ___","label":"nguồn còn thiếu"},{"text":"and the carrying of cargo by ship","label":"nguồn thứ hai: chở hàng bằng tàu"}]
evidence_chunks: [{"text":"made his fortune","label":"gây dựng cơ nghiệp"},{"text":"in the timber and shipping trades","label":"từ ngành gỗ và vận tải biển"}]
paraphrases: [{"question":"built his wealth","question_label":"gây dựng của cải","passage":"made his fortune","passage_label":"tạo dựng cơ nghiệp"}]`
}

function buildBatchPrompt(questions, family, ctx, previousError = null) {
  const list = Array.isArray(questions) ? questions : []
  const numbers = list.map(q => q.number)
  const skillLabel = ctx.skill === 'reading' ? 'Reading' : ctx.skill === 'listening' ? 'Listening' : 'Practice'
  const sourceName = ctx.skill === 'listening' ? 'transcript' : 'bài đọc'
  const contextBlock = ctx.parts.map(p => `${p.label}:\n${p.text}`).join('\n\n')

  const hasSource = Boolean(ctx.sourceText && String(ctx.sourceText).trim())
  const hasImages = Array.isArray(ctx.images) && ctx.images.length > 0
  const imageBlock = hasImages
    ? `\nHÌNH ẢNH: ${ctx.images.length} hình ảnh bản đồ/sơ đồ được đính kèm ngay sau tin nhắn này và DÙNG CHUNG cho toàn bộ ${list.length} câu bên dưới. Hãy QUAN SÁT hình MỘT LẦN, xác định vị trí của từng câu, rồi giải thích riêng cho từng câu.\n`
    : ''
  const noSourceBlock = hasSource
    ? ''
    : `\nLƯU Ý: Nhóm câu hỏi này KHÔNG có transcript/bài đọc đi kèm, nên "evidence_quote", "locate_keywords" và "paraphrases" hãy để rỗng — TUYỆT ĐỐI không bịa dẫn chứng.\n`
  const retryBlock = previousError
    ? `\nLẦN TRẢ LỜI TRƯỚC BỊ LOẠI VÌ: ${previousError}\nHãy sửa lỗi này và trả lại ĐẦY ĐỦ ${list.length} câu. Mọi cụm trích từ ${sourceName} phải chép NGUYÊN VĂN từng chữ.\n`
    : ''

  const questionBlocks = list.map(q => {
    const pairs = extractOptionPairs(q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null))
    const optionsLine = pairs.length > 0
      ? `\n   + Các lựa chọn: ${pairs.map(p => `${p.letter}. ${p.text}`).join(' | ')}`
      : ''
    const parts = []
    if (family === 'COMPLETION') {
      const noteText = findNoteSectionContext(q.group, q.number)
      if (noteText) parts.push(`\n   + Đoạn ghi chú chứa chỗ trống (giữ nguyên nhãn [Q:n], chỗ trống cần giải thích là [Q:${q.number}]):\n${noteText}`)
    }
    return `- Câu ${q.number ?? '(không rõ)'} (loại: ${q.type || '(không rõ)'}): ${q.questionText || '(không có sẵn — câu hỏi nằm trong hình/ngữ cảnh)'}${optionsLine}${parts.join('')}`
  }).join('\n')

  const jsonFieldsInstruction = `{
  "explanations": [
    {
      "number": 16,
      "question_chunks": [{ "text": "cụm tiếng Anh của câu hỏi", "label": "nghĩa/vai trò của cụm, 2-6 từ tiếng Việt" }],
      "predict": "1-2 câu: câu hỏi cần thông tin gì, dự đoán loại đáp án",
      "locate_note": "1-2 câu: ý nào trong câu hỏi giúp tìm vùng cần đọc/vị trí trên hình",
      "locate_keywords": ["1-3 cụm NGUYÊN VĂN trong ${sourceName} giúp định vị"],
      "evidence_quote": "1-2 câu liên tiếp chép NGUYÊN VĂN từ ${sourceName} chứa thông tin trả lời, không viết tắt, không dùng dấu ... — nếu cần nhiều chỗ khác nhau trong ${sourceName}, chép riêng từng chỗ và ngăn cách bằng \\" | \\"",
      "evidence_chunks": [{ "text": "cụm quan trọng NGUYÊN VĂN nằm trong evidence_quote", "label": "nghĩa tiếng Việt 2-8 từ" }],
      "answer": "đáp án thực tế chính xác nhất cho RIÊNG câu này (ghi rõ chữ cái hoặc số La Mã và nội dung nếu là trắc nghiệm/nối; nếu chọn nhiều chữ cái ghi dạng \\"B, C\\")",
      "full_sentence": "câu hoàn chỉnh sau khi điền đáp án (chỉ cho câu điền từ, còn lại để rỗng)",
      "translation": "dịch tiếng Việt của full_sentence (để rỗng nếu full_sentence rỗng)",
      "reasoning": "2-3 câu: chứng minh mạch tư duy vì sao đáp án này đúng theo ${sourceName} (với câu bản đồ/sơ đồ phải nêu rõ vị trí trên hình). Dành cho học sinh đọc — TUYỆT ĐỐI KHÔNG nhắc người dùng, người nhập, giáo viên, ngộ nhận.",
      "paraphrases": [{ "question": "cụm trong câu hỏi", "question_label": "nghĩa", "passage": "cụm NGUYÊN VĂN trong ${sourceName}", "passage_label": "nghĩa" }],
      "distractors": [{ "option": "lựa chọn/từ dễ nhầm", "label": "nghĩa ngắn", "reason": "1-2 câu vì sao sai" }]
    }
  ]
}`

  return `Bạn là gia sư IELTS, giải thích theo phương pháp "Linear thinking": tách câu thành từng cụm ý ngắn, gắn nghĩa tiếng Việt cho từng cụm, rồi đối chiếu câu hỏi với ${sourceName} theo 4 bước. Đề thi ${skillLabel}.

QUY TẮC GỘP NHÓM (BẮT BUỘC):
- Đây là ${list.length} câu hỏi DÙNG CHUNG một bộ ngữ cảnh/hình ảnh. Hãy giải từng câu ĐỘC LẬP với câu còn lại.
- Trả về ĐÚNG ${list.length} phần tử trong mảng "explanations", mỗi phần tử có trường "number" là một trong các số câu: ${numbers.join(', ')}.
- Không gộp câu, không bỏ sót câu, không thêm số câu khác.
- VIẾT NGẮN GỌN (BẮT BUỘC): mỗi câu tối đa 6 "question_chunks", 3 "paraphrases", 2 "distractors", 4 "evidence_chunks"; "reasoning" tối đa 3 câu; KHÔNG lặp lại nội dung và KHÔNG liệt kê toàn bộ các lựa chọn. Tuyệt đối không lặp từ/câu vô nghĩa.

${TYPE_INSTRUCTION[family]}
${imageBlock}${noSourceBlock}${retryBlock}
DANH SÁCH CÂU HỎI:
${questionBlocks}

${contextBlock}

Trả về DUY NHẤT một JSON, không thêm chữ nào ngoài JSON. Phần giải thích viết bằng tiếng Việt, ngắn gọn, xưng "ta". Định dạng:
${jsonFieldsInstruction}`
}

function buildBatchResponseSchema() {
  const base = buildResponseSchema(null)
  // Chặn model "lan man"/lặp từ vô hạn khi sinh nhiều câu trong một lần bằng
  // giới hạn độ dài chuỗi (maxItems không được Gemini chấp nhận trong schema).
  const itemProperties = {
    number: { type: 'INTEGER' },
    ...base.properties,
    question_chunks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', maxLength: 200 },
          label: { type: 'STRING', maxLength: 120 },
        },
        required: ['text', 'label'],
      },
    },
    predict: { type: 'STRING', maxLength: 300 },
    locate_note: { type: 'STRING', maxLength: 300 },
    locate_keywords: { type: 'ARRAY', items: { type: 'STRING', maxLength: 200 } },
    evidence_quote: { type: 'STRING', maxLength: 900 },
    evidence_chunks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', maxLength: 200 },
          label: { type: 'STRING', maxLength: 120 },
        },
        required: ['text', 'label'],
      },
    },
    answer: { type: 'STRING', maxLength: 200 },
    full_sentence: { type: 'STRING', maxLength: 400 },
    translation: { type: 'STRING', maxLength: 600 },
    reasoning: { type: 'STRING', maxLength: 1200 },
    paraphrases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING', maxLength: 200 },
          question_label: { type: 'STRING', maxLength: 120 },
          passage: { type: 'STRING', maxLength: 200 },
          passage_label: { type: 'STRING', maxLength: 120 },
        },
        required: ['question', 'passage'],
      },
    },
    distractors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          option: { type: 'STRING', maxLength: 200 },
          label: { type: 'STRING', maxLength: 120 },
          reason: { type: 'STRING', maxLength: 300 },
        },
        required: ['option', 'reason'],
      },
    },
  }
  return {
    type: 'OBJECT',
    properties: {
      explanations: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: itemProperties,
          required: ['number', ...base.required],
        },
      },
    },
    required: ['explanations'],
  }
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

async function callGroq(prompt, { maxRateLimitRetries = 6, signal = null } = {}) {
  const groq = getGroqClient()
  let completion
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Yêu cầu AI đã bị hủy')
      err.name = 'AbortError'
      throw err
    }
    try {
      const payload = {
        messages: [{ role: 'user', content: prompt }],
        model: getGroqModel(),
        temperature: 0.3,
      }
      completion = signal
        ? await groq.chat.completions.create(payload, { signal })
        : await groq.chat.completions.create(payload)
      break
    } catch (err) {
      if (signal?.aborted) throw err
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

function buildResponseSchema(type, rawOptions = null, schemaOpts = {}) {
  const isFixedMode = Boolean(schemaOpts?.isFixedMode)
  let answerSchema = { type: 'STRING' }

  const pairs = extractOptionPairs(rawOptions)
  const family = type ? classifyFamily(type) : null

  if (type === 'true_false_ng') {
    answerSchema = {
      type: 'STRING',
      enum: ['TRUE', 'FALSE', 'NOT GIVEN'],
    }
  } else if (type === 'yes_no_ng') {
    answerSchema = {
      type: 'STRING',
      enum: ['YES', 'NO', 'NOT GIVEN'],
    }
  } else if (pairs.length > 0 && (family === 'MATCHING' || type?.startsWith('matching_') || type === 'mcq' || type === 'choose_title')) {
    answerSchema = {
      type: 'STRING',
      enum: pairs.map(p => p.letter),
    }
  } else if (type === 'mcq' || type === 'choose_title') {
    let opts = rawOptions
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts) } catch {}
    }
    const letters = Array.isArray(opts) && opts.length > 0
      ? opts.map((_, i) => String.fromCharCode(65 + i))
      : ['A', 'B', 'C', 'D']
    answerSchema = {
      type: 'STRING',
      enum: letters,
    }
  }

  const properties = {
    question_chunks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          label: { type: 'STRING' },
        },
        required: ['text', 'label'],
      },
    },
    predict: { type: 'STRING' },
    locate_note: { type: 'STRING' },
    locate_keywords: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    evidence_quote: { type: 'STRING' },
    evidence_chunks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          label: { type: 'STRING' },
        },
        required: ['text', 'label'],
      },
    },
    answer: answerSchema,
    full_sentence: { type: 'STRING' },
    translation: { type: 'STRING' },
    reasoning: { type: 'STRING' },
    paraphrases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          question_label: { type: 'STRING' },
          passage: { type: 'STRING' },
          passage_label: { type: 'STRING' },
        },
        required: ['question', 'passage'],
      },
    },
    distractors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          option: { type: 'STRING' },
          label: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['option', 'reason'],
      },
    },
  }

  if (isFixedMode) {
    properties.no_support = { type: 'BOOLEAN' }
    properties.support_note = { type: 'STRING' }
  }

  // Chế độ cố định (giải thích theo đáp án đã chốt) BẮT BUỘC phải khai báo no_support
  // để hệ thống biết khi nào AI không tìm được bằng chứng cho đáp án đó.
  const required = ['question_chunks', 'predict', 'evidence_quote', 'answer', 'reasoning']
  if (isFixedMode) {
    required.push('no_support')
  }

  return {
    type: 'OBJECT',
    properties,
    required,
  }
}

function buildVisionUnavailableError() {
  const err = new Error('Không thể tạo giải thích cho câu hỏi bản đồ/sơ đồ vì AI chính (Gemini) đang không sẵn sàng để đọc hình ảnh. Vui lòng thử lại sau ít phút.')
  err.code = 'VISION_PROVIDER_UNAVAILABLE'
  return err
}

async function callAi(prompt, { questionType = null, rawOptions = null, model: customModel = null, maxRateLimitRetries = 6, isFixedMode = false, forceProvider = null, signal = null, images = [], requiresVision = false, responseSchema: customResponseSchema = null, maxTokens = 8192 } = {}) {
  const useGemini = process.env.GEMINI_API_KEY && (process.env.NODE_ENV !== 'test' || process.env.ENABLE_GEMINI_IN_TEST === 'true')
  const model = customModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const hasImages = Array.isArray(images) && images.length > 0

  // Câu hỏi hình ảnh: model văn bản (Groq) KHÔNG nhìn thấy bản đồ nên sẽ bịa vị trí.
  // Vì vậy tuyệt đối không fallback sang Groq khi câu hỏi cần nhìn hình.
  const visionRequired = requiresVision || hasImages

  if (forceProvider === 'Groq') {
    if (visionRequired) throw buildVisionUnavailableError()
    const groqData = await callGroq(prompt, { maxRateLimitRetries, signal })
    return {
      data: groqData,
      provider: 'Groq',
      model: typeof getGroqModel === 'function' ? getGroqModel() : 'openai/gpt-oss-120b',
      isFallback: true,
    }
  }

  if (useGemini && typeof requestGeminiJson === 'function') {
    // Cho phép truyền schema riêng (vd. schema batch cho cả nhóm câu hỏi hình ảnh).
    const responseSchema = customResponseSchema || buildResponseSchema(questionType, rawOptions, { isFixedMode })
    const maxGeminiAttempts = forceProvider === 'Gemini' ? 1 : 2
    for (let geminiAttempt = 0; geminiAttempt < maxGeminiAttempts; geminiAttempt++) {
      if (signal?.aborted) {
        const err = new Error('Yêu cầu AI đã bị hủy')
        err.name = 'AbortError'
        throw err
      }
      try {
        const res = await requestGeminiJson(prompt, {
          model,
          temperature: 0,
          responseSchema,
          max_tokens: maxTokens,
          withMetadata: true,
          images: Array.isArray(images) ? images : [],
          signal,
        })
        return {
          data: res.data || res,
          provider: res.provider || 'Gemini',
          model: res.model || model,
          isFallback: false,
        }
      } catch (geminiErr) {
        if (signal?.aborted) throw geminiErr
        const isTransient = geminiErr.status === 503 || geminiErr.status === 429 || /503|429|high demand/i.test(geminiErr.message)
        if (isTransient && geminiAttempt < 2) {
          const waitMs = geminiErr.retryWaitMs || ((geminiAttempt + 1) * 3000)
          console.warn(`   … [AI] Gemini giới hạn hoặc quá tải (${geminiErr.status || geminiErr.message}), chờ ${waitMs / 1000}s trước khi thử lại lượt ${geminiAttempt + 2}...`)
          await sleep(waitMs)
          continue
        }
        if (forceProvider === 'Gemini' || visionRequired) {
          if (visionRequired) throw buildVisionUnavailableError()
          throw geminiErr
        }
        console.warn(`   … [AI] Gemini gặp sự cố (${geminiErr.status || geminiErr.message}), chuyển sang Groq dự phòng...`)
        break
      }
    }
  } else if (forceProvider === 'Gemini' || visionRequired) {
    if (visionRequired) throw buildVisionUnavailableError()
    throw new Error('Gemini API key is not configured or requestGeminiJson is unavailable')
  }

  const groqData = await callGroq(prompt, { maxRateLimitRetries, signal })
  return {
    data: groqData,
    provider: 'Groq',
    model: typeof getGroqModel === 'function' ? getGroqModel() : 'openai/gpt-oss-120b',
    isFallback: true,
  }
}

async function generateExplanation(q, family, ctx, { teacherFeedback = null, isFixedMode = false, targetAnswer = null, forceProvider = null, signal = null } = {}) {
  let previousError = null

  // Câu hỏi hình ảnh: chuyển ảnh (local /uploads hoặc Cloudinary) sang data URI để
  // Gemini vision "nhìn" được bản đồ/sơ đồ. Không tải được ảnh thì báo lỗi rõ ràng
  // thay vì để AI bịa vị trí.
  const imageUrls = Array.isArray(ctx?.images) ? ctx.images : []
  let images = []
  if (imageUrls.length) {
    images = await resolveContextImages(imageUrls)
    if (!images.length && family === IMAGE_FAMILY) {
      throw new Error('Không tải được ảnh bản đồ/sơ đồ của câu hỏi nên không thể giải thích chính xác. Vui lòng kiểm tra lại ảnh của nhóm câu hỏi.')
    }
  }
  const requiresVision = family === IMAGE_FAMILY

  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Yêu cầu AI đã bị hủy')
      err.name = 'AbortError'
      throw err
    }
    const rawOptions = q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null)
    const prompt = buildPrompt(q, family, ctx, previousError, teacherFeedback, { isFixedMode, targetAnswer })
    const aiResult = await callAi(prompt, {
      questionType: q.type,
      rawOptions,
      isFixedMode,
      forceProvider,
      signal,
      images,
      requiresVision,
    })
    const payload = aiResult?.data || aiResult

    if (isFixedMode && payload?.no_support) {
      return {
        v: 2,
        no_support: true,
        answer: targetAnswer || q.correctAnswer,
        reasoning: cleanString(payload.reasoning, 900) || '',
        supportNote: cleanString(payload.support_note, 500) || null,
        provider: aiResult?.provider,
        model: aiResult?.model,
        isFallback: aiResult?.isFallback || false,
      }
    }

    try {
      const explanation = enrichExplanation(payload, ctx, targetAnswer || q.correctAnswer, family, { attempt })
      if (aiResult?.provider) explanation.provider = aiResult.provider
      if (aiResult?.model) explanation.model = aiResult.model
      if (aiResult?.isFallback) explanation.isFallback = true
      if (isFixedMode) {
        explanation.no_support = false
        explanation.supportNote = cleanString(payload.support_note, 500) || null
      }
      return explanation
    } catch (err) {
      if (!(err instanceof ExplanationValidationError) || attempt === 1) throw err
      previousError = err.message
    }
  }
  return null
}

/**
 * Giải thích cả một NHÓM câu hỏi dùng chung một hình ảnh bằng MỘT lần gọi Gemini.
 * Trả về Map<number, explanation> chỉ chứa các câu AI trả về hợp lệ; câu thiếu/sai
 * sẽ được nơi gọi fallback sang generateExplanation (gọi riêng từng câu).
 */
async function generateBatchExplanations(questions, family, ctx, { signal = null } = {}) {
  const list = Array.isArray(questions) ? questions : []
  if (!list.length) return new Map()

  const imageUrls = Array.isArray(ctx?.images) ? ctx.images : []
  let images = []
  if (imageUrls.length) {
    images = await resolveContextImages(imageUrls)
    if (!images.length && family === IMAGE_FAMILY) {
      throw new Error('Không tải được ảnh bản đồ/sơ đồ của nhóm câu hỏi nên không thể giải thích chính xác. Vui lòng kiểm tra lại ảnh của nhóm câu hỏi.')
    }
  }
  const requiresVision = family === IMAGE_FAMILY
  const responseSchema = buildBatchResponseSchema()

  const byNumber = new Map()
  let previousError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Yêu cầu AI đã bị hủy')
      err.name = 'AbortError'
      throw err
    }

    // Lần đầu giải cả nhóm; nếu thiếu câu nào (AI bỏ sót hoặc sai định dạng) thì
    // lần hai chỉ hỏi lại đúng những câu còn thiếu — tránh phải gọi riêng từng câu.
    const remaining = list.filter(q => !byNumber.has(Number(q.number)))
    if (!remaining.length) break
    if (attempt > 0 && !previousError) {
      previousError = `Thiếu kết quả cho ${remaining.map(q => `câu ${q.number}`).join(', ')}`
    }
    if (attempt > 0) {
      console.log(`[BATCH_RETRY] Hỏi lại ${remaining.length} câu còn thiếu (${remaining.map(q => q.number).join(', ')}). Lý do: ${previousError || '(không rõ)'}`)
    }

    const prompt = buildBatchPrompt(remaining, family, ctx, previousError)
    const aiResult = await callAi(prompt, {
      responseSchema,
      signal,
      images,
      requiresVision,
      // Đủ cho ~5 câu × ~400 token; chặn trường hợp model lan man làm tràn token
      // và kéo dài thời gian chờ (đã đo có lần sinh tới 7.7k token).
      maxTokens: 4096,
    })
    const payload = aiResult?.data || aiResult
    const rawItems = Array.isArray(payload?.explanations) ? payload.explanations : null

    if (!rawItems) {
      previousError = 'Thiếu mảng "explanations" trong JSON trả về'
      continue
    }

    let validationError = null
    for (const item of rawItems) {
      const num = Number(item?.number)
      if (!Number.isInteger(num)) continue
      const q = remaining.find(x => Number(x.number) === num)
      // Bỏ qua số câu lạ hoặc trùng lặp (giữ kết quả đầu tiên).
      if (!q || byNumber.has(num)) continue
      try {
        const explanation = enrichExplanation(item, ctx, q.correctAnswer, family)
        explanation.provider = aiResult?.provider || 'Gemini'
        if (aiResult?.model) explanation.model = aiResult.model
        if (aiResult?.isFallback) explanation.isFallback = true
        byNumber.set(num, explanation)
      } catch (err) {
        if (!(err instanceof ExplanationValidationError)) throw err
        validationError = `Câu ${num}: ${err.message}`
      }
    }
    previousError = validationError || previousError
  }

  return byNumber
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
      id: true, number: true, type: true, questionText: true, options: true, correctAnswer: true, imageUrl: true,
      passage: { select: { body: true } },
      listeningSection: { select: { transcript: true, context: true } },
      group: {
        select: {
          type: true,
          imageUrl: true,
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

// Nhóm IMAGE (diagram_label/diagram_completion/map_diagram) trước đây bị bỏ qua
// hoàn toàn vì AI chỉ có văn bản nên bịa vị trí trên bản đồ. Nay ảnh của nhóm câu
// hỏi (group.imageUrl / question.imageUrl) được gửi kèm cho Gemini vision, nên
// nhóm này được giải thích bình thường. Chỉ bỏ qua khi nhóm hình ảnh KHÔNG có ảnh
// nào — khi đó không có căn cứ nào để xác định vị trí (xem
// isUnsupportedExplanationQuestion).
const SKIP_FAMILIES = new Set()

async function processQuestion(q, { dryRun }) {
  const family = classifyFamily(q.type)
  if (isUnsupportedExplanationQuestion(q, family)) return { skipped: true }
  const ctx = buildContext(q, family)
  const explanation = await generateExplanation(q, family, ctx)
  if (!dryRun) {
    await prisma.question.update({ where: { id: q.id }, data: { explanation } })
  }
  return { skipped: false, explanation }
}

// PracticeQuestion.content là JSON của cả group (có thể chứa imageUrl của bản đồ).
function extractPracticeGroup(content) {
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') return obj
  } catch { /* không phải JSON — bỏ qua */ }
  return null
}

async function processPracticeQuestion(pq, { dryRun }) {
  const family = classifyFamily(pq.type)
  const groupObj = extractPracticeGroup(pq.content)
  const q = {
    id: pq.id,
    number: null,
    type: pq.type,
    questionText: extractPracticeQuestionText(pq.content),
    options: pq.options,
    correctAnswer: pq.correctAnswer || '(không có đáp án lưu sẵn)',
    imageUrl: groupObj?.imageUrl || null,
    passage: null,
    listeningSection: null,
    group: { imageUrl: groupObj?.imageUrl || null },
    exam: pq.exam,
  }
  if (isUnsupportedExplanationQuestion(q, family)) return { skipped: true }
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
        console.log(`${tag} SKIP — câu bản đồ/sơ đồ nhưng chưa có ảnh đính kèm`)
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
  buildBatchPrompt,
  buildBatchResponseSchema,
  generateBatchExplanations,
  callGroq,
  callAi,
  generateExplanation,
  fetchQuestions,
  enrichExplanation,
  normalizeText,
  splitParagraphs,
  ExplanationValidationError,
  extractPracticeQuestionText,
  processQuestion,
  processPracticeQuestion,
  main,
  SKIP_FAMILIES,
  IMAGE_FAMILY,
  collectQuestionImages,
  resolveContextImages,
  isUnsupportedExplanationQuestion,
  findParagraph,
  cleanChunks,
  buildResponseSchema,
  cleanString,
  extractOptionPairs,
  ROMAN_NUMERALS,
  stripTrailingPunctuation,
  isVietnameseTranslation,
  VIETNAMESE_DIACRITICS_REGEX,
}
