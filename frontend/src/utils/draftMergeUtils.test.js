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

  describe('so sánh mốc thời gian khi nháp và DB khác nhau', () => {
    const makeDbForm = (updatedAt) => ({
      questionGroups: [
        {
          id: 'g1',
          questions: [{ number: 1, explanation: { steps: { predict: 'DB Exp' }, updatedAt } }],
          explanations: { 1: { steps: { predict: 'DB Exp' }, updatedAt } },
        },
      ],
    })

    const makeDraft = () => ({
      questionGroups: [
        {
          id: 'g1',
          questions: [{ number: 1, explanation: { steps: { predict: 'Draft Exp' } } }],
          explanations: { 1: { steps: { predict: 'Draft Exp' } } },
        },
      ],
    })

    it('nháp lưu SAU cập nhật cuối của DB -> ưu tiên bản nháp (không cần người dùng chọn)', () => {
      const dbUpdatedAt = '2026-10-20T08:00:00.000Z'
      const draftSavedAt = Date.parse('2026-10-20T09:00:00.000Z')

      const merged = smartMergeDraft({
        draftData: makeDraft(),
        currentDbForm: makeDbForm(dbUpdatedAt),
        draftSavedAt,
      })

      expect(merged.questionGroups[0].explanations[1].steps.predict).toBe('Draft Exp')
    })

    it('DB được cập nhật SAU khi lưu nháp -> giữ giải thích DB', () => {
      const dbUpdatedAt = '2026-10-20T10:00:00.000Z'
      const draftSavedAt = Date.parse('2026-10-20T09:00:00.000Z')

      const merged = smartMergeDraft({
        draftData: makeDraft(),
        currentDbForm: makeDbForm(dbUpdatedAt),
        draftSavedAt,
      })

      expect(merged.questionGroups[0].explanations[1].steps.predict).toBe('DB Exp')
    })

    it('thiếu mốc thời gian -> mặc định an toàn là giữ DB', () => {
      const merged = smartMergeDraft({
        draftData: makeDraft(),
        currentDbForm: makeDbForm(null),
      })

      expect(merged.questionGroups[0].explanations[1].steps.predict).toBe('DB Exp')
    })

    it('lựa chọn rõ ràng của người dùng luôn thắng mốc thời gian', () => {
      const merged = smartMergeDraft({
        draftData: makeDraft(),
        currentDbForm: makeDbForm('2026-10-20T08:00:00.000Z'),
        draftSavedAt: Date.parse('2026-10-20T09:00:00.000Z'),
        resolutionChoice: 'keep_db',
      })

      expect(merged.questionGroups[0].explanations[1].steps.predict).toBe('DB Exp')
    })

    it('analyzeDraftDifferences báo câu nào trong nháp mới hơn + khuyến nghị', () => {
      const diff = analyzeDraftDifferences({
        draftData: makeDraft(),
        currentDbForm: makeDbForm('2026-10-20T08:00:00.000Z'),
        draftSavedAt: Date.parse('2026-10-20T09:00:00.000Z'),
      })

      expect(diff.differentCount).toBe(1)
      expect(diff.draftMayBeNewer).toEqual([1])
      expect(diff.recommendedChoice).toBe('keep_draft')
    })
  })

  describe('không làm mất dữ liệu chỉ có ở DB', () => {
    it('giữ nhóm câu hỏi được thêm vào DB sau khi lưu nháp', () => {
      const currentDbForm = {
        questionGroups: [
          { id: 'g1', questions: [{ number: 1 }], explanations: { 1: { steps: { predict: 'DB 1' } } } },
          { id: 'g2', questions: [{ number: 6 }], explanations: { 6: { steps: { predict: 'DB 6' } } } },
        ],
      }
      const draftData = {
        questionGroups: [
          { id: 'g1', questions: [{ number: 1 }], explanations: { 1: { steps: { predict: 'Draft 1' } } } },
        ],
      }

      const merged = smartMergeDraft({ draftData, currentDbForm, resolutionChoice: 'keep_db' })

      expect(merged.questionGroups).toHaveLength(2)
      expect(merged.questionGroups[1].id).toBe('g2')
      expect(merged.questionGroups[1].explanations[6].steps.predict).toBe('DB 6')
    })

    it('giữ câu hỏi được thêm vào DB trong cùng nhóm', () => {
      const currentDbForm = {
        questionGroups: [
          {
            id: 'g1',
            questions: [{ number: 1 }, { number: 2, explanation: { steps: { predict: 'DB 2' } } }],
            explanations: { 2: { steps: { predict: 'DB 2' } } },
          },
        ],
      }
      const draftData = {
        questionGroups: [
          { id: 'g1', questions: [{ number: 1 }], explanations: {} },
        ],
      }

      const merged = smartMergeDraft({ draftData, currentDbForm })

      const questions = merged.questionGroups[0].questions
      expect(questions.map((q) => q.number)).toEqual([1, 2])
      expect(merged.questionGroups[0].explanations[2].steps.predict).toBe('DB 2')
    })

    it('giữ passage được thêm vào DB sau khi lưu nháp', () => {
      const currentDbForm = {
        passages: [
          { id: 'p1', questionGroups: [{ id: 'g1', questions: [{ number: 1 }] }] },
          { id: 'p2', questionGroups: [{ id: 'g2', questions: [{ number: 6 }] }] },
        ],
      }
      const draftData = {
        passages: [
          { id: 'p1', questionGroups: [{ id: 'g1', questions: [{ number: 1, questionText: 'Sửa trong nháp' }] }] },
        ],
      }

      const merged = smartMergeDraft({ draftData, currentDbForm })

      expect(merged.passages).toHaveLength(2)
      expect(merged.passages[0].questionGroups[0].questions[0].questionText).toBe('Sửa trong nháp')
      expect(merged.passages[1].id).toBe('p2')
    })
  })
})
