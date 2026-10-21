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
})
