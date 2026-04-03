import { useRef, useEffect, useCallback } from 'react'

const TOOLBAR = [
  { cmd: 'bold',        label: <strong>B</strong>,     title: 'Bold' },
  { cmd: 'italic',      label: <em>I</em>,              title: 'Italic' },
  { cmd: 'underline',   label: <u>U</u>,                title: 'Underline' },
  null, // separator
  { cmd: 'formatBlock', value: 'H1', label: 'H1', title: 'Tiêu đề 1' },
  { cmd: 'formatBlock', value: 'H2', label: 'H2', title: 'Tiêu đề 2' },
  { cmd: 'formatBlock', value: 'H3', label: 'H3', title: 'Tiêu đề 3' },
  { cmd: 'formatBlock', value: 'P',  label: 'P',  title: 'Đoạn văn' },
  null,
  { cmd: 'insertUnorderedList', label: '• List', title: 'Danh sách không thứ tự' },
  { cmd: 'insertOrderedList',   label: '1. List', title: 'Danh sách có thứ tự' },
  null,
  { cmd: 'justifyLeft',   label: '⬤←', title: 'Căn trái' },
  { cmd: 'justifyCenter', label: '⬤—', title: 'Căn giữa' },
  { cmd: 'justifyRight',  label: '→⬤', title: 'Căn phải' },
]

export default function RichTextEditor({ value = '', onChange, placeholder = 'Nhập nội dung...' }) {
  const editorRef = useRef(null)

  // Sync external value → DOM
  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const exec = useCallback((cmd, val) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val ?? null)
    if (onChange) onChange(editorRef.current.innerHTML)
  }, [onChange])

  const handleInput = useCallback(() => {
    if (onChange) onChange(editorRef.current.innerHTML)
  }, [onChange])

  const handleColorChange = (e) => exec('foreColor', e.target.value)

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 8px',
        background: '#f8fafc', borderBottom: '1px solid #e2e8f0'
      }}>
        {TOOLBAR.map((item, i) => {
          if (item === null) return (
            <span key={i} style={{ width: 1, background: '#e2e8f0', margin: '2px 3px', alignSelf: 'stretch' }} />
          )
          return (
            <button key={i} title={item.title}
              onMouseDown={e => { e.preventDefault(); exec(item.cmd, item.value) }}
              style={{
                padding: '3px 8px', borderRadius: 5, border: '1px solid transparent',
                background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                color: '#374151', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#cbd5e1' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              {item.label}
            </button>
          )
        })}
        {/* Color picker */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Màu</span>
          <input type="color" defaultValue="#000000" onChange={handleColorChange}
            style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
        </span>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: 200, padding: 16, outline: 'none', fontSize: 14, lineHeight: 1.7,
          color: '#1e293b', fontFamily: 'inherit',
        }}
        // CSS for placeholder via attribute (injected via global class)
      />
      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 1.6em; font-weight: 700; margin: 0.5em 0; }
        [contenteditable] h2 { font-size: 1.3em; font-weight: 600; margin: 0.4em 0; }
        [contenteditable] h3 { font-size: 1.1em; font-weight: 600; margin: 0.3em 0; }
        [contenteditable] ul { list-style: disc; padding-left: 1.5em; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.5em; }
      `}</style>
    </div>
  )
}
