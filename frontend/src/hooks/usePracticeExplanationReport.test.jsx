import { it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePracticeExplanationReport } from './usePracticeExplanationReport'
import { makeRunReportKey } from '../utils/explanationRunReport'

it('clears a saved question review flag without clearing another question error', () => {
  const { result } = renderHook(() => usePracticeExplanationReport({ skill: 'reading', practiceId: 10, enabled: true }))
  act(() => result.current.start([1, 2]))
  act(() => result.current.finish({ totalGenerated: 1, needsRetryQuestions: [{ number: 1, reason: 'Unverified' }], errors: [{ number: 2, message: 'timeout' }] }))
  expect(result.current.statuses[1]).toBe('retry')
  act(() => result.current.acknowledgeSaved(1))
  expect(result.current.statuses[1]).toBeUndefined()
  expect(result.current.statuses[2]).toBe('error')
  expect(result.current.report.needsRetry).toEqual([])
  expect(result.current.report.rows).toHaveLength(1)
})

it.each(['reading', 'listening'])('starts a fresh %s report after returning to practice', skill => {
  const key = makeRunReportKey(`practice_${skill}`, 10)
  sessionStorage.setItem(key, JSON.stringify({ status: 'running', rows: [{ number: 1 }], savedAt: Date.now() }))
  const props = { practiceId: 10, skill, enabled: true }
  const first = renderHook(() => usePracticeExplanationReport(props))
  expect(first.result.current.report).toBeNull()
  expect(first.result.current.statuses).toEqual({})
  expect(sessionStorage.getItem(key)).toBeNull()
  act(() => first.result.current.start([1, 2]))
  expect(first.result.current.report).not.toBeNull()
  first.unmount()
  const next = renderHook(() => usePracticeExplanationReport(props))
  expect(next.result.current.report).toBeNull()
  expect(next.result.current.statuses).toEqual({})
})
