/**
 * Highlight rendering cho passage Reading (kiểu IELTS on Computer của IDP/BC):
 * text được lưu dưới dạng offset ký tự trong từng đoạn văn (không thao tác DOM trực
 * tiếp) nên tương thích an toàn với reconciliation của React — mỗi lần render lại
 * chỉ cần biết đoạn văn nào (`paraIndex`) và khoảng ký tự nào (`start`/`end`) cần bọc
 * trong <mark>.
 */

/** Tính offset ký tự tuyệt đối của (node, offset) trong `container`, dựa trên text node. */
export function getOffsetWithinElement(container, node, offset) {
  if (!container || !node) return null
  let total = 0
  let found = null
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let current = walker.nextNode()
  while (current) {
    if (current === node) {
      found = total + offset
      break
    }
    total += current.textContent.length
    current = walker.nextNode()
  }
  return found
}

/** Render `text` thành mảng node React, bọc các khoảng trong `ranges` bằng <mark>. */
export default function HighlightLayer({ text, ranges, onHighlightClick }) {
  if (!ranges || ranges.length === 0) return text

  const sorted = [...ranges]
    .filter((r) => r.start < r.end && r.start >= 0 && r.end <= text.length)
    .sort((a, b) => a.start - b.start)

  const nodes = []
  let cursor = 0
  sorted.forEach((r) => {
    if (r.start < cursor) return // bỏ qua khoảng chồng lấn — highlight đầu tiên thắng
    if (r.start > cursor) nodes.push(text.slice(cursor, r.start))
    nodes.push(
      <mark
        key={r.id}
        data-highlight-id={r.id}
        title={r.note || undefined}
        className="bg-amber-200 dark:bg-amber-900/50 text-inherit rounded-xs px-0.5 cursor-pointer"
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onHighlightClick?.(r, e)
        }}
      >
        {text.slice(r.start, r.end)}
      </mark>
    )
    cursor = r.end
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))

  return nodes
}
