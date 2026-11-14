'use strict'

// Explicit isolated-DB integration smoke. Never accepts project .env URLs.
const assert = require('node:assert/strict')
const url = new URL(process.env.DATABASE_URL || '')
assert.equal(url.hostname, 'ai-workflow-pg-smoke')
assert.equal(url.port, '5433')
assert.equal(url.pathname, '/workflow_smoke')
const source = 'The library opens at nine.'
let providerCalls = 0
const providerPath = require.resolve('../lib/groqClient')
require.cache[providerPath] = { id: providerPath, filename: providerPath, loaded: true, exports: {
  requestGeminiJson: async () => {
    providerCalls++
    return { model: 'isolated-fake', provider: 'fake', data: {
      question_chunks: [{ text: 'opening time', label: 'time' }], predict: 'Find the opening time.',
      answer: 'A', reasoning: 'The source states that the library opens at nine.', evidence_quote: source,
    } }
  },
  getGroqClient: () => { throw new Error('Unexpected fallback') }, getGroqModel: () => 'unused',
} }
const prisma = require('../lib/prisma')
const service = require('../services/explanationDraftService')
const { filterLearnerExplanation } = require('../services/explanationGeneratorService')
const { lockExplanationTarget } = require('../lib/explanationWriteLock')
const { draftEnvelope } = require('../lib/explanationWorkflow')
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

async function fixture(kind, skill) {
  const options = JSON.stringify(['nine', 'ten'])
  if (kind === 'exam') {
    const exam = await prisma.exam.create({ data: { title: 'Isolated smoke', skill } })
    const parent = skill === 'reading'
      ? await prisma.passage.create({ data: { examId: exam.id, number: 1, title: 'Smoke', body: source } })
      : await prisma.listeningSection.create({ data: { examId: exam.id, number: 1, context: 'Smoke', transcript: source } })
    const q = await prisma.question.create({ data: { [skill === 'reading' ? 'passageId' : 'listeningSectionId']: parent.id,
      number: 1, type: 'mcq', questionText: 'What is the opening time?', correctAnswer: 'A', options } })
    return { id: exam.id, args: { examId: exam.id, questionId: q.id },
      raw: async () => (await prisma.question.findUnique({ where: { id: q.id } })).explanation,
      answer: async () => (await prisma.question.findUnique({ where: { id: q.id } })).correctAnswer,
      changeSource: tx => tx[skill === 'reading' ? 'passage' : 'listeningSection'].update({ where: { id: parent.id }, data: { [skill === 'reading' ? 'body' : 'transcript']: source + ' New source.' } }),
      cas: () => prisma.question.updateMany({ where: { id: q.id, explanation: { equals: { impossible: true } } }, data: { explanation: { bad: true } } }),
    }
  }
  const exam = await prisma.practiceExam.create({ data: { title: 'Isolated smoke', skill, [skill === 'reading' ? 'passage' : 'transcript']: source } })
  const row = await prisma.practiceQuestion.create({ data: { examId: exam.id, content: JSON.stringify({ type: 'mcq', questions: [
    { number: 1, questionText: 'What is the opening time?', correctAnswer: 'A', options: ['nine', 'ten'], _explanationId: `smoke-${skill}` },
  ] }) } })
  return { id: exam.id, args: { examId: exam.id, isPractice: true, questionNumber: 1 },
    raw: async () => (await prisma.practiceQuestion.findUnique({ where: { id: row.id } })).explanation?.byNumber?.[1],
    answer: async () => JSON.parse((await prisma.practiceQuestion.findUnique({ where: { id: row.id } })).content).questions[0].correctAnswer,
    changeSource: tx => tx.practiceExam.update({ where: { id: exam.id }, data: { [skill === 'reading' ? 'passage' : 'transcript']: source + ' New source.' } }),
    cas: () => prisma.practiceQuestion.updateMany({ where: { id: row.id, explanation: { equals: { impossible: true } } }, data: { explanation: { bad: true } } }),
  }
}

async function run(kind, skill) {
  const f = await fixture(kind, skill)
  const generate = kind === 'exam' ? service.generateForExam : service.generateForPracticeExam
  const result = await generate(f.id, { force: true, questionNumbers: [1], operationId: `smoke-${kind}-${skill}` })
  assert.equal(result.generatedCount, 1, JSON.stringify(result))
  let envelope = await f.raw()
  assert.equal(envelope.workflowVersion, 3)
  assert.equal(filterLearnerExplanation(envelope), null)
  const beforeCalls = providerCalls
  const firstVersion = envelope.draft.version
  await service.updateManualExplanation({ ...f.args, fields: { reasoning: 'Teacher verified opening time.',
    expectedDraftVersion: firstVersion, expectedSourceHash: envelope.draft.sourceHash } })
  envelope = await f.raw()
  assert.notEqual(envelope.draft.version, firstVersion)
  assert.equal(filterLearnerExplanation(envelope), null)
  await assert.rejects(service.reviewQuestionExplanation({ ...f.args, fields: { draftVersion: firstVersion } }), e => e.code === 'DRAFT_CHANGED')
  const exact = structuredClone(envelope.draft.payload)
  await service.reviewQuestionExplanation({ ...f.args, fields: { draftVersion: envelope.draft.version, sourceHash: envelope.draft.sourceHash } })
  const published = await f.raw()
  assert.equal(published.draft, null)
  for (const [key, value] of Object.entries(exact)) if (!['updatedAt', 'reviewedAt', 'status'].includes(key)) assert.deepEqual(published.published[key], value)
  assert.equal(filterLearnerExplanation(published).reasoning, exact.reasoning)
  assert.equal(providerCalls, beforeCalls)
  assert.equal(await f.answer(), 'A')
  assert.equal((await f.cas()).count, 0)
  assert.deepEqual(await f.raw(), published)

  const target = (await service.targets(prisma, kind, f.id, f.args))[0]
  const locked = deferred(), release = deferred()
  const editor = prisma.$transaction(async tx => {
    await lockExplanationTarget(tx, kind, f.id)
    await f.changeSource(tx)
    locked.resolve()
    await release.promise
  }, { timeout: 10000 })
  await locked.promise
  let settled = false
  const writer = service.write(target, fresh => draftEnvelope(fresh.raw, exact, service.input(target).sourceHash))
    .then(() => ({ ok: true }), error => ({ error })).finally(() => { settled = true })
  await new Promise(resolve => setTimeout(resolve, 250))
  assert.equal(settled, false, 'Writer must wait for source transaction advisory lock')
  release.resolve()
  await editor
  const outcome = await writer
  assert.equal(outcome.error?.code, 'SOURCE_CHANGED', outcome.error?.stack)
  assert.deepEqual(await f.raw(), published)
  console.log(`PASS ${kind}/${skill}: generate+save+publish, JSON CAS, fixed answer, advisory lock wait+source rejection`)
}

async function main() {
  for (const kind of ['exam', 'practice']) for (const skill of ['reading', 'listening']) await run(kind, skill)
  assert.equal(providerCalls, 4)
  console.log('PASS isolated PostgreSQL16 workflow smoke: 4 flows, 4 fake provider calls, 0 real AI calls')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
