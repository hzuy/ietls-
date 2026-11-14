import { redactRunTechnical } from './explanationRunReport'

export const EXPLANATION_ATTENTION_LABELS = Object.freeze({
  conflict_pending: 'Chờ xác nhận',
  needs_regeneration: 'Cần kiểm tra',
  possibly_stale: 'Nội dung đã đổi',
})

export function getExplanationAttention(explanation, runStatus = null, runIssue = null) {
  const status = explanation?.status
  if (status === 'conflict_pending') return {
    title: EXPLANATION_ATTENTION_LABELS[status], action: 'confirm',
    reason: 'Đáp án AI đề xuất khác đáp án trong đề.',
    hint: 'Chọn đáp án trước khi sử dụng lời giải. Chưa hiển thị cho học sinh.',
  }
  if (status === 'needs_regeneration') return {
    title: EXPLANATION_ATTENTION_LABELS[status], action: 'edit',
    reason: redactRunTechnical(explanation.needsRegenerationReason || explanation.supportNote
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
