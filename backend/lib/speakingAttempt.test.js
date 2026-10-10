import { describe, it, expect } from 'vitest'
const {
  analyzeTranscript,
  isInsufficient,
  isHallucination,
  averageBand,
  pickCurrentAttempt,
  readWhisperResult,
  applyRelevanceCap,
} = require('./speakingAttempt')

const t = (...texts) => JSON.stringify(texts.map(text => ({ text })))

describe('speakingAttempt', () => {
  it('treats Whisper silence phrases as no answer', () => {
    expect(isHallucination('Thank you.')).toBe(true)
    expect(isHallucination(' you you ')).toBe(true)
    expect(isHallucination('Thanks for watching!')).toBe(true)
    expect(isHallucination('Thank you for asking, I love cooking.')).toBe(false)
  })

  it('marks a silent part as insufficient', () => {
    const a = analyzeTranscript(t('Thank you.', '', 'you'))
    expect(a.answeredCount).toBe(0)
    expect(isInsufficient(1, a)).toBe(true)
    expect(isInsufficient(2, analyzeTranscript(t('Thank you.')))).toBe(true)
  })

  it('accepts a real answer and counts only spoken questions', () => {
    const a = analyzeTranscript(t('I usually eat Vietnamese food at home with my family.', 'Thank you.', 'Yes, I like trying food from Japan and Korea.'))
    expect(a.answeredCount).toBe(2)
    expect(a.meaningfulWords).toBeGreaterThanOrEqual(10)
    expect(isInsufficient(1, a)).toBe(false)
  })

  it('needs a longer answer for Part 2', () => {
    const a = analyzeTranscript(t('I will describe a law about cars in my city.'))
    expect(isInsufficient(1, a)).toBe(false)
    expect(isInsufficient(2, a)).toBe(true)
  })

  it('handles plain-text legacy transcripts', () => {
    expect(analyzeTranscript('I can find many food from many different country where I live').meaningfulWords).toBe(12)
    expect(analyzeTranscript('').answeredCount).toBe(0)
  })

  it('averages only numeric bands and never returns NaN', () => {
    expect(averageBand([5, '?', null, 6])).toBe(5.5)
    expect(averageBand(['?', undefined])).toBeNull()
    expect(averageBand([0, 4])).toBe(2)
  })

  it('keeps only answers from the latest attempt (since the newest Part 1)', () => {
    const answers = [
      { partId: 1, partNumber: 1, createdAt: '2026-10-08T00:57:00Z', aiScore: 5 },
      { partId: 2, partNumber: 2, createdAt: '2026-10-08T00:59:00Z', aiScore: 5.5 },
      { partId: 3, partNumber: 3, createdAt: '2026-10-08T01:01:00Z', aiScore: 4.5 },
      { partId: 1, partNumber: 1, createdAt: '2026-10-08T03:16:00Z', aiScore: 3.5 },
    ]
    const current = pickCurrentAttempt(answers)
    expect(Object.keys(current)).toEqual(['1'])
    expect(current[1].aiScore).toBe(3.5)
  })

  it('falls back to the latest answer per part when no Part 1 exists', () => {
    const current = pickCurrentAttempt([
      { partId: 2, partNumber: 2, createdAt: '2026-10-01T00:00:00Z', aiScore: 4 },
      { partId: 2, partNumber: 2, createdAt: '2026-10-02T00:00:00Z', aiScore: 6 },
    ])
    expect(current[2].aiScore).toBe(6)
  })

  it('flags non-English Whisper results and keeps the original text', () => {
    const vi = readWhisperResult({ language: 'Vietnamese', text: 'Sao không mở cửa còn tắt đèn?', segments: [{ text: 'Sao không mở cửa còn tắt đèn?', no_speech_prob: 0.01 }] })
    expect(vi.isEnglish).toBe(false)
    expect(vi.languageLabel).toBe('tiếng Việt')
    const en = readWhisperResult({ language: 'English', segments: [{ text: ' I live in Hanoi.', no_speech_prob: 0.05 }] })
    expect(en).toMatchObject({ isEnglish: true, text: 'I live in Hanoi.' })
  })

  it('drops silent segments and silence hallucinations', () => {
    expect(readWhisperResult({ language: 'English', segments: [{ text: ' you', no_speech_prob: 0.7 }] }).text).toBe('')
    expect(readWhisperResult({ language: 'English', segments: [{ text: 'Thank you.', no_speech_prob: 0.2 }] }).text).toBe('')
    expect(readWhisperResult({ text: 'Hello world transcription' }).text).toBe('Hello world transcription')
  })

  it('ignores Vietnamese answers when analysing a transcript', () => {
    const a = analyzeTranscript(t('Sao không mở cửa còn tắt đèn?', 'I really like cooking pho with my mother at weekends.'))
    expect(a.answeredCount).toBe(1)
  })

  it('caps scores when answers are off-topic', () => {
    const none = applyRelevanceCap({ on_topic_answers: 0, overall: 4.5, criteria: { fluency: { score: 5 } }, improvements: 'x' }, 3)
    expect(none).toMatchObject({ offTopic: true, overall: 2 })
    expect(none.criteria.fluency.score).toBe(2)
    expect(none.improvements).toHaveLength(2)
    expect(applyRelevanceCap({ on_topic_answers: 1, overall: 5.5, criteria: {} }, 4).overall).toBe(4)
    const ok = applyRelevanceCap({ on_topic_answers: 3, overall: 6, criteria: {} }, 4)
    expect(ok.overall).toBe(6)
    expect(ok.offTopic).toBeUndefined()
    expect(applyRelevanceCap({ overall: 6, criteria: {} }, 4).overall).toBe(6)
  })
})
