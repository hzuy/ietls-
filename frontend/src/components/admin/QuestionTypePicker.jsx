import { useState } from 'react'

export default function QuestionTypePicker({ types, onSelect, onCancel }) {
  const [search, setSearch] = useState('')
  const visible = types.filter(t => t.label.toLowerCase().includes(search.trim().toLowerCase()))
  return <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
    <label className="block text-xs font-medium text-zinc-700">
      Chọn dạng câu hỏi
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm dạng câu hỏi…" className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-700" />
    </label>
    <div className="mt-3 grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
      {visible.map(t => <button key={t.value} type="button" onClick={() => onSelect(t.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-zinc-800 hover:border-zinc-400 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-700">{t.label}</button>)}
    </div>
    {!visible.length && <p className="mt-3 text-sm text-zinc-600">Không có dạng câu hỏi phù hợp.</p>}
    <button type="button" onClick={onCancel} className="mt-3 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-200">Hủy</button>
  </div>
}
