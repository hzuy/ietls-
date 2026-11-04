import { describe, it, expect } from 'vitest'
import {
  mergeExamExplanations,
  normalizeFormForDirtyCheck,
  isExamFormDirty,
  calculateExamExplanationStats,
  isExplanationUnsupportedGroup
} from './examExplanationUtils'

describe('examExplanationUtils', () => {
  describe('mergeExamExplanations for Reading Exam', () => {
    it('merges explanation into existing form while preserving 100% of teacher pending edits', () => {
      // Teacher form state with uncommitted in-flight modifications:
      // - Modified passage body
      // - Modified question text on Q1
      // - Custom uncommitted option
      // - Brand new question (no id) added by teacher
      const currentForm = {
        title: 'Cambridge 19 Test 1 - Reading (Drafting)',
        bookNumber: '19',
        testNumber: '1',
        seriesId: '1',
        passages: [
          {
            id: 101,
            number: 1,
            title: 'Passage 1 Title',
            body: 'TEACHER MODIFIED PASSAGE BODY (UNSAVED DRAFT)',
            questionGroups: [
              {
                id: 201,
                type: 'tfng',
                qNumberStart: 1,
                qNumberEnd: 2,
                instruction: 'Do the following statements agree with the information...',
                questions: [
                  {
                    id: 301,
                    number: 1,
                    questionText: 'Q1 Text edited by teacher pending save',
                    options: ['', '', '', ''],
                    correctAnswer: 'TRUE',
                    explanation: null
                  },
                  {
                    id: 302,
                    number: 2,
                    questionText: 'Q2 Original text',
                    options: ['', '', '', ''],
                    correctAnswer: 'FALSE',
                    explanation: null
                  },
                  {
                    // Brand new question added in client
                    number: 3,
                    questionText: 'Q3 Brand new uncommitted question',
                    options: ['', '', '', ''],
                    correctAnswer: 'NOT GIVEN'
                  }
                ]
              }
            ]
          }
        ]
      }

      // Fresh data from server after AI generation
      const freshExam = {
        id: 50,
        title: 'Cambridge 19 Test 1 - Reading',
        passages: [
          {
            id: 101,
            number: 1,
            title: 'Passage 1 Original Title',
            body: 'Original passage text in database',
            questionGroups: [
              {
                id: 201,
                questions: [
                  {
                    id: 301,
                    number: 1,
                    questionText: 'Q1 Original text in DB',
                    correctAnswer: 'TRUE',
                    explanation: {
                      status: 'ai_generated',
                      steps: [{ stepNumber: 1, title: 'Analyze', content: 'Step 1' }]
                    }
                  },
                  {
                    id: 302,
                    number: 2,
                    questionText: 'Q2 Original text in DB',
                    correctAnswer: 'FALSE',
                    explanation: {
                      status: 'ai_generated',
                      steps: [{ stepNumber: 1, title: 'Analyze', content: 'Step 2' }]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }

      const merged = mergeExamExplanations(currentForm, freshExam)

      // 1. Teacher unsaved edits MUST be preserved
      expect(merged.passages[0].body).toBe('TEACHER MODIFIED PASSAGE BODY (UNSAVED DRAFT)')
      expect(merged.passages[0].questionGroups[0].questions[0].questionText).toBe(
        'Q1 Text edited by teacher pending save'
      )
      expect(merged.passages[0].questionGroups[0].questions[2].questionText).toBe(
        'Q3 Brand new uncommitted question'
      )

      // 2. Explanations MUST be merged in
      expect(merged.passages[0].questionGroups[0].questions[0].explanation).toEqual({
        status: 'ai_generated',
        steps: [{ stepNumber: 1, title: 'Analyze', content: 'Step 1' }]
      })
      expect(merged.passages[0].questionGroups[0].questions[1].explanation).toEqual({
        status: 'ai_generated',
        steps: [{ stepNumber: 1, title: 'Analyze', content: 'Step 2' }]
      })

      // 3. Group explanations lookup map is synchronized
      expect(merged.passages[0].questionGroups[0].explanations[1].status).toBe('ai_generated')
      expect(merged.passages[0].questionGroups[0].explanations[2].status).toBe('ai_generated')
    })

    it('updates correctAnswer ONLY when resolvedChoices specifies "ai"', () => {
      const currentForm = {
        passages: [
          {
            id: 101,
            questionGroups: [
              {
                id: 201,
                questions: [
                  { id: 301, number: 1, correctAnswer: 'TEACHER_ANSWER_1' },
                  { id: 302, number: 2, correctAnswer: 'TEACHER_ANSWER_2' }
                ]
              }
            ]
          }
        ]
      }

      const freshExam = {
        passages: [
          {
            id: 101,
            questionGroups: [
              {
                id: 201,
                questions: [
                  { id: 301, number: 1, correctAnswer: 'AI_ANSWER_1', explanation: { status: 'ai_generated' } },
                  { id: 302, number: 2, correctAnswer: 'AI_ANSWER_2', explanation: { status: 'conflict_pending' } }
                ]
              }
            ]
          }
        ]
      }

      // Teacher chooses 'ai' for Q1, but 'teacher' for Q2
      const resolvedChoices = {
        1: 'ai',
        2: 'teacher'
      }

      const merged = mergeExamExplanations(currentForm, freshExam, resolvedChoices)

      // Q1 answer adopted AI answer
      expect(merged.passages[0].questionGroups[0].questions[0].correctAnswer).toBe('AI_ANSWER_1')
      // Q2 answer stayed with Teacher answer
      expect(merged.passages[0].questionGroups[0].questions[1].correctAnswer).toBe('TEACHER_ANSWER_2')
    })
  })

  describe('mergeExamExplanations for Listening Exam', () => {
    it('merges explanation into listening sections while keeping audioUrl and transcript edits', () => {
      const currentForm = {
        title: 'Cambridge 19 Test 1 - Listening',
        sections: [
          {
            id: 401,
            number: 1,
            context: 'A student speaking with an advisor',
            audioUrl: 'https://cdn.example.com/unsaved-new-audio.mp3',
            transcript: 'Teacher edited transcript in progress',
            questionGroups: [
              {
                id: 501,
                type: 'note_completion',
                instruction: 'Write ONE WORD AND/OR A NUMBER',
                questions: [
                  {
                    id: 601,
                    number: 1,
                    questionText: 'Address: [1] Street',
                    correctAnswer: 'Park',
                    explanation: null
                  }
                ]
              }
            ]
          }
        ]
      }

      const freshExam = {
        listeningSections: [
          {
            id: 401,
            questionGroups: [
              {
                id: 501,
                questions: [
                  {
                    id: 601,
                    number: 1,
                    correctAnswer: 'Park',
                    explanation: { status: 'ai_generated', quote: 'I live on Park Street' }
                  }
                ]
              }
            ]
          }
        ]
      }

      const merged = mergeExamExplanations(currentForm, freshExam)

      // Transcripts and audioUrl edits preserved
      expect(merged.sections[0].audioUrl).toBe('https://cdn.example.com/unsaved-new-audio.mp3')
      expect(merged.sections[0].transcript).toBe('Teacher edited transcript in progress')

      // Explanation updated
      expect(merged.sections[0].questionGroups[0].questions[0].explanation.status).toBe('ai_generated')
      expect(merged.sections[0].questionGroups[0].explanations[1].quote).toBe('I live on Park Street')
    })
  })

  describe('isExamFormDirty & normalizeFormForDirtyCheck', () => {
    it('detects changes in passage body or question content as dirty', () => {
      const form = {
        title: 'Test Exam',
        passages: [
          {
            id: 1,
            number: 1,
            body: 'Original passage text',
            questionGroups: [
              {
                id: 10,
                type: 'tfng',
                questions: [{ id: 100, number: 1, questionText: 'Q1' }]
              }
            ]
          }
        ]
      }

      const pristineSig = normalizeFormForDirtyCheck(form)
      expect(isExamFormDirty(form, pristineSig)).toBe(false)

      // Modify passage body
      const dirtyForm = {
        ...form,
        passages: [
          {
            ...form.passages[0],
            body: 'Modified passage text'
          }
        ]
      }
      expect(isExamFormDirty(dirtyForm, pristineSig)).toBe(true)
    })

    it('does NOT mark form dirty when ONLY explanation status changes', () => {
      const form = {
        title: 'Test Exam',
        passages: [
          {
            id: 1,
            number: 1,
            body: 'Original passage text',
            questionGroups: [
              {
                id: 10,
                type: 'tfng',
                questions: [{ id: 100, number: 1, questionText: 'Q1', explanation: null }]
              }
            ]
          }
        ]
      }

      const pristineSig = normalizeFormForDirtyCheck(form)

      // Only explanation was added
      const formWithExp = {
        ...form,
        passages: [
          {
            ...form.passages[0],
            questionGroups: [
              {
                ...form.passages[0].questionGroups[0],
                questions: [
                  {
                    id: 100,
                    number: 1,
                    questionText: 'Q1',
                    explanation: { status: 'ai_generated' }
                  }
                ]
              }
            ]
          }
        ]
      }

      // Dirty check should ignore explanation field
      expect(isExamFormDirty(formWithExp, pristineSig)).toBe(false)
    })
  })

  describe('calculateExamExplanationStats (Batch 2 - Requirement 3.3)', () => {
    it('properly counts mcq_multi where 1 question record covers multiple question numbers/slots', () => {
      const examForm = {
        passages: [
          {
            number: 1,
            questionGroups: [
              {
                id: 1,
                type: 'mcq_multi',
                qNumberStart: 21,
                qNumberEnd: 22,
                maxChoices: 2,
                questions: [
                  {
                    id: 50,
                    number: 21,
                    questionText: 'Which TWO factors are discussed?',
                    explanation: { status: 'ai_generated' }
                  }
                ]
              }
            ]
          }
        ]
      }

      const stats = calculateExamExplanationStats(examForm)

      // 1 question record in DB, but covers 2 slots (Q21 and Q22)
      expect(stats.totalQuestions).toBe(1)
      expect(stats.supportedQuestions).toBe(1)
      expect(stats.explainedQuestions).toBe(1)

      expect(stats.totalSlots).toBe(2)
      expect(stats.supportedSlots).toBe(2)
      expect(stats.explainedSlots).toBe(2)
      expect(stats.isFullyExplained).toBe(true)
      expect(stats.hasAttention).toBe(false)
    })

    it('excludes image groups WITHOUT imageUrl from the denominator (supportedSlots/Questions)', () => {
      const examForm = {
        passages: [
          {
            number: 1,
            questionGroups: [
              // 4 questions in diagram_label (IMAGE family) — chưa có ảnh nên không thể giải thích
              {
                id: 1,
                type: 'diagram_label',
                qNumberStart: 1,
                qNumberEnd: 4,
                questions: [
                  { id: 10, number: 1 },
                  { id: 11, number: 2 },
                  { id: 12, number: 3 },
                  { id: 13, number: 4 }
                ]
              },
              // 6 standard questions with explanations
              {
                id: 2,
                type: 'fill_blank',
                qNumberStart: 5,
                qNumberEnd: 10,
                questions: [5, 6, 7, 8, 9, 10].map(n => ({
                  id: 10 + n,
                  number: n,
                  explanation: { status: 'teacher_reviewed' }
                }))
              }
            ]
          }
        ]
      }

      const stats = calculateExamExplanationStats(examForm)

      // Total slots = 10, but 4 are unsupported diagram_label (thiếu ảnh)
      expect(stats.totalSlots).toBe(10)
      expect(stats.unsupportedSlots).toBe(4)
      expect(stats.supportedSlots).toBe(6) // Denominator excludes image groups without image
      expect(stats.explainedSlots).toBe(6)
      expect(stats.isFullyExplained).toBe(true) // 6/6 supported are explained
      expect(stats.hasUnsupported).toBe(true)
    })

    it('counts image groups WITH imageUrl as supported (Gemini vision đọc được bản đồ)', () => {
      const examForm = {
        sections: [
          {
            id: 1,
            number: 2,
            questionGroups: [
              {
                id: 276,
                type: 'map_diagram',
                imageUrl: 'https://cdn.example.com/map.png',
                qNumberStart: 16,
                qNumberEnd: 20,
                questions: [16, 17, 18, 19, 20].map(n => ({
                  id: 100 + n,
                  number: n,
                  explanation: { status: 'ai_generated' }
                }))
              }
            ]
          }
        ]
      }

      const stats = calculateExamExplanationStats(examForm)

      expect(stats.totalSlots).toBe(5)
      expect(stats.unsupportedSlots).toBe(0)
      expect(stats.supportedSlots).toBe(5)
      expect(stats.explainedSlots).toBe(5)
      expect(stats.isFullyExplained).toBe(true)
      expect(stats.hasUnsupported).toBe(false)
    })

    it('isExplanationUnsupportedGroup chỉ chặn nhóm hình ảnh thiếu ảnh', () => {
      expect(isExplanationUnsupportedGroup({ type: 'map_diagram' })).toBe(true)
      expect(isExplanationUnsupportedGroup({ type: 'map_diagram', imageUrl: 'https://x/y.png' })).toBe(false)
      expect(isExplanationUnsupportedGroup({ type: 'fill_blank' })).toBe(false)
      expect(isExplanationUnsupportedGroup(null)).toBe(false)
    })

    it('flags hasAttention ONLY for conflict_pending, needs_regeneration, and possibly_stale with text labels', () => {
      const examForm = {
        sections: [
          {
            number: 1,
            questionGroups: [
              {
                id: 1,
                type: 'mcq',
                questions: [
                  { id: 1, number: 1, explanation: { status: 'ai_generated' } },
                  { id: 2, number: 2, explanation: { status: 'teacher_reviewed' } },
                  { id: 3, number: 3, explanation: { status: 'teacher_edited' } },
                  { id: 4, number: 4, explanation: { status: 'conflict_pending' } },
                  { id: 5, number: 5, explanation: { status: 'needs_regeneration' } },
                  { id: 6, number: 6, explanation: { status: 'possibly_stale' } }
                ]
              }
            ]
          }
        ]
      }

      const stats = calculateExamExplanationStats(examForm)

      expect(stats.totalSlots).toBe(6)
      expect(stats.supportedSlots).toBe(6)
      expect(stats.explainedSlots).toBe(6)

      // 3 questions require attention
      expect(stats.hasAttention).toBe(true)
      expect(stats.attentionSlots).toBe(3)
      expect(stats.statusCounts.conflict_pending).toBe(1)
      expect(stats.statusCounts.needs_regeneration).toBe(1)
      expect(stats.statusCounts.possibly_stale).toBe(1)

      // Check text reasons (non-color based labels)
      expect(stats.attentionReasons).toContain('1 câu Chờ duyệt (Lệch)')
      expect(stats.attentionReasons).toContain('1 câu Cần sinh lại')
      expect(stats.attentionReasons).toContain('1 câu Có thể lỗi thời')
    })

    it('works on a single passage partition or group', () => {
      const passage = {
        number: 1,
        questionGroups: [
          {
            type: 'true_false_ng',
            questions: [
              { id: 1, number: 1, explanation: { status: 'ai_generated' } },
              { id: 2, number: 2, explanation: null }
            ]
          }
        ]
      }

      const stats = calculateExamExplanationStats(passage)
      expect(stats.supportedSlots).toBe(2)
      expect(stats.explainedSlots).toBe(1)
      expect(stats.isFullyExplained).toBe(false)
      expect(stats.hasAttention).toBe(false)
    })
  })
})
