import { expect, it } from 'vitest'
import { getExplanationAttention } from './explanationPresentation'

it.each(['MISSING_DATA', 'QUESTION_CONTEXT_MISMATCH', 'QUESTION_CONTEXT_MISSING', 'ANSWER_NOT_IN_SOURCE'])('keeps the actual %s content reason separate from network failures', code => {
  const result = getExplanationAttention({ status: 'needs_regeneration', contentIssue: { code, message: 'Lời giải đang dùng dữ liệu của câu khác.' } })
  expect(result.reason).toBe('Lời giải đang dùng dữ liệu của câu khác.')
  expect(result.action).toBe(code === 'QUESTION_CONTEXT_MISMATCH' ? 'retry_generation' : 'edit_source')
})

it.each([
  { contentIssue: { code: 'TRANSLATION_INVALID', message: 'Bản dịch còn chứa tiếng Anh.' } },
  { validationIssue: 'Bản dịch chưa hợp lệ.' },
])('identifies translation repair without treating it as missing evidence', extra => {
  expect(getExplanationAttention({ status: 'needs_regeneration', ...extra })).toMatchObject({ title: 'Cần sửa bản dịch', action: 'edit_translation' })
})
it('keeps content issue metadata and its actual reason actionable', () => {
  expect(getExplanationAttention({ status: 'published' }, 'retry', { code: 'MISSING_EVIDENCE', action: 'edit_source', message: 'Transcript không chứng minh đáp án nine.' }))
    .toMatchObject({ reason: 'Transcript không chứng minh đáp án nine.', action: 'edit_source' })
})

it.each([
  ['needs_regeneration', { needsRegenerationReason: 'Không tìm thấy bằng chứng cho đáp án A' }, 'Không tìm thấy bằng chứng cho đáp án A'],
  ['needs_regeneration', { needsRegenerationReason: 'Lời giải chứa cụm từ nội bộ' }, 'Lời giải chứa cụm từ nội bộ'],
  ['needs_regeneration', { no_support: true }, 'Chưa tìm thấy bằng chứng phù hợp với đáp án đã chọn.'],
  ['possibly_stale', { staleReason: 'Đoạn văn đã thay đổi' }, 'Đoạn văn đã thay đổi'],
])('shows the actual reason for %s', (status, extra, reason) => {
  const info = getExplanationAttention({ status, ...extra })
  expect(info.reason).toBe(reason)
  expect(info.action).toBe('edit')
})
it('makes a saved answer conflict actionable without presenting it as a provider error', () => {
  expect(getExplanationAttention({ status: 'conflict_pending' })).toMatchObject({ title: 'Cần kiểm tra', action: 'edit' })
})
it('does not claim that a retained approved explanation is hidden after a fallback attempt', () => {
  const info = getExplanationAttention({ status: 'teacher_reviewed' }, 'retry', { message: 'Chưa kiểm chứng được kết quả dự phòng' })
  expect(info.reason).toBe('Chưa kiểm chứng được kết quả dự phòng')
  expect(info.hint).not.toContain('Chưa hiển thị')
})
it('does not show an attention banner for a valid saved explanation', () => {
  expect(getExplanationAttention({ status: 'teacher_edited' })).toBeNull()
})
