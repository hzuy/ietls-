'use strict'

function compactInstruction({ extraCompact = false } = {}) {
  return `GIỚI HẠN ĐẦU RA BẮT BUỘC${extraCompact ? ' — LƯỢT RÚT GỌN SAU KHI PHẢN HỒI BỊ CẮT' : ''}:
- Chỉ một câu hỏi, không lặp ý hay lặp từ. reasoning tối đa ${extraCompact ? 2 : 3} câu và ${extraCompact ? 350 : 600} ký tự.
- question_chunks tối đa ${extraCompact ? 3 : 6} mục; locate_keywords tối đa ${extraCompact ? 2 : 3}; evidence_chunks tối đa ${extraCompact ? 2 : 4}; paraphrases tối đa ${extraCompact ? 1 : 3}; distractors tối đa ${extraCompact ? 1 : 2} và chỉ khi đề có lựa chọn.
- evidence_quote chỉ 1–2 câu nguyên văn cần thiết (tối đa 600 ký tự); không cắt/sửa câu trích rồi giả làm nguyên văn.
- predict và locate_note mỗi trường tối đa 180 ký tự; full_sentence và translation mỗi trường tối đa 300 ký tự; label tối đa 80 ký tự.
- Câu điền từ có bằng chứng: bắt buộc có full_sentence và bản dịch tiếng Việt có dấu. Nếu thiếu bằng chứng, no_support=true với support_note ngắn; không bịa nội dung để điền đủ các trường.
- Kết thúc đầy đủ JSON; bỏ các mục phân tích không cần thiết thay vì viết dài.`
}

function compactSchema(schema, { extraCompact = false } = {}) {
  const result = structuredClone(schema)
  const arrays = { question_chunks: extraCompact ? 3 : 6, locate_keywords: extraCompact ? 2 : 3,
    evidence_chunks: extraCompact ? 2 : 4, paraphrases: extraCompact ? 1 : 3, distractors: extraCompact ? 1 : 2 }
  const lengths = { reasoning: extraCompact ? 350 : 600, evidence_quote: 600, predict: 180, locate_note: 180,
    full_sentence: 300, translation: 300, support_note: 300, answer: 200, label: 80 }
  function visit(node, key = '') {
    if (node.type === 'ARRAY' && arrays[key] != null) node.maxItems = Math.min(Number(node.maxItems ?? arrays[key]), arrays[key])
    // Gemini's schema subset is not relied on to enforce string maxLength.
    // Keep explicit field instructions, plus local validation and a hard token budget.
    if (node.type === 'STRING') node.description = `${node.description || ''} Tối đa ${lengths[key] || 160} ký tự; ngắn gọn, không lặp.`.trim()
    for (const [name, child] of Object.entries(node.properties || {})) visit(child, name)
    if (node.items) visit(node.items, key)
  }
  visit(result)
  return result
}

module.exports = { compactInstruction, compactSchema }
