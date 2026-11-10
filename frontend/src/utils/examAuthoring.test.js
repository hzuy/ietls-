import { describe, it, expect } from 'vitest'
import { buildExamPayload, hydrateExamForm } from './examAuthoring'
import { normalizeFormForDirtyCheck } from './examExplanationUtils'
import { questionGroupTheme } from './questionTypes'

const group = { _id: 1780000000.5, type: 'mcq_multi', qNumberStart: 1, qNumberEnd: 3, maxChoices: 3, canReuse: true, questions: [{ number: 1, options: ['A', 'B', 'C'], questionText: 'Pick three', correctAnswer: 'A,B,C' }] }
for (const skill of ['reading', 'listening']) {
  const key = skill === 'reading' ? 'passages' : 'sections'
  const dbKey = skill === 'reading' ? 'passages' : 'listeningSections'
  describe(`${skill} save contract`, () => {
    it('never sends a temporary UI key as a persisted ID', () => {
      const form = { title: 'Test', [key]: [{ number: 1, questionGroups: [group] }] }
      const payload = buildExamPayload(form, skill)[key][0].questionGroups[0]
      expect(payload.id).toBeUndefined()
      expect(payload.isNew).toBe(true)
      expect(payload.questions[0]).toMatchObject({ isNew: true })
      expect(payload).toMatchObject({ maxChoices: 3, canReuse: true })
    })
    it('uses server identities on the second save while preserving the UI key', () => {
      const form = { title: 'Test', [key]: [{ number: 1, questionGroups: [group] }] }
      const saved = { title: 'Test', [dbKey]: [{ id: 10, number: 1, questionGroups: [{ ...group, id: 20, questions: [{ ...group.questions[0], id: 30, options: '["A","B","C"]' }] }] }] }
      const canonical = hydrateExamForm(saved, skill, form)
      expect(canonical[key][0].questionGroups[0]._id).toBe(group._id)
      const payload = buildExamPayload(canonical, skill)[key][0].questionGroups[0]
      expect(payload.id).toBe(20)
      expect(payload.isNew).toBeUndefined()
      expect(payload.questions[0].id).toBe(30)
      expect(payload.questions[0].isNew).toBeUndefined()
      expect(payload).toMatchObject({ maxChoices: 3, canReuse: true })
    })
    it('persists diagram hints and treats editing only a hint as dirty', () => {
      const form = { title: 'Test', [key]: [{ number: 1, questionGroups: [{ ...group, type: 'diagram_label', questions: [{ id: 30, number: 1, questionText: 'Old hint', hint: 'Edited hint', correctAnswer: 'arch' }] }] }] }
      expect(buildExamPayload(form, skill)[key][0].questionGroups[0].questions[0]).toMatchObject({ hint: 'Edited hint', questionText: 'Edited hint' })
      const edited = structuredClone(form)
      edited[key][0].questionGroups[0].questions[0].hint = 'New hint'
      expect(normalizeFormForDirtyCheck(edited)).not.toBe(normalizeFormForDirtyCheck(form))
    })
  })
}
it('marks Listening answer settings dirty', () => {
  const form = { sections: [{ number: 1, questionGroups: [group] }] }
  const edited = structuredClone(form)
  edited.sections[0].questionGroups[0].maxChoices = 2
  expect(normalizeFormForDirtyCheck(edited)).not.toBe(normalizeFormForDirtyCheck(form))
})
it('distinguishes headers while keeping all card bodies neutral', () => {
  const themes = ['mcq','matching','note_completion','true_false_ng','diagram_label'].map(questionGroupTheme)
  expect(new Set(themes.map(t => t.headerBg)).size).toBe(5)
  expect(themes.every(t => t.cardBg === 'bg-white' && t.subBoxBg === 'bg-zinc-50')).toBe(true)
})
