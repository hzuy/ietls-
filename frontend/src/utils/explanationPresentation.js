import { redactRunTechnical } from './explanationRunReport'

export const EXPLANATION_ATTENTION_LABELS = Object.freeze({
  draft_ready: 'Chờ duyệt',
  conflict_pending: 'Cần kiểm tra',
  needs_regeneration: 'Cần kiểm tra',
  possibly_stale: 'Nội dung đã đổi',
})

export function getExplanationAttention(explanation, runStatus = null, runIssue = null) {
  const status = explanation?.status
  const issue = runStatus === 'retry' && runIssue?.code ? runIssue : explanation?.contentIssue
  const reason = redactRunTechnical(issue?.message || runIssue?.message || explanation?.validationIssue || explanation?.needsRegenerationReason || explanation?.supportNote || '')
  if (issue?.code === 'TRANSLATION_INVALID' || /bản dịch|translation/i.test(reason)) return {
    title: 'Cần sửa bản dịch', action: 'edit_translation',
    reason: reason || 'Bản dịch tiếng Việt chưa hợp lệ.',
    hint: 'Sửa bản dịch theo câu tiếng Anh rồi lưu bản nháp để kiểm tra lại.',
  }
  if (['MISSING_EVIDENCE', 'MISSING_DATA', 'QUESTION_CONTEXT_MISMATCH', 'QUESTION_CONTEXT_MISSING', 'ANSWER_NOT_IN_SOURCE'].includes(issue?.code)) return {
    title: 'Cần kiểm tra', action: issue?.action || (issue?.code === 'QUESTION_CONTEXT_MISMATCH' ? 'retry_generation' : 'edit_source'),
    reason: reason || 'Chưa tìm thấy bằng chứng phù hợp với đáp án đề.',
    hint: 'Đối chiếu bài đọc hoặc transcript với đáp án đề. Bổ sung dữ liệu hoặc sửa lời giải trước khi sử dụng.',
  }
  if (status === 'conflict_pending') return {
    title: 'Cần kiểm tra', action: 'edit',
    reason: 'Lời giải cũ đang giải thích một đáp án khác đáp án trong đề.',
    hint: 'Nếu đáp án đề đúng, sửa lời giải hoặc tạo lại theo đáp án đề. Nếu đáp án đề sai, quay lại sửa đề và lưu trước.',
  }
  if (status === 'needs_regeneration') return {
    title: EXPLANATION_ATTENTION_LABELS[status], action: 'edit',
    reason: redactRunTechnical(issue?.message || explanation.validationIssue || explanation.needsRegenerationReason || explanation.supportNote
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
    title: 'Cần kiểm tra', action: runIssue?.action || 'edit',
    reason: redactRunTechnical(runIssue?.message || 'Kết quả AI mới chưa được kiểm chứng. Lời giải đã lưu trước đó được giữ nguyên.'),
    hint: 'Đối chiếu bằng chứng trước khi sử dụng kết quả mới.',
  }
  return null
}
