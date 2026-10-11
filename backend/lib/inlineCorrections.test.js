import { describe, it, expect } from 'vitest'
const { sanitizeCorrections } = require('./inlineCorrections')

const essay = 'At first it was just a place playing with a desk with a few notes books. Now it looked much cosier.'

describe('sanitizeCorrections', () => {
  it('keeps corrections that exist in the text and records their exact position', () => {
    const out = sanitizeCorrections([
      { original: 'playing', corrected: 'with a', type: 'grammar', explanation: 'x' },
      { original: 'notes books', corrected: 'notebooks', type: 'spelling', explanation: 'y' },
    ], [essay])
    expect(out).toHaveLength(2)
    expect(essay.slice(out[0].start, out[0].end)).toBe('playing')
    expect(essay.slice(out[1].start, out[1].end)).toBe('notes books')
  })

  it('picks the next occurrence of a repeated word instead of the first one', () => {
    const out = sanitizeCorrections([
      { original: 'playing', corrected: 'with a' },
      { original: 'with', corrected: 'and' },
      { original: 'with', corrected: 'beside' },
    ], [essay])
    const first = essay.indexOf('with')
    const second = essay.indexOf('with', first + 1)
    expect(out.map(c => c.start)).toEqual([essay.indexOf('playing'), first, second])
  })

  it('drops invented, empty, unchanged or overlapping corrections', () => {
    const out = sanitizeCorrections([
      { original: 'not in the essay', corrected: 'x' },
      { original: '', corrected: 'x' },
      { original: 'looked', corrected: 'looked' },
      { original: 'looked much', corrected: 'looks much' },
      { original: 'much', corrected: 'far' },
    ], [essay])
    expect(out.map(c => c.original)).toEqual(['looked', 'much'])
  })

  it('matches case-insensitively but keeps the original casing', () => {
    const out = sanitizeCorrections([{ original: 'at first', corrected: 'Initially' }], [essay])
    expect(out[0].original).toBe('At first')
  })

  it('maps speaking answer numbers to transcript entries and normalises the type', () => {
    const texts = ['Thank you.', 'I like play football.', 'He go to school.']
    const out = sanitizeCorrections([
      { answer: 1, original: 'play', corrected: 'playing', type: 'grammar' },
      { answer: 2, original: 'go', corrected: 'goes', type: 'weird' },
      { answer: 9, original: 'go', corrected: 'goes' },
    ], texts, { indexMap: [1, 2] })
    expect(out).toEqual([
      expect.objectContaining({ answer: 1, original: 'play', type: 'grammar' }),
      expect.objectContaining({ answer: 2, original: 'go', type: 'grammar' }),
    ])
  })

  it('marks only the wrong words when the AI quotes a longer phrase', () => {
    const text = 'Nowadays, many people believes that competition is good.'
    const [c] = sanitizeCorrections([{ original: 'many people believes', corrected: 'many people believe' }], [text])
    expect(c).toMatchObject({ original: 'believes', corrected: 'believe' })
    expect(text.slice(c.start, c.end)).toBe('believes')
    const [d] = sanitizeCorrections([{ original: 'competition is good', corrected: 'competition is beneficial' }], [text])
    expect(text.slice(d.start, d.end)).toBe('good')
    const [e] = sanitizeCorrections([{ original: 'I am totally agree', corrected: 'I totally agree' }], ['So I am totally agree.'])
    expect(e).toMatchObject({ original: 'am', corrected: '' })
  })

  it('returns an empty list for bad input', () => {
    expect(sanitizeCorrections(null, [essay])).toEqual([])
    expect(sanitizeCorrections('x', [essay])).toEqual([])
  })

  it('filters out punctuation-only corrections (e.g. food -> food, or month -> month.)', () => {
    const text = 'I eat typical food sometimes about once a month.'
    const raw = [
      { original: 'food', corrected: 'food,', type: 'punctuation' },
      { original: 'month', corrected: 'month.', type: 'punctuation' },
      { original: 'typical', corrected: 'traditional', type: 'word_choice' },
    ]
    const out = sanitizeCorrections(raw, [text])
    expect(out).toHaveLength(1)
    expect(out[0].original).toBe('typical')
    expect(out[0].corrected).toBe('traditional')
  })

  it('filters out UK/US spelling variants (e.g. colour -> color)', () => {
    const text = 'I like this colour very much.'
    const raw = [{ original: 'colour', corrected: 'color', type: 'spelling' }]
    expect(sanitizeCorrections(raw, [text])).toHaveLength(0)
  })

  it('in Speaking mode, filters out punctuation errors and ghostwritten rewrites', () => {
    const texts = ['I just eat typical food.', "I don't know."]
    const raw = [
      { answer: 1, original: 'food', corrected: 'food,', type: 'punctuation' },
      { answer: 2, original: "I don't know.", corrected: "No, I haven't tried making food from another country.", type: 'word_choice' },
      { answer: 2, original: "don't", corrected: "do not", type: 'grammar' },
    ]
    const out = sanitizeCorrections(raw, texts, { indexMap: [0, 1], isSpeaking: true })
    // food -> food, (bị lọc do punctuation/casing)
    // I don't know -> No, I haven't... (bị lọc do excessive rewrite)
    // don't -> do not (được giữ lại nếu cần)
    expect(out).toHaveLength(1)
    expect(out[0].original).toBe("don't")
    expect(out[0].corrected).toBe("do not")
  })
})
