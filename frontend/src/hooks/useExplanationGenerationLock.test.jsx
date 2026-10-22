import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useExplanationGenerationLock } from './useExplanationGenerationLock'
import api from '../utils/axios'

vi.mock('../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

const EVIDENCE_KEY = 'ai_exp_evidence_exam_1'

// Đề đã sinh 1/5 câu: còn 4 câu chưa có giải thích → có banner nhắc.
const SERVER_STATUS = {
  isLocked: false,
  generatedCount: 1,
  totalQuestions: 5,
  unprocessedCount: 4,
  processedCount: 1,
  unprocessedQuestionNumbers: [2, 3, 4, 5]
}

describe('useExplanationGenerationLock — banner nháp/bằng chứng không bị stale', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: SERVER_STATUS })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('xóa bằng chứng xong thì banner hết "Lần sinh trước chưa hoàn tất" (không dùng memo cũ)', async () => {
    // Phiên trước bị dừng giữa chừng → còn bằng chứng trong localStorage.
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify({ startedAt: Date.now(), total: 5 }))

    const { result } = renderHook(() =>
      useExplanationGenerationLock({ examId: 1, type: 'exam', skill: 'reading' })
    )

    await waitFor(() => expect(result.current.resumeBanner?.variant).toBe('interrupted'))

    // Lần sinh này hoàn tất → hook xóa bằng chứng.
    await act(async () => {
      result.current.endLocalGeneration({ completed: true })
    })
    expect(localStorage.getItem(EVIDENCE_KEY)).toBeNull()

    // Không còn bằng chứng → phải là banner trung tính, không phải "chưa hoàn tất".
    await waitFor(() => expect(result.current.resumeBanner?.variant).toBe('unprocessed'))
  })

  it('hủy giữa chừng (bằng chứng còn) thì vẫn giữ banner "Lần sinh trước chưa hoàn tất"', async () => {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify({ startedAt: Date.now(), total: 5 }))

    const { result } = renderHook(() =>
      useExplanationGenerationLock({ examId: 1, type: 'exam', skill: 'reading' })
    )

    await waitFor(() => expect(result.current.resumeBanner?.variant).toBe('interrupted'))

    await act(async () => {
      result.current.endLocalGeneration({ completed: false, cancelled: true })
    })

    expect(localStorage.getItem(EVIDENCE_KEY)).not.toBeNull()
    expect(result.current.resumeBanner?.variant).toBe('interrupted')
  })

  it('khi vào lại lúc server đang chạy: banner running có tiến độ và tự mở khóa sau khi server xong', async () => {
    const locked = {
      isLocked: true,
      generatedCount: 3,
      totalQuestions: 10,
      unprocessedCount: 7,
      unprocessedQuestionNumbers: [4, 5, 6, 7, 8, 9, 10],
    }
    const unlocked = {
      isLocked: false,
      generatedCount: 10,
      totalQuestions: 10,
      unprocessedCount: 0,
      unprocessedQuestionNumbers: [],
    }
    let currentStatus = locked
    api.get.mockImplementation(() => Promise.resolve({ data: currentStatus }))

    const { result } = renderHook(() =>
      useExplanationGenerationLock({ examId: 1, type: 'exam', skill: 'reading' })
    )

    await waitFor(() => expect(result.current.isServerRunning).toBe(true))
    expect(result.current.resumeBanner).toMatchObject({ variant: 'running', current: 3, total: 10 })

    // Server hoàn tất → polling (50ms trong test env) thấy khóa đã nhả và mở
    // khóa nút ngay, không cần F5.
    currentStatus = unlocked
    await waitFor(() => expect(result.current.isServerRunning).toBe(false), { timeout: 2000 })
    expect(result.current.isLockedOperation).toBe(false)
  })

  it('abort request sinh AI đang chạy và dọn heartbeat khi component unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useExplanationGenerationLock({ examId: 1, type: 'exam', skill: 'reading' })
    )
    await waitFor(() => expect(result.current.isCheckingStatus).toBe(false))

    const controller = new AbortController()
    await act(async () => {
      await result.current.startLocalGeneration({ abortController: controller, total: 10, current: 0 })
    })

    expect(controller.signal.aborted).toBe(false)
    expect(localStorage.getItem('ai_exp_active_exam_1')).not.toBeNull()

    unmount()

    // Rời trang khi AI còn chạy: request bị abort để server dừng ghi và nhả khóa
    expect(controller.signal.aborted).toBe(true)
    expect(localStorage.getItem('ai_exp_active_exam_1')).toBeNull()
  })
})
