import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  attempt: { findFirst: vi.fn() },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const app = require('../server')

describe('Result Detail Answer Mapping to Letters (BUG-MCQ-DISPLAY)', () => {
  const getTestToken = (userId = 1) =>
    jwt.sign({ userId, email: 'student@example.com', role: 'user' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test_secret_key'
  })

  it('maps MCQ option text to single letter (A, B, C, D) and retains raw text', async () => {
    const mockExam = {
      title: 'Cambridge 19 Test 3 Reading',
      seriesId: 1,
      bookNumber: 19,
      testNumber: 3,
      series: { name: 'Cambridge' },
      passages: [
        {
          id: 1,
          number: 3,
          questions: [],
          questionGroups: [
            {
              id: 192,
              type: 'mcq',
              qNumberStart: 26,
              qNumberEnd: 27,
              maxChoices: 1,
              questions: [
                {
                  id: 1087,
                  number: 26,
                  type: 'mcq',
                  questionText: 'What does the reader learn?',
                  options: JSON.stringify([
                    'The speakers are communicating in different languages.',
                    'Neither of the speakers is familiar with their environment.',
                    'The topic of the conversation is difficult for both speakers.',
                    'Aspects of the conversation are challenging for both speakers.'
                  ]),
                  correctAnswer: 'Aspects of the conversation are challenging for both speakers.'
                },
                {
                  id: 1088,
                  number: 27,
                  type: 'mcq',
                  questionText: 'What assists the electronic translator?',
                  options: JSON.stringify([
                    'the repeated content of lectures',
                    "the students' reading skills",
                    'the languages used',
                    "the lecturers' technical ability"
                  ]),
                  correctAnswer: 'the repeated content of lectures'
                }
              ]
            }
          ]
        }
      ]
    }

    prismaMock.exam.findUnique.mockResolvedValue(mockExam)
    prismaMock.attempt.findFirst.mockResolvedValue({
      id: 372,
      score: 6.0,
      questionAnswers: [
        {
          questionId: 1087,
          userAnswer: 'The speakers are communicating in different languages.',
          isCorrect: false
        },
        {
          questionId: 1088,
          userAnswer: "the students' reading skills",
          isCorrect: false
        }
      ]
    })

    const token = getTestToken(1)
    const res = await request(app)
      .get('/api/reading/exams/20/result-detail?attemptId=372')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const q26 = res.body.sections[0].questions.find(q => q.number === 26)
    expect(q26).toBeDefined()
    // userAnswer should be mapped to 'A' (index 0)
    expect(q26.userAnswer).toBe('A')
    // correctAnswer should be mapped to 'D' (index 3)
    expect(q26.correctAnswer).toBe('D')
    // raw values are preserved
    expect(q26.rawUserAnswer).toBe('The speakers are communicating in different languages.')
    expect(q26.rawCorrectAnswer).toBe('Aspects of the conversation are challenging for both speakers.')
    // options array and type are included
    expect(Array.isArray(q26.options)).toBe(true)
    expect(q26.options).toHaveLength(4)
    expect(q26.type).toBe('mcq')

    const q27 = res.body.sections[0].questions.find(q => q.number === 27)
    expect(q27).toBeDefined()
    // userAnswer: "the students' reading skills" is index 1 -> 'B'
    expect(q27.userAnswer).toBe('B')
    // correctAnswer: "the repeated content of lectures" is index 0 -> 'A'
    expect(q27.correctAnswer).toBe('A')
  })

  it('preserves non-MCQ text answers without modification', async () => {
    const mockExam = {
      title: 'Cambridge 19 Test 3 Reading',
      seriesId: 1,
      bookNumber: 19,
      testNumber: 3,
      series: { name: 'Cambridge' },
      passages: [
        {
          id: 1,
          number: 1,
          questions: [
            {
              id: 101,
              number: 1,
              type: 'fill_blank',
              questionText: 'Complete the note',
              options: null,
              correctAnswer: 'DW30 7YZ/DW307YZ'
            }
          ],
          questionGroups: []
        }
      ]
    }

    prismaMock.exam.findUnique.mockResolvedValue(mockExam)
    prismaMock.attempt.findFirst.mockResolvedValue({
      id: 372,
      score: 5.0,
      questionAnswers: [
        {
          questionId: 101,
          userAnswer: 'dw30 7yz',
          isCorrect: true
        }
      ]
    })

    const token = getTestToken(1)
    const res = await request(app)
      .get('/api/reading/exams/20/result-detail?attemptId=372')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const q1 = res.body.sections[0].questions.find(q => q.number === 1)
    expect(q1.userAnswer).toBe('dw30 7yz')
    expect(q1.correctAnswer).toBe('DW30 7YZ/DW307YZ')
  })
})
