'use strict'
const { randomUUID } = require('crypto')
const { Prisma } = require('@prisma/client')
const prisma = require('../lib/prisma')
const { saveExplanationBatch } = require('../lib/explanationSave')
const { lockExplanationTarget } = require('../lib/explanationWriteLock')
const { fingerprint, isWorkflow, versionOf, adminView, draftEnvelope, workflowError } = require('../lib/explanationWorkflow')
const generator = require('../scripts/generate-explanations')
const legacy = require('./explanationGeneratorService')
const { practiceQuestionContext } = require('../scripts/import-practice-explanations')
const { requestGeminiJson, getGroqClient, getGroqModel } = require('../lib/groqClient')
const { invalidate } = require('../lib/swrCache')
const { invalidateExamCaches } = require('../utils/cache')

const canonicalType = type => ({ true_false_not_given: 'true_false_ng', yes_no_not_given: 'yes_no_ng', multiple_choice: 'mcq' }[type] || type)
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
      q: { ...q, type: canonicalType(generator.classifyFamily(q.group?.type) === 'IMAGE' ? q.group.type : q.type) }, raw: q.explanation }))
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
      q.type = canonicalType(generator.classifyFamily(group.type) === 'IMAGE' ? group.type : q.type)
      // A context description is not an audio transcript.
      if (exam.skill === 'listening') q.group.section = { transcript: exam.transcript || '' }
      result.push({ kind, examId, id: row.id, number, q, row, group, item: question, raw: row.explanation?.byNumber?.[number] || question.explanation || group.explanations?.[number] || null })
    }
  }
  return result
}

function input(target) {
  const q = target.q
  const family = generator.classifyFamily(q.type)
  const ctx = generator.buildContext(q, family)
  const answer = String(q.correctAnswer || '').trim()
  const source = ctx.skill === 'listening' ? q.listeningSection?.transcript || q.group?.section?.transcript : q.passage?.body || q.group?.passage?.body
  const sourceHash = fingerprint({ type: q.type, text: q.questionText || '', answer, options: q.options || null,
    source: source || '', instruction: q.group?.instruction || '', image: ctx.images,
    noteSections: sourceOnly(q.group?.noteSections || []), matchingOptions: sourceOnly(q.group?.matchingOptions || []), canReuse: q.group?.canReuse, maxChoices: q.group?.maxChoices })
  return { q, family, ctx, answer, source, sourceHash }
}

function preflight(data) {
  if (!data.answer) return 'Câu chưa có đáp án trong đề.'
  if (!data.source?.trim()) return data.ctx.skill === 'listening' ? 'Cần bổ sung transcript trước khi tạo lời giải.' : 'Cần bổ sung nội dung bài đọc trước khi tạo lời giải.'
  if (data.family === 'IMAGE' && !data.ctx.images.length) return 'Cần bổ sung ảnh bản đồ hoặc sơ đồ.'
  if (['MCQ', 'MATCHING'].includes(data.family) && !generator.extractOptionPairs(data.q.options || data.q.group?.matchingOptions).length) return 'Cần bổ sung các lựa chọn của câu hỏi.'
  if (['MCQ', 'MATCHING'].includes(data.family)) {
    const pairs = generator.extractOptionPairs(data.q.options || data.q.group?.matchingOptions)
    if (['mcq_multi', 'list_selection'].includes(data.q.type)) {
      const tokens = legacy.extractMultiChoiceTokens(data.answer, pairs)
      const valid = new Set(pairs.map(pair => pair.letter.toUpperCase()))
      if ([...tokens].some(token => !valid.has(token))) return 'Đáp án chứa lựa chọn không có trong đề.'
      if (tokens.size !== (data.q.group?.maxChoices || 2)) return 'Số đáp án chưa đúng yêu cầu chọn nhiều lựa chọn.'
    } else if (!legacy.resolveToOption(data.answer, pairs)) return 'Đáp án không nằm trong các lựa chọn của đề.'
  }
  return null
}

function payloadIssue(data, payload) {
  if (payload.no_support) return payload.supportNote || payload.support_note || 'Chưa tìm thấy bằng chứng phù hợp với đáp án đề.'
  if (!legacy.isAnswerMatch(data.answer, payload.answer, data.q.options || data.q.group?.matchingOptions, data.q.type)) return 'Lời giải không khớp đáp án đã lưu trong đề.'
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

async function fixedDraft(data, signal, onDiagnostic) {
  const prompt = generator.buildPrompt(data.q, data.family, data.ctx, null, null, { isFixedMode: true, targetAnswer: data.answer })
  const images = data.ctx.images.length ? await generator.resolveContextImages(data.ctx.images) : []
  if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
  if (data.family === 'IMAGE' && !images.length) throw workflowError('MISSING_IMAGE', 'Không đọc được ảnh của câu hỏi.', 400)
  let raw, provider = 'Gemini', model = process.env.GEMINI_MODEL
  try {
    const response = await requestGeminiJson(prompt, { images, responseSchema: generator.buildResponseSchema(data.q.type, data.q.options || data.q.group?.matchingOptions, { isFixedMode: true }),
      retriesPerModel: 0, allowModelFallback: false, max_tokens: 4096, withMetadata: true, signal, onDiagnostic })
    raw = response.data; model = response.model
  } catch (error) {
    if (signal.aborted || images.length || ![429, 500, 502, 503, 504].includes(error.status)) throw error
    // Exactly one fallback, with SDK retries explicitly disabled.
    provider = 'Groq'; model = getGroqModel()
    onDiagnostic?.({ phase: 'provider', provider, model })
    const completion = await getGroqClient({ maxRetries: 0 }).chat.completions.create({ model, messages: [{ role: 'user', content: prompt }],
      temperature: 0, max_tokens: 4096, response_format: { type: 'json_object' } }, { signal })
    raw = JSON.parse(completion.choices[0]?.message?.content || '')
  }
  if (raw?.no_support) return { v: 2, answer: data.answer, no_support: true,
    supportNote: generator.cleanString(raw.support_note, 500), reasoning: generator.cleanString(raw.reasoning, 900), provider, model }
  try {
    const explanation = generator.enrichExplanation(raw, data.ctx, data.answer, data.family)
    return { ...explanation, provider, model }
  } catch (error) {
    if (!(error instanceof generator.ExplanationValidationError)) throw error
    return { v: 2, answer: data.answer, no_support: true, reasoning: '',
      supportNote: generator.cleanString(error.message, 500), provider, model }
  }
}

async function boundedGenerate(data, signal, timeoutMs, diagnostic) {
  const controller = new AbortController()
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  let timer
  try {
    return await Promise.race([fixedDraft(data, combined, event => Object.assign(diagnostic, event)), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(workflowError('AI_QUESTION_TIMEOUT', 'Hết thời gian tạo lời giải cho câu này.', 504)) }, timeoutMs)
    })])
  } finally { clearTimeout(timer) }
}

async function write(target, transform, { startTime = Date.now(), signal = null } = {}) {
  let stored
  await saveExplanationBatch(prisma, async tx => {
    await lockExplanationTarget(tx, target.kind, target.examId)
    const fresh = (await targets(tx, target.kind, target.examId, target.kind === 'exam' ? { questionId: target.id } : { questionNumber: target.number }))[0]
    if (target.kind === 'practice' && target.item?._explanationId && target.item._explanationId !== fresh?.item?._explanationId) throw workflowError('SOURCE_CHANGED', 'Câu hỏi đã được di chuyển hoặc đánh số lại. Tải lại để tiếp tục.')
    if (!fresh || fingerprint(fresh.raw) !== fingerprint(target.raw) || input(fresh).sourceHash !== input(target).sourceHash) throw workflowError('SOURCE_CHANGED', 'Câu hỏi hoặc lời giải đã thay đổi. Tải lại trước khi tiếp tục.')
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    stored = transform(fresh)
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
  }, { startTime, target: `${target.kind}:${target.examId}:${target.number}` })
  if (target.kind === 'exam') invalidateExamCaches(target.examId)
  else invalidate('practice:')
  return legacy.sanitizeExplanationForRead(stored, target.q.type)
}

async function generate(kind, examId, options = {}) {
  const startTime = Date.now()
  if (Object.keys(options.resolveChoices || {}).length) throw workflowError('ANSWER_CHANGE_DISABLED', 'Đổi đáp án trong phần sửa đề; AI chỉ tạo lời giải cho đáp án đã lưu.', 400)
  const items = await targets(prisma, kind, Number(examId), options)
  const operationId = typeof options.operationId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(options.operationId) ? options.operationId : null
  const candidates = items.filter(item => (operationId && item.raw?.lastGenerationOperation?.id === operationId && item.raw.lastGenerationOperation.sourceHash === input(item).sourceHash)
    || options.force || item.raw?.status === 'possibly_stale' || (!isWorkflow(item.raw) && !legacy.isExplanationVisibleToLearner(item.raw))
    || (isWorkflow(item.raw) && (item.raw.draft?.issue || (!item.raw.published && !item.raw.draft))))
  let generatedCount = 0
  const errors = [], needsRetryQuestions = [], completed = new Set()
  for (const target of candidates) {
    if (options.signal?.aborted) break
    const remaining = 48000 - (Date.now() - startTime) - 11000
    if (remaining < 5000) break
  const data = input(target), invalid = preflight(data)
    if (invalid) { errors.push({ number: target.number, code: 'MISSING_DATA', status: 400, message: invalid }); completed.add(target.number); continue }
    const diagnostic = { phase: 'generating' }
    if (operationId && target.raw?.lastGenerationOperation?.id === operationId && target.raw.lastGenerationOperation.sourceHash === data.sourceHash) {
      generatedCount++
      if (target.raw.draft?.issue) needsRetryQuestions.push({ number: target.number, reason: target.raw.draft.issue })
      completed.add(target.number)
      continue
    }
    try {
      const payload = await boundedGenerate(data, options.signal, Math.min(35000, remaining), diagnostic)
      if (options.signal?.aborted) break
      const issue = payloadIssue(data, payload)
      await write(target, fresh => ({ ...draftEnvelope(fresh.raw, payload, data.sourceHash, issue),
        lastGenerationOperation: operationId ? { id: operationId, sourceHash: data.sourceHash } : null }), { startTime, signal: options.signal })
      generatedCount++ // Count only committed drafts.
      if (issue) needsRetryQuestions.push({ number: target.number, reason: issue })
    } catch (error) {
      if (options.signal?.aborted || error.name === 'AbortError') break
      errors.push({ number: target.number, code: error.code || 'AI_GENERATION_FAILED', status: error.status || 503,
        ...diagnostic, phase: error.phase || diagnostic.phase, operationId,
        failedAt: new Date().toISOString(), causeCode: error.causeCode || (error.status ? `HTTP_${error.status}` : 'PROVIDER_ERROR'),
        message: error.code === 'AI_SAVE_FAILED' ? error.message : error.status === 409 ? error.message : 'Không tạo được bản nháp. Kiểm tra chi tiết và thử lại riêng câu này.' })
      console.error('[AI_DRAFT_FAILED]', { kind, examId, number: target.number, code: error.code, status: error.status, phase: diagnostic.phase })
    }
    completed.add(target.number)
  }
  return { ok: !errors.length, generatedCount, totalQuestions: candidates.length, hasConflicts: false, conflicts: [],
    remainingQuestionNumbers: candidates.filter(item => !completed.has(item.number)).map(item => item.number), errors, needsRetryQuestions,
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
  if (invalid) throw workflowError('MISSING_DATA', invalid, 400)
  expectedDraft(target, fields.expectedDraftVersion, fields.expectedSourceHash, fields.expectedPublishedVersion)
  const previous = isWorkflow(target.raw) ? target.raw.draft?.payload || target.raw.published || {} : target.raw || {}
  const clean = legacy.validateManualExplanation(fields, { sourceText: data.source, family: data.family, prevExp: previous, targetAnswer: data.answer })
  const payload = { ...previous, ...clean, answer: data.answer, no_support: false, supportNote: null, manualEdit: true }
  const issue = payloadIssue(data, payload)
  const explanation = await write(target, fresh => draftEnvelope(fresh.raw, payload, data.sourceHash, issue))
  return { ok: true, status: explanation.status, explanation, message: 'Đã lưu bản nháp.' }
}

async function publish(options) {
  const target = await one(options), data = input(target), fields = options.fields || {}
  const invalid = preflight(data)
  if (invalid) throw workflowError('MISSING_DATA', invalid, 400)
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
  return generate(target.kind, target.examId, { questionNumbers: [target.number], force: true, signal: options.signal })
}

module.exports = { generateForExam: (id, options) => generate('exam', id, options), generateForPracticeExam: (id, options) => generate('practice', id, options),
  updateManualExplanation: saveDraft, reviewQuestionExplanation: publish, regenerateQuestionExplanation: regenerate,
  targets, input, preflight, payloadIssue, write }
