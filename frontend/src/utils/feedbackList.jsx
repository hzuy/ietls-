// Chuẩn hoá feedback strengths/improvements từ AI (Groq) thành list hiển thị.
// AI có thể trả string, mảng, hoặc object — hàm này xử lý được cả 3, không crash.
// Dùng chung bởi WritingExam.jsx và SpeakingExam.jsx.
export function renderFeedbackList(input, bulletColorClass = 'text-purple-600') {
  if (!input) return null

  let items = []
  if (typeof input === 'string') {
    items = input.split(/\r?\n|•|-|\*/).map(s => s.trim()).filter(Boolean)
  } else if (Array.isArray(input)) {
    items = input.map(item => typeof item === 'string' ? item.trim() : String(item)).filter(Boolean)
  } else if (typeof input === 'object' && input !== null) {
    items = Object.values(input).map(val => typeof val === 'string' ? val.trim() : String(val)).filter(Boolean)
  } else {
    items = [String(input)]
  }

  if (items.length === 0) return null

  if (items.length <= 1) {
    return <p className="text-slate-600 text-sm leading-relaxed m-0 font-medium">{items[0]}</p>
  }
  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2.5 text-slate-600 text-sm leading-relaxed font-medium">
          <span className={`font-bold select-none ${bulletColorClass}`} style={{ marginTop: '2px' }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
