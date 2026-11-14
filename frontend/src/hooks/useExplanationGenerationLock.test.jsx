import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useExplanationGenerationLock } from './useExplanationGenerationLock'
import api from '../utils/axios'
vi.mock('../utils/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(cleanup)

it.each(['exam', 'practice'])('opens %s as a fresh visit without restoring or polling a previous run', type => {
  const key = `${type}_1`
  localStorage.setItem(`ai_exp_active_${key}`, JSON.stringify({ isRunning: true, tabId: 'old-tab', lastHeartbeat: Date.now(), current: 0, total: 38 }))
  localStorage.setItem(`ai_exp_evidence_${key}`, '{}')
  const { result } = renderHook(() => useExplanationGenerationLock({ examId: 1, type }))
  expect(result.current.resumeBanner).toBeNull()
  expect(result.current.isLockedOperation).toBe(false)
  expect(result.current.isLockedGenerate).toBe(false)
  expect(api.get).not.toHaveBeenCalled()
  expect(localStorage.getItem(`ai_exp_active_${key}`)).toBeNull()
  expect(localStorage.getItem(`ai_exp_evidence_${key}`)).toBeNull()
})

it('locks only the current generation and resets progress when it ends', async () => {
  const { result } = renderHook(() => useExplanationGenerationLock({ examId: 1, type: 'exam' }))
  await act(async () => result.current.startLocalGeneration({ abortController: new AbortController(), total: 38 }))
  expect(result.current.isLockedGenerate).toBe(true)
  act(() => result.current.updateLocalProgress({ current: 2, total: 38 }))
  expect(result.current.localProgress.current).toBe(2)
  act(() => result.current.endLocalGeneration({ cancelled: true }))
  expect(result.current.isLockedGenerate).toBe(false)
  expect(result.current.localProgress).toBeNull()
  expect(result.current.resumeBanner).toBeNull()
  expect(localStorage.getItem('ai_exp_active_exam_1')).toBeNull()
})

it('aborts on leave and opens the same exam as a new visit', async () => {
  const first = renderHook(() => useExplanationGenerationLock({ examId: 1, type: 'exam' }))
  const controller = new AbortController()
  await act(async () => first.result.current.startLocalGeneration({ abortController: controller, total: 38 }))
  first.unmount()
  expect(controller.signal.aborted).toBe(true)
  const next = renderHook(() => useExplanationGenerationLock({ examId: 1, type: 'exam' }))
  expect(next.result.current.isLockedGenerate).toBe(false)
  expect(next.result.current.localProgress).toBeNull()
})

it('aborts and clears local progress when changing the edited exam', async () => {
  const { result, rerender } = renderHook(({ id }) => useExplanationGenerationLock({ examId: id, type: 'exam' }), { initialProps: { id: 1 } })
  const controller = new AbortController()
  await act(async () => result.current.startLocalGeneration({ abortController: controller, total: 38 }))
  rerender({ id: 2 })
  expect(controller.signal.aborted).toBe(true)
  expect(result.current.isLockedOperation).toBe(false)
  expect(result.current.localProgress).toBeNull()
})

it('confirms exit by aborting the current request before navigation', async () => {
  const { result } = renderHook(() => useExplanationGenerationLock({ examId: 1 }))
  const controller = new AbortController()
  const navigate = vi.fn(() => expect(controller.signal.aborted).toBe(true))
  await act(async () => result.current.startLocalGeneration({ abortController: controller }))
  act(() => result.current.handleSafeActionOrExit(navigate))
  expect(navigate).not.toHaveBeenCalled()
  act(() => result.current.confirmExit())
  expect(navigate).toHaveBeenCalledOnce()
  expect(result.current.isLockedOperation).toBe(false)
})
