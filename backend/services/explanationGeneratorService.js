const prisma = require('../lib/prisma')
const {
  classifyFamily,
  buildContext,
  generateExplanation,
  normalizeText,
  SKIP_FAMILIES,
} = require('../scripts/generate-explanations')
const { practiceQuestionContext } = require('../scripts/import-practice-explanations')
const { invalidate } = require('../lib/swrCache')

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
        return { letter: romanMatch[1].toLowerCase(), text: romanMatch[2].trim() }
      }
      // Check letter prefix: "A. Option text"
      const letterMatch = trimmed.match(/^([A-Za-z])[\.\:\)]\s*(.*)$/)
      if (letterMatch) {
        return { letter: letterMatch[1].toUpperCase(), text: letterMatch[2].trim() }
      }
      return { letter: defaultLetter, text: trimmed }
    }
    if (item && typeof item === 'object') {
      const rawLetter = String(item.optionLetter || item.letter || defaultLetter).trim()
      const isRoman = ROMAN_NUMERALS.has(rawLetter.toLowerCase())
      const letter = isRoman ? rawLetter.toLowerCase() : rawLetter.toUpperCase()
      const text = (item.optionText || item.text || '').trim()
      return { letter, text }
    }
    return null
  }).filter(Boolean)
}

function resolveToOption(str, optionPairs) {
  if (!str || !optionPairs.length) return null
  const trimmed = str.trim()
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
    if (pair.text && normalizeText(pair.text) === norm) {
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
  const strA = String(a).trim()
  const strB = String(b).trim()
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
 * Generate explanations for a PracticeExam (Reading or Listening).
 *
 * @param {number} examId - PracticeExam ID
 * @param {object} options
 * @param {boolean} options.force - If true, regenerate even if explanation exists
 * @param {object} options.resolveChoices - Map of { [questionNumber]: 'ai' | 'input' }
 */
async function generateForPracticeExam(examId, { force = false, resolveChoices = {} } = {}) {
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

  const conflicts = []
  const updatesByRow = new Map() // rowId -> { byNumber: {}, groupContent: modifiedGroup }
  let generatedCount = 0

  for (const row of exam.questions) {
    const group = parseGroup(row)
    if (!group || !Array.isArray(group.questions)) continue

    const currentExplanations = { ...(row.explanation?.byNumber || {}) }
    let groupModified = false

    for (const qItem of group.questions) {
      const qNum = Number(qItem.number)
      if (!qNum) continue

      // Skip if already has explanation and not force/resolving
      if (currentExplanations[qNum] && !force && !resolveChoices[qNum]) {
        continue
      }

      const qCtx = practiceQuestionContext(exam, group, qNum)
      if (!qCtx) continue

      const family = classifyFamily(qCtx.type)
      if (SKIP_FAMILIES.has(family)) continue

      const ctx = buildContext(qCtx, family)
      const explanation = await generateExplanation(qCtx, family, ctx)
      if (!explanation) continue

      generatedCount++

      const inputAnswer = String(qCtx.correctAnswer || '').trim()
      const aiAnswer = String(explanation.answer || '').trim()
      const rawOptions = qCtx.options || (group.matchingOptions?.length ? group.matchingOptions : null)
      const match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, qCtx.type)

      const choice = resolveChoices[qNum]

      if (!match && !choice) {
        // Record conflict
        conflicts.push({
          number: qNum,
          type: qCtx.type,
          questionText: qCtx.questionText,
          inputAnswer,
          aiAnswer,
          evidence: explanation.evidence?.parts?.[0]?.text || '',
          reasoning: explanation.reasoning,
          explanation,
        })
      } else {
        // Resolve or match
        if (choice === 'ai') {
          // Adopt AI answer into question
          qItem.correctAnswer = aiAnswer
          groupModified = true
          explanation.answer = aiAnswer
        } else if (choice === 'input') {
          explanation.answer = inputAnswer
        }

        currentExplanations[qNum] = explanation
      }
    }

    updatesByRow.set(row.id, {
      byNumber: currentExplanations,
      groupContent: groupModified ? JSON.stringify(group) : null,
    })
  }

  // If there are unresolved conflicts and no explicit resolveChoices, pause and return conflicts for confirmation
  if (conflicts.length > 0 && Object.keys(resolveChoices).length === 0) {
    return {
      ok: false,
      hasConflicts: true,
      conflicts,
      generatedCount,
      message: `Đã quét và phát hiện ${conflicts.length} câu có đáp án lệch so với bài đọc. Vui lòng duyệt trước khi lưu.`,
    }
  }

  // Save updates to database
  await prisma.$transaction(async (tx) => {
    for (const [rowId, { byNumber, groupContent }] of updatesByRow) {
      const data = { explanation: { byNumber } }
      if (groupContent) data.content = groupContent
      await tx.practiceQuestion.update({
        where: { id: rowId },
        data,
      })
    }
  })

  invalidate('practice:')

  return {
    ok: true,
    hasConflicts: false,
    generatedCount,
    message: `Đã tạo giải thích 4 bước thành công cho ${generatedCount} câu hỏi!`,
  }
}

/**
 * Generate explanations for an Exam (Reading or Listening Cambridge / Full Test Exam).
 *
 * @param {number} examId - Exam ID
 * @param {object} options
 * @param {boolean} options.force - If true, regenerate even if explanation exists
 * @param {object} options.resolveChoices - Map of { [questionNumber]: 'ai' | 'input' }
 */
async function generateForExam(examId, { force = false, resolveChoices = {} } = {}) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, skill: true },
  })

  if (!exam) throw new Error(`Không tìm thấy đề thi #${examId}`)

  const questions = await prisma.question.findMany({
    where: {
      OR: [
        { passage: { examId } },
        { listeningSection: { examId } },
        { group: { passage: { examId } } },
        { group: { section: { examId } } },
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

  const conflicts = []
  const updates = []
  let generatedCount = 0

  if (!questions.length) throw new Error(`Đề thi #${examId} chưa có câu hỏi nào`)

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
    if (q.explanation && !force && !resolveChoices[q.number]) {
      continue
    }
    const passage = q.passage || q.group?.passage
    const section = q.listeningSection || q.group?.section
    const content = passage?.body || section?.transcript || section?.context
    if (!content || !content.trim()) {
      const label = exam.skill === 'listening' ? 'transcript' : 'nội dung bài đọc (Passage)'
      throw new Error(`Đề thi chưa có ${label} cho câu ${q.number}. Vui lòng nhập đầy đủ nội dung trước khi tạo giải thích AI.`)
    }
  }

  for (const q of questions) {
    if (q.explanation && !force && !resolveChoices[q.number]) {
      continue
    }

    const family = classifyFamily(q.type)
    if (SKIP_FAMILIES.has(family)) continue

    const ctx = buildContext(q, family)
    const explanation = await generateExplanation(q, family, ctx)
    if (!explanation) continue

    generatedCount++

    const inputAnswer = String(q.correctAnswer || '').trim()
    const aiAnswer = String(explanation.answer || '').trim()
    const rawOptions = q.options || (q.group?.matchingOptions?.length ? q.group.matchingOptions : null)
    const match = isAnswerMatch(inputAnswer, aiAnswer, rawOptions, q.type)
    const choice = resolveChoices[q.number]

    if (!match && !choice) {
      conflicts.push({
        number: q.number,
        type: q.type,
        questionText: q.questionText,
        inputAnswer,
        aiAnswer,
        evidence: explanation.evidence?.parts?.[0]?.text || '',
        reasoning: explanation.reasoning,
        explanation,
      })
    } else {
      let finalCorrectAnswer = inputAnswer
      if (choice === 'ai') {
        finalCorrectAnswer = aiAnswer
        explanation.answer = aiAnswer
      } else if (choice === 'input') {
        explanation.answer = inputAnswer
      }

      updates.push({
        id: q.id,
        correctAnswer: finalCorrectAnswer,
        explanation,
      })
    }
  }

  if (conflicts.length > 0 && Object.keys(resolveChoices).length === 0) {
    return {
      ok: false,
      hasConflicts: true,
      conflicts,
      generatedCount,
      message: `Đã quét và phát hiện ${conflicts.length} câu có đáp án lệch so với bài đọc/nghe. Vui lòng duyệt trước khi lưu.`,
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of updates) {
      await tx.question.update({
        where: { id: item.id },
        data: {
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        },
      })
    }
  })

  invalidate('exams:')
  invalidate('reading:')
  invalidate('listening:')

  return {
    ok: true,
    hasConflicts: false,
    generatedCount,
    message: `Đã tạo giải thích 4 bước thành công cho ${generatedCount} câu hỏi!`,
  }
}

module.exports = {
  isAnswerMatch,
  extractOptionPairs,
  resolveToOption,
  extractMultiChoiceTokens,
  normalizeCompletionTerm,
  expandCompletionVariants,
  ROMAN_NUMERALS,
  generateForPracticeExam,
  generateForExam,
}
