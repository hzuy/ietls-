import { describe, it, expect } from 'vitest'
import {
  normalizeExplanation,
  isExplanationEqual,
  analyzeDraftDifferences,
  smartMergeDraft,
} from './draftMergeUtils'

describe('draftMergeUtils', () => {
  describe('normalizeExplanation & isExplanationEqual', () => {
    it('normalizes steps and compares equal content with different spacing', () => {
      const exp1 = {
        steps: {
          predict: '  Dự đoán bước 1  ',
          locate: 'Đoạn A dòng 2',
          analyze: 'Phân tích',
          conclude: 'Kết luận',
        },
        status: 'ai_generated',
      }
      const exp2 = {
        steps: {
          predict: 'Dự đoán bước 1',
          locate: 'Đoạn A dòng 2  ',
          analyze: 'Phân tích',
          conclude: 'Kết luận',
        },
        status: 'ai_generated',
        updatedAt: '2026-10-19T10:00:00Z', // metadata should be ignored
      }

      expect(isExplanationEqual(exp1, exp2)).toBe(true)
    })

    it('detects difference when teacher edited steps', () => {
      const expDb = {
        steps: { predict: 'AI predict', locate: 'Para 1', analyze: 'AI text', conclude: 'Done' },
        status: 'ai_generated',
      }
      const expDraft = {
        steps: { predict: 'Teacher edit step 1', locate: 'Para 1', analyze: 'AI text', conclude: 'Done' },
        status: 'teacher_edited',
      }

      expect(isExplanationEqual(expDb, expDraft)).toBe(false)
    })
  })

  describe('analyzeDraftDifferences', () => {
    it('correctly counts explanations and detects differing questions', () => {
      const currentDbForm = {
        title: 'DB Title',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, explanation: { steps: { predict: 'DB Exp 1' } } },
              { number: 2, explanation: { steps: { predict: 'DB Exp 2' } } },
            ],
            explanations: {
              1: { steps: { predict: 'DB Exp 1' } },
              2: { steps: { predict: 'DB Exp 2' } },
            },
          },
        ],
      }

      const draftData = {
        title: 'Draft Title (User edited)',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, explanation: { steps: { predict: 'Draft Edited Exp 1' } } }, // Different
              { number: 2, explanation: { steps: { predict: 'DB Exp 2' } } }, // Identical
            ],
            explanations: {
              1: { steps: { predict: 'Draft Edited Exp 1' } },
              2: { steps: { predict: 'DB Exp 2' } },
            },
          },
        ],
      }

      const analysis = analyzeDraftDifferences({ draftData, currentDbForm })
      expect(analysis.draftExplanationCount).toBe(2)
      expect(analysis.differentCount).toBe(1)
      expect(analysis.differentQuestionNumbers).toEqual([1])
      expect(analysis.hasContentDifferences).toBe(true)
    })

    it('identifies questions where DB has newly generated explanations missing in draft', () => {
      const currentDbForm = {
        questionGroups: [
          {
            questions: [
              { number: 1, explanation: { steps: { predict: 'DB Exp 1' } } },
              { number: 2, explanation: { steps: { predict: 'DB Exp 2 (new from AI)' } } },
            ],
            explanations: {
              1: { steps: { predict: 'DB Exp 1' } },
              2: { steps: { predict: 'DB Exp 2 (new from AI)' } },
            },
          },
        ],
      }

      // Old draft created before AI generated question 2
      const draftData = {
        questionGroups: [
          {
            questions: [
              { number: 1, explanation: { steps: { predict: 'DB Exp 1' } } },
              { number: 2, explanation: null },
            ],
            explanations: {
              1: { steps: { predict: 'DB Exp 1' } },
            },
          },
        ],
      }

      const analysis = analyzeDraftDifferences({ draftData, currentDbForm })
      expect(analysis.draftExplanationCount).toBe(1)
      expect(analysis.dbHasNewerQuestions).toEqual([2])
    })
  })

  describe('smartMergeDraft', () => {
    it('restores non-explanation fields from draft while preserving newly generated DB explanations', () => {
      const currentDbForm = {
        title: 'Original Title',
        passage: 'Original Passage',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, questionText: 'Q1', explanation: { steps: { predict: 'New AI Exp 1' } } },
              { number: 2, questionText: 'Q2', explanation: { steps: { predict: 'New AI Exp 2' } } },
            ],
            explanations: {
              1: { steps: { predict: 'New AI Exp 1' } },
              2: { steps: { predict: 'New AI Exp 2' } },
            },
          },
        ],
      }

      const draftData = {
        title: 'Updated Title from Draft',
        passage: 'Passage with minor typos corrected',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, questionText: 'Q1 edited in draft' },
              { number: 2, questionText: 'Q2 edited in draft' },
            ],
            // Draft has NO explanations because it was saved before AI run
            explanations: {},
          },
        ],
      }

      const merged = smartMergeDraft({ draftData, currentDbForm, resolutionChoice: 'keep_db' })

      // Restores title & passage
      expect(merged.title).toBe('Updated Title from Draft')
      expect(merged.passage).toBe('Passage with minor typos corrected')

      // Preserves DB explanations
      const g = merged.questionGroups[0]
      expect(g.questions[0].questionText).toBe('Q1 edited in draft')
      expect(g.questions[0].explanation).toEqual({ steps: { predict: 'New AI Exp 1' } })
      expect(g.explanations[1]).toEqual({ steps: { predict: 'New AI Exp 1' } })
      expect(g.explanations[2]).toEqual({ steps: { predict: 'New AI Exp 2' } })
    })

    it('respects user choice when user decides to keep draft explanations', () => {
      const currentDbForm = {
        questionGroups: [
          {
            id: 'g1',
            questions: [{ number: 1, explanation: { steps: { predict: 'DB Exp 1' } } }],
            explanations: { 1: { steps: { predict: 'DB Exp 1' } } },
          },
        ],
      }

      const draftData = {
        questionGroups: [
          {
            id: 'g1',
            questions: [{ number: 1, explanation: { steps: { predict: 'Teacher Manual Edit' } } }],
            explanations: { 1: { steps: { predict: 'Teacher Manual Edit' } } },
          },
        ],
      }

      // User chose keep_draft
      const merged = smartMergeDraft({ draftData, currentDbForm, resolutionChoice: 'keep_draft' })
      expect(merged.questionGroups[0].explanations[1].steps.predict).toBe('Teacher Manual Edit')
    })
  })
})
