const prisma = require('../lib/prisma')
const {
  classifyFamily,
  buildContext,
  generateExplanation,
  normalizeText,
  cleanString,
  splitParagraphs,
  findParagraph,
  cleanChunks,
  ExplanationValidationError,
  SKIP_FAMILIES,
} = require('../scripts/generate-explanations')
const { practiceQuestionContext } = require('../scripts/import-practice-explanations')
const { invalidate } = require('../lib/swrCache')
const { invalidateExamCaches } = require('../utils/cache')

const DEFAULT_TIME_BUDGET_MS = parseInt(process.env.EXPLANATION_TIME_BUDGET_MS, 10) || 40000
const MAX_REQUEST_HARD_TIMEOUT_MS = 48000 // Trần cứng: không bao giờ để một request vượt 48s (< 50s và < 60s Nginx)
const SINGLE_QUESTION_TIMEOUT_MS = 20000 // Timeout cứng cho MỖI lần xử lý 1 câu (kể cả retry/backoff)
const MIN_REMAINING_FOR_NEXT_CALL_MS = 14000 // Trước khi bắt đầu câu mới, cần ít nhất 14s (đủ cho 1 lần gọi đầy đủ)

function withTimeout(promise, timeoutMs, timeoutErrorMessage = 'Quá thời gian xử lý AI cho câu hỏi này', onCancel = null) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (typeof onCancel === 'function') onCancel()
      const err = new Error(timeoutErrorMessage)
      err.code = 'ETIMEDOUT'
      err.isTimeout = true
      reject(err)
    }, timeoutMs)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer))
}

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

function validateManualExplanation(data, { sourceText = null, family = 'GENERIC', prevExp = {}, targetAnswer = null } = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Dữ liệu sửa giải thích không hợp lệ')
  }

  const allowed = {}
  const paragraphs = sourceText ? splitParagraphs(sourceText) : []
  const hasSource = paragraphs.length > 0
  const isImageFamily = family === 'IMAGE'
  const effectiveAnswer = String(data.answer || targetAnswer || prevExp?.answer || '').trim().toUpperCase()
  const isNotGiven = (family === 'TFNG') && (effectiveAnswer === 'NOT GIVEN' || effectiveAnswer === 'NG' || effectiveAnswer === 'NOTGIVEN')
  const allowEmptyEvidence = isNotGiven || isImageFamily || !hasSource

  // BƯỚC 1: Phân tích câu hỏi và dự đoán
  if (data.predict !== undefined) {
    if (typeof data.predict !== 'string') throw new Error('predict phải là chuỗi ký tự')
    if (data.predict.length > 1000) throw new Error('predict không được vượt quá 1000 ký tự')
    allowed.predict = cleanString(data.predict, 1000)
  }

  if (data.question_chunks !== undefined) {
    if (!Array.isArray(data.question_chunks)) throw new Error('question_chunks phải là danh sách')
    if (data.question_chunks.length > 12) throw new Error('question_chunks không được vượt quá 12 cụm')
    allowed.question_chunks = cleanChunks(data.question_chunks, 12)
  }

  // BƯỚC 2: Định vị thông tin liên quan
  let validatedLocate = null
  if (data.locate !== undefined) {
    if (data.locate && typeof data.locate === 'object') {
      const note = cleanString(data.locate.note, 600)
      const rawKeywords = Array.isArray(data.locate.keywords) ? data.locate.keywords : []
      if (rawKeywords.length > 5) throw new Error('locate.keywords không được vượt quá 5 từ khóa')

      const keywords = []
      for (const rawKw of rawKeywords) {
        const kw = cleanString(rawKw, 120)
        if (!kw) continue
        if (hasSource && !isImageFamily) {
          const foundP = findParagraph(paragraphs, kw)
          if (foundP === -1) {
            throw new Error(`Từ khóa định vị "${kw}" không tìm thấy nguyên văn trong bài đọc/transcript.`)
          }
        }
        keywords.push(kw)
      }
      validatedLocate = {
        note,
        keywords,
        paragraph: null, // sẽ tính lại ở dưới
      }
    } else if (data.locate === null) {
      validatedLocate = null
    }
  }

  // BƯỚC 3: Đọc thông tin liên quan (evidence)
  if (data.evidence !== undefined) {
    if (data.evidence && typeof data.evidence === 'object' && Array.isArray(data.evidence.parts)) {
      const rawParts = data.evidence.parts
      if (rawParts.length > 5) throw new Error('Số đoạn trích dẫn trong bằng chứng không được vượt quá 5')

      const parts = []
      for (const rawP of rawParts) {
        const pText = cleanString(typeof rawP === 'string' ? rawP : rawP?.text, 1200)
        if (!pText) continue

        if (hasSource && !isImageFamily) {
          // Tái dùng logic từ enrichExplanation
          const whole = findParagraph(paragraphs, pText)
          if (whole !== -1) {
            parts.push({ text: pText, paragraph: whole })
          } else {
            const sentences = pText.split(/(?<=[.!?;])\s+/).filter(Boolean)
            if (sentences.length === 0) {
              throw new Error(`Câu trích dẫn "${pText.slice(0, 80)}" không tìm thấy nguyên văn trong bài đọc/transcript.`)
            }
            for (const sentence of sentences) {
              const found = findParagraph(paragraphs, sentence)
              if (found === -1) {
                throw new Error(`Câu trích dẫn "${sentence.slice(0, 100)}" không tìm thấy nguyên văn trong bài đọc/transcript.`)
              }
              parts.push({ text: sentence, paragraph: found })
            }
          }
        } else {
          parts.push({ text: pText, paragraph: null })
        }
      }

      let chunks = []
      if (parts.length > 0 && Array.isArray(data.evidence.chunks)) {
        const normParts = parts.map((p) => normalizeText(p.text))
        for (const rawChunk of data.evidence.chunks) {
          const cText = cleanString(rawChunk?.text, 200)
          const cLabel = cleanString(rawChunk?.label, 80)
          if (!cText) continue

          const target = normalizeText(cText)
          let partIdx = typeof rawChunk?.part === 'number' && rawChunk.part >= 0 && rawChunk.part < parts.length
            ? rawChunk.part
            : -1

          if (partIdx === -1 || !normParts[partIdx].includes(target)) {
            partIdx = normParts.findIndex((np) => np.includes(target))
          }

          if (partIdx === -1) {
            throw new Error(`Cụm từ trích dẫn "${cText}" không nằm trong câu trích dẫn của Bước 3.`)
          }

          chunks.push({
            text: cText,
            label: cLabel,
            part: partIdx,
          })
        }
        chunks.sort((a, b) => a.part - b.part)
      }

      if (parts.length > 0) {
        allowed.evidence = {
          parts,
          paragraph: parts[0].paragraph,
          chunks,
        }
      } else {
        const hadEvidence = Boolean(prevExp?.evidence?.parts?.length > 0 || prevExp?.evidence?.text)
        if (hadEvidence && !allowEmptyEvidence) {
          throw new Error('Không thể để trống bằng chứng khi câu hỏi đang có bằng chứng dẫn chứng.')
        }
        allowed.evidence = null
      }
    } else if (data.evidence === null) {
      const hadEvidence = Boolean(prevExp?.evidence?.parts?.length > 0 || prevExp?.evidence?.text)
      if (hadEvidence && !allowEmptyEvidence) {
        throw new Error('Không thể để trống bằng chứng khi câu hỏi đang có bằng chứng dẫn chứng.')
      }
      allowed.evidence = null
    }
  }

  // TÍNH LẠI locate.paragraph (hoặc tính từ evidence hoặc keywords)
  if (validatedLocate) {
    const activeEvidence = allowed.evidence !== undefined ? allowed.evidence : prevExp?.evidence
    if (activeEvidence?.parts?.length > 0 && activeEvidence.paragraph != null) {
      validatedLocate.paragraph = activeEvidence.paragraph
    } else if (validatedLocate.keywords.length > 0 && hasSource) {
      const kwP = findParagraph(paragraphs, validatedLocate.keywords[0])
      validatedLocate.paragraph = kwP === -1 ? null : kwP
    } else {
      validatedLocate.paragraph = null
    }
    allowed.locate = validatedLocate
  } else if (data.locate === null) {
    allowed.locate = null
  }

  // BƯỚC 4: Paraphrases
  if (data.paraphrases !== undefined) {
    if (!Array.isArray(data.paraphrases)) throw new Error('paraphrases phải là một danh sách')
    if (data.paraphrases.length > 5) throw new Error('paraphrases không được vượt quá 5 mục')
    const paraphrases = []
    for (const p of data.paraphrases) {
      if (!p || typeof p !== 'object') continue
      const question = cleanString(p.question, 160)
      const question_label = cleanString(p.question_label, 80)
      const passage = cleanString(p.passage, 160)
      const passage_label = cleanString(p.passage_label, 80)
      if (!question || !passage) continue

      if (hasSource && !isImageFamily) {
        const found = findParagraph(paragraphs, passage)
        if (found === -1) {
          throw new Error(`Cụm từ đối chiếu paraphrasing "${passage}" không tìm thấy nguyên văn trong bài đọc/transcript.`)
        }
      }
      paraphrases.push({ question, question_label, passage, passage_label })
    }
    allowed.paraphrases = paraphrases
  }

  // BƯỚC 4: Các trường văn bản suy luận
  if (data.reasoning !== undefined) {
    if (typeof data.reasoning !== 'string') throw new Error('reasoning phải là chuỗi ký tự')
    if (data.reasoning.length > 2000) throw new Error('reasoning không được vượt quá 2000 ký tự')
    allowed.reasoning = cleanString(data.reasoning, 2000)
  }

  if (data.teacher_note !== undefined) {
    if (typeof data.teacher_note !== 'string') throw new Error('teacher_note phải là chuỗi ký tự')
    if (data.teacher_note.length > 2000) throw new Error('teacher_note không được vượt quá 2000 ký tự')
    allowed.teacher_note = cleanString(data.teacher_note, 2000)
  }

  if (data.translation !== undefined) {
    if (typeof data.translation !== 'string') throw new Error('translation phải là chuỗi ký tự')
    if (data.translation.length > 1000) throw new Error('translation không được vượt quá 1000 ký tự')
    allowed.translation = family === 'COMPLETION' ? cleanString(data.translation, 1000) : ''
  } else if (family !== 'COMPLETION') {
    allowed.translation = ''
  }

  if (data.full_sentence !== undefined) {
    if (typeof data.full_sentence !== 'string') throw new Error('full_sentence phải là chuỗi ký tự')
    if (data.full_sentence.length > 1000) throw new Error('full_sentence không được vượt quá 1000 ký tự')
    allowed.full_sentence = family === 'COMPLETION' ? cleanString(data.full_sentence, 1000) : ''
  } else if (family !== 'COMPLETION') {
    allowed.full_sentence = ''
  }

  if (data.distractors !== undefined) {
    if (!Array.isArray(data.distractors)) throw new Error('distractors phải là một danh sách')
    if (data.distractors.length > 10) throw new Error('distractors không được vượt quá 10 mục')
    allowed.distractors = data.distractors.map((d, i) => {
      if (!d || typeof d !== 'object') throw new Error(`Lựa chọn thứ ${i + 1} trong distractors không hợp lệ`)
      const option = cleanString(d.option, 100)
      const reason = cleanString(d.reason, 500)
      const label = d.label ? cleanString(d.label, 100) : ''
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
  const requestedBudget = (typeof timeBudgetMs === 'number' && timeBudgetMs > 0)
    ? timeBudgetMs
    : DEFAULT_TIME_BUDGET_MS
  const effectiveTimeBudget = Math.min(requestedBudget, MAX_REQUEST_HARD_TIMEOUT_MS)
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

  for (const item of candidateItems) {
    // 3.1: Kiểm tra thời gian còn lại đủ cho một lần gọi đầy đủ (kể cả backoff tối đa)
    const elapsedBeforeItem = Date.now() - startTime
    const remainingTime = effectiveTimeBudget - elapsedBeforeItem
    if (generatedCount > 0 && remainingTime < MIN_REMAINING_FOR_NEXT_CALL_MS) {
      console.log(`[TIME_BUDGET] Practice #${examId}: Đã chạy ${elapsedBeforeItem}ms, thời gian còn lại ${remainingTime}ms không đủ cho một lần gọi đầy đủ (cần >= ${MIN_REMAINING_FOR_NEXT_CALL_MS}ms). Ngắt lượt để trả về client gọi tiếp.`)
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
        explanation = await withTimeout(
          generateExplanation(qCtx, family, ctx, { isFixedMode: true, targetAnswer: inputAnswer }),
          SINGLE_QUESTION_TIMEOUT_MS,
          `Hết thời gian xử lý AI (${SINGLE_QUESTION_TIMEOUT_MS}ms) cho câu #${qNum}`
        )
      } else {
        explanation = await withTimeout(
          generateExplanation(qCtx, family, ctx),
          SINGLE_QUESTION_TIMEOUT_MS,
          `Hết thời gian xử lý AI (${SINGLE_QUESTION_TIMEOUT_MS}ms) cho câu #${qNum}`
        )
      }
    } catch (err) {
      if (err.isTimeout || err.code === 'ETIMEDOUT') {
        console.warn(`[TIMEOUT_STALL] Practice #${examId} Câu #${qNum} bị timeout sau ${SINGLE_QUESTION_TIMEOUT_MS}ms. Coi là chưa xong, ngắt request để trả về client gọi lại câu này.`)
        break
      }
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
  const requestedBudget = (typeof timeBudgetMs === 'number' && timeBudgetMs > 0)
    ? timeBudgetMs
    : DEFAULT_TIME_BUDGET_MS
  const effectiveTimeBudget = Math.min(requestedBudget, MAX_REQUEST_HARD_TIMEOUT_MS)
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

  for (const { q, family } of candidateQuestions) {
    // 3.1: Kiểm tra thời gian còn lại đủ cho một lần gọi đầy đủ (kể cả backoff tối đa)
    const elapsedBeforeItem = Date.now() - startTime
    const remainingTime = effectiveTimeBudget - elapsedBeforeItem
    if (generatedCount > 0 && remainingTime < MIN_REMAINING_FOR_NEXT_CALL_MS) {
      console.log(`[TIME_BUDGET] Exam #${examId}: Đã chạy ${elapsedBeforeItem}ms, thời gian còn lại ${remainingTime}ms không đủ cho một lần gọi đầy đủ (cần >= ${MIN_REMAINING_FOR_NEXT_CALL_MS}ms). Ngắt lượt để trả về client gọi tiếp.`)
      break
    }

    const ctx = buildContext(q, family)

    let explanation
    const choice = resolveChoices[q.number]
    const inputAnswer = String(q.correctAnswer || '').trim()
    const rawOptions = q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null)

    try {
      if (choice === 'input') {
        explanation = await withTimeout(
          generateExplanation(q, family, ctx, { isFixedMode: true, targetAnswer: inputAnswer }),
          SINGLE_QUESTION_TIMEOUT_MS,
          `Hết thời gian xử lý AI (${SINGLE_QUESTION_TIMEOUT_MS}ms) cho câu #${q.number}`
        )
      } else {
        explanation = await withTimeout(
          generateExplanation(q, family, ctx),
          SINGLE_QUESTION_TIMEOUT_MS,
          `Hết thời gian xử lý AI (${SINGLE_QUESTION_TIMEOUT_MS}ms) cho câu #${q.number}`
        )
      }
    } catch (err) {
      if (err.isTimeout || err.code === 'ETIMEDOUT') {
        console.warn(`[TIMEOUT_STALL] Exam #${examId} Câu #${q.number} bị timeout sau ${SINGLE_QUESTION_TIMEOUT_MS}ms. Coi là chưa xong, ngắt request để trả về client gọi lại câu này.`)
        break
      }
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
 * Core regeneration logic shared across Practice and Exam.
 * Handles L2 requirements:
 * - Proposed answer flow (blind solve, confirmation, fallback blocking, attempt warning)
 * - Teacher feedback flow (blind verify to avoid defending wrong answers)
 */
async function solveBlindWithGeminiRetry(qCtx, family, ctx) {
  let lastErr = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const exp = await generateExplanation(qCtx, family, ctx, {
        isFixedMode: false,
        targetAnswer: null,
        teacherFeedback: null,
        forceProvider: 'Gemini',
      })
      const isFallback = Boolean(
        exp?.isFallback ||
        (exp?.provider && exp.provider.toLowerCase() !== 'gemini')
      )
      if (!isFallback && exp && exp.answer) {
        return { ok: true, explanation: exp }
      }
    } catch (err) {
      if (err instanceof ExplanationValidationError) {
        return {
          ok: false,
          error: 'EVIDENCE_NOT_FOUND',
          message: 'Không thể xác thực bằng chứng nguyên văn khi giải mù: ' + err.message,
        }
      }
      lastErr = err
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return {
    ok: false,
    error: 'FALLBACK_NOT_ALLOWED',
    message: 'AI chính đang bận, hãy thử lại sau. (Hệ thống không dùng AI dự phòng để quyết định đổi đáp án chuẩn)',
    details: lastErr?.message,
  }
}

async function handleRegenerateCore({
  qCtx,
  family,
  ctx,
  inputAnswer,
  rawOptions,
  oldExp,
  cleanFeedback,
  cleanProposed,
  confirmChangeAnswer,
  attemptCount = 0,
  updateCorrectAnswer,
  saveExplanation,
  questionNumber,
}) {
  const isChangingAnswer = Boolean(cleanProposed && !isAnswerMatch(inputAnswer, cleanProposed, rawOptions, qCtx.type))

  // ─── BRANCH 1: TEACHER PROPOSES A NEW ANSWER ──────────────────────────────
  if (isChangingAnswer) {
    if (confirmChangeAnswer) {
      // Step 2: Teacher confirmed changing the answer!
      await updateCorrectAnswer(cleanProposed)

      let explanation
      try {
        explanation = await generateExplanation(qCtx, family, ctx, {
          isFixedMode: true,
          targetAnswer: cleanProposed,
          teacherFeedback: cleanFeedback,
        })
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
        return { ok: false, message: 'AI không tạo được giải thích cho đáp án mới này.' }
      }

      if (explanation.no_support) {
        explanation.status = 'needs_regeneration'
        explanation.teacher_note = `Đã đổi đáp án sang "${cleanProposed}" nhưng AI không tìm thấy bằng chứng ủng hộ. Cần sửa trực tiếp.`
      } else {
        explanation.status = 'teacher_reviewed'
        explanation.teacher_note = `Đã đổi đáp án chuẩn từ "${inputAnswer}" sang "${cleanProposed}" (xác nhận bởi giáo viên).`
      }

      if (containsInternalJargon(explanation)) {
        explanation.status = 'needs_regeneration'
        explanation.needsRegenerationReason = 'Lời giải chứa cụm từ nội bộ'
      }

      const oldHistory = Array.isArray(oldExp.feedbackHistory) ? oldExp.feedbackHistory : []
      const feedbackEntry = {
        at: new Date().toISOString(),
        feedback: cleanFeedback ? `[Đổi đáp án -> ${cleanProposed}] ${cleanFeedback}` : `[Đổi đáp án -> ${cleanProposed}]`,
        provider: explanation.provider || 'Gemini',
        model: explanation.model || 'gemini-3.5-flash-lite',
      }
      explanation.teacherFeedback = cleanFeedback || ''
      explanation.feedbackHistory = [feedbackEntry, ...oldHistory].slice(0, 5)
      explanation.updatedAt = new Date().toISOString()

      await saveExplanation(explanation)

      return {
        ok: true,
        status: explanation.status,
        isConflict: false,
        updatedCorrectAnswer: cleanProposed,
        explanation,
        message: `Đã cập nhật đáp án chuẩn thành "${cleanProposed}" và tạo lời giải mới thành công!`,
      }
    } else {
      // Step 1: Independent Blind Solve! (No feedback, no targetAnswer, force Gemini with retry)
      const blindRes = await solveBlindWithGeminiRetry(qCtx, family, ctx)
      if (!blindRes.ok) {
        return blindRes
      }
      const blindExplanation = blindRes.explanation

      const aiBlindAnswer = String(blindExplanation.answer || '').trim()
      const matchProposed = isAnswerMatch(cleanProposed, aiBlindAnswer, rawOptions, qCtx.type)

      if (matchProposed) {
        // AI agrees with proposed answer! Prompt confirmation
        return {
          ok: true,
          requiresConfirmation: true,
          proposedAnswer: cleanProposed,
          currentAnswer: inputAnswer,
          aiBlindAnswer,
          attemptCount,
          evidence: blindExplanation.evidence?.parts?.[0]?.text || '',
          reasoning: blindExplanation.reasoning || '',
          message: `AI giải độc lập cũng ra "${aiBlindAnswer}" (khớp với bạn). Bạn có chắc chắn muốn đổi đáp án chuẩn từ "${inputAnswer}" thành "${cleanProposed}" không?`,
        }
      } else {
        // AI does NOT agree with proposed answer! Reject change and do NOT overwrite
        return {
          ok: false,
          conflict: true,
          proposedAnswer: cleanProposed,
          currentAnswer: inputAnswer,
          aiBlindAnswer,
          attemptCount,
          evidence: blindExplanation.evidence?.parts?.[0]?.text || '',
          reasoning: blindExplanation.reasoning || '',
          message: `AI giải độc lập ra "${aiBlindAnswer}" (dựa trên bài đọc), KHÔNG khớp với đáp án "${cleanProposed}" bạn đề xuất. Lời giải chưa được lưu.`,
        }
      }
    }
  }

  // ─── BRANCH 2: TEACHER ONLY GIVES FEEDBACK (OR NORMAL REGENERATE) ─────────
  if (cleanFeedback) {
    const isTeacherReviewed = oldExp && oldExp.status === 'teacher_reviewed'
    if (!isTeacherReviewed) {
      // Run 1 blind check to see if AI still supports inputAnswer
      const blindRes = await solveBlindWithGeminiRetry(qCtx, family, ctx)
      if (!blindRes.ok) {
        return blindRes
      }
      const blindExp = blindRes.explanation
      const aiBlindAnswer = String(blindExp?.answer || '').trim()
      const matchCurrent = isAnswerMatch(inputAnswer, aiBlindAnswer, rawOptions, qCtx.type)

      if (!matchCurrent) {
        // AI disagrees with current answer! Do NOT manufacture false defense.
        // Return conflict for modal selection (Flow X) without overwriting correct explanation.
        const conflictExp = {
          ...(blindExp || oldExp),
          status: 'conflict_pending',
          aiAnswer: aiBlindAnswer,
          answer: inputAnswer,
          teacher_note: `AI chọn "${aiBlindAnswer}"; đáp án đề đang là "${inputAnswer}". Cần giáo viên đối chiếu.`,
          teacherFeedback: cleanFeedback,
          updatedAt: new Date().toISOString(),
        }

        return {
          ok: true,
          conflict: true,
          isConflict: true,
          status: 'conflict_pending',
          isFeedbackOnly: true,
          currentAnswer: inputAnswer,
          aiBlindAnswer,
          attemptCount,
          explanation: conflictExp,
          evidence: blindExp.evidence?.parts?.[0]?.text || '',
          reasoning: blindExp.reasoning || '',
          message: `AI giải độc lập ra đáp án "${aiBlindAnswer}" (khác với đáp án "${inputAnswer}" đang lưu của câu hỏi). Lời giải chưa được lưu.`,
        }
      }
    }
  }

  // Standard generate (or proceed with fixedMode after blind check succeeded, or teacher_reviewed)
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
  let match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, qCtx.type)
  const isFallbackResult = Boolean(
    explanation?.isFallback ||
    (explanation?.provider && explanation.provider.toLowerCase() !== 'gemini')
  )

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
        message: `AI chính đang bận, kết quả dự phòng của câu #${questionNumber} chưa đủ tin cậy, hãy thử lại sau.`,
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

  await saveExplanation(explanation)

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

/**
 * 4.3 Regenerate explanation for a single question with optional teacherFeedback,
 * proposedAnswer, and confirmChangeAnswer (L2).
 */
async function regenerateQuestionExplanation({
  examId,
  questionId = null,
  questionNumber = null,
  isPractice = false,
  skill = 'reading',
  teacherFeedback = null,
  proposedAnswer = null,
  confirmChangeAnswer = false,
  timeoutMs = MAX_REQUEST_HARD_TIMEOUT_MS,
}) {
  // cancelFlag: ngăn saveExplanation ghi DB sau khi HTTP 504 đã được trả về
  const cancelFlag = { cancelled: false }
  return withTimeout(
    (async () => {
      const cleanFeedback = teacherFeedback ? cleanString(teacherFeedback, 1000) : null
      const cleanProposed = proposedAnswer ? cleanString(proposedAnswer, 200).trim() : null
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
        const rawOptions = qCtx.options || (targetGroup.matchingOptions?.length ? targetGroup.matchingOptions : null)

        let attemptCount = 0
        try {
          if (prisma.practiceAttempt && typeof prisma.practiceAttempt.count === 'function') {
            attemptCount = await prisma.practiceAttempt.count({ where: { practiceExamId: parsedExamId } })
          }
        } catch {
          attemptCount = 0
        }

        return await handleRegenerateCore({
          qCtx,
          family,
          ctx,
          inputAnswer,
          rawOptions,
          oldExp,
          cleanFeedback,
          cleanProposed,
          confirmChangeAnswer: Boolean(confirmChangeAnswer),
          attemptCount,
          questionNumber: targetNum,
          updateCorrectAnswer: async (newAnswer) => {
            targetQItem.correctAnswer = newAnswer
            await prisma.practiceQuestion.update({
              where: { id: targetRow.id },
              data: { content: JSON.stringify(targetGroup) },
            })
          },
          saveExplanation: async (exp) => {
            if (cancelFlag.cancelled) return // True Cancel: bỏ qua nếu HTTP đã timeout
            await updatePracticeQuestionExplanationTx(targetRow.id, (byNumber) => {
              byNumber[targetNum] = exp
              return byNumber
            })
            invalidate('practice:')
          },
        })
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
        const rawOptions = question.options || (question.group?.matchingOptions?.length ? question.group.matchingOptions : null)

        let attemptCount = 0
        try {
          if (prisma.attempt && typeof prisma.attempt.count === 'function') {
            attemptCount = await prisma.attempt.count({ where: { examId: parsedExamId } })
          }
        } catch {
          attemptCount = 0
        }

        return await handleRegenerateCore({
          qCtx: question,
          family,
          ctx,
          inputAnswer,
          rawOptions,
          oldExp,
          cleanFeedback,
          cleanProposed,
          confirmChangeAnswer: Boolean(confirmChangeAnswer),
          attemptCount,
          questionNumber: question.number,
          updateCorrectAnswer: async (newAnswer) => {
            await prisma.question.update({
              where: { id: question.id },
              data: { correctAnswer: newAnswer },
            })
          },
          saveExplanation: async (exp) => {
            if (cancelFlag.cancelled) return // True Cancel: bỏ qua nếu HTTP đã timeout
            await prisma.question.update({
              where: { id: question.id },
              data: { explanation: exp },
            })
            invalidateExamCaches(parsedExamId)
          },
        })
      }
    })(),
    timeoutMs,
    `Hết thời gian xử lý AI (${Math.round(timeoutMs / 1000)}s) khi tạo lại giải thích cho câu hỏi.`,
    () => { cancelFlag.cancelled = true } // onCancel: set flag khi timeout fires
  )
}

/**
 * 4.4 Manual edit an explanation for a single question.
 */
async function updateManualExplanation({ examId, questionId = null, questionNumber = null, isPractice = false, fields = null, updateData = null }) {
  const parsedExamId = parseInt(examId, 10)
  const payloadFields = fields || updateData || {}

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

    if (!targetRow || !targetQItem || !targetGroup) {
      throw new Error(`Không tìm thấy câu hỏi #${targetNum} trong bài luyện tập #${parsedExamId}`)
    }

    const qCtx = practiceQuestionContext(exam, targetGroup, targetNum)
    if (!qCtx) throw new Error(`Không thể khởi tạo ngữ cảnh cho câu #${targetNum}`)
    const family = classifyFamily(qCtx.type)
    const ctx = buildContext(qCtx, family)

    const prevByNumber = (targetRow.explanation && typeof targetRow.explanation === 'object' && targetRow.explanation.byNumber) || {}
    const prev = (prevByNumber[targetNum] && typeof prevByNumber[targetNum] === 'object')
      ? prevByNumber[targetNum]
      : { v: 2, answer: String(targetQItem.correctAnswer || '') }

    const cleanFields = validateManualExplanation(payloadFields, {
      sourceText: ctx.sourceText,
      family,
      prevExp: prev,
      targetAnswer: String(targetQItem.correctAnswer || ''),
    })

    const updated = {
      ...prev,
      ...cleanFields,
      status: 'teacher_edited',
      manualEdit: true,
      updatedAt: new Date().toISOString(),
    }

    if (containsInternalJargon(updated)) {
      throw new Error('Nội dung chỉnh sửa chứa cụm từ nội bộ không phù hợp (người dùng nhập, đáp án người dùng, ngộ nhận...)')
    }

    let resultExp = null
    await updatePracticeQuestionExplanationTx(targetRow.id, (byNumber) => {
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

    const family = classifyFamily(question.type)
    const ctx = buildContext(question, family)

    const prev = (question.explanation && typeof question.explanation === 'object')
      ? question.explanation
      : { v: 2, answer: String(question.correctAnswer || '') }

    const cleanFields = validateManualExplanation(payloadFields, {
      sourceText: ctx.sourceText,
      family,
      prevExp: prev,
      targetAnswer: String(question.correctAnswer || ''),
    })

    const updated = {
      ...prev,
      ...cleanFields,
      status: 'teacher_edited',
      manualEdit: true,
      updatedAt: new Date().toISOString(),
    }

    if (containsInternalJargon(updated)) {
      throw new Error('Nội dung chỉnh sửa chứa cụm từ nội bộ không phù hợp (người dùng nhập, đáp án người dùng, ngộ nhận...)')
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
