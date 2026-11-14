import { redactRunTechnical } from './explanationRunReport'

export const EXPLANATION_ATTENTION_LABELS = Object.freeze({
  draft_ready: 'Chờ duyệt',
  conflict_pending: 'Cần kiểm tra',
  needs_regeneration: 'Cần kiểm tra',
  possibly_stale: 'Nội dung đã đổi',
})

export function getExplanationAttention(explanation, runStatus = null, runIssue = null) {
  const status = explanation?.status
  if (status === 'conflict_pending') return {
    title: 'Cần kiểm tra', action: 'edit',
    reason: 'Lời giải cũ đang giải thích một đáp án khác đáp án trong đề.',
    hint: 'Sửa lời giải theo đáp án đề hoặc tạo bản nháp mới. AI không thay đổi đáp án đề.',
  }
  if (status === 'needs_regeneration') return {
    title: EXPLANATION_ATTENTION_LABELS[status], action: 'edit',
    reason: redactRunTechnical(explanation.validationIssue || explanation.needsRegenerationReason || explanation.supportNote
      || (explanation.no_support ? 'Chưa tìm thấy bằng chứng phù hợp với đáp án đã chọn.'
        : 'Lời giải chưa được xác nhận phù hợp với đáp án hiện tại.')),
    hint: 'Đối chiếu dữ liệu và sửa lời giải trước khi sử dụng. Chưa hiển thị cho học sinh.',
  }
  if (status === 'possibly_stale') return {
    title: EXPLANATION_ATTENTION_LABELS[status], action: 'edit',
    reason: redactRunTechnical(explanation.staleReason || 'Nội dung câu hỏi đã thay đổi sau khi tạo lời giải.'),
    hint: 'Kiểm tra lời giải theo nội dung hiện tại. Chưa hiển thị cho học sinh.',
  }
  if (runStatus === 'retry') return {
    title: 'Cần kiểm tra', action: 'edit',
    reason: redactRunTechnical(runIssue?.message || 'Kết quả AI mới chưa được kiểm chứng. Lời giải đã lưu trước đó được giữ nguyên.'),
    hint: 'Đối chiếu bằng chứng trước khi sử dụng kết quả mới.',
  }
  return null
}
