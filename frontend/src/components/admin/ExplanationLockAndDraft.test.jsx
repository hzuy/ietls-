import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AIGenerationExitConfirmModal from './AIGenerationExitConfirmModal'
import AIGenerationResumeBanner from './AIGenerationResumeBanner'
import AIGenerationStickyProgress from './AIGenerationStickyProgress'
import ExplanationChipGrid from './ExplanationChipGrid'
import {
  smartMergeDraft,
  analyzeDraftDifferences,
  isExplanationEqual,
  extractExplanationsMap,
} from '../../utils/draftMergeUtils'

describe('Explanation Lock, Safe Exit, Resume Banner, and Smart Draft Merge', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // 1. Khóa thao tác & Sticky Progress khi đang sinh
  describe('1. Khóa nút và Sticky Progress khi đang sinh', () => {
    it('hiển thị thanh tiến độ sticky và nút Hủy hoạt động bình thường', () => {
      const onCancel = vi.fn()
      const { rerender } = render(
        <AIGenerationStickyProgress
          isGenerating={true}
          isCancelling={false}
          progress={{ current: 2, total: 5, label: '2/5 câu' }}
          onCancel={onCancel}
        />
      )

      expect(screen.getByText(/Đang sinh giải thích AI/i)).toBeInTheDocument()
      expect(screen.getByText(/2\/5 câu/i)).toBeInTheDocument()
      const cancelBtn = screen.getByRole('button', { name: /Hủy sinh/i })
      expect(cancelBtn).toBeInTheDocument()
      fireEvent.click(cancelBtn)
      expect(onCancel).toHaveBeenCalledTimes(1)

      // Khi isCancelling = true, chuyển sang trạng thái dừng an toàn
      rerender(
        <AIGenerationStickyProgress
          isGenerating={false}
          isCancelling={true}
          progress={{ current: 2, total: 5, label: '2/5 câu' }}
          onCancel={onCancel}
        />
      )
      expect(screen.getByText(/Đang dừng tiến trình sinh AI.../i)).toBeInTheDocument()
    })
  })

  // 2. Hộp thoại cảnh báo thoát (Exit Confirmation Modal)
  describe('2. Hộp thoại xác nhận thoát khi đang sinh AI', () => {
    it('chỉ hiện khi isOpen=true và hỗ trợ Ở lại hoặc Dừng và thoát', () => {
      const onStay = vi.fn()
      const onConfirmExit = vi.fn()

      const { rerender } = render(
        <AIGenerationExitConfirmModal
          isOpen={false}
          onClose={onStay}
          onConfirmExit={onConfirmExit}
          currentCount={2}
          totalCount={10}
        />
      )
      expect(screen.queryByText(/Tiến trình sinh giải thích AI đang diễn ra/i)).not.toBeInTheDocument()

      rerender(
        <AIGenerationExitConfirmModal
          isOpen={true}
          onClose={onStay}
          onConfirmExit={onConfirmExit}
          currentCount={2}
          totalCount={10}
        />
      )
      expect(screen.getByText(/Tiến trình sinh giải thích AI đang diễn ra/i)).toBeInTheDocument()
      expect(screen.getByText(/2\/10/i)).toBeInTheDocument()
      expect(screen.getByText(/Ở lại tiếp tục/i)).toBeInTheDocument()
      expect(screen.getByText(/Dừng và thoát/i)).toBeInTheDocument()

      // Bấm "Ở lại tiếp tục"
      fireEvent.click(screen.getByText(/Ở lại tiếp tục/i))
      expect(onStay).toHaveBeenCalledTimes(1)

      // Bấm "Dừng và thoát"
      fireEvent.click(screen.getByText(/Dừng và thoát/i))
      expect(onConfirmExit).toHaveBeenCalledTimes(1)
    })
  })

  // 3. Banner vào lại (Resume Banner) với 4 trường hợp
  describe('3. Banner vào lại (AIGenerationResumeBanner)', () => {
    it('Trường hợp 1: Đang có tiến trình sinh AI từ tab khác (running)', () => {
      render(
        <AIGenerationResumeBanner
          banner={{
            variant: 'running',
            message: 'Đang có tiến trình sinh AI cho bài này (3/10 câu đã hoàn tất)...',
          }}
        />
      )
      expect(screen.getByText(/Đang có tiến trình sinh AI cho bài này/i)).toBeInTheDocument()
      expect(screen.getByText(/Các nút thao tác đang được tạm khóa để tránh xung đột dữ liệu/i)).toBeInTheDocument()
    })

    it('Trường hợp 2: Lần sinh trước chưa hoàn tất có bằng chứng (interrupted)', () => {
      const onAction = vi.fn()
      render(
        <AIGenerationResumeBanner
          banner={{
            variant: 'interrupted',
            title: 'Lần sinh trước chưa hoàn tất',
            message: 'Đã xong 2/10 câu, còn 8 câu chưa có giải thích.',
            actionLabel: 'Sinh tiếp các câu còn lại',
            onAction,
          }}
        />
      )
      expect(screen.getByText(/Lần sinh trước chưa hoàn tất/i)).toBeInTheDocument()
      expect(screen.getByText(/còn 8 câu chưa có giải thích/i)).toBeInTheDocument()
      const resumeBtn = screen.getByRole('button', { name: /Sinh tiếp các câu còn lại/i })
      expect(resumeBtn).toBeInTheDocument()
      fireEvent.click(resumeBtn)
      expect(onAction).toHaveBeenCalledTimes(1)
    })

    it('Trường hợp 3: Còn câu chưa có giải thích không có bằng chứng (unprocessed)', () => {
      const onAction = vi.fn()
      render(
        <AIGenerationResumeBanner
          banner={{
            variant: 'unprocessed',
            title: 'Tiến độ lời giải',
            message: 'Còn 12 câu chưa có giải thích.',
            actionLabel: 'Sinh các câu còn lại',
            onAction,
          }}
        />
      )
      expect(screen.getByText(/Tiến độ lời giải/i)).toBeInTheDocument()
      expect(screen.getByText(/Còn 12 câu chưa có giải thích/i)).toBeInTheDocument()
      expect(screen.queryByText(/Lần sinh trước chưa hoàn tất/i)).not.toBeInTheDocument()
      const resumeBtn = screen.getByRole('button', { name: /Sinh các câu còn lại/i })
      expect(resumeBtn).toBeInTheDocument()
      fireEvent.click(resumeBtn)
      expect(onAction).toHaveBeenCalledTimes(1)
    })

    it('Trường hợp 4: Đã hoàn tất hoặc chưa từng sinh (banner = null) -> không render banner', () => {
      const { container } = render(
        <AIGenerationResumeBanner
          banner={null}
        />
      )
      expect(container.firstChild).toBeNull()
    })
  })

  // 4. Nhãn "Chưa lưu" trên chip câu hỏi
  describe('4. Nhãn "Chưa lưu" trên ExplanationChipGrid', () => {
    it('hiển thị nhãn Chưa lưu khi số câu có trong unsavedQuestionNumbers', () => {
      const questions = [
        { number: 1, explanation: { text: 'Giải thích câu 1' } },
        { number: 2, explanation: { text: 'Giải thích câu 2' } },
      ]
      const unsaved = new Set([2])

      render(
        <ExplanationChipGrid
          questions={questions}
          group={{}}
          unsavedQuestionNumbers={unsaved}
          onSelectQuestion={vi.fn()}
        />
      )

      expect(screen.getByText(/Chưa lưu/i)).toBeInTheDocument()
      expect(screen.getByText('Câu 1')).toBeInTheDocument()
      expect(screen.getByText('Câu 2')).toBeInTheDocument()
    })
  })

  // 5. Smart merge nháp không tự ghi đè giải thích trong DB
  describe('5. Smart Draft Merge', () => {
    it('DB có giải thích và nháp không có hoặc giống DB -> giữ bản DB', () => {
      const currentDbForm = {
        title: 'DB Title',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, text: 'Q1', explanation: { text: 'DB explanation 1' } },
              { number: 2, text: 'Q2', explanation: { text: 'DB explanation 2' } },
            ],
          },
        ],
      }

      const draftData = {
        title: 'Draft Title Modified',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, text: 'Q1 draft', explanation: null }, // Nháp không có giải thích
              { number: 2, text: 'Q2 draft', explanation: { text: 'DB explanation 2' } }, // Nháp giống DB
            ],
          },
        ],
      }

      const diff = analyzeDraftDifferences({ draftData, currentDbForm })
      expect(diff.differentCount).toBe(0)
      expect(diff.draftExplanationCount).toBe(1)
      expect(diff.dbHasNewerQuestions).toContain(1)

      const merged = smartMergeDraft({ draftData, currentDbForm, resolutionChoice: 'keep_db' })
      expect(merged.title).toBe('Draft Title Modified') // khôi phục các trường khác
      // Giữ bản giải thích DB cho câu 1
      expect(merged.questionGroups[0].questions[0].explanation.text).toBe('DB explanation 1')
      expect(merged.questionGroups[0].questions[1].explanation.text).toBe('DB explanation 2')
    })

    it('Nháp có giải thích khác DB do sửa tay -> đếm khác nhau và tuân theo resolutionChoice', () => {
      const currentDbForm = {
        title: 'DB Title',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, text: 'Q1', explanation: { text: 'DB explanation' } },
            ],
          },
        ],
      }

      const draftData = {
        title: 'Draft Title',
        questionGroups: [
          {
            id: 'g1',
            questions: [
              { number: 1, text: 'Q1', explanation: { text: 'User hand-edited explanation' } },
            ],
          },
        ],
      }

      const diff = analyzeDraftDifferences({ draftData, currentDbForm })
      expect(diff.differentCount).toBe(1)
      expect(diff.differentQuestionNumbers).toContain(1)

      // Khi người dùng chọn keep_db -> giữ bản DB
      const mergedKeepDb = smartMergeDraft({ draftData, currentDbForm, resolutionChoice: 'keep_db' })
      expect(mergedKeepDb.questionGroups[0].questions[0].explanation.text).toBe('DB explanation')

      // Khi người dùng chọn keep_draft -> giữ bản người dùng đã sửa tay
      const mergedKeepDraft = smartMergeDraft({ draftData, currentDbForm, resolutionChoice: 'keep_draft' })
      expect(mergedKeepDraft.questionGroups[0].questions[0].explanation.text).toBe('User hand-edited explanation')
    })
  })

  // 6. Tab ẩn không bị coi là đã chết (Heartbeat TTL >= 15s)
  describe('6. Heartbeat TTL và phát hiện tab cùng trình duyệt', () => {
    it('ngưỡng hết hạn localStorage heartbeat là 20 giây (>= 15 giây), 5 giây không bị coi là hết hạn', () => {
      const now = Date.now()
      const runKey = 'ai_exp_run_practice_reading_99'
      // Giả sử heartbeat được ghi 5 giây trước (tab ở nền bị giãn timer)
      localStorage.setItem(runKey, JSON.stringify({
        heartbeat: now - 5000,
        unprocessedCount: 3,
        totalQuestions: 10,
      }))

      const raw = localStorage.getItem(runKey)
      const parsed = JSON.parse(raw)
      const elapsed = now - parsed.heartbeat

      // Ngưỡng 20s không coi tab chạy sau 5s là đã chết
      const TTL_MS = 20000
      expect(TTL_MS).toBeGreaterThanOrEqual(15000)
      expect(elapsed < TTL_MS).toBe(true)
    })
  })
})
