import { describe, expect, it } from 'vitest'

const generator = require('../scripts/generate-explanations')
const { sanitizeExplanationForRead, filterLearnerExplanation, validateManualExplanation } = require('./explanationGeneratorService')
const { normalizeAlternatives } = require('../lib/explanationAlternatives')
const { draftEnvelope } = require('../lib/explanationWorkflow')
const passage = 'The library opens at nine and closes at ten.'
const distractions = [{ option: 'ten', label: '', reason: 'This is the closing time.' }, { option: 'invented', reason: 'Invented choice.' }]
const payload = { question_chunks: [{ text: 'opening time', label: 'time' }], predict: 'Find a time.', answer: 'nine',
  reasoning: 'The library opens at nine.', evidence_quote: passage, translation: 'Thư viện mở cửa lúc chín giờ.', full_sentence: 'The library opens at nine.', distractors: distractions }
const openTypes = ['fill_blank', 'short_answer', 'table_completion', 'note_completion', 'form_completion', 'sentence_completion', 'summary_completion', 'flow_chart_completion']
const choiceTypes = ['mcq', 'mcq_multi', 'choose_title', 'list_selection', 'multiple_choice', 'matching', 'matching_headings', 'matching_features', 'matching_paragraph', 'matching_information', 'matching_drag', 'matching_endings', 'categorisation', 'drag_word_bank']
const imageTypes = ['diagram_completion', 'diagram_label', 'map_diagram']
const question = (type, options) => ({ type, options, number: 1, questionText: 'Opening time?', correctAnswer: 'nine', passage: { body: passage }, group: { type } })

describe('question-family alternatives policy', () => {
  it.each(openTypes)('%s never generates, saves or exposes invented alternatives', type => {
    const q = question(type, ['nine', 'ten']) // incidental options cannot turn an open task into MCQ
    const family = generator.classifyFamily(type), ctx = generator.buildContext(q, family)
    expect(generator.enrichExplanation(payload, ctx, 'nine', family).distractors).toEqual([])
    expect(generator.buildResponseSchema(type, q.options).properties.distractors.maxItems).toBe(0)
    expect(generator.buildPrompt(q, family, ctx, null, null, { isFixedMode: true })).toContain('"distractors" PHẢI là []')
    expect(generator.buildBatchPrompt([q], family, ctx)).toContain('"distractors" PHẢI là []')
    const legacy = { ...payload, status: 'teacher_reviewed' }
    expect(sanitizeExplanationForRead(legacy, type, q.options).distractors).toEqual([])
    expect(filterLearnerExplanation(legacy, type, q.options).distractors).toEqual([])
    expect(validateManualExplanation({ reasoning: payload.reasoning }, { family, prevExp: legacy, options: q.options, targetAnswer: 'nine' }).distractors).toEqual([])
    expect(legacy.distractors).toEqual(distractions)
    const envelope = draftEnvelope(legacy, legacy, 'source')
    const view = sanitizeExplanationForRead(envelope, type, q.options)
    expect(view.distractors).toEqual([])
    expect(view.publishedExplanation.distractors).toEqual([])
    expect(envelope.draft.payload.distractors).toEqual(distractions)
  })
  it.each(choiceTypes)('%s permits only genuine incorrect choices from its bank', type => {
    const q = question(type, ['nine', 'ten'])
    const family = generator.classifyFamily(type)
    expect(family).not.toBe('GENERIC')
    expect(generator.enrichExplanation(payload, generator.buildContext(q, family), 'nine', family).distractors).toEqual([distractions[0]])
    expect(filterLearnerExplanation({ ...payload, status: 'teacher_reviewed' }, type, q.options).distractors).toEqual([distractions[0]])
    expect(sanitizeExplanationForRead(payload, type).distractors).toEqual([])
  })
  it.each(imageTypes)('%s free entry has no alternatives; a real bank permits them', type => {
    const family = generator.classifyFamily(type)
    const q = question(type)
    expect(generator.enrichExplanation(payload, generator.buildContext(q, family), 'nine', family).distractors).toEqual([])
    q.options = ['nine', 'ten']
    expect(generator.enrichExplanation(payload, generator.buildContext(q, family), 'nine', family).distractors).toEqual([distractions[0]])
  })
  it.each(['T', 'TRUE', 'F', 'FALSE', 'NG', 'NOTGIVEN', 'NOT GIVEN'])('TFNG removes correct answer alias %s', answer => {
    const items = ['TRUE', 'FALSE', 'NOT GIVEN'].map(option => ({ option, reason: 'Reason' }))
    const expected = /^(T|TRUE)$/.test(answer) ? 'TRUE' : /^(F|FALSE)$/.test(answer) ? 'FALSE' : 'NOT GIVEN'
    const result = normalizeAlternatives(items, { family: 'TFNG', answer, type: 'true_false_not_given' })
    expect(result).toHaveLength(2)
    expect(result.map(item => item.option)).not.toContain(expected)
  })
  it.each(['Y', 'YES', 'N', 'NO', 'NG'])('YN aliases remove the correct inherent option %s', answer => {
    const items = ['YES', 'NO', 'NOT GIVEN'].map(option => ({ option, reason: 'Reason' }))
    const result = normalizeAlternatives(items, { family: 'TFNG', answer, type: 'yes_no_not_given' })
    expect(result).toHaveLength(2)
    expect(result.map(item => item.option)).not.toContain(answer === 'Y' || answer === 'YES' ? 'YES' : answer === 'N' || answer === 'NO' ? 'NO' : 'NOT GIVEN')
  })
  it.each(['B,C', 'B C', 'B and C', 'B / C', 'BC'])('removes every correct multi-select choice in %s', answer => {
    const pairs = ['Alpha', 'Beta', 'Charlie'].map((text, index) => ({ letter: String.fromCharCode(65 + index), text }))
    const items = pairs.map(pair => ({ option: pair.letter, reason: 'Reason' }))
    expect(normalizeAlternatives(items, { family: 'MCQ', pairs, answer }).map(item => item.option)).toEqual(['A'])
  })
  it('uses group bank mechanics when the stored question is mapped to fill_blank', () => {
    const q = { ...question('fill_blank'), group: { type: 'drag_word_bank', matchingOptions: [{ optionLetter: 'A', optionText: 'nine' }, { optionLetter: 'B', optionText: 'ten' }] } }
    expect(generator.enrichExplanation(payload, generator.buildContext(q, 'COMPLETION'), 'nine', 'COMPLETION').distractors).toEqual([distractions[0]])
  })
  it.each(['New York, Los Angeles', 'New York and Los Angeles', 'New York / Los Angeles'])('preserves phrase choices when excluding multiple correct answers: %s', answer => {
    const pairs = ['New York', 'Los Angeles', 'Boston'].map((text, index) => ({ letter: String.fromCharCode(65 + index), text }))
    const items = pairs.map(pair => ({ option: pair.text, reason: 'Reason' }))
    expect(normalizeAlternatives(items, { family: 'MCQ', pairs, answer }).map(item => item.option)).toEqual(['Boston'])
  })
  it('resolves nonempty group options despite empty child and matching banks', () => {
    const q = { ...question('map_diagram', []), group: { type: 'map_diagram', matchingOptions: [], options: ['nine', 'ten'] } }
    expect(generator.questionOptions(q)).toEqual(['nine', 'ten'])
    expect(generator.enrichExplanation(payload, generator.buildContext(q, 'IMAGE'), 'nine', 'IMAGE').distractors).toEqual([distractions[0]])
  })
})
