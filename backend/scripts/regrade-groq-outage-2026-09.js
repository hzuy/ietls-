// One-off maintenance script — NOT meant to be re-run blindly.
//
// Context: llama-3.3-70b-versatile was removed by Groq (404 model_not_found),
// which left a handful of WritingAnswer/SpeakingAnswer rows stuck in
// status='failed' from before GROQ_MODEL was fixed (see lib/groqClient.js).
// This regrades those SPECIFIC rows in place, from the essayText/transcript
// already saved on them — no resubmission, no data loss. It intentionally
// does NOT touch WritingAnswer#8 (exam 15, task 2, user "minh@gmail.com"):
// that row is graded 0 because the submitted essay was an off-topic
// duplicate of Task 1's essay, not an infrastructure failure — out of scope.
//
// Mirrors processWritingAI / processSpeakingAI in routes/writing.js and
// routes/speaking.js exactly (same prompt template, same band rounding),
// rather than importing them, since those functions aren't exported from
// the route files.
//
// Already run once (2026-09-06) — see commit message for the actual
// resulting scores. Kept here for auditability/reproducibility, not for
// routine use. If Groq breaks again, prefer POST /answers/:id/retry
// (added alongside this incident) over reaching for this script.
//
//   node scripts/regrade-groq-outage-2026-09.js
//
const prisma = require('../lib/prisma')
const Groq = require('groq-sdk')
const { getGroqModel } = require('../lib/groqClient')

const WRITING_ANSWER_IDS = [59]
const SPEAKING_ANSWER_IDS = [33, 34, 35]

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const roundBand = s => Math.round(Math.min(9, Math.max(0, parseFloat(s) || 0)) * 2) / 2

async function regradeWriting(answerId) {
  const answer = await prisma.writingAnswer.findUnique({ where: { id: answerId }, include: { task: true } })
  if (!answer) { console.log(`WritingAnswer#${answerId} not found — skip`); return }
  if (answer.status !== 'failed') { console.log(`WritingAnswer#${answerId} status='${answer.status}', not 'failed' — skip`); return }

  await prisma.writingAnswer.update({ where: { id: answerId }, data: { status: 'grading' } })

  const prompt = `Bạn là giám khảo IELTS. Chấm bài Writing Task ${answer.task.number}.

ĐỀ BÀI: ${answer.task.prompt}
BÀI VIẾT: ${answer.essayText}

Trả về JSON (không có gì khác):
{
  "overall": 6.5,
  "criteria": {
    "task_achievement": { "score": 6.5, "comment": "..." },
    "coherence_cohesion": { "score": 6.5, "comment": "..." },
    "lexical_resource": { "score": 6.5, "comment": "..." },
    "grammatical_range": { "score": 6.5, "comment": "..." }
  },
  "strengths": "...",
  "improvements": "..."
}`

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: getGroqModel(),
      temperature: 0.3
    })
    const feedback = JSON.parse(completion.choices[0]?.message?.content || '{}')
    feedback.overall = roundBand(feedback.overall)
    if (feedback.criteria) {
      for (const key of Object.keys(feedback.criteria)) {
        if (feedback.criteria[key]) feedback.criteria[key].score = roundBand(feedback.criteria[key].score)
      }
    }
    await prisma.writingAnswer.update({
      where: { id: answerId },
      data: { aiFeedback: JSON.stringify(feedback), aiScore: feedback.overall, status: 'graded', error: null }
    })
    console.log(`WritingAnswer#${answerId} REGRADED -> overall ${feedback.overall}`)
  } catch (err) {
    await prisma.writingAnswer.update({ where: { id: answerId }, data: { status: 'failed', error: err.message } })
    console.log(`WritingAnswer#${answerId} FAILED AGAIN -> ${err.message}`)
  }
}

async function regradeSpeaking(answerId) {
  const answer = await prisma.speakingAnswer.findUnique({
    where: { id: answerId },
    include: { part: { include: { questions: { orderBy: { orderNum: 'asc' } } } } }
  })
  if (!answer) { console.log(`SpeakingAnswer#${answerId} not found — skip`); return }
  if (answer.status !== 'failed') { console.log(`SpeakingAnswer#${answerId} status='${answer.status}', not 'failed' — skip`); return }

  await prisma.speakingAnswer.update({ where: { id: answerId }, data: { status: 'grading' } })

  const questionsText = answer.part.questions.map((q, i) => `${i + 1}. ${q.questionText}`).join('\n')
  const prompt = `Bạn là giám khảo IELTS Speaking. Đánh giá câu trả lời Part ${answer.part.number}.

CÂU HỎI:\n${questionsText}
CÂU TRẢ LỜI: ${answer.transcript}

Trả về JSON (không có gì khác):
{
  "overall": 6.5,
  "criteria": {
    "fluency": { "score": 6.5, "comment": "..." },
    "vocabulary": { "score": 6.5, "comment": "..." },
    "grammar": { "score": 6.5, "comment": "..." },
    "pronunciation": { "score": 6.5, "comment": "..." }
  },
  "strengths": "...",
  "improvements": "..."
}`

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: getGroqModel(),
      temperature: 0.3
    })
    const feedback = JSON.parse(completion.choices[0]?.message?.content || '{}')
    feedback.overall = roundBand(feedback.overall)
    if (feedback.criteria) {
      for (const key of Object.keys(feedback.criteria)) {
        if (feedback.criteria[key]) feedback.criteria[key].score = roundBand(feedback.criteria[key].score)
      }
    }
    await prisma.speakingAnswer.update({
      where: { id: answerId },
      data: { aiFeedback: JSON.stringify(feedback), aiScore: feedback.overall, status: 'graded', error: null }
    })
    console.log(`SpeakingAnswer#${answerId} (part ${answer.part.number}) REGRADED -> overall ${feedback.overall}`)
  } catch (err) {
    await prisma.speakingAnswer.update({ where: { id: answerId }, data: { status: 'failed', error: err.message } })
    console.log(`SpeakingAnswer#${answerId} FAILED AGAIN -> ${err.message}`)
  }
}

async function main() {
  for (const id of WRITING_ANSWER_IDS) await regradeWriting(id)
  for (const id of SPEAKING_ANSWER_IDS) await regradeSpeaking(id)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
