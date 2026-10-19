const prisma = require('../lib/prisma')
const {
  classifyFamily,
  buildContext,
  generateExplanation,
  normalizeText,
  cleanString,
  ExplanationValidationError,
  SKIP_FAMILIES,
} = require('../scripts/generate-explanations')
const { practiceQuestionContext } = require('../scripts/import-practice-explanations')
const { invalidate } = require('../lib/swrCache')
const { invalidateExamCaches } = require('../utils/cache')

const DEFAULT_TIME_BUDGET_MS = parseInt(process.env.EXPLANATION_TIME_BUDGET_MS, 10) || 40000
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const INTERNAL_JARGON_PHRASES = Object.freeze([
  'nguoi dung nhap',
  'nguoi nhap',
  'dap an nguoi dung',
  'ngo nhan',
  'thu thach',
  'giao vien nhap',
  'he thong cung cap',
])

function normalizeJargonText(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

const EXCLUDED_METADATA_KEYS = new Set([
  'teacher_note',
  'teacherFeedback',
  'feedbackHistory',
  'teacherKeptAnswer',
  'status',
  'statusHistory',
  'staleReason',
  'staleAt',
  'needsRegenerationReason',
  'id',
  'method',
  'provider',
  'model',
  'answer',
  'aiAnswer',
  'v',
  'createdAt',
  'updatedAt',
])

function extractLearnerTexts(val) {
  if (!val) return []
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) {
    return val.flatMap((item) => extractLearnerTexts(item))
  }
  if (typeof val === 'object') {
    const texts = []
    for (const [k, v] of Object.entries(val)) {
      if (!EXCLUDED_METADATA_KEYS.has(k)) {
        texts.push(...extractLearnerTexts(v))
      }
    }
    return texts
  }
  return []
}

function containsInternalJargon(explanation) {
  if (!explanation || typeof explanation !== 'object') return false
  const texts = extractLearnerTexts(explanation)
  for (const text of texts) {
    const norm = normalizeJargonText(text)
    for (const phrase of INTERNAL_JARGON_PHRASES) {
      const normPhrase = normalizeJargonText(phrase)
      if (norm.includes(normPhrase)) {
        return true
      }
    }
  }
  return false
}

function isExplanationVisibleToLearner(explanation) {
  if (!explanation || typeof explanation !== 'object') return false
  // 3.2 TƯƠNG THÍCH NGƯỢC: lời giải cũ (chưa có status) coi như ai_generated, vẫn hiển thị bình thường
  if (explanation.status && !['ai_generated', 'teacher_reviewed', 'teacher_edited'].includes(explanation.status)) {
    return false
  }
  // B.3: Ẩn lời giải chứa cụm nội bộ khỏi học sinh
  if (containsInternalJargon(explanation)) {
    return false
  }
  return true
}

function filterLearnerExplanation(explanation) {
  return isExplanationVisibleToLearner(explanation) ? explanation : null
}

function validateManualExplanation(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Dữ liệu sửa giải thích không hợp lệ')
  }

  const allowed = {}

  if (data.reasoning !== undefined) {
    if (typeof data.reasoning !== 'string') throw new Error('reasoning phải là chuỗi ký tự')
    if (data.reasoning.length > 2000) throw new Error('reasoning không được vượt quá 2000 ký tự')
    allowed.reasoning = data.reasoning.trim()
  }

  if (data.teacher_note !== undefined) {
    if (typeof data.teacher_note !== 'string') throw new Error('teacher_note phải là chuỗi ký tự')
    if (data.teacher_note.length > 2000) throw new Error('teacher_note không được vượt quá 2000 ký tự')
    allowed.teacher_note = data.teacher_note.trim()
  }

  if (data.predict !== undefined) {
    if (typeof data.predict !== 'string') throw new Error('predict phải là chuỗi ký tự')
    if (data.predict.length > 1000) throw new Error('predict không được vượt quá 1000 ký tự')
    allowed.predict = data.predict.trim()
  }

  if (data.translation !== undefined) {
    if (typeof data.translation !== 'string') throw new Error('translation phải là chuỗi ký tự')
    if (data.translation.length > 1000) throw new Error('translation không được vượt quá 1000 ký tự')
    allowed.translation = data.translation.trim()
  }

  if (data.full_sentence !== undefined) {
    if (typeof data.full_sentence !== 'string') throw new Error('full_sentence phải là chuỗi ký tự')
    if (data.full_sentence.length > 1000) throw new Error('full_sentence không được vượt quá 1000 ký tự')
    allowed.full_sentence = data.full_sentence.trim()
  }

  if (data.distractors !== undefined) {
    if (!Array.isArray(data.distractors)) throw new Error('distractors phải là một danh sách')
    if (data.distractors.length > 10) throw new Error('distractors không được vượt quá 10 mục')
    allowed.distractors = data.distractors.map((d, i) => {
      if (!d || typeof d !== 'object') throw new Error(`Lựa chọn thứ ${i + 1} trong distractors không hợp lệ`)
      const option = String(d.option || '').trim().slice(0, 100)
      const reason = String(d.reason || '').trim().slice(0, 500)
      const label = d.label ? String(d.label).trim().slice(0, 100) : ''
      if (!option || !reason) throw new Error(`Lựa chọn thứ ${i + 1} phải có đầy đủ option và reason`)
      return { option, reason, ...(label ? { label } : {}) }
    })
  }

  return allowed
}

function parseGroup(row) {
  try {
    return JSON.parse(row.content)
  } catch {
    return null
  }
}

const ROMAN_NUMERALS = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
])

const NUMBER_WORDS_MAP = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  first: '1st',
  second: '2nd',
  third: '3rd',
}

const TFNG_CANONICAL_FAMILY = {
  't': 'TRUE',
  'true': 'TRUE',
  'y': 'TRUE',
  'yes': 'TRUE',
  'f': 'FALSE',
  'false': 'FALSE',
  'n': 'FALSE',
  'no': 'FALSE',
  'ng': 'NOT_GIVEN',
  'not given': 'NOT_GIVEN',
  'not_given': 'NOT_GIVEN',
}

const TFNG_CANONICAL_STRICT = {
  't': 'true',
  'true': 'true',
  'f': 'false',
  'false': 'false',
  'ng': 'not given',
  'not given': 'not given',
  'not_given': 'not given',
  'y': 'yes',
  'yes': 'yes',
  'n': 'no',
  'no': 'no',
}

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
    return null
  }).filter(Boolean)
}

function resolveToOption(str, optionPairs) {
  if (!str || !optionPairs.length) return null
  const trimmed = stripTrailingPunctuation(str)
  const norm = normalizeText(trimmed)

  // 1. Direct letter or Roman numeral match: "A", "a", "iv", "IV"
  const lower = trimmed.toLowerCase()
  if (ROMAN_NUMERALS.has(lower)) {
    const found = optionPairs.find(p => p.letter.toLowerCase() === lower)
    if (found) return found
  }
  const letterMatch = trimmed.match(/^([A-Za-z])[\.\:\)]?$/)
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase()
    const found = optionPairs.find(p => p.letter.toUpperCase() === letter)
    if (found) return found
  }

  // 2. Prefixed match: "A. peers", "B: patients", "iv. Agriculture"
  const romanPrefix = trimmed.match(/^(x{0,3}(?:ix|iv|v?i{1,3}))[\.\:\)]\s*(.*)$/i)
  if (romanPrefix && ROMAN_NUMERALS.has(romanPrefix[1].toLowerCase())) {
    const found = optionPairs.find(p => p.letter.toLowerCase() === romanPrefix[1].toLowerCase())
    if (found) return found
  }
  const prefixMatch = trimmed.match(/^([A-Za-z])[\.\:\)]\s*(.*)$/)
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase()
    const found = optionPairs.find(p => p.letter.toUpperCase() === letter)
    if (found) return found
  }

  // 3. Exact text match against option text
  for (const pair of optionPairs) {
    if (pair.text && normalizeText(stripTrailingPunctuation(pair.text)) === norm) {
      return pair
    }
  }

  return null
}

function extractMultiChoiceTokens(str, optionPairs = []) {
  if (!str) return new Set()
  const raw = String(str).trim()
  if (!raw) return new Set()

  const tokens = new Set()

  // Split input by separators: comma, semicolon, newline, " and ", " & ", " và "
  const rawParts = raw.split(/[,;\n]|\s+(?:and|&|và)\s+/i).map(s => s.trim()).filter(Boolean)

  for (const part of rawParts) {
    const resolved = resolveToOption(part, optionPairs)
    if (resolved) {
      tokens.add(resolved.letter.toUpperCase())
      continue
    }

    // Direct single letter: "A", "C"
    const mLetter = part.match(/^([A-Za-z])[\.\:\)]?$/)
    if (mLetter) {
      tokens.add(mLetter[1].toUpperCase())
      continue
    }

    // Prefixed letter in part: "A. Some text"
    const mPrefix = part.match(/^([A-Za-z])[\.\:\)]\s*(.*)$/)
    if (mPrefix) {
      tokens.add(mPrefix[1].toUpperCase())
      continue
    }

    // If string is short sequence of uppercase letters like "AC" or "BD"
    const cleaned = part.replace(/[^A-Za-z]/g, '')
    if (cleaned.length >= 2 && cleaned.length <= 6 && cleaned === cleaned.toUpperCase()) {
      for (const char of cleaned) tokens.add(char)
      continue
    }

    // Retain normalized text token if present
    const normPart = normalizeText(part)
    if (normPart) tokens.add(normPart)
  }

  // If no tokens found by splitting, but input is e.g. "AC"
  if (tokens.size === 0) {
    const cleanLetters = raw.replace(/[^A-Za-z]/g, '')
    if (cleanLetters.length >= 1 && cleanLetters.length <= 6 && cleanLetters === cleanLetters.toUpperCase()) {
      for (const char of cleanLetters) tokens.add(char)
    }
  }

  return tokens
}

function normalizeCompletionTerm(term) {
  let s = normalizeText(term)
  if (!s) return ''

  // 1. Strip leading articles: a, an, the
  s = s.replace(/^(?:a|an|the)\s+/i, '').trim()

  // 2. Normalize hyphens between words: "well-known" -> "well known"
  s = s.replace(/(\w+)-(\w+)/g, '$1 $2')

  // 3. Normalize number words to digits: e.g. "two" -> "2"
  s = s.replace(/\b([a-z]+)\b/g, (match, word) => NUMBER_WORDS_MAP[word.toLowerCase()] || match)

  // 4. Strip trailing punctuation
  s = s.replace(/[.,;:!?]+$/, '').trim()

  // 5. Collapse spaces
  s = s.replace(/\s+/g, ' ')

  return s
}

function expandCompletionVariants(rawStr) {
  if (!rawStr) return []
  const norm = normalizeText(rawStr)
  if (!norm) return []

  // Split alternatives: "/" or "|"
  const alts = norm.split(/[/|]/).map(s => s.trim()).filter(Boolean)
  const variants = new Set()

  for (const alt of alts) {
    const base = normalizeCompletionTerm(alt)
    if (!base) continue
    variants.add(base)

    // Handle parentheses for optional plural like "student(s)" -> "student", "students"
    if (base.includes('(s)')) {
      variants.add(base.replace(/\(s\)/g, ''))
      variants.add(base.replace(/\(s\)/g, 's'))
    } else if (/\([a-z0-9]+\)/i.test(base)) {
      variants.add(base.replace(/\([a-z0-9]+\)/gi, '').replace(/\s+/g, ' ').trim())
      variants.add(base.replace(/[()]/g, '').replace(/\s+/g, ' ').trim())
    }
  }

  return Array.from(variants)
}

/**
 * Compare two answer strings for equivalence (case-insensitive, trimmed, normalized quotes/spaces).
 * Supports family-specific normalization (MCQ, TFNG, Matching, Completion).
 */
function isAnswerMatch(a, b, rawOptionsOrOpts = null, explicitType = null) {
  if (a == null || b == null) return false
  const strA = stripTrailingPunctuation(String(a))
  const strB = stripTrailingPunctuation(String(b))
  if (!strA || !strB) return false

  let rawOptions = rawOptionsOrOpts
  let type = explicitType
  if (rawOptionsOrOpts && typeof rawOptionsOrOpts === 'object' && !Array.isArray(rawOptionsOrOpts)) {
    if ('rawOptions' in rawOptionsOrOpts || 'type' in rawOptionsOrOpts) {
      rawOptions = rawOptionsOrOpts.rawOptions ?? null
      type = rawOptionsOrOpts.type ?? explicitType
    }
  }

  const normA = normalizeText(strA)
  const normB = normalizeText(strB)
  if (normA === normB) return true

  const family = type ? classifyFamily(type) : null
  const isMcqMulti = type === 'mcq_multi' || type === 'list_selection'
  const isTfngFamily = family === 'TFNG' || type === 'true_false_ng' || type === 'yes_no_ng'

  // 1. TFNG / YNNG Normalization
  if (isTfngFamily) {
    const tfA = TFNG_CANONICAL_FAMILY[normA.toLowerCase()]
    const tfB = TFNG_CANONICAL_FAMILY[normB.toLowerCase()]
    if (tfA && tfB) {
      return tfA === tfB
    }
  } else {
    // If not in TFNG family, strict canonical check (no YES=TRUE mapping)
    const tfA = TFNG_CANONICAL_STRICT[normA.toLowerCase()]
    const tfB = TFNG_CANONICAL_STRICT[normB.toLowerCase()]
    if (tfA && tfB) {
      return tfA === tfB
    }
  }

  // 2. MCQ Multi Normalization (Set comparison)
  const optionPairs = extractOptionPairs(rawOptions)
  if (isMcqMulti) {
    const setA = extractMultiChoiceTokens(strA, optionPairs)
    const setB = extractMultiChoiceTokens(strB, optionPairs)
    if (setA.size > 0 && setB.size > 0) {
      if (setA.size !== setB.size) return false
      for (const item of setA) {
        if (!setB.has(item)) return false
      }
      return true
    }
  }

  // 3. Single Option Matching (MCQ single & Matching with option pairs)
  if (optionPairs.length > 0) {
    const optA = resolveToOption(strA, optionPairs)
    const optB = resolveToOption(strB, optionPairs)

    if (optA && optB) {
      return optA.letter.toLowerCase() === optB.letter.toLowerCase()
    }
    if (optA || optB) {
      return false
    }
  }

  // 4. Roman Numeral Direct Matching (Matching Headings without options or direct check)
  const lowerA = normA.toLowerCase()
  const lowerB = normB.toLowerCase()
  if (ROMAN_NUMERALS.has(lowerA) && ROMAN_NUMERALS.has(lowerB)) {
    return lowerA === lowerB
  }
  const mRomanA = lowerA.match(/^(x{0,3}(?:ix|iv|v?i{1,3}))[\.\:\)]/i)
  const mRomanB = lowerB.match(/^(x{0,3}(?:ix|iv|v?i{1,3}))[\.\:\)]/i)
  if (mRomanA && ROMAN_NUMERALS.has(mRomanA[1]) && lowerB === mRomanA[1]) return true
  if (mRomanB && ROMAN_NUMERALS.has(mRomanB[1]) && lowerA === mRomanB[1]) return true

  // 5. Completion / Text Normalization (variants, articles, numbers, plural)
  const variantsA = expandCompletionVariants(strA)
  const variantsB = expandCompletionVariants(strB)
  if (variantsA.length > 0 && variantsB.length > 0) {
    const hasMatch = variantsA.some(va => variantsB.includes(va))
    if (hasMatch) return true
  }

  return false
}

/**
 * Thử lại bằng Gemini khi kết quả AI đến từ fallback (Groq) bị lệch so với đáp án đề.
 * Tối đa 2 lần, có backoff, kiểm tra thời gian còn lại trong ngân sách.
 */
async function handleFallbackMismatchRetry({
  qCtx,
  family,
  ctx,
  inputAnswer,
  rawOptions,
  startTime,
  effectiveTimeBudget,
  isFixedMode = false,
  targetAnswer = null,
}) {
  for (let retry = 1; retry <= 2; retry++) {
    const elapsed = Date.now() - startTime
    const remainingTime = effectiveTimeBudget - elapsed
    // Cần tối thiểu 6s cho một lần thử Gemini
    if (remainingTime < 6000) {
      console.warn(`[FALLBACK_RETRY] Thời gian còn lại ${remainingTime}ms không đủ cho retry Gemini lần ${retry}. Bỏ qua retry.`)
      break
    }

    const backoffMs = retry * 1000
    await sleep(backoffMs)

    try {
      console.log(`[FALLBACK_RETRY] Kết quả dự phòng lệch đáp án đề. Thử lại với Gemini lần ${retry}/2 (đã chạy ${Date.now() - startTime}ms)...`)
      const geminiExp = await generateExplanation(qCtx, family, ctx, {
        forceProvider: 'Gemini',
        isFixedMode,
        targetAnswer,
      })

      if (geminiExp && (!geminiExp.provider || geminiExp.provider.toLowerCase() === 'gemini') && !geminiExp.isFallback) {
        if (geminiExp.no_support) {
          return {
            resolvedWithGemini: true,
            explanation: geminiExp,
            no_support: true,
            match: false,
          }
        }
        const geminiAiAnswer = String(geminiExp.answer || '').trim()
        const geminiMatch = isAnswerMatch(inputAnswer, geminiAiAnswer, rawOptions, qCtx.type)
        return {
          resolvedWithGemini: true,
          explanation: geminiExp,
          aiAnswer: geminiAiAnswer,
          match: geminiMatch,
        }
      }
    } catch (retryErr) {
      console.warn(`[FALLBACK_RETRY] Retry Gemini lần ${retry} thất bại: ${retryErr.message}`)
    }
  }

  return {
    resolvedWithGemini: false,
  }
}

/**
 * Generate explanations for a PracticeExam (Reading or Listening).
 *
 * @param {number} examId - PracticeExam ID
 * @param {object} options
 * @param {boolean} options.force - If true, regenerate even if explanation exists
 * @param {object} options.resolveChoices - Map of { [questionNumber]: 'ai' | 'input' }
 * @param {boolean} options.overwriteProtected - If true, overwrite teacher_reviewed or teacher_edited explanations
 */
async function generateForPracticeExam(examId, {
  force = false,
  resolveChoices = {},
  overwriteProtected = false,
  questionNumbers = null,
  timeBudgetMs = null,
} = {}) {
  const effectiveTimeBudget = (typeof timeBudgetMs === 'number' && timeBudgetMs > 0)
    ? timeBudgetMs
    : DEFAULT_TIME_BUDGET_MS
  const startTime = Date.now()

  const exam = await prisma.practiceExam.findUnique({
    where: { id: examId },
    include: { questions: { orderBy: { orderNum: 'asc' } } },
  })

  if (!exam) throw new Error(`Không tìm thấy bài luyện tập #${examId}`)

  // Kiểm tra đề bài (reading: passage, listening: transcript / passage)
  if (exam.skill === 'reading' && !String(exam.passage || '').trim()) {
    throw new Error('Bài đọc chưa có nội dung đề bài (Passage). Vui lòng cập nhật đề bài trước khi tạo giải thích bằng AI.')
  }
  if (exam.skill === 'listening' && !String(exam.transcript || '').trim() && !String(exam.passage || '').trim()) {
    throw new Error('Bài nghe chưa có transcript hoặc nội dung bài nghe. Vui lòng cập nhật transcript trước khi tạo giải thích bằng AI.')
  }

  // Quét trước để bắt buộc mọi câu hỏi phải có đáp án đúng
  const missingAnswerQuestions = []
  for (const row of exam.questions) {
    const group = parseGroup(row)
    if (!group || !Array.isArray(group.questions)) continue
    for (const qItem of group.questions) {
      const qNum = Number(qItem.number)
      if (!qNum) continue
      const ans = String(qItem.correctAnswer ?? '').trim()
      if (!ans) {
        missingAnswerQuestions.push(qNum)
      }
    }
  }

  if (missingAnswerQuestions.length > 0) {
    throw new Error(`Không thể tạo giải thích AI do các câu sau chưa có đáp án đúng: Câu ${missingAnswerQuestions.join(', ')}. Vui lòng điền đầy đủ đáp án đúng trước.`)
  }

  // Gom các câu hỏi mục tiêu hợp lệ
  const candidateItems = []
  for (const row of exam.questions) {
    const group = parseGroup(row)
    if (!group || !Array.isArray(group.questions)) continue
    const currentExplanations = { ...(row.explanation?.byNumber || {}) }
    for (const qItem of group.questions) {
      const qNum = Number(qItem.number)
      if (!qNum) continue
      if (Array.isArray(questionNumbers) && questionNumbers.length > 0 && !questionNumbers.includes(qNum)) {
        continue
      }
      const existing = currentExplanations[qNum]
      const isProtected = existing && (existing.status === 'teacher_reviewed' || existing.status === 'teacher_edited')
      if (existing && !resolveChoices[qNum]) {
        if (!force) continue
        if (isProtected && !overwriteProtected) continue
      }
      const qCtx = practiceQuestionContext(exam, group, qNum)
      if (!qCtx) continue
      const family = classifyFamily(qCtx.type)
      if (SKIP_FAMILIES.has(family)) continue
      candidateItems.push({ row, group, qItem, qNum, qCtx, family, existing })
    }
  }

  const startedAt = new Date().toISOString()
  const conflicts = []
  const needsRetryQuestions = []
  const newlyGeneratedByRow = new Map() // rowId -> Map(qNum -> { explanation, adoptedAiAnswer })
  const failedQuestions = []
  let generatedCount = 0

  const budgetThreshold = effectiveTimeBudget > 20000 ? (effectiveTimeBudget - 15000) : effectiveTimeBudget

  for (const item of candidateItems) {
    // Kiểm tra ngân sách thời gian (tính cả rate limit & backoff đã tiêu tốn)
    if (generatedCount > 0 && (Date.now() - startTime) >= budgetThreshold) {
      console.log(`[TIME_BUDGET] Practice #${examId}: Đã chạy ${Date.now() - startTime}ms (ngưỡng an toàn ${budgetThreshold}ms / ngân sách ${effectiveTimeBudget}ms). Ngắt lượt để trả về client gọi tiếp.`)
      break
    }

    const { row, group, qNum, qCtx, family, existing } = item
    let rowGeneratedMap = newlyGeneratedByRow.get(row.id)
    if (!rowGeneratedMap) {
      rowGeneratedMap = new Map()
      newlyGeneratedByRow.set(row.id, rowGeneratedMap)
    }

    const ctx = buildContext(qCtx, family)

    let explanation
    const choice = resolveChoices[qNum]
    const inputAnswer = String(qCtx.correctAnswer || '').trim()
    const rawOptions = qCtx.options || (group.matchingOptions?.length ? group.matchingOptions : null)

    try {
      if (choice === 'input') {
        explanation = await generateExplanation(qCtx, family, ctx, { isFixedMode: true, targetAnswer: inputAnswer })
      } else {
        explanation = await generateExplanation(qCtx, family, ctx)
      }
    } catch (err) {
      failedQuestions.push({ number: qNum, message: err.message })
      continue
    }
    if (!explanation) continue

    generatedCount++
    explanation.updatedAt = new Date().toISOString()

    const aiAnswer = String(explanation.answer || '').trim()
    const match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, qCtx.type)
    let adoptedAiAnswer = null

    if (choice === 'input') {
      if (explanation.no_support) {
        explanation.status = 'needs_regeneration'
        explanation.teacherKeptAnswer = inputAnswer
        explanation.needsRegenerationReason = 'AI không tìm thấy bằng chứng trong bài đọc ủng hộ đáp án này'
        explanation.teacher_note = `AI không tìm thấy bằng chứng ủng hộ đáp án "${inputAnswer}". Cần sửa trực tiếp.`
      } else if (!match) {
        explanation.status = 'needs_regeneration'
        explanation.teacherKeptAnswer = inputAnswer
        explanation.needsRegenerationReason = 'AI không thể bảo vệ đáp án của giáo viên'
        explanation.teacher_note = `AI không thể bảo vệ đáp án "${inputAnswer}". Cần sửa trực tiếp.`
      } else {
        explanation.status = 'ai_generated'
        explanation.answer = inputAnswer
        explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
      }

      if (containsInternalJargon(explanation)) {
        explanation.status = 'needs_regeneration'
        explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
      }

      rowGeneratedMap.set(qNum, { explanation, adoptedAiAnswer: null })
    } else if (!match && !choice) {
      const isFallbackResult = Boolean(explanation?.isFallback || (explanation?.provider && explanation.provider.toLowerCase() !== 'gemini'))

      if (isFallbackResult) {
        // 1.1: Fallback provider lệch đáp án -> KHÔNG tạo conflict_pending, KHÔNG hiện modal xung đột!
        // Thử lại bằng Gemini tối đa 2 lần, backoff, trong phạm vi ngân sách thời gian.
        const retryResult = await handleFallbackMismatchRetry({
          qCtx,
          family,
          ctx,
          inputAnswer,
          rawOptions,
          startTime,
          effectiveTimeBudget,
        })

        if (retryResult.resolvedWithGemini) {
          explanation = retryResult.explanation
          const geminiAiAnswer = retryResult.aiAnswer
          const geminiMatch = retryResult.match

          if (geminiMatch) {
            explanation.status = 'ai_generated'
            explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
            rowGeneratedMap.set(qNum, { explanation, adoptedAiAnswer: null })
          } else {
            explanation.status = 'conflict_pending'
            explanation.aiAnswer = geminiAiAnswer
            explanation.teacher_note = `AI chọn "${geminiAiAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`
            conflicts.push({
              number: qNum,
              type: qCtx.type,
              questionText: qCtx.questionText,
              inputAnswer,
              aiAnswer: geminiAiAnswer,
              evidence: explanation.evidence?.parts?.[0]?.text || '',
              reasoning: explanation.reasoning,
              teacher_note: explanation.teacher_note,
              explanation,
            })
            rowGeneratedMap.set(qNum, { explanation, adoptedAiAnswer: null })
          }
        } else {
          // Vẫn chỉ có kết quả fallback lệch đáp án:
          // KHÔNG tạo conflict_pending, KHÔNG hiện modal xung đột.
          // KHÔNG lưu lời giải mới đè lên lời giải cũ; đặt câu ở trạng thái needs_regeneration
          // kèm lý do "AI chính đang bận, kết quả dự phòng chưa đủ tin cậy, hãy thử lại sau"
          // và đưa vào danh sách "cần thử lại" trong phản hồi để frontend hiển thị.
          const retryReason = 'AI chính đang bận, kết quả dự phòng chưa đủ tin cậy, hãy thử lại sau'
          needsRetryQuestions.push({
            number: qNum,
            reason: retryReason,
          })

          const hasMeaningfulOldExp = existing && (existing.answer || existing.reasoning || existing.status)
          if (!hasMeaningfulOldExp) {
            const placeholderExp = {
              v: 2,
              status: 'needs_regeneration',
              needsRegenerationReason: retryReason,
              teacher_note: retryReason,
              answer: inputAnswer,
              provider: explanation.provider || 'Groq',
              model: explanation.model || 'llama-3.3-70b-versatile',
              isFallback: true,
              updatedAt: new Date().toISOString(),
            }
            rowGeneratedMap.set(qNum, { explanation: placeholderExp, adoptedAiAnswer: null })
          }
        }
      } else {
        // 4.1: Record conflict and save with conflict_pending status
        explanation.status = 'conflict_pending'
        explanation.aiAnswer = aiAnswer
        explanation.teacher_note = `AI chọn "${aiAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`
        conflicts.push({
          number: qNum,
          type: qCtx.type,
          questionText: qCtx.questionText,
          inputAnswer,
          aiAnswer,
          evidence: explanation.evidence?.parts?.[0]?.text || '',
          reasoning: explanation.reasoning,
          teacher_note: explanation.teacher_note,
          explanation,
        })
        rowGeneratedMap.set(qNum, { explanation, adoptedAiAnswer: null })
      }
    } else {
      // Resolve or match
      if (choice === 'ai') {
        // 3.4: Adopt AI answer into question
        adoptedAiAnswer = aiAnswer
        explanation.answer = aiAnswer
        explanation.status = 'ai_generated'
        explanation.teacher_note = `Đã chọn theo đáp án của AI (${aiAnswer}).`
      } else {
        explanation.status = 'ai_generated'
        explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
      }

      if (containsInternalJargon(explanation)) {
        explanation.status = 'needs_regeneration'
        explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
      }

      rowGeneratedMap.set(qNum, { explanation, adoptedAiAnswer })
    }
  }

  // B.5 SỬA GỐC RACE: Trong transaction đọc lại dữ liệu hiện tại và chỉ ghi đè theo key
  await prisma.$transaction(async (tx) => {
    for (const [rowId, newlyGeneratedMap] of newlyGeneratedByRow) {
      if (!newlyGeneratedMap.size) continue

      const currentRow = await tx.practiceQuestion.findUnique({
        where: { id: rowId },
        select: { id: true, content: true, explanation: true },
      })
      if (!currentRow) continue

      const currentByNumber = (currentRow.explanation && typeof currentRow.explanation === 'object' && currentRow.explanation.byNumber)
        ? { ...currentRow.explanation.byNumber }
        : {}

      let currentGroup = parseGroup(currentRow)
      let groupModified = false

      for (const [qNum, { explanation: newExp, adoptedAiAnswer }] of newlyGeneratedMap) {
        const existingExp = currentByNumber[qNum]

        // Không ghi đè câu có status được bảo vệ nếu !overwriteProtected
        const isExistingProtected = existingExp && (existingExp.status === 'teacher_reviewed' || existingExp.status === 'teacher_edited')
        if (isExistingProtected && !overwriteProtected) {
          continue
        }

        // Không ghi đè câu vừa bị đổi trong lúc sinh cả đề (updatedAt mới hơn startedAt)
        if (existingExp && existingExp.updatedAt && new Date(existingExp.updatedAt) > new Date(startedAt)) {
          continue
        }

        currentByNumber[qNum] = newExp

        if (adoptedAiAnswer && currentGroup && Array.isArray(currentGroup.questions)) {
          const qTarget = currentGroup.questions.find((q) => Number(q.number) === Number(qNum))
          if (qTarget) {
            qTarget.correctAnswer = adoptedAiAnswer
            groupModified = true
          }
        }
      }

      const data = { explanation: { byNumber: currentByNumber } }
      if (groupModified) data.content = JSON.stringify(currentGroup)

      await tx.practiceQuestion.update({
        where: { id: rowId },
        data,
      })
    }
  })

  invalidate('practice:')

  const processedNumbers = new Set()
  for (const map of newlyGeneratedByRow.values()) {
    for (const qNum of map.keys()) processedNumbers.add(qNum)
  }
  for (const f of failedQuestions) processedNumbers.add(f.number)
  for (const r of needsRetryQuestions) processedNumbers.add(r.number)

  const remainingQuestionNumbers = candidateItems
    .map(item => item.qNum)
    .filter(num => !processedNumbers.has(num))

  if (conflicts.length > 0 && Object.keys(resolveChoices).length === 0) {
    return {
      ok: false,
      hasConflicts: true,
      conflicts,
      needsRetryQuestions: needsRetryQuestions.length ? needsRetryQuestions : undefined,
      needsRetryCount: needsRetryQuestions.length,
      generatedCount,
      remainingQuestionNumbers,
      totalQuestions: candidateItems.length,
      errors: failedQuestions.length ? failedQuestions : undefined,
      message: `Đã lưu giải thích và phát hiện ${conflicts.length} câu có đáp án lệch so với bài đọc. Vui lòng duyệt trước khi công bố cho học sinh.`,
    }
  }

  return {
    ok: true,
    hasConflicts: false,
    needsRetryQuestions: needsRetryQuestions.length ? needsRetryQuestions : undefined,
    needsRetryCount: needsRetryQuestions.length,
    generatedCount,
    remainingQuestionNumbers,
    totalQuestions: candidateItems.length,
    errors: failedQuestions.length ? failedQuestions : undefined,
    message: failedQuestions.length
      ? `Đã tạo giải thích thành công cho ${generatedCount} câu hỏi (${failedQuestions.length} câu bị lỗi: câu ${failedQuestions.map(f => f.number).join(', ')}).`
      : `Đã tạo giải thích 4 bước thành công cho ${generatedCount} câu hỏi!`,
  }
}

/**
 * Generate explanations for an Exam (Reading or Listening Cambridge / Full Test Exam).
 *
 * @param {number} examId - Exam ID
 * @param {object} options
 * @param {boolean} options.force - If true, regenerate even if explanation exists
 * @param {object} options.resolveChoices - Map of { [questionNumber]: 'ai' | 'input' }
 * @param {boolean} options.overwriteProtected - If true, overwrite teacher_reviewed or teacher_edited explanations
 * @param {number|null} options.groupId - If provided, only generates explanations for questions in this QuestionGroup
 */
async function generateForExam(examId, {
  force = false,
  resolveChoices = {},
  overwriteProtected = false,
  groupId = null,
  questionNumbers = null,
  timeBudgetMs = null,
} = {}) {
  const effectiveTimeBudget = (typeof timeBudgetMs === 'number' && timeBudgetMs > 0)
    ? timeBudgetMs
    : DEFAULT_TIME_BUDGET_MS
  const startTime = Date.now()

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, skill: true },
  })

  if (!exam) throw new Error(`Không tìm thấy đề thi #${examId}`)

  const parsedGroupId = groupId ? parseInt(groupId, 10) : null
  const whereClause = parsedGroupId
    ? {
        groupId: parsedGroupId,
        OR: [
          { group: { passage: { examId } } },
          { group: { section: { examId } } },
        ],
      }
    : {
        OR: [
          { passage: { examId } },
          { listeningSection: { examId } },
          { group: { passage: { examId } } },
          { group: { section: { examId } } },
        ],
      }

  const questions = await prisma.question.findMany({
    where: whereClause,
    select: {
      id: true,
      number: true,
      type: true,
      questionText: true,
      options: true,
      correctAnswer: true,
      explanation: true,
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
    orderBy: { number: 'asc' },
  })

  if (!questions.length) {
    if (parsedGroupId) {
      throw new Error(`Nhóm câu hỏi #${parsedGroupId} không có câu hỏi nào trong đề thi #${examId}`)
    }
    throw new Error(`Đề thi #${examId} chưa có câu hỏi nào`)
  }

  // Pre-validate that all questions have correctAnswer
  const missingAnswerQuestions = []
  for (const q of questions) {
    const ans = String(q.correctAnswer ?? '').trim()
    if (!ans) {
      missingAnswerQuestions.push(q.number)
    }
  }

  if (missingAnswerQuestions.length > 0) {
    throw new Error(`Không thể tạo giải thích AI do các câu sau chưa có đáp án đúng: Câu ${missingAnswerQuestions.join(', ')}. Vui lòng điền đầy đủ đáp án đúng trước.`)
  }

  // Pre-validate that passage/transcript content exists for questions needing generation
  for (const q of questions) {
    const existing = q.explanation
    const isProtected = existing && (existing.status === 'teacher_reviewed' || existing.status === 'teacher_edited')
    if (existing && !resolveChoices[q.number]) {
      if (!force) continue
      if (isProtected && !overwriteProtected) continue
    }
    const passage = q.passage || q.group?.passage
    const section = q.listeningSection || q.group?.section
    const content = passage?.body || section?.transcript || section?.context
    if (!content || !content.trim()) {
      const label = exam.skill === 'listening' ? 'transcript' : 'nội dung bài đọc (Passage)'
      throw new Error(`Đề thi chưa có ${label} cho câu ${q.number}. Vui lòng nhập đầy đủ nội dung trước khi tạo giải thích AI.`)
    }
  }

  // Filter candidate questions
  const candidateQuestions = []
  for (const q of questions) {
    if (Array.isArray(questionNumbers) && questionNumbers.length > 0 && !questionNumbers.includes(q.number)) {
      continue
    }
    const existing = q.explanation
    const isProtected = existing && (existing.status === 'teacher_reviewed' || existing.status === 'teacher_edited')
    if (existing && !resolveChoices[q.number]) {
      if (!force) continue
      if (isProtected && !overwriteProtected) continue
    }

    const family = classifyFamily(q.type)
    if (SKIP_FAMILIES.has(family)) continue

    candidateQuestions.push({ q, family })
  }

  const startedAt = new Date().toISOString()
  const conflicts = []
  const needsRetryQuestions = []
  const updates = []
  const failedQuestions = []
  let generatedCount = 0

  const budgetThreshold = effectiveTimeBudget > 20000 ? (effectiveTimeBudget - 15000) : effectiveTimeBudget

  for (const { q, family } of candidateQuestions) {
    if (generatedCount > 0 && (Date.now() - startTime) >= budgetThreshold) {
      console.log(`[TIME_BUDGET] Exam #${examId}: Đã chạy ${Date.now() - startTime}ms (ngưỡng an toàn ${budgetThreshold}ms / ngân sách ${effectiveTimeBudget}ms). Ngắt lượt để trả về client gọi tiếp.`)
      break
    }

    const ctx = buildContext(q, family)

    let explanation
    const choice = resolveChoices[q.number]
    const inputAnswer = String(q.correctAnswer || '').trim()
    const rawOptions = q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null)

    try {
      if (choice === 'input') {
        explanation = await generateExplanation(q, family, ctx, { isFixedMode: true, targetAnswer: inputAnswer })
      } else {
        explanation = await generateExplanation(q, family, ctx)
      }
    } catch (err) {
      failedQuestions.push({ number: q.number, message: err.message })
      continue
    }
    if (!explanation) continue

    generatedCount++
    explanation.updatedAt = new Date().toISOString()

    const aiAnswer = String(explanation.answer || '').trim()
    const match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, q.type)

    if (choice === 'input') {
      if (explanation.no_support) {
        explanation.status = 'needs_regeneration'
        explanation.teacherKeptAnswer = inputAnswer
        explanation.needsRegenerationReason = 'AI không tìm thấy bằng chứng trong bài đọc ủng hộ đáp án này'
        explanation.teacher_note = `AI không tìm thấy bằng chứng ủng hộ đáp án "${inputAnswer}". Cần sửa trực tiếp.`
      } else if (!match) {
        explanation.status = 'needs_regeneration'
        explanation.teacherKeptAnswer = inputAnswer
        explanation.needsRegenerationReason = 'AI không thể bảo vệ đáp án của giáo viên'
        explanation.teacher_note = `AI không thể bảo vệ đáp án "${inputAnswer}". Cần sửa trực tiếp.`
      } else {
        explanation.status = 'ai_generated'
        explanation.answer = inputAnswer
        explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
      }

      if (containsInternalJargon(explanation)) {
        explanation.status = 'needs_regeneration'
        explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
      }

      updates.push({
        id: q.id,
        number: q.number,
        correctAnswer: inputAnswer,
        explanation,
      })
    } else if (!match && !choice) {
      const isFallbackResult = Boolean(explanation?.isFallback || (explanation?.provider && explanation.provider.toLowerCase() !== 'gemini'))

      if (isFallbackResult) {
        // 1.1: Fallback provider lệch đáp án -> KHÔNG tạo conflict_pending, KHÔNG hiện modal xung đột!
        const retryResult = await handleFallbackMismatchRetry({
          qCtx: q,
          family,
          ctx,
          inputAnswer,
          rawOptions,
          startTime,
          effectiveTimeBudget,
        })

        if (retryResult.resolvedWithGemini) {
          explanation = retryResult.explanation
          const geminiAiAnswer = retryResult.aiAnswer
          const geminiMatch = retryResult.match

          if (geminiMatch) {
            explanation.status = 'ai_generated'
            explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
            updates.push({
              id: q.id,
              number: q.number,
              correctAnswer: inputAnswer,
              explanation,
            })
          } else {
            explanation.status = 'conflict_pending'
            explanation.aiAnswer = geminiAiAnswer
            explanation.teacher_note = `AI chọn "${geminiAiAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`
            conflicts.push({
              number: q.number,
              type: q.type,
              questionText: q.questionText,
              inputAnswer,
              aiAnswer: geminiAiAnswer,
              evidence: explanation.evidence?.parts?.[0]?.text || '',
              reasoning: explanation.reasoning,
              teacher_note: explanation.teacher_note,
              explanation,
            })
            updates.push({
              id: q.id,
              number: q.number,
              correctAnswer: inputAnswer,
              explanation,
            })
          }
        } else {
          // Fallback mismatch and Gemini retry failed:
          const retryReason = 'AI chính đang bận, kết quả dự phòng chưa đủ tin cậy, hãy thử lại sau'
          needsRetryQuestions.push({
            number: q.number,
            reason: retryReason,
          })

          const hasMeaningfulOldExp = q.explanation && (q.explanation.answer || q.explanation.reasoning || q.explanation.status)
          if (!hasMeaningfulOldExp) {
            const placeholderExp = {
              v: 2,
              status: 'needs_regeneration',
              needsRegenerationReason: retryReason,
              teacher_note: retryReason,
              answer: inputAnswer,
              provider: explanation.provider || 'Groq',
              model: explanation.model || 'llama-3.3-70b-versatile',
              isFallback: true,
              updatedAt: new Date().toISOString(),
            }
            updates.push({
              id: q.id,
              number: q.number,
              correctAnswer: inputAnswer,
              explanation: placeholderExp,
            })
          }
        }
      } else {
        // 4.1: Record conflict and save with conflict_pending
        explanation.status = 'conflict_pending'
        explanation.aiAnswer = aiAnswer
        explanation.teacher_note = `AI chọn "${aiAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`
        conflicts.push({
          number: q.number,
          type: q.type,
          questionText: q.questionText,
          inputAnswer,
          aiAnswer,
          evidence: explanation.evidence?.parts?.[0]?.text || '',
          reasoning: explanation.reasoning,
          teacher_note: explanation.teacher_note,
          explanation,
        })
        updates.push({
          id: q.id,
          number: q.number,
          correctAnswer: inputAnswer,
          explanation,
        })
      }
    } else {
      let finalCorrectAnswer = inputAnswer
      if (choice === 'ai') {
        finalCorrectAnswer = aiAnswer
        explanation.answer = aiAnswer
        explanation.status = 'ai_generated'
        explanation.teacher_note = `Đã chọn theo đáp án của AI (${aiAnswer}).`
      } else {
        explanation.status = 'ai_generated'
        explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
      }

      if (containsInternalJargon(explanation)) {
        explanation.status = 'needs_regeneration'
        explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
      }

      updates.push({
        id: q.id,
        number: q.number,
        correctAnswer: finalCorrectAnswer,
        explanation,
      })
    }
  }

  // B.5 SỬA GỐC RACE: Trong transaction đọc lại dữ liệu câu hỏi hiện tại và không ghi đè câu vừa đổi
  await prisma.$transaction(async (tx) => {
    for (const item of updates) {
      const currentQ = tx.question.findUnique
        ? await tx.question.findUnique({
            where: { id: item.id },
            select: { id: true, explanation: true },
          })
        : null

      const existingExp = currentQ?.explanation
      const isExistingProtected = existingExp && (existingExp.status === 'teacher_reviewed' || existingExp.status === 'teacher_edited')

      // Không ghi đè câu có status được bảo vệ nếu !overwriteProtected
      if (isExistingProtected && !overwriteProtected) {
        continue
      }

      // Không ghi đè câu vừa bị đổi trong lúc sinh cả đề (updatedAt mới hơn startedAt)
      if (existingExp && existingExp.updatedAt && new Date(existingExp.updatedAt) > new Date(startedAt)) {
        continue
      }

      await tx.question.update({
        where: { id: item.id },
        data: {
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        },
      })
    }
  })

  invalidateExamCaches(examId)

  const processedNumbers = new Set(updates.map(u => u.number))
  for (const f of failedQuestions) processedNumbers.add(f.number)
  for (const r of needsRetryQuestions) processedNumbers.add(r.number)

  const remainingQuestionNumbers = candidateQuestions
    .map(c => c.q.number)
    .filter(num => !processedNumbers.has(num))

  if (conflicts.length > 0 && Object.keys(resolveChoices).length === 0) {
    return {
      ok: false,
      hasConflicts: true,
      conflicts,
      needsRetryQuestions: needsRetryQuestions.length ? needsRetryQuestions : undefined,
      needsRetryCount: needsRetryQuestions.length,
      generatedCount,
      remainingQuestionNumbers,
      totalQuestions: candidateQuestions.length,
      errors: failedQuestions.length ? failedQuestions : undefined,
      message: `Đã lưu giải thích và phát hiện ${conflicts.length} câu có đáp án lệch so với bài đọc/nghe. Vui lòng duyệt trước khi công bố cho học sinh.`,
    }
  }

  return {
    ok: true,
    hasConflicts: false,
    needsRetryQuestions: needsRetryQuestions.length ? needsRetryQuestions : undefined,
    needsRetryCount: needsRetryQuestions.length,
    generatedCount,
    remainingQuestionNumbers,
    totalQuestions: candidateQuestions.length,
    errors: failedQuestions.length ? failedQuestions : undefined,
    message: failedQuestions.length
      ? `Đã tạo giải thích thành công cho ${generatedCount} câu hỏi (${failedQuestions.length} câu bị lỗi: câu ${failedQuestions.map(f => f.number).join(', ')}).`
      : `Đã tạo giải thích 4 bước thành công cho ${generatedCount} câu hỏi!`,
  }
}

/**
 * Atomic helper for modifying PracticeQuestion.explanation.byNumber safely in transaction.
 * 3.6 CONCURRENCY SAFE
 */
async function updatePracticeQuestionExplanationTx(practiceQuestionId, updaterFn) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.practiceQuestion.findUnique({
      where: { id: practiceQuestionId },
      select: { id: true, explanation: true, content: true },
    })
    if (!row) throw new Error(`Không tìm thấy PracticeQuestion #${practiceQuestionId}`)

    const currentByNumber = (row.explanation && typeof row.explanation === 'object' && row.explanation.byNumber) || {}
    const updatedByNumber = updaterFn({ ...currentByNumber }, row)

    const updated = await tx.practiceQuestion.update({
      where: { id: practiceQuestionId },
      data: {
        explanation: { byNumber: updatedByNumber },
      },
    })
    return { updated, row }
  })
}

/**
 * 4.3 Regenerate explanation for a single question with optional teacherFeedback.
 */
async function regenerateQuestionExplanation({ examId, questionId = null, questionNumber = null, isPractice = false, skill = 'reading', teacherFeedback = null }) {
  const cleanFeedback = teacherFeedback ? cleanString(teacherFeedback, 1000) : null
  const parsedExamId = parseInt(examId, 10)

  if (isPractice) {
    const exam = await prisma.practiceExam.findUnique({
      where: { id: parsedExamId },
      include: { questions: { orderBy: { orderNum: 'asc' } } },
    })
    if (!exam) throw new Error(`Không tìm thấy bài luyện tập #${parsedExamId}`)

    const targetNum = parseInt(questionNumber, 10)
    let targetRow = null
    let targetGroup = null
    let targetQItem = null

    for (const row of exam.questions) {
      const group = parseGroup(row)
      if (!group || !Array.isArray(group.questions)) continue
      const qItem = group.questions.find((q) => Number(q.number) === targetNum)
      if (qItem) {
        targetRow = row
        targetGroup = group
        targetQItem = qItem
        break
      }
    }

    if (!targetRow || !targetQItem) {
      throw new Error(`Không tìm thấy câu hỏi #${targetNum} trong bài luyện tập #${parsedExamId}`)
    }

    const inputAnswer = String(targetQItem.correctAnswer ?? '').trim()
    if (!inputAnswer) {
      throw new Error(`Câu #${targetNum} chưa có đáp án đúng, không thể tạo giải thích bằng AI.`)
    }

    const qCtx = practiceQuestionContext(exam, targetGroup, targetNum)
    if (!qCtx) throw new Error(`Không thể khởi tạo ngữ cảnh cho câu #${targetNum}`)
    const family = classifyFamily(qCtx.type)
    const ctx = buildContext(qCtx, family)

    const oldExp = targetRow.explanation?.byNumber?.[targetNum] || {}
    const isFixedMode = Boolean(
      cleanFeedback ||
      oldExp.status === 'needs_regeneration' ||
      oldExp.teacherKeptAnswer ||
      oldExp.status === 'teacher_edited'
    )

    let explanation
    try {
      if (isFixedMode) {
        explanation = await generateExplanation(qCtx, family, ctx, {
          isFixedMode: true,
          targetAnswer: inputAnswer,
          teacherFeedback: cleanFeedback,
        })
      } else {
        explanation = await generateExplanation(qCtx, family, ctx, { teacherFeedback: cleanFeedback })
      }
    } catch (err) {
      if (err instanceof ExplanationValidationError) {
        return {
          ok: false,
          error: 'EVIDENCE_NOT_FOUND',
          message: 'Không thể xác thực bằng chứng nguyên văn: ' + err.message,
        }
      }
      throw err
    }

    if (!explanation) {
      return { ok: false, message: 'AI không tạo được giải thích cho câu hỏi này.' }
    }

    const aiAnswer = String(explanation.answer || '').trim()
    const rawOptions = qCtx.options || (targetGroup.matchingOptions?.length ? targetGroup.matchingOptions : null)
    let match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, qCtx.type)
    const isFallbackResult = Boolean(explanation?.isFallback || (explanation?.provider && explanation.provider.toLowerCase() !== 'gemini'))

    if (isFallbackResult && (!match || (isFixedMode && explanation.no_support))) {
      const retryResult = await handleFallbackMismatchRetry({
        qCtx,
        family,
        ctx,
        inputAnswer,
        rawOptions,
        startTime: Date.now(),
        effectiveTimeBudget: 30000,
        isFixedMode,
        targetAnswer: isFixedMode ? inputAnswer : null,
      })
      if (retryResult.resolvedWithGemini) {
        explanation = retryResult.explanation
        match = retryResult.match
      } else {
        return {
          ok: false,
          status: 'needs_regeneration',
          isConflict: false,
          needsRetry: true,
          message: `AI chính đang bận, kết quả dự phòng của câu #${targetNum} chưa đủ tin cậy, hãy thử lại sau.`,
          explanation: oldExp,
        }
      }
    }

    if (isFixedMode && explanation.no_support) {
      return {
        ok: false,
        error: 'NO_SUPPORT',
        message: `Không tìm thấy bằng chứng trong bài đọc ủng hộ đáp án "${inputAnswer}". Bạn vui lòng sử dụng chức năng "Sửa trực tiếp" để viết lời giải thủ công.`,
      }
    }

    const currentAiAnswer = String(explanation.answer || '').trim()
    if (match) {
      explanation.status = 'ai_generated'
      explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
    } else if (isFixedMode && (oldExp.status === 'needs_regeneration' || oldExp.teacherKeptAnswer)) {
      explanation.status = 'needs_regeneration'
      explanation.teacher_note = `AI không tìm thấy bằng chứng ủng hộ đáp án "${inputAnswer}". Cần sửa trực tiếp.`
    } else {
      explanation.status = 'conflict_pending'
      explanation.aiAnswer = currentAiAnswer
      explanation.teacher_note = `AI chọn "${currentAiAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`
    }

    if (containsInternalJargon(explanation)) {
      explanation.status = 'needs_regeneration'
      explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
    }

    const oldHistory = Array.isArray(oldExp.feedbackHistory) ? oldExp.feedbackHistory : []
    const feedbackEntry = {
      at: new Date().toISOString(),
      feedback: cleanFeedback || '',
      provider: explanation.provider || 'Gemini',
      model: explanation.model || 'gemini-3.5-flash-lite',
    }
    explanation.teacherFeedback = cleanFeedback || ''
    explanation.feedbackHistory = [feedbackEntry, ...oldHistory].slice(0, 5)
    explanation.updatedAt = new Date().toISOString()

    await updatePracticeQuestionExplanationTx(targetRow.id, (byNumber) => {
      byNumber[targetNum] = explanation
      return byNumber
    })

    invalidate('practice:')

    return {
      ok: true,
      status: explanation.status,
      isConflict: explanation.status === 'conflict_pending',
      explanation,
      message: (isFixedMode || match)
        ? 'Đã tạo lại giải thích thành công!'
        : 'AI sinh giải thích nhưng đáp án lệch so với đáp án câu hỏi. Trạng thái được đặt là Chờ duyệt (ẩn khỏi học sinh).',
    }
  } else {
    // Cambridge / Full Exam
    const qLookup = parseInt(questionId || questionNumber, 10)
    const question = await prisma.question.findFirst({
      where: {
        OR: [
          { id: qLookup },
          {
            number: qLookup,
            OR: [
              { passage: { examId: parsedExamId } },
              { listeningSection: { examId: parsedExamId } },
              { group: { passage: { examId: parsedExamId } } },
              { group: { section: { examId: parsedExamId } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        number: true,
        type: true,
        questionText: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        passage: { select: { body: true, examId: true } },
        listeningSection: { select: { transcript: true, context: true, examId: true } },
        group: {
          select: {
            type: true,
            passage: { select: { body: true, examId: true } },
            section: { select: { transcript: true, context: true, examId: true } },
            matchingOptions: { select: { optionLetter: true, optionText: true }, orderBy: { sortOrder: 'asc' } },
            noteSections: {
              select: { lines: { select: { contentWithTokens: true }, orderBy: { sortOrder: 'asc' } } },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })

    if (!question) {
      throw new Error(`Không tìm thấy câu hỏi #${questionId || questionNumber} trong đề #${parsedExamId}`)
    }

    const inputAnswer = String(question.correctAnswer ?? '').trim()
    if (!inputAnswer) {
      throw new Error(`Câu #${question.number} chưa có đáp án đúng, không thể tạo giải thích bằng AI.`)
    }

    const family = classifyFamily(question.type)
    const ctx = buildContext(question, family)

    const oldExp = (question.explanation && typeof question.explanation === 'object') ? question.explanation : {}
    const isFixedMode = Boolean(
      cleanFeedback ||
      oldExp.status === 'needs_regeneration' ||
      oldExp.teacherKeptAnswer ||
      oldExp.status === 'teacher_edited'
    )

    let explanation
    try {
      if (isFixedMode) {
        explanation = await generateExplanation(question, family, ctx, {
          isFixedMode: true,
          targetAnswer: inputAnswer,
          teacherFeedback: cleanFeedback,
        })
      } else {
        explanation = await generateExplanation(question, family, ctx, { teacherFeedback: cleanFeedback })
      }
    } catch (err) {
      if (err instanceof ExplanationValidationError) {
        return {
          ok: false,
          error: 'EVIDENCE_NOT_FOUND',
          message: 'Không thể xác thực bằng chứng nguyên văn: ' + err.message,
        }
      }
      throw err
    }

    if (!explanation) {
      return { ok: false, message: 'AI không tạo được giải thích cho câu hỏi này.' }
    }

    const aiAnswer = String(explanation.answer || '').trim()
    const rawOptions = question.options || (question.group?.matchingOptions?.length ? question.group.matchingOptions : null)
    let match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, question.type)
    const isFallbackResult = Boolean(explanation?.isFallback || (explanation?.provider && explanation.provider.toLowerCase() !== 'gemini'))

    if (isFallbackResult && (!match || (isFixedMode && explanation.no_support))) {
      const retryResult = await handleFallbackMismatchRetry({
        qCtx: question,
        family,
        ctx,
        inputAnswer,
        rawOptions,
        startTime: Date.now(),
        effectiveTimeBudget: 30000,
        isFixedMode,
        targetAnswer: isFixedMode ? inputAnswer : null,
      })
      if (retryResult.resolvedWithGemini) {
        explanation = retryResult.explanation
        match = retryResult.match
      } else {
        return {
          ok: false,
          status: 'needs_regeneration',
          isConflict: false,
          needsRetry: true,
          message: `AI chính đang bận, kết quả dự phòng của câu #${question.number} chưa đủ tin cậy, hãy thử lại sau.`,
          explanation: oldExp,
        }
      }
    }

    if (isFixedMode && explanation.no_support) {
      return {
        ok: false,
        error: 'NO_SUPPORT',
        message: `Không tìm thấy bằng chứng trong bài đọc ủng hộ đáp án "${inputAnswer}". Bạn vui lòng sử dụng chức năng "Sửa trực tiếp" để viết lời giải thủ công.`,
      }
    }

    const currentAiAnswer = String(explanation.answer || '').trim()
    if (match) {
      explanation.status = 'ai_generated'
      explanation.teacher_note = `Khớp với đáp án đề (${inputAnswer}).`
    } else if (isFixedMode && (oldExp.status === 'needs_regeneration' || oldExp.teacherKeptAnswer)) {
      explanation.status = 'needs_regeneration'
      explanation.teacher_note = `AI không tìm thấy bằng chứng ủng hộ đáp án "${inputAnswer}". Cần sửa trực tiếp.`
    } else {
      explanation.status = 'conflict_pending'
      explanation.aiAnswer = currentAiAnswer
      explanation.teacher_note = `AI chọn "${currentAiAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`
    }

    if (containsInternalJargon(explanation)) {
      explanation.status = 'needs_regeneration'
      explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
    }

    const oldHistory = Array.isArray(oldExp.feedbackHistory) ? oldExp.feedbackHistory : []
    const feedbackEntry = {
      at: new Date().toISOString(),
      feedback: cleanFeedback || '',
      provider: explanation.provider || 'Gemini',
      model: explanation.model || 'gemini-3.5-flash-lite',
    }
    explanation.teacherFeedback = cleanFeedback || ''
    explanation.feedbackHistory = [feedbackEntry, ...oldHistory].slice(0, 5)
    explanation.updatedAt = new Date().toISOString()

    await prisma.question.update({
      where: { id: question.id },
      data: { explanation },
    })

    invalidateExamCaches(parsedExamId)

    return {
      ok: true,
      status: explanation.status,
      isConflict: explanation.status === 'conflict_pending',
      explanation,
      message: (isFixedMode || match)
        ? 'Đã tạo lại giải thích thành công!'
        : 'AI sinh giải thích nhưng đáp án lệch so với đáp án câu hỏi. Trạng thái được đặt là Chờ duyệt (ẩn khỏi học sinh).',
    }
  }
}

/**
 * 4.4 Manual edit an explanation for a single question.
 */
async function updateManualExplanation({ examId, questionId = null, questionNumber = null, isPractice = false, fields = {} }) {
  const cleanFields = validateManualExplanation(fields)
  const parsedExamId = parseInt(examId, 10)

  if (isPractice) {
    const exam = await prisma.practiceExam.findUnique({
      where: { id: parsedExamId },
      include: { questions: { orderBy: { orderNum: 'asc' } } },
    })
    if (!exam) throw new Error(`Không tìm thấy bài luyện tập #${parsedExamId}`)

    const targetNum = parseInt(questionNumber, 10)
    let targetRow = null
    let targetQItem = null

    for (const row of exam.questions) {
      const group = parseGroup(row)
      if (!group || !Array.isArray(group.questions)) continue
      const qItem = group.questions.find((q) => Number(q.number) === targetNum)
      if (qItem) {
        targetRow = row
        targetQItem = qItem
        break
      }
    }

    if (!targetRow || !targetQItem) {
      throw new Error(`Không tìm thấy câu hỏi #${targetNum} trong bài luyện tập #${parsedExamId}`)
    }

    let resultExp = null
    await updatePracticeQuestionExplanationTx(targetRow.id, (byNumber) => {
      const prev = (byNumber[targetNum] && typeof byNumber[targetNum] === 'object')
        ? byNumber[targetNum]
        : { v: 2, answer: String(targetQItem.correctAnswer || '') }

      const updated = {
        ...prev,
        ...cleanFields,
        status: 'teacher_edited',
        manualEdit: true,
        updatedAt: new Date().toISOString(),
      }
      byNumber[targetNum] = updated
      resultExp = updated
      return byNumber
    })

    invalidate('practice:')

    return {
      ok: true,
      status: 'teacher_edited',
      explanation: resultExp,
      message: 'Đã lưu chỉnh sửa lời giải thành công!',
    }
  } else {
    const qLookup = parseInt(questionId || questionNumber, 10)
    const question = await prisma.question.findFirst({
      where: {
        OR: [
          { id: qLookup },
          {
            number: qLookup,
            OR: [
              { passage: { examId: parsedExamId } },
              { listeningSection: { examId: parsedExamId } },
              { group: { passage: { examId: parsedExamId } } },
              { group: { section: { examId: parsedExamId } } },
            ],
          },
        ],
      },
      select: { id: true, number: true, correctAnswer: true, explanation: true },
    })

    if (!question) {
      throw new Error(`Không tìm thấy câu hỏi #${questionId || questionNumber} trong đề #${parsedExamId}`)
    }

    const prev = (question.explanation && typeof question.explanation === 'object')
      ? question.explanation
      : { v: 2, answer: String(question.correctAnswer || '') }

    const updated = {
      ...prev,
      ...cleanFields,
      status: 'teacher_edited',
      manualEdit: true,
      updatedAt: new Date().toISOString(),
    }

    await prisma.question.update({
      where: { id: question.id },
      data: { explanation: updated },
    })

    invalidateExamCaches(parsedExamId)

    return {
      ok: true,
      status: 'teacher_edited',
      explanation: updated,
      message: 'Đã lưu chỉnh sửa lời giải thành công!',
    }
  }
}

/**
 * 4.5 Teacher review action for a single question.
 */
async function reviewQuestionExplanation({ examId, questionId = null, questionNumber = null, isPractice = false }) {
  const parsedExamId = parseInt(examId, 10)

  if (isPractice) {
    const exam = await prisma.practiceExam.findUnique({
      where: { id: parsedExamId },
      include: { questions: { orderBy: { orderNum: 'asc' } } },
    })
    if (!exam) throw new Error(`Không tìm thấy bài luyện tập #${parsedExamId}`)

    const targetNum = parseInt(questionNumber, 10)
    let targetRow = null
    let targetGroup = null
    let targetQItem = null

    for (const row of exam.questions) {
      const group = parseGroup(row)
      if (!group || !Array.isArray(group.questions)) continue
      const qItem = group.questions.find((q) => Number(q.number) === targetNum)
      if (qItem) {
        targetRow = row
        targetGroup = group
        targetQItem = qItem
        break
      }
    }

    if (!targetRow || !targetQItem) {
      throw new Error(`Không tìm thấy câu hỏi #${targetNum} trong bài luyện tập #${parsedExamId}`)
    }

    let resultExp = null
    await updatePracticeQuestionExplanationTx(targetRow.id, (byNumber) => {
      const prev = byNumber[targetNum]
      if (!prev || typeof prev !== 'object') {
        throw new Error(`Câu hỏi #${targetNum} chưa có lời giải để duyệt`)
      }

      const inputAnswer = String(targetQItem.correctAnswer ?? '').trim()
      const expAnswer = String(prev.answer ?? '').trim()
      const rawOptions = targetQItem.options || (targetGroup.matchingOptions?.length ? targetGroup.matchingOptions : null)
      const qType = targetGroup.type || targetQItem.type
      if (!isAnswerMatch(inputAnswer, expAnswer, rawOptions, qType)) {
        throw new Error(`Không thể duyệt lời giải vì đáp án trong lời giải ("${expAnswer}") không khớp với đáp án đúng của câu hỏi ("${inputAnswer}").`)
      }

      const updated = {
        ...prev,
        status: 'teacher_reviewed',
        reviewedAt: new Date().toISOString(),
      }
      byNumber[targetNum] = updated
      resultExp = updated
      return byNumber
    })

    invalidate('practice:')

    return {
      ok: true,
      status: 'teacher_reviewed',
      explanation: resultExp,
      message: 'Đã duyệt lời giải thành công!',
    }
  } else {
    const qLookup = parseInt(questionId || questionNumber, 10)
    const question = await prisma.question.findFirst({
      where: {
        OR: [
          { id: qLookup },
          {
            number: qLookup,
            OR: [
              { passage: { examId: parsedExamId } },
              { listeningSection: { examId: parsedExamId } },
              { group: { passage: { examId: parsedExamId } } },
              { group: { section: { examId: parsedExamId } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        number: true,
        type: true,
        correctAnswer: true,
        options: true,
        explanation: true,
        group: {
          select: {
            type: true,
            matchingOptions: { select: { optionLetter: true, optionText: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })

    if (!question) {
      throw new Error(`Không tìm thấy câu hỏi #${questionId || questionNumber} trong đề #${parsedExamId}`)
    }

    if (!question.explanation || typeof question.explanation !== 'object') {
      throw new Error(`Câu hỏi #${question.number} chưa có lời giải để duyệt`)
    }

    const inputAnswer = String(question.correctAnswer ?? '').trim()
    const expAnswer = String(question.explanation.answer ?? '').trim()
    const rawOptions = question.options || (question.group?.matchingOptions?.length ? question.group.matchingOptions : null)
    const qType = question.type || question.group?.type
    if (!isAnswerMatch(inputAnswer, expAnswer, rawOptions, qType)) {
      throw new Error(`Không thể duyệt lời giải vì đáp án trong lời giải ("${expAnswer}") không khớp với đáp án đúng của câu hỏi ("${inputAnswer}").`)
    }

    const updated = {
      ...question.explanation,
      status: 'teacher_reviewed',
      reviewedAt: new Date().toISOString(),
    }

    await prisma.question.update({
      where: { id: question.id },
      data: { explanation: updated },
    })

    invalidateExamCaches(parsedExamId)

    return {
      ok: true,
      status: 'teacher_reviewed',
      explanation: updated,
      message: 'Đã duyệt lời giải thành công!',
    }
  }
}

module.exports = {
  isAnswerMatch,
  stripTrailingPunctuation,
  extractOptionPairs,
  resolveToOption,
  extractMultiChoiceTokens,
  normalizeCompletionTerm,
  expandCompletionVariants,
  ROMAN_NUMERALS,
  generateForPracticeExam,
  generateForExam,
  INTERNAL_JARGON_PHRASES,
  normalizeJargonText,
  containsInternalJargon,
  isExplanationVisibleToLearner,
  filterLearnerExplanation,
  validateManualExplanation,
  updatePracticeQuestionExplanationTx,
  regenerateQuestionExplanation,
  updateManualExplanation,
  reviewQuestionExplanation,
}
