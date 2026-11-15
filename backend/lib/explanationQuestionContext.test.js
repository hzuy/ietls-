import { describe, expect, it } from 'vitest'

const { completionTarget, targetIssue, adminTargetView, sourceAnswerIssue } = require('./explanationQuestionContext')
const lines = [
  { contentWithTokens: 'The problem' },
  { contentWithTokens: 'The [Q:1] of London increased rapidly between 1800 and 1850', lineType: 'heading' },
  { contentWithTokens: 'The streets were full of horse-drawn vehicles' },
  { contentWithTokens: 'Building the railway would move people to housing in the [Q:2]' },
  { contentWithTokens: "A number of [Q:3] agreed with Pearson's idea" },
  { contentWithTokens: 'The company had problems getting the [Q:4] needed for the project', lineType: 'heading' },
  { contentWithTokens: 'Negative articles about the project appeared in the [Q:5]' },
  { contentWithTokens: 'Completion was followed by [Q:10]' },
]
const group = { type: 'note_completion', instruction: 'Write ONE WORD ONLY from the passage for each answer.',
  passage: { body: 'The population of London doubled. Some businessmen supported Pearson. Families moved to the suburbs. Negative articles appeared in the press.' },
  noteSections: [{ title: 'London underground', lines }] }
const q = (number, correctAnswer = 'population', overrides = {}) => ({ number, correctAnswer, type: 'fill_blank', questionText: '', group, ...overrides })
const payload = (full_sentence, text = '1. ___') => ({ answer: 'population', full_sentence, question_chunks: [{ text }] })

describe('completion question identity', () => {
  it('selects the exact target even when a blank is marked as a heading', () => {
    const target = completionTarget(q(1))
    expect(target.template).toBe('The [Q:1] of London increased rapidly between 1800 and 1850')
    expect(target.context).toContain('London underground')
    expect(target.context).toContain('The problem')
    expect(target.context).toContain('horse-drawn vehicles')
    expect([...target.context.matchAll(/\[Q:(\d+)\]/g)].map(match => match[1])).toEqual(['1'])
    expect(target.context).not.toContain('Negative articles')
  })
  it('does not confuse question one with question ten', () => {
    expect(completionTarget(q(10)).template).toBe('Completion was followed by [Q:10]')
    expect(completionTarget(q(1)).template).not.toContain('[Q:10]')
  })
  it('rejects q5 chunks when explaining q1 even if the saved answer is press', () => {
    expect(targetIssue(payload('Negative articles about the project appeared in the press.', '5. ___ ___'), q(1, 'press')))
      .toMatchObject({ code: 'QUESTION_CONTEXT_MISMATCH', action: 'retry_generation' })
  })
  it('rejects unnumbered chunks copied from another note despite a correct filled sentence', () => {
    expect(targetIssue(payload('The population of London increased rapidly between 1800 and 1850', 'Negative articles about the project'), q(1)))
      .toMatchObject({ code: 'QUESTION_CONTEXT_MISMATCH' })
  })
  it('rejects q2 full sentence when explaining q4 despite an answer-key match', () => {
    const nonliteral = { ...group, instruction: 'Complete the notes.' }
    expect(targetIssue(payload('Building the railway would move people to housing in the outskirts', '4. ___'), q(4, 'outskirts', { group: nonliteral })))
      .toMatchObject({ code: 'QUESTION_CONTEXT_MISMATCH' })
  })
  it('accepts only the exact target filled with its answer, ignoring case and trailing punctuation', () => {
    expect(targetIssue(payload('THE POPULATION OF LONDON INCREASED RAPIDLY BETWEEN 1800 AND 1850.'), q(1))).toBeNull()
  })
  it('preserves an explicit no_support response for the correct target instead of inventing a correction', () => {
    expect(targetIssue({ no_support: true, supportNote: 'The blank concerns population, not press.' }, q(1, 'press'))).toBeNull()
    expect(q(1, 'press').correctAnswer).toBe('press')
  })
  it('does not choose another note line when the target is missing', () => {
    const question = q(99)
    expect(completionTarget(question)).toMatchObject({ found: false, reason: 'missing' })
    expect(targetIssue({}, question)).toMatchObject({ code: 'QUESTION_CONTEXT_MISSING', action: 'edit_source' })
  })
  it('rejects duplicate target labels instead of guessing between two templates', () => {
    const duplicate = { ...group, noteSections: [{ lines: [{ content: 'Name [Q:1]' }, { content: 'Age [Q:1]' }] }] }
    expect(completionTarget(q(1, 'population', { group: duplicate }))).toMatchObject({ found: false, reason: 'ambiguous' })
  })
  it('falls back to a self-contained question template when notes do not contain the target', () => {
    const question = q(99, 'population', { questionText: 'London had a growing ___.' })
    expect(completionTarget(question)).toMatchObject({ found: true, template: 'London had a growing [Q:99].', source: 'question' })
    expect(targetIssue(payload('London had a growing population.', '99. ___'), question)).toBeNull()
  })
  it('isolates the exact table cell while preserving safe headers and row labels', () => {
    const table = { type: 'table_completion', noteSections: [{ title: 'Schedule', lines: [
      { content: 'Day | Time | Room', lineType: 'header' },
      { content: 'Monday | Starts at [Q:1] | Meet in [Q:2]' },
    ] }] }
    const question = q(1, 'nine', { group: table })
    const target = completionTarget(question)
    expect(target.template).toBe('Starts at [Q:1]')
    expect(target.context).toContain('Day | Time | Room')
    expect(target.context).toContain('Monday')
    expect(target.context).not.toContain('[Q:2]')
    expect(targetIssue(payload('Starts at nine'), question)).toBeNull()
  })
  it('isolates a fragment between adjacent blanks without solving the other blank', () => {
    const multi = { type: 'summary_completion', noteSections: [{ lines: [{ content: 'The [Q:1] carries [Q:2] every day.' }] }] }
    const question = q(1, 'train', { group: multi })
    expect(completionTarget(question)).toMatchObject({ template: 'The [Q:1] carries', fragment: true })
    expect(targetIssue(payload('The train carries'), question)).toBeNull()
    expect(completionTarget(question).context).not.toContain('[Q:2]')
  })
  it('leaves non-completion word-bank mechanics outside this strict completion-template gate', () => {
    expect(completionTarget(q(1, 'A', { group: { type: 'drag_word_bank' } })).applicable).toBe(false)
    expect(targetIssue(payload('Something else.'), q(1, 'A', { group: { type: 'drag_word_bank' } }))).toBeNull()
  })
  it('binds word-bank notes to the right blank without requiring completion-only full_sentence or literal source words', () => {
    const bank = { ...group, type: 'drag_word_bank', matchingOptions: [{ optionLetter: 'A', optionText: 'population' }] }
    const question = q(1, 'A', { group: bank })
    expect(completionTarget(question)).toMatchObject({ applicable: true, found: true, explicit: true })
    expect(targetIssue({ question_chunks: [{ text: 'The' }, { text: '1. ___' }, { text: 'of London' }] }, question)).toBeNull()
    expect(targetIssue({ question_chunks: [{ text: '5. ___' }] }, question)?.code).toBe('QUESTION_CONTEXT_MISMATCH')
    expect(sourceAnswerIssue(question)).toBeNull()
  })
})

describe('literal source constraints', () => {
  it('reports a nonliteral reading answer precisely when passage words are required', () => {
    expect(sourceAnswerIssue(q(4, 'outskirts'))).toMatchObject({ code: 'ANSWER_NOT_IN_SOURCE', action: 'edit_source' })
    expect(sourceAnswerIssue(q(2, 'suburbs'))).toBeNull()
  })
  it('supports stored answer aliases and optional word endings', () => {
    expect(sourceAnswerIssue(q(2, 'outskirts/suburbs'))).toBeNull()
    expect(sourceAnswerIssue(q(2, 'suburb(s)'))).toBeNull()
  })
  it('matches whole source words and escapes punctuation instead of using regex wildcards', () => {
    expect(sourceAnswerIssue(q(1, 'pres'))?.code).toBe('ANSWER_NOT_IN_SOURCE')
    const question = q(1, 'a.b', { group: { ...group, passage: { body: 'axb' } } })
    expect(sourceAnswerIssue(question)?.code).toBe('ANSWER_NOT_IN_SOURCE')
  })
  it('does not apply passage-word constraints to free-form or Listening answers', () => {
    expect(sourceAnswerIssue(q(1, 'outskirts', { group: { ...group, instruction: 'Answer in your own words.' } }))).toBeNull()
    expect(sourceAnswerIssue(q(1, 'outskirts', { group: { ...group, section: { transcript: 'They moved to suburbs.' } }, exam: { skill: 'listening' } }))).toBeNull()
  })
})

describe('read-only admin projection', () => {
  it('marks an existing wrong draft while preserving both the stored payload and published projection', () => {
    const projected = { ...payload('Negative articles appeared in the press.', '5. ___'), status: 'draft_ready', hasDraft: true,
      publishedExplanation: { reasoning: 'Visible existing explanation' } }
    const result = adminTargetView(projected, q(1, 'press'))
    expect(result).toMatchObject({ status: 'needs_regeneration', canUse: false, contentIssue: { code: 'QUESTION_CONTEXT_MISMATCH' } })
    expect(result.publishedExplanation).toEqual(projected.publishedExplanation)
    expect(projected.status).toBe('draft_ready')
    expect(projected).not.toHaveProperty('contentIssue')
  })
  it('preserves already published explanations and genuine unsupported drafts', () => {
    const published = { ...payload('An old sentence.', '5. ___'), status: 'published', hasDraft: false }
    expect(adminTargetView(published, q(1, 'press'))).toBe(published)
    const noSupport = { no_support: true, status: 'needs_regeneration', hasDraft: true }
    expect(adminTargetView(noSupport, q(1, 'press'))).toBe(noSupport)
  })
  it('keeps an established actual-answer mismatch ahead of the secondary filled-template mismatch', () => {
    const projected = { ...payload('A number of businessmen agreed with Pearson.', '5. ___'), answer: 'businessmen', hasDraft: true,
      status: 'needs_regeneration', contentIssue: { code: 'ANSWER_MISMATCH', message: 'The AI answer differs from the saved key.', action: 'retry_generation' } }
    expect(adminTargetView(projected, q(1, 'traffic'))).toMatchObject({ contentIssue: projected.contentIssue, validationIssue: projected.contentIssue.message, canUse: false })
  })
  it('keeps a changed-source projection stale instead of overwriting it with a context issue', () => {
    const projected = { ...payload('Wrong sentence.', '5. ___'), hasDraft: true, status: 'possibly_stale', staleReason: 'Source changed' }
    expect(adminTargetView(projected, q(1))).toBe(projected)
  })
})
