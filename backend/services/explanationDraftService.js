'use strict'
const { randomUUID } = require('crypto')
const { Prisma } = require('@prisma/client')
const prisma = require('../lib/prisma')
const { saveExplanationBatch, DEFAULT_HTTP_BUDGET_MS } = require('../lib/explanationSave')
const { lockExplanationTarget } = require('../lib/explanationWriteLock')
const { normalizeAlternatives } = require('../lib/explanationAlternatives')
const { targetIssue } = require('../lib/explanationQuestionContext')
const { fingerprint, isWorkflow, versionOf, adminView, draftEnvelope, workflowError } = require('../lib/explanationWorkflow')
const generator = require('../scripts/generate-explanations')
const legacy = require('./explanationGeneratorService')
const { practiceQuestionContext } = require('../scripts/import-practice-explanations')
const { requestGeminiJson, getGroqClient, getGroqModel } = require('../lib/groqClient')
const { invalidate } = require('../lib/swrCache')
const { invalidateExamCaches } = require('../utils/cache')
const { createRunTelemetry } = require('../lib/explanationRunTelemetry')
const { recordRun } = require('../lib/explanationMetrics')

// One HTTP request may generate several questions. The wall-clock budget stays
// well under the 48s reverse-proxy limit and reserves time for the last save.
const BUDGET_RESERVE_MS = 11000
const MIN_QUESTION_MS = 5000
const QUESTION_TIMEOUT_MS = 35000
const MAX_QUESTION_CONCURRENCY = 4

function resolveBudget(value) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_HTTP_BUDGET_MS
  return Math.min(60000, Math.max(15000, Math.round(value)))
}

function reserveFor(budgetMs) {
  return Math.min(BUDGET_RESERVE_MS, Math.max(3000, Math.round(budgetMs * 0.25)))
}

function questionConcurrency() {
  const raw = Number(process.env.AI_EXPLANATION_QUESTION_CONCURRENCY)
  if (!Number.isFinite(raw) || raw < 1) return 2
  return Math.min(MAX_QUESTION_CONCURRENCY, Math.floor(raw))
}

const canonicalType = type => ({ true_false_not_given: 'true_false_ng', yes_no_not_given: 'yes_no_ng', multiple_choice: 'mcq' }[type] || type)
const effectiveType = (type, groupType) => {
  const family = generator.classifyFamily(groupType)
  return family !== 'GENERIC' && (family !== generator.classifyFamily(type) || ['mcq_multi', 'list_selection'].includes(groupType)) ? groupType : type
}
function sourceOnly(value) {
  if (Array.isArray(value)) return value.map(sourceOnly)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !['id', '_id', 'groupId', 'noteSectionId', 'createdAt', 'updatedAt', '_explanationId'].includes(key)).map(([key, item]) => [key, sourceOnly(item)]))
  return value
}
const examScope = examId => {
  const source = { examId, exam: { deletedAt: null, skill: { in: ['reading', 'listening'] } } }
  return { OR: [{ passage: source }, { listeningSection: source }, { group: { passage: source } }, { group: { section: source } }] }
}
const questionInclude = { passage: true, listeningSection: true, group: { include: { passage: true, section: true, matchingOptions: true, noteSections: { include: { lines: true } } } } }

async function targets(client, kind, examId, { questionId = null, questionNumber = null, questionNumbers = null, groupId = null } = {}) {
  const selected = questionNumbers ? new Set(questionNumbers.map(Number)) : questionNumber ? new Set([Number(questionNumber)]) : null
  if (kind === 'exam') {
    const rows = await client.question.findMany({ where: { AND: [examScope(examId), ...(questionId ? [{ id: Number(questionId) }] : []), ...(groupId ? [{ groupId: Number(groupId) }] : [])] }, include: questionInclude, orderBy: { number: 'asc' } })
    return rows.filter(q => !selected || selected.has(q.number)).map(q => ({ kind, examId, id: q.id, number: q.number,
      q: { ...q, type: canonicalType(effectiveType(q.type, q.group?.type)) }, raw: q.explanation }))
  }
  const exam = await client.practiceExam.findUnique({ where: { id: examId }, include: { questions: { orderBy: { orderNum: 'asc' } } } })
  if (!exam || exam.deletedAt) throw workflowError('NOT_FOUND', 'Không tìm thấy bài luyện tập.', 404)
  const result = []
  for (const row of exam.questions) {
    let group
    try { group = typeof row.content === 'string' ? JSON.parse(row.content) : row.content } catch { continue }
    for (const question of group.questions || []) {
      const number = Number(question.number)
      if (selected && !selected.has(number)) continue
      const q = practiceQuestionContext(exam, group, number)
      if (!q) continue
      q.type = canonicalType(effectiveType(q.type, group.type))
      // A context description is not an audio transcript.
      if (exam.skill === 'listening') q.group.section = { transcript: exam.transcript || '' }
      result.push({ kind, examId, id: row.id, number, q, row, group, item: question, raw: row.explanation?.byNumber?.[number] || question.explanation || group.explanations?.[number] || null })
    }
  }
  return result
}

// Narrow counterpart of targets() used inside the save transaction. It reads a
// single question row instead of re-scanning the whole exam while the advisory
// lock is held, which keeps the transaction well inside its timeout budget.
async function singleTarget(client, kind, examId, target) {
  if (kind === 'exam') {
    const q = await client.question.findFirst({ where: { AND: [examScope(examId), { id: Number(target.id) }] }, include: questionInclude })
    if (!q) return null
    return { kind, examId, id: q.id, number: q.number,
      q: { ...q, type: canonicalType(effectiveType(q.type, q.group?.type)) }, raw: q.explanation }
  }
  const row = await client.practiceQuestion.findUnique({ where: { id: Number(target.id) } })
  if (!row) return null
  const exam = await client.practiceExam.findUnique({ where: { id: examId },
    select: { id: true, skill: true, transcript: true, passage: true, deletedAt: true } })
  if (!exam || exam.deletedAt) return null
  let group
  try { group = typeof row.content === 'string' ? JSON.parse(row.content) : row.content } catch { return null }
  const question = (group.questions || []).find(item => Number(item.number) === Number(target.number))
  if (!question) return null
  const q = practiceQuestionContext(exam, group, target.number)
  if (!q) return null
  q.type = canonicalType(effectiveType(q.type, group.type))
  if (exam.skill === 'listening') q.group.section = { transcript: exam.transcript || '' }
  return { kind, examId, id: row.id, number: Number(target.number), q, row, group, item: question,
    raw: row.explanation?.byNumber?.[target.number] || question.explanation || group.explanations?.[target.number] || null }
}

function input(target) {
  const q = target.q
  const family = generator.classifyFamily(q.type)
  const ctx = generator.buildContext(q, family)
  const answer = String(q.correctAnswer || '').trim()
  const source = ctx.skill === 'listening' ? q.listeningSection?.transcript || q.group?.section?.transcript : q.passage?.body || q.group?.passage?.body
  const sourceHash = fingerprint({ type: q.type, text: q.questionText || '', answer, options: q.options || null,
    source: source || '', instruction: q.group?.instruction || '', image: ctx.images,
    ...(generator.extractOptionPairs(q.group?.options).length ? { groupOptions: q.group.options } : {}),
    noteSections: sourceOnly(q.group?.noteSections || []), matchingOptions: sourceOnly(q.group?.matchingOptions || []), canReuse: q.group?.canReuse, maxChoices: q.group?.maxChoices })
  return { q, family, ctx, answer, source, sourceHash }
}

const MAX_TEACHER_FEEDBACK = 1000

function cleanFeedback(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, MAX_TEACHER_FEEDBACK) : null
}

function preflight(data) {
  if (!data.answer) return 'Câu chưa có đáp án trong đề.'
  if (!data.source?.trim()) return data.ctx.skill === 'listening' ? 'Cần bổ sung transcript trước khi tạo lời giải.' : 'Cần bổ sung nội dung bài đọc trước khi tạo lời giải.'
  const contextProblem = targetIssue({}, data.q)
  if (contextProblem) return contextProblem.message
  if (data.family === 'IMAGE' && !data.ctx.images.length) return 'Cần bổ sung ảnh bản đồ hoặc sơ đồ.'
  if (['MCQ', 'MATCHING'].includes(data.family) && !generator.extractOptionPairs(generator.questionOptions(data.q)).length) return 'Cần bổ sung các lựa chọn của câu hỏi.'
  if (['MCQ', 'MATCHING'].includes(data.family)) {
    const pairs = generator.extractOptionPairs(generator.questionOptions(data.q))
    if (['mcq_multi', 'list_selection'].includes(data.q.type)) {
      const tokens = legacy.extractMultiChoiceTokens(data.answer, pairs)
      const valid = new Set(pairs.map(pair => pair.letter.toUpperCase()))
      if ([...tokens].some(token => !valid.has(token))) return 'Đáp án chứa lựa chọn không có trong đề.'
      if (tokens.size !== (data.q.group?.maxChoices || 2)) return 'Số đáp án chưa đúng yêu cầu chọn nhiều lựa chọn.'
    } else if (!legacy.resolveToOption(data.answer, pairs)) return 'Đáp án không nằm trong các lựa chọn của đề.'
  }
  return null
}

function corePayloadIssue(data, payload) {
  if (payload.no_support) return payload.supportNote || payload.support_note || 'Chưa tìm thấy bằng chứng phù hợp với đáp án đề.'
  if (!legacy.isAnswerMatch(data.answer, payload.answer, generator.questionOptions(data.q), data.q.type)) return 'Lời giải không khớp đáp án đã lưu trong đề.'
  if (!String(payload.reasoning || '').trim()) return 'Lời giải chưa có phần giải thích đáp án.'
  if (legacy.containsInternalJargon(payload)) return 'Lời giải chứa nội dung không phù hợp với học sinh.'
  const notGiven = data.family === 'TFNG' && /^(NOT GIVEN|NG|NOTGIVEN)$/i.test(data.answer)
  if (!notGiven && (data.family !== 'IMAGE' || data.ctx.skill === 'listening') && !payload.evidence?.parts?.length) return 'Lời giải chưa có trích dẫn làm bằng chứng.'
  for (const part of payload.evidence?.parts || []) if (!String(part.text || '').trim() || !generator.normalizeText(data.source).includes(generator.normalizeText(part.text))) return 'Trích dẫn không có trong nguồn đã lưu.'
  const match = String(data.q.group?.instruction || '').toUpperCase().match(/(?:NO MORE THAN )?(ONE|TWO|THREE|\d+) WORDS?(?: ONLY)?/)
  if (data.family === 'COMPLETION' && match) {
    const limit = ({ ONE: 1, TWO: 2, THREE: 3 })[match[1]] || Number(match[1])
    const answerWords = data.answer.split(/\s+/).filter(Boolean)
    const allowsNumber = /AND(?:\/OR)? (?:A |ONE )?NUMBER/i.test(data.q.group.instruction)
    const numeric = answerWords.filter(word => /^\d+(?:[.,]\d+)*$/.test(word))
    if (answerWords.length - (allowsNumber ? numeric.length : 0) > limit || (allowsNumber && numeric.length > 1)) return 'Đáp án vượt giới hạn số từ trong đề.'
  }
  return null
}

function contentIssue(data, payload) {
  if (!payload.no_support && !legacy.isAnswerMatch(data.answer, payload.answer, generator.questionOptions(data.q), data.q.type)) {
    return { code: 'ANSWER_MISMATCH', message: 'Lời giải không khớp đáp án đã lưu trong đề.', action: 'retry_generation' }
  }
  const contextProblem = targetIssue(payload, data.q)
  if (contextProblem) return contextProblem
  const message = corePayloadIssue(data, payload)
  if (message) {
    if (payload.no_support) return { code: 'MISSING_EVIDENCE', message, action: 'edit_source' }
    if (!legacy.isAnswerMatch(data.answer, payload.answer, generator.questionOptions(data.q), data.q.type)) return { code: 'ANSWER_MISMATCH', message, action: 'retry_generation' }
    if (/trích dẫn/i.test(message)) return { code: 'MISSING_EVIDENCE', message, action: 'edit_source' }
    return { code: 'EXPLANATION_INVALID', message, action: 'retry_generation' }
  }
  if (data.family === 'COMPLETION') {
    if (!String(payload.full_sentence || '').trim()) return { code: 'TRANSLATION_INVALID', message: 'Cần bổ sung câu hoàn chỉnh và bản dịch tiếng Việt.', action: 'edit_translation' }
    if (!generator.isVietnameseTranslation(payload.translation)) return { code: 'TRANSLATION_INVALID', message: 'Cần sửa bản dịch tiếng Việt.', action: 'edit_translation' }
  }
  return null
}

function payloadIssue(data, payload) { return contentIssue(data, payload)?.message || null }

function responseMetadata(value) {
  const tokenUsage = Object.fromEntries(['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount']
    .filter(key => Number.isFinite(value?.tokenUsage?.[key])).map(key => [key, value.tokenUsage[key]]))
  return { ...(typeof value?.finishReason === 'string' ? { finishReason: value.finishReason.slice(0, 40) } : {}),
    ...(Object.keys(tokenUsage).length ? { tokenUsage } : {}) }
}

function parsingError(code, causeCode) {
  return Object.assign(workflowError(code, code === 'AI_RESPONSE_TRUNCATED'
    ? 'AI trả lời vượt giới hạn độ dài. Thử tạo lại lời giải ngắn hơn.' : 'AI trả về dữ liệu chưa đúng định dạng. Thử tạo lại.', 502), { phase: 'parsing', causeCode })
}

async function fixedDraft(data, signal, onDiagnostic, deadline, teacherFeedback = null, meta = null) {
  const feedback = cleanFeedback(teacherFeedback)
  const images = data.ctx.images.length ? await generator.resolveContextImages(data.ctx.images) : []
  if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
  if (data.family === 'IMAGE' && !images.length) throw workflowError('MISSING_IMAGE', 'Không đọc được ảnh của câu hỏi.', 400)
  let raw, provider = 'Gemini', model = process.env.GEMINI_MODEL
  let attempts = 0
  const gemini = async extraCompact => {
    attempts++
    onDiagnostic?.({ attempts, phase: 'generating', ...(extraCompact ? { retryReason: 'AI_RESPONSE_TRUNCATED' } : {}) })
    const prompt = generator.buildPrompt(data.q, data.family, data.ctx, null, feedback, { isFixedMode: true, targetAnswer: data.answer, compact: true, extraCompact })
    const retryController = new AbortController()
    const retrySignal = extraCompact ? AbortSignal.any([signal, retryController.signal]) : signal
    const timer = extraCompact ? setTimeout(() => retryController.abort(), Math.max(1, Math.min(15000, deadline - Date.now()))) : null
    try {
      const response = await requestGeminiJson(prompt, { images, responseSchema: generator.buildResponseSchema(data.q.type, generator.questionOptions(data.q), { isFixedMode: true, targetAnswer: data.answer, compact: true, extraCompact }),
        strictJson: true, retriesPerModel: 0, allowModelFallback: false, max_tokens: extraCompact ? 2048 : 3072, withMetadata: true, signal: retrySignal, onDiagnostic, meta })
      onDiagnostic?.(responseMetadata(response))
      return response
    } catch (error) {
      if (retryController.signal.aborted && !signal.aborted) throw workflowError('AI_QUESTION_TIMEOUT', 'Hết thời gian tạo lời giải ngắn cho câu này.', 504)
      throw error
    } finally { if (timer) clearTimeout(timer) }
  }
  try {
    let response
    try { response = await gemini(false) } catch (error) {
      if (error.code !== 'AI_RESPONSE_TRUNCATED' || signal.aborted || deadline - Date.now() < 8000) throw error
      response = await gemini(true)
    }
    raw = response.data; model = response.model
  } catch (error) {
    if (signal.aborted || attempts >= 2 || ['AI_RESPONSE_TRUNCATED', 'AI_RESPONSE_INVALID'].includes(error.code) || images.length || ![429, 500, 502, 503, 504].includes(error.status)) throw error
    // Exactly one fallback, with SDK retries explicitly disabled.
    provider = 'Groq'; model = getGroqModel()
    attempts++
    onDiagnostic?.({ phase: 'provider', provider, model, attempts })
    const prompt = generator.buildPrompt(data.q, data.family, data.ctx, null, feedback, { isFixedMode: true, targetAnswer: data.answer, compact: true })
    const completion = await getGroqClient({ maxRetries: 0 }).chat.completions.create({ model, messages: [{ role: 'user', content: prompt }],
      temperature: 0, max_tokens: 3072, response_format: { type: 'json_object' } }, { signal })
    if (completion.choices[0]?.finish_reason === 'length') throw Object.assign(parsingError('AI_RESPONSE_TRUNCATED', 'MAX_TOKENS'), { finishReason: 'length' })
    try { raw = JSON.parse(completion.choices[0]?.message?.content || '') } catch { throw parsingError('AI_RESPONSE_INVALID', 'INVALID_JSON') }
  }
  if (raw?.no_support) return { v: 2, answer: data.answer, no_support: true,
    supportNote: generator.cleanString(raw.support_note, 500), reasoning: generator.cleanString(raw.reasoning, 900), provider, model,
    ...(feedback ? { teacherFeedback: feedback } : {}) }
  try {
    const explanation = generator.enrichExplanation(raw, data.ctx, data.answer, data.family, { allowPartialTranslation: true })
    return { ...explanation, provider, model, ...(feedback ? { teacherFeedback: feedback } : {}) }
  } catch (error) {
    if (!(error instanceof generator.ExplanationValidationError)) throw error
    throw Object.assign(workflowError('EXPLANATION_INVALID', 'AI trả về lời giải chưa hợp lệ. Thử tạo lại câu này.', 502), { phase: 'validation', causeCode: error.code || 'EXPLANATION_VALIDATION_FAILED' })
  }
}

async function write(target, transform, { startTime = Date.now(), signal = null, budgetMs = DEFAULT_HTTP_BUDGET_MS, telemetry = null } = {}) {
  let stored
  const saveStartedAt = Date.now()
  await saveExplanationBatch(prisma, async tx => {
    await lockExplanationTarget(tx, target.kind, target.examId)
    const fresh = await singleTarget(tx, target.kind, target.examId, target)
    if (target.kind === 'practice' && target.item?._explanationId && target.item._explanationId !== fresh?.item?._explanationId) throw workflowError('SOURCE_CHANGED', 'Câu hỏi đã được di chuyển hoặc đánh số lại. Tải lại để tiếp tục.')
    if (!fresh || fingerprint(fresh.raw) !== fingerprint(target.raw) || input(fresh).sourceHash !== input(target).sourceHash) throw workflowError('SOURCE_CHANGED', 'Câu hỏi hoặc lời giải đã thay đổi. Tải lại trước khi tiếp tục.')
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    stored = transform(fresh)
    const current = input(fresh)
    const normalizePayload = payload => ({ ...payload, distractors: normalizeAlternatives(payload.distractors, {
      family: current.family, pairs: current.ctx.optionPairs || [], answer: current.answer, type: current.q.type,
    }) })
    if (stored.draft?.payload) stored.draft = { ...stored.draft, payload: normalizePayload(stored.draft.payload) }
    else if (stored.published) stored.published = normalizePayload(stored.published)
    let changed
    if (target.kind === 'exam') changed = await tx.question.updateMany({ where: { id: fresh.id, explanation: { equals: fresh.raw == null ? Prisma.DbNull : fresh.raw } }, data: { explanation: stored } })
    else {
      const group = structuredClone(fresh.group)
      const item = group.questions.find(q => Number(q.number) === fresh.number)
      item._explanationId ||= randomUUID()
      const byNumber = { ...fresh.row.explanation?.byNumber, [fresh.number]: stored }
      changed = await tx.practiceQuestion.updateMany({ where: { id: fresh.id, content: fresh.row.content,
        explanation: { equals: fresh.row.explanation == null ? Prisma.DbNull : fresh.row.explanation } }, data: { content: JSON.stringify(group), explanation: { byNumber } } })
    }
    if (changed.count !== 1) throw workflowError('DRAFT_CHANGED', 'Lời giải đã thay đổi trong lúc lưu. Tải lại để kiểm tra.')
  }, { startTime, target: `${target.kind}:${target.examId}:${target.number}`, budgetMs })
  telemetry?.recordSave(Date.now() - saveStartedAt)
  if (target.kind === 'exam') invalidateExamCaches(target.examId)
  else invalidate('practice:')
  return legacy.sanitizeExplanationForRead(stored, target.q.type, generator.questionOptions(target.q) || target.q.group?.options)
}

// Two tabs may request the same question at the same moment. Share the provider
// promise instead of paying for (and writing) the same draft twice.
const inFlight = new Map()

async function generatePayload(target, data, { signal, remaining, teacherFeedback, meta }) {
  const key = `${target.kind}:${target.examId}:${target.number}`
  const existing = inFlight.get(key)
  if (existing) return { payload: await existing, shared: true }
  const promise = boundedGenerateWithFeedback(data, signal, remaining, teacherFeedback, meta)
  inFlight.set(key, promise)
  try { return { payload: await promise, shared: false } }
  finally { inFlight.delete(key) }
}

async function boundedGenerateWithFeedback(data, signal, remaining, teacherFeedback, meta) {
  const controller = new AbortController()
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  let timer
  try {
    return await Promise.race([fixedDraft(data, combined, () => {}, Date.now() + remaining, teacherFeedback, meta), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(workflowError('AI_QUESTION_TIMEOUT', 'Hết thời gian tạo lời giải cho câu này.', 504)) }, remaining)
    })])
  } finally { clearTimeout(timer) }
}

async function generate(kind, examId, options = {}) {
  const startTime = Date.now()
  if (Object.keys(options.resolveChoices || {}).length) throw workflowError('ANSWER_CHANGE_DISABLED', 'Đổi đáp án trong phần sửa đề; AI chỉ tạo lời giải cho đáp án đã lưu.', 400)
  const items = await targets(prisma, kind, Number(examId), options)
  const operationId = typeof options.operationId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(options.operationId) ? options.operationId : null
  const candidates = items.filter(item => (operationId && item.raw?.lastGenerationOperation?.id === operationId && item.raw.lastGenerationOperation.sourceHash === input(item).sourceHash)
    || options.force || item.raw?.status === 'possibly_stale' || (!isWorkflow(item.raw) && !legacy.isExplanationVisibleToLearner(item.raw))
    || (isWorkflow(item.raw) && (!item.raw.published && !item.raw.draft)))
  const budgetMs = resolveBudget(options.timeBudgetMs)
  const reserveMs = reserveFor(budgetMs)
  const concurrency = Math.max(1, Math.min(questionConcurrency(), candidates.length || 1))
  const teacherFeedback = cleanFeedback(options.teacherFeedback)
  const runId = randomUUID()
  const telemetry = options.telemetry === false ? null : createRunTelemetry(runId)
  let generatedCount = 0
  const saved = []
  const errors = [], needsRetryQuestions = [], completed = new Set()

  const runOne = async target => {
    const data = input(target), contextProblem = targetIssue({}, data.q), invalid = preflight(data)
    if (invalid) { errors.push({ number: target.number, code: contextProblem?.code || 'MISSING_DATA', status: 400, message: invalid, action: 'edit_source' }); completed.add(target.number); return }
    if (operationId && target.raw?.lastGenerationOperation?.id === operationId && target.raw.lastGenerationOperation.sourceHash === data.sourceHash) {
      generatedCount++
      if (target.raw.draft?.issue) {
        const replayIssue = contentIssue(data, target.raw.draft.payload)
        needsRetryQuestions.push({ number: target.number, reason: target.raw.draft.issue, ...(replayIssue ? { code: replayIssue.code, action: replayIssue.action } : {}) })
      }
      completed.add(target.number)
      return
    }
    const diagnostic = { phase: 'generating' }
    let shared = false
    try {
      const remainingForQuestion = Math.min(QUESTION_TIMEOUT_MS, budgetMs - (Date.now() - startTime) - reserveMs)
      const { payload, shared: followed } = await generatePayload(target, data, { signal: options.signal, remaining: remainingForQuestion,
        teacherFeedback, meta: { runId, number: target.number } })
      shared = followed
      if (options.signal?.aborted) return
      // A followed request re-reads the row the shared call may have already written.
      let writeTarget = target
      if (shared) {
        const refreshed = await singleTarget(prisma, target.kind, target.examId, target)
        if (!refreshed || input(refreshed).sourceHash !== data.sourceHash) throw workflowError('SOURCE_CHANGED', 'Câu hỏi hoặc lời giải đã thay đổi. Tải lại trước khi tiếp tục.')
        writeTarget = refreshed
      }
      const issue = contentIssue(data, payload)
      if (issue) payload.contentIssue = issue
      else delete payload.contentIssue
      const explanation = await write(writeTarget, fresh => ({ ...draftEnvelope(fresh.raw, payload, data.sourceHash, issue?.message || null),
        lastGenerationOperation: operationId ? { id: operationId, sourceHash: data.sourceHash } : null }), { startTime, signal: options.signal, budgetMs, telemetry })
      // Count only committed drafts.
      generatedCount++
      saved.push({ number: target.number, questionId: target.kind === 'exam' ? target.id : null, explanation })
      if (issue) needsRetryQuestions.push({ number: target.number, reason: issue.message, code: issue.code, action: issue.action })
      completed.add(target.number)
    } catch (error) {
      // An aborted run is not a failure: the question stays "remaining" so the
      // client can retry it after reconnecting.
      if (options.signal?.aborted || error.name === 'AbortError') return
      // A shared provider call may lose the write race against its own twin.
      // When the stored draft already belongs to this exact source, the result
      // is committed; return the stored explanation instead of an error.
      if (shared && ['SOURCE_CHANGED', 'DRAFT_CHANGED'].includes(error.code)) {
        const current = await singleTarget(prisma, target.kind, target.examId, target).catch(() => null)
        const stored = current && isWorkflow(current.raw) ? current.raw.draft : null
        if (stored && stored.sourceHash === data.sourceHash) {
          generatedCount++
          saved.push({ number: target.number, questionId: target.kind === 'exam' ? target.id : null,
            explanation: legacy.sanitizeExplanationForRead(current.raw, data.q.type, generator.questionOptions(data.q) || data.q.group?.options) })
          if (stored.issue) needsRetryQuestions.push({ number: target.number, reason: stored.issue })
          completed.add(target.number)
          return
        }
      }
      errors.push({ number: target.number, code: error.code || 'AI_GENERATION_FAILED', status: error.status || 503,
        ...diagnostic, ...responseMetadata(error), phase: error.phase || diagnostic.phase, operationId,
        failedAt: new Date().toISOString(), causeCode: error.causeCode || (error.status ? `HTTP_${error.status}` : 'PROVIDER_ERROR'),
        action: 'retry_generation',
        message: error.code === 'AI_SAVE_FAILED' || error.status === 409 ? error.message
          : ['AI_RESPONSE_TRUNCATED', 'AI_RESPONSE_INVALID'].includes(error.code) ? parsingError(error.code, error.causeCode).message
          : error.code === 'EXPLANATION_INVALID' ? 'AI trả về lời giải chưa hợp lệ. Thử tạo lại câu này.'
          : 'Không tạo được bản nháp. Kiểm tra chi tiết và thử lại riêng câu này.' })
      console.error('[AI_DRAFT_FAILED]', { kind, examId, number: target.number, code: error.code, status: error.status, phase: diagnostic.phase })
      completed.add(target.number)
    }
  }

  try {
    let cursor = 0
    const worker = async () => {
      while (cursor < candidates.length) {
        if (options.signal?.aborted) return
        if (budgetMs - (Date.now() - startTime) - reserveMs < MIN_QUESTION_MS) return
        const target = candidates[cursor++]
        await runOne(target)
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
  } finally {
    let summary = null
    if (telemetry) {
      summary = telemetry.summary({ runId, kind, examId: Number(examId), operationId, concurrency,
        requested: candidates.length, committed: generatedCount, failed: errors.length, needsReview: needsRetryQuestions.length,
        durationMs: Date.now() - startTime })
      telemetry.dispose()
      recordRun({ ...summary, ok: errors.length === 0 })
      console.info('[AI_EXPLANATION_RUN]', JSON.stringify(summary))
    }
  }

  const byNumber = (a, b) => Number(a.number) - Number(b.number)
  errors.sort(byNumber)
  needsRetryQuestions.sort(byNumber)
  saved.sort(byNumber)
  return { ok: !errors.length, generatedCount, totalQuestions: candidates.length, hasConflicts: false, conflicts: [],
    remainingQuestionNumbers: candidates.filter(item => !completed.has(item.number)).map(item => item.number),
    errors, needsRetryQuestions, saved, runId,
    message: generatedCount ? 'Đã lưu bản nháp. Giáo viên cần xác nhận sử dụng.' : 'Chưa có bản nháp mới được lưu.' }
}

async function one(options) {
  const kind = options.isPractice ? 'practice' : 'exam'
  const target = (await targets(prisma, kind, Number(options.examId), options))[0]
  if (!target) throw workflowError('NOT_FOUND', 'Không tìm thấy câu hỏi trong bài này.', 404)
  return target
}

function expectedDraft(target, expected, sourceHash, expectedPublishedVersion) {
  if (isWorkflow(target.raw) && target.raw.draft && expected !== target.raw.draft.version) throw workflowError('DRAFT_CHANGED', 'Bản nháp đã thay đổi. Tải lại trước khi lưu.')
  if (sourceHash && sourceHash !== input(target).sourceHash) throw workflowError('SOURCE_CHANGED', 'Nội dung đề đã thay đổi. Tải lại trước khi tiếp tục.')
  if (isWorkflow(target.raw) && !target.raw.draft && expectedPublishedVersion !== target.raw.publishedVersion) throw workflowError('DRAFT_CHANGED', 'Bản đang sử dụng đã thay đổi. Tải lại trước khi sửa.')
}

async function saveDraft(options) {
  const target = await one(options), data = input(target), fields = options.fields || options.updateData || {}
  const invalid = preflight(data)
  if (invalid) throw Object.assign(workflowError(targetIssue({}, data.q)?.code || 'MISSING_DATA', invalid, 400), { action: 'edit_source' })
  expectedDraft(target, fields.expectedDraftVersion, fields.expectedSourceHash, fields.expectedPublishedVersion)
  const previous = isWorkflow(target.raw) ? target.raw.draft?.payload || target.raw.published || {} : target.raw || {}
  const clean = legacy.validateManualExplanation(fields, { sourceText: data.source, family: data.family, prevExp: previous, targetAnswer: data.answer,
    options: generator.questionOptions(data.q) || data.q.group?.options, questionType: data.q.type })
  const payload = { ...previous, ...clean, answer: data.answer, no_support: false, supportNote: null, manualEdit: true }
  const issue = contentIssue(data, payload)
  if (issue) payload.contentIssue = issue
  else delete payload.contentIssue
  const explanation = await write(target, fresh => draftEnvelope(fresh.raw, payload, data.sourceHash, issue?.message || null))
  return { ok: true, status: explanation.status, explanation, message: 'Đã lưu bản nháp.' }
}

async function publish(options) {
  const target = await one(options), data = input(target), fields = options.fields || {}
  const invalid = preflight(data)
  if (invalid) throw Object.assign(workflowError(targetIssue({}, data.q)?.code || 'MISSING_DATA', invalid, 400), { action: 'edit_source' })
  expectedDraft(target, fields.draftVersion, fields.sourceHash, fields.publishedVersion)
  const draft = isWorkflow(target.raw) ? target.raw.draft : { payload: target.raw, sourceHash: data.sourceHash }
  if (!draft?.payload) throw workflowError('NO_DRAFT', 'Chưa có bản nháp để sử dụng.', 400)
  if (draft.sourceHash !== data.sourceHash || target.raw?.status === 'possibly_stale') throw workflowError('SOURCE_CHANGED', 'Nội dung đề đã thay đổi. Kiểm tra và lưu lại bản nháp trước khi sử dụng.')
  const issue = payloadIssue(data, draft.payload)
  if (draft.issue || issue) throw workflowError('DRAFT_INVALID', draft.issue || issue, 400)
  const explanation = await write(target, () => ({ workflowVersion: 3,
    published: { ...draft.payload, status: 'teacher_reviewed', reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    publishedVersion: randomUUID(), publishedSourceHash: data.sourceHash, draft: null,
    reviewedBy: options.actorId || null, lastGenerationOperation: target.raw?.lastGenerationOperation || null }))
  return { ok: true, status: 'published', explanation, message: 'Đã cập nhật lời giải cho học sinh.' }
}

async function regenerate(options) {
  const target = await one(options)
  if (options.proposedAnswer || options.confirmChangeAnswer) throw workflowError('ANSWER_CHANGE_DISABLED', 'Đổi đáp án trong phần sửa đề trước khi tạo lời giải.', 400)
  return generate(target.kind, target.examId, { questionNumbers: [target.number], force: true, signal: options.signal,
    teacherFeedback: options.teacherFeedback, operationId: options.operationId, timeBudgetMs: options.timeBudgetMs })
}

module.exports = { generateForExam: (id, options) => generate('exam', id, options), generateForPracticeExam: (id, options) => generate('practice', id, options),
  updateManualExplanation: saveDraft, reviewQuestionExplanation: publish, regenerateQuestionExplanation: regenerate,
  targets, singleTarget, input, preflight, payloadIssue, write, resolveBudget, questionConcurrency }
