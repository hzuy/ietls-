'use strict'

const SILENCE_HALLUCINATIONS = new Set([
  'thank you',
  'thank you very much',
  'thanks',
  'thanks for watching',
  'thank you for watching',
  'thank you so much for watching',
  'please subscribe',
  'subscribe',
  'bye',
  'bye bye',
  'you',
  'okay',
  'ok',
  'um',
  'uh',
  'hmm',
])

const MIN_WORDS_BY_PART = { 1: 10, 2: 20, 3: 10 }

function normalizeAnswerText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTranscriptEntries(transcript) {
  if (typeof transcript !== 'string') return []
  const raw = transcript.trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(e => ({ ...e, text: String(e?.text || '') }))
    } catch {
      return [{ text: raw }]
    }
  }
  return [{ text: raw }]
}

function isHallucination(text) {
  const norm = normalizeAnswerText(text)
  if (!norm) return true
  if (SILENCE_HALLUCINATIONS.has(norm)) return true
  const words = norm.split(' ')
  return words.every(w => SILENCE_HALLUCINATIONS.has(w))
}

function analyzeTranscript(transcript) {
  const entries = parseTranscriptEntries(transcript).map((e, index) => ({ ...e, index }))
  const spoken = entries.filter(e => !isHallucination(e.text) && !VIETNAMESE_CHARS.test(e.text))
  const meaningfulWords = spoken.reduce((sum, e) => sum + normalizeAnswerText(e.text).split(' ').filter(Boolean).length, 0)
  return { entries, spoken, meaningfulWords, answeredCount: spoken.length }
}

function isInsufficient(partNumber, analysis) {
  const min = MIN_WORDS_BY_PART[partNumber] || 10
  return analysis.meaningfulWords < min
}

function insufficientFeedback() {
  const comment = 'Không ghi nhận được câu trả lời đủ dài để chấm.'
  return {
    overall: 0,
    insufficient: true,
    criteria: {
      fluency: { score: 0, comment },
      vocabulary: { score: 0, comment },
      grammar: { score: 0, comment },
      pronunciation: { score: 0, comment },
    },
    strengths: [],
    improvements: ['Hãy trả lời đầy đủ từng câu hỏi và kiểm tra microphone trước khi làm bài.'],
  }
}

const VIETNAMESE_CHARS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i

const LANGUAGE_LABELS = {
  vietnamese: 'tiếng Việt',
  chinese: 'tiếng Trung',
  japanese: 'tiếng Nhật',
  korean: 'tiếng Hàn',
  french: 'tiếng Pháp',
  thai: 'tiếng Thái',
}

function readWhisperResult(transcription) {
  const language = String(transcription?.language || '').trim().toLowerCase()
  const segments = Array.isArray(transcription?.segments) ? transcription.segments : null
  const raw = segments
    ? segments.filter(s => !(Number(s.no_speech_prob) > 0.6)).map(s => s.text || '').join(' ')
    : String(transcription?.text || '')
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const text = isHallucination(cleaned) ? '' : cleaned
  const isEnglish = (!language || language === 'english' || language === 'en') && !VIETNAMESE_CHARS.test(text)
  const languageLabel = LANGUAGE_LABELS[language] || (VIETNAMESE_CHARS.test(text) ? 'tiếng Việt' : 'một ngôn ngữ khác tiếng Anh')
  return { text, language, isEnglish, languageLabel }
}

const RELEVANCE_NOTE = 'Phần lớn câu trả lời không đúng trọng tâm câu hỏi nên điểm bị giới hạn.'

function applyRelevanceCap(feedback, answeredCount) {
  const onTopic = Number(feedback?.on_topic_answers)
  if (!Number.isFinite(onTopic) || answeredCount <= 0) return feedback
  const ratio = onTopic / answeredCount
  const cap = onTopic <= 0 ? 2 : ratio < 0.5 ? 4 : null
  if (cap == null) return feedback
  feedback.offTopic = true
  feedback.overall = Math.min(Number(feedback.overall) || 0, cap)
  for (const c of Object.values(feedback.criteria || {})) {
    if (c && typeof c === 'object') c.score = Math.min(Number(c.score) || 0, cap)
  }
  const improvements = Array.isArray(feedback.improvements) ? feedback.improvements : feedback.improvements ? [feedback.improvements] : []
  feedback.improvements = [RELEVANCE_NOTE, ...improvements]
  return feedback
}

function toBand(value) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function averageBand(values) {
  const nums = values.map(toBand).filter(v => v != null)
  if (nums.length === 0) return null
  return Math.round(Math.min(9, Math.max(0, nums.reduce((a, b) => a + b, 0) / nums.length)) * 2) / 2
}

function pickCurrentAttempt(answers) {
  const sorted = [...answers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const latestPart1 = sorted.find(a => a.partNumber === 1)
  const since = latestPart1 ? new Date(latestPart1.createdAt).getTime() : 0
  const byPart = {}
  for (const a of sorted) {
    if (byPart[a.partId]) continue
    if (since && new Date(a.createdAt).getTime() < since) continue
    byPart[a.partId] = a
  }
  return byPart
}

module.exports = {
  analyzeTranscript,
  isInsufficient,
  isHallucination,
  insufficientFeedback,
  averageBand,
  toBand,
  pickCurrentAttempt,
  parseTranscriptEntries,
  readWhisperResult,
  applyRelevanceCap,
  MIN_WORDS_BY_PART,
}
