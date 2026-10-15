import { describe, it, expect } from 'vitest'
import { collectSubmissions, currentBands } from './currentBand'

const day = n => new Date(Date.UTC(2026, 9, n, 3))
const rl = (skill, score, correctCount, n) => ({ score, correctCount, finishedAt: day(n), exam: { skill } })

describe('currentBand', () => {
  it('ignores blank reading/listening submissions instead of averaging them in as zero', () => {
    const submissions = collectSubmissions({
      attempts: [
        rl('listening', 0, 0, 11),
        rl('listening', 0, 2, 6),
        rl('listening', 2.5, 4, 5),
        rl('reading', 0, 0, 6),
        rl('reading', 2.5, 5, 4),
      ],
    })
    const { bandBySkill } = currentBands(submissions)
    expect(bandBySkill.reading).toBe(2.5)
    expect(bandBySkill.listening).toBe(1.5)
  })

  it('averages only the most recent three valid submissions per skill', () => {
    const submissions = collectSubmissions({
      attempts: [rl('reading', 7, 30, 10), rl('reading', 6, 26, 9), rl('reading', 6.5, 28, 8), rl('reading', 3, 10, 1)],
    })
    expect(currentBands(submissions).bandBySkill.reading).toBe(6.5)
  })

  it('counts writing and speaking attempts from their answer tables, skipping zero-scored parts', () => {
    const at = (n, h) => new Date(Date.UTC(2026, 9, n, h))
    const submissions = collectSubmissions({
      writingAnswers: [
        { id: 1, taskId: 1, aiScore: 6, status: 'graded', createdAt: at(10, 1), task: { examId: 15 } },
        { id: 2, taskId: 2, aiScore: 7, status: 'graded', createdAt: at(10, 2), task: { examId: 15 } },
      ],
      speakingAnswers: [
        { id: 3, partId: 31, aiScore: 6.5, status: 'graded', createdAt: at(10, 3), part: { examId: 40, number: 1 } },
        { id: 4, partId: 32, aiScore: 0, status: 'graded', createdAt: at(10, 4), part: { examId: 40, number: 2 } },
        { id: 5, partId: 33, aiScore: 5.5, status: 'graded', createdAt: at(10, 5), part: { examId: 40, number: 3 } },
      ],
    })
    expect(submissions).toHaveLength(2)
    const { bandBySkill, avgBand } = currentBands(submissions)
    expect(bandBySkill.writing).toBe(6.5)
    expect(bandBySkill.speaking).toBe(6)
    expect(bandBySkill.reading).toBeNull()
    expect(avgBand).toBe(6.5)
  })

  it('returns no band for a skill whose submissions were all blank', () => {
    const submissions = collectSubmissions({ attempts: [rl('reading', 0, 0, 3)] })
    expect(submissions).toHaveLength(1)
    expect(currentBands(submissions)).toMatchObject({ bandBySkill: { reading: null }, avgBand: 0 })
  })
})

describe('loadSubmissionsByUser + bandSummary', () => {
  it('groups rows per user and summarises band, count and last submission', async () => {
    const { loadSubmissionsByUser, bandSummary } = await import('./currentBand')
    const prisma = {
      attempt: { findMany: async () => [
        { userId: 1, score: 6, correctCount: 25, finishedAt: day(5), exam: { skill: 'reading' } },
        { userId: 2, score: 0, correctCount: 0, finishedAt: day(4), exam: { skill: 'reading' } },
      ] },
      writingAnswer: { findMany: async () => [
        { id: 9, userId: 1, taskId: 1, aiScore: 7, status: 'graded', createdAt: day(6), task: { examId: 15 } },
      ] },
      speakingAnswer: { findMany: async () => [] },
    }
    const byUser = await loadSubmissionsByUser(prisma, [1, 2, 3])
    expect(bandSummary(byUser[1])).toMatchObject({ avgBand: 6.5, submissionCount: 2, bandBySkill: { reading: 6, writing: 7 } })
    expect(bandSummary(byUser[1]).lastSubmittedAt).toEqual(day(6))
    expect(bandSummary(byUser[2])).toMatchObject({ avgBand: null, submissionCount: 1 })
    expect(bandSummary(byUser[3])).toMatchObject({ avgBand: null, submissionCount: 0, lastSubmittedAt: null })
  })
})
