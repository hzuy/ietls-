import { describe, it, expect } from 'vitest'
import { recalcAllGroupNumbers, recalcAllListeningNumbers } from './adminConstants'

describe('recalcAllGroupNumbers — Auto-renumber for token-based & standard groups', () => {
  it('updates Question.number and rewrites [Q:n] tokens when previous group shifts slot count', () => {
    const passages = [
      {
        number: 1,
        questionGroups: [
          {
            type: 'true_false_ng',
            qNumberStart: 1,
            qNumberEnd: 4,
            questions: [
              { id: 1, number: 1, questionText: 'Statement 1', correctAnswer: 'TRUE' },
              { id: 2, number: 2, questionText: 'Statement 2', correctAnswer: 'FALSE' },
              { id: 3, number: 3, questionText: 'Statement 3', correctAnswer: 'NOT GIVEN' },
              { id: 4, number: 4, questionText: 'Statement 4', correctAnswer: 'TRUE' },
            ],
          },
          {
            type: 'note_completion',
            qNumberStart: 5,
            qNumberEnd: 7,
            noteSections: [
              {
                title: 'Section 1',
                lines: [
                  { content: 'Name: [Q:5]', contentWithTokens: 'Name: [Q:5]' },
                  { content: 'Address: [Q:6] and [Q:7]', contentWithTokens: 'Address: [Q:6] and [Q:7]' },
                ],
              },
            ],
            questions: [
              { id: 10, number: 5, correctAnswer: 'Smith' },
              { id: 11, number: 6, correctAnswer: 'Oxford' },
              { id: 12, number: 7, correctAnswer: 'London' },
            ],
          },
        ],
      },
    ]

    // Now add 1 question to group 1 (so group 1 is 1-5, group 2 should become 6-8)
    passages[0].questionGroups[0].questions.push({
      id: 5,
      number: 5,
      questionText: 'Statement 5',
      correctAnswer: 'TRUE',
    })

    const result = recalcAllGroupNumbers(passages)
    const g1 = result[0].questionGroups[0]
    const g2 = result[0].questionGroups[1]

    expect(g1.qNumberStart).toBe(1)
    expect(g1.qNumberEnd).toBe(5)
    expect(g1.questions.map(q => q.number)).toEqual([1, 2, 3, 4, 5])

    // Group 2 range
    expect(g2.qNumberStart).toBe(6)
    expect(g2.qNumberEnd).toBe(8)

    // Questions renumbered & preserved IDs
    expect(g2.questions).toEqual([
      { id: 10, number: 6, correctAnswer: 'Smith' },
      { id: 11, number: 7, correctAnswer: 'Oxford' },
      { id: 12, number: 8, correctAnswer: 'London' },
    ])

    // Tokens rewritten
    expect(g2.noteSections[0].lines[0].content).toBe('Name: [Q:6]')
    expect(g2.noteSections[0].lines[0].contentWithTokens).toBe('Name: [Q:6]')
    expect(g2.noteSections[0].lines[1].content).toBe('Address: [Q:7] and [Q:8]')
    expect(g2.noteSections[0].lines[1].contentWithTokens).toBe('Address: [Q:7] and [Q:8]')
  })

  it('avoids token number collision when shifting by +1', () => {
    // Shifting [Q:1] -> [Q:2] and [Q:2] -> [Q:3] must not turn both into [Q:3]
    const passages = [
      {
        number: 1,
        questionGroups: [
          {
            type: 'mcq',
            qNumberStart: 1,
            qNumberEnd: 1,
            questions: [{ id: 1, number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }],
          },
          {
            type: 'table_completion',
            qNumberStart: 1,
            qNumberEnd: 2,
            noteSections: [
              {
                title: 'Table',
                lines: [
                  { content: 'Item [Q:1]|Item [Q:2]', contentWithTokens: 'Item [Q:1]|Item [Q:2]' },
                ],
              },
            ],
            questions: [
              { id: 20, number: 1, correctAnswer: 'First' },
              { id: 21, number: 2, correctAnswer: 'Second' },
            ],
          },
        ],
      },
    ]

    const result = recalcAllGroupNumbers(passages)
    const tableGroup = result[0].questionGroups[1]

    expect(tableGroup.qNumberStart).toBe(2)
    expect(tableGroup.qNumberEnd).toBe(3)
    expect(tableGroup.noteSections[0].lines[0].content).toBe('Item [Q:2]|Item [Q:3]')
    expect(tableGroup.questions.map(q => q.number)).toEqual([2, 3])
    expect(tableGroup.questions.map(q => q.id)).toEqual([20, 21])
  })

  it('renumbers diagram_label without tokens based on slot index', () => {
    const passages = [
      {
        number: 1,
        questionGroups: [
          {
            type: 'diagram_label',
            qNumberStart: 1,
            qNumberEnd: 2,
            questions: [
              { id: 30, number: 1, hint: 'Top label', correctAnswer: 'arch' },
              { id: 31, number: 2, hint: 'Base label', correctAnswer: 'pillar' },
            ],
          },
        ],
      },
      {
        number: 2,
        questionGroups: [
          {
            type: 'diagram_label',
            qNumberStart: 1,
            qNumberEnd: 2,
            questions: [
              { id: 32, number: 1, hint: 'Roof label', correctAnswer: 'dome' },
              { id: 33, number: 2, hint: 'Window label', correctAnswer: 'glass' },
            ],
          },
        ],
      },
    ]

    const result = recalcAllGroupNumbers(passages)
    const p1g1 = result[0].questionGroups[0]
    const p2g1 = result[1].questionGroups[0]

    expect(p1g1.qNumberStart).toBe(1)
    expect(p1g1.qNumberEnd).toBe(2)
    expect(p1g1.questions.map(q => q.number)).toEqual([1, 2])

    expect(p2g1.qNumberStart).toBe(3)
    expect(p2g1.qNumberEnd).toBe(4)
    expect(p2g1.questions.map(q => q.number)).toEqual([3, 4])
    expect(p2g1.questions.map(q => q.id)).toEqual([32, 33])
  })

  it('handles drag_word_bank and preserves order of tokens appearing in text', () => {
    const passages = [
      {
        number: 1,
        questionGroups: [
          {
            type: 'drag_word_bank',
            qNumberStart: 1,
            qNumberEnd: 2,
            noteSections: [
              {
                title: 'Summary',
                lines: [
                  { content: 'Later [Q:10] and earlier [Q:4]' },
                ],
              },
            ],
            questions: [
              { id: 40, number: 4, correctAnswer: 'early' },
              { id: 41, number: 10, correctAnswer: 'late' },
            ],
          },
        ],
      },
    ]

    const result = recalcAllGroupNumbers(passages)
    const g = result[0].questionGroups[0]

    expect(g.qNumberStart).toBe(1)
    expect(g.qNumberEnd).toBe(2)
    // Token 10 appears first -> mapped to 1. Token 4 appears second -> mapped to 2.
    expect(g.noteSections[0].lines[0].content).toBe('Later [Q:1] and earlier [Q:2]')
    // Question 10 (late) is now 1, Question 4 (early) is now 2
    expect(g.questions).toEqual([
      { id: 41, number: 1, correctAnswer: 'late' },
      { id: 40, number: 2, correctAnswer: 'early' },
    ])
  })

  it('recalcAllListeningNumbers is an alias of recalcAllGroupNumbers and works identically', () => {
    expect(recalcAllListeningNumbers).toBe(recalcAllGroupNumbers)
  })
})
