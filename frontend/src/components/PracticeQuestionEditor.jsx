import { useState } from 'react'

const Q_TYPES = [
  { value: 'mcq',              label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi',        label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'true_false_ng',    label: 'True / False / Not Given' },
  { value: 'yes_no_ng',        label: 'Yes / No / Not Given' },
  { value: 'fill_blank',       label: 'Fill in the blank' },
  { value: 'matching',         label: 'Matching' },
  { value: 'matching_headings',label: 'Matching Headings' },
]

const TF_ANSWERS = ['TRUE', 'FALSE', 'NOT GIVEN']
const YN_ANSWERS = ['YES', 'NO', 'NOT GIVEN']

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function newGroup(startNum = 1) {
  return {
    id: uid(),
    type: 'mcq',
    instruction: '',
    qNumberStart: startNum,
    qNumberEnd: startNum,
    mcqOptions: ['', '', '', ''],
    matchingOptions: [{ id: uid(), letter: 'A', text: '' }],
    questions: [{ id: uid(), number: startNum, questionText: '', correctAnswer: '' }]
  }
}

// ── Group component ─────────────────────────────────────────────────────────
function Group({ group, onChange, onDelete, index }) {
  const isChoice = ['mcq', 'mcq_multi'].includes(group.type)
  const isTFNG = group.type === 'true_false_ng'
  const isYNNG = group.type === 'yes_no_ng'
  const isMatching = ['matching', 'matching_headings'].includes(group.type)
  const tfOptions = isTFNG ? TF_ANSWERS : YN_ANSWERS

  const updateField = (field, val) => onChange({ ...group, [field]: val })

  const syncQuestions = (start, end, prevQ) => {
    const count = end - start + 1
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push(prevQ[i] || { id: uid(), number: start + i, questionText: '', correctAnswer: '' })
    }
    // Update numbers
    return arr.map((q, i) => ({ ...q, number: start + i }))
  }

  const setRange = (start, end) => {
    const s = Math.max(1, parseInt(start) || 1)
    const e = Math.max(s, parseInt(end) || s)
    onChange({ ...group, qNumberStart: s, qNumberEnd: e, questions: syncQuestions(s, e, group.questions) })
  }

  const updateQ = (qId, field, val) => updateField('questions', group.questions.map(q => q.id === qId ? { ...q, [field]: val } : q))
  const updateMcqOpt = (i, val) => {
    const opts = [...group.mcqOptions]
    opts[i] = val
    updateField('mcqOptions', opts)
  }
  const addMcqOpt = () => updateField('mcqOptions', [...group.mcqOptions, ''])
  const removeMcqOpt = (i) => updateField('mcqOptions', group.mcqOptions.filter((_, idx) => idx !== i))

  const updateMatchOpt = (id, field, val) => updateField('matchingOptions', group.matchingOptions.map(o => o.id === id ? { ...o, [field]: val } : o))
  const addMatchOpt = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const next = letters[group.matchingOptions.length] || `${group.matchingOptions.length + 1}`
    updateField('matchingOptions', [...group.matchingOptions, { id: uid(), letter: next, text: '' }])
  }
  const removeMatchOpt = (id) => updateField('matchingOptions', group.matchingOptions.filter(o => o.id !== id))

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      {/* Group header */}
      <div style={{ background: '#f8fafc', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', minWidth: 28 }}>#{index + 1}</span>
        <select value={group.type} onChange={e => {
          const t = e.target.value
          onChange({ ...group, type: t })
        }} style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }}>
          {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>Q</span>
        <input type="number" min={1} value={group.qNumberStart}
          onChange={e => setRange(e.target.value, group.qNumberEnd)}
          style={{ width: 52, fontSize: 13, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, textAlign: 'center' }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>–</span>
        <input type="number" min={group.qNumberStart} value={group.qNumberEnd}
          onChange={e => setRange(group.qNumberStart, e.target.value)}
          style={{ width: 52, fontSize: 13, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, textAlign: 'center' }} />
        <button onClick={onDelete} style={{ marginLeft: 'auto', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: 14 }}>
        {/* Instruction */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Hướng dẫn (instruction)</label>
          <textarea value={group.instruction} onChange={e => updateField('instruction', e.target.value)}
            rows={2} placeholder="VD: Choose the correct letter, A, B, C or D."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>

        {/* MCQ options */}
        {isChoice && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Đáp án chọn (MCQ Options)</label>
            {group.mcqOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 20, fontSize: 13, color: '#64748b', paddingTop: 5 }}>{String.fromCharCode(65 + i)}.</span>
                <input value={opt} onChange={e => updateMcqOpt(i, e.target.value)}
                  placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
                <button onClick={() => removeMcqOpt(i)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button onClick={addMcqOpt} style={{ fontSize: 12, color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Thêm đáp án</button>
          </div>
        )}

        {/* Matching options */}
        {isMatching && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Danh sách để nối (Matching Pool)</label>
            {group.matchingOptions.map(opt => (
              <div key={opt.id} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input value={opt.letter} onChange={e => updateMatchOpt(opt.id, 'letter', e.target.value)}
                  style={{ width: 36, padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
                <input value={opt.text} onChange={e => updateMatchOpt(opt.id, 'text', e.target.value)}
                  placeholder="Nội dung đáp án..."
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
                <button onClick={() => removeMatchOpt(opt.id)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button onClick={addMatchOpt} style={{ fontSize: 12, color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Thêm mục</button>
          </div>
        )}

        {/* Questions */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Câu hỏi</label>
          {group.questions.map((q) => (
            <div key={q.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, color: '#64748b', paddingTop: 7, minWidth: 22, textAlign: 'right' }}>{q.number}.</span>
              {/* Question text */}
              {!isTFNG && !isYNNG ? (
                <input value={q.questionText} onChange={e => updateQ(q.id, 'questionText', e.target.value)}
                  placeholder="Nội dung câu hỏi..."
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
              ) : (
                <input value={q.questionText} onChange={e => updateQ(q.id, 'questionText', e.target.value)}
                  placeholder="Statement..."
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
              )}
              {/* Correct answer */}
              {(isTFNG || isYNNG) ? (
                <select value={q.correctAnswer} onChange={e => updateQ(q.id, 'correctAnswer', e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, minWidth: 120 }}>
                  <option value="">-- Đáp án --</option>
                  {(isTFNG ? TF_ANSWERS : YN_ANSWERS).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              ) : isChoice ? (
                <select value={q.correctAnswer} onChange={e => updateQ(q.id, 'correctAnswer', e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, minWidth: 80 }}>
                  <option value="">Đáp án</option>
                  {group.mcqOptions.map((opt, i) => <option key={i} value={opt}>{String.fromCharCode(65 + i)}</option>)}
                </select>
              ) : (
                <input value={q.correctAnswer} onChange={e => updateQ(q.id, 'correctAnswer', e.target.value)}
                  placeholder="Đáp án đúng"
                  style={{ width: 140, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main editor ─────────────────────────────────────────────────────────────
export default function PracticeQuestionEditor({ value = { groups: [] }, onChange }) {
  const groups = value.groups || []

  const update = (newGroups) => onChange({ ...value, groups: newGroups })

  const addGroup = () => {
    const lastEnd = groups.length > 0 ? groups[groups.length - 1].qNumberEnd : 0
    update([...groups, newGroup(lastEnd + 1)])
  }

  const updateGroup = (id, g) => update(groups.map(gr => gr.id === id ? g : gr))
  const deleteGroup = (id) => update(groups.filter(gr => gr.id !== id))
  const moveGroup = (i, dir) => {
    const arr = [...groups]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    update(arr)
  }

  return (
    <div>
      {groups.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0', borderRadius: 12, marginBottom: 12 }}>
          Chưa có nhóm câu hỏi nào. Bấm "+ Thêm nhóm" để bắt đầu.
        </div>
      )}
      {groups.map((g, i) => (
        <div key={g.id} style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', right: 44, top: 8, display: 'flex', gap: 2, zIndex: 1 }}>
            <button onClick={() => moveGroup(i, -1)} disabled={i === 0}
              style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#cbd5e1' : '#64748b', fontSize: 14 }}>↑</button>
            <button onClick={() => moveGroup(i, 1)} disabled={i === groups.length - 1}
              style={{ background: 'none', border: 'none', cursor: i === groups.length - 1 ? 'default' : 'pointer', color: i === groups.length - 1 ? '#cbd5e1' : '#64748b', fontSize: 14 }}>↓</button>
          </div>
          <Group key={g.id} group={g} index={i}
            onChange={(updated) => updateGroup(g.id, updated)}
            onDelete={() => deleteGroup(g.id)} />
        </div>
      ))}
      <button onClick={addGroup} style={{
        width: '100%', padding: '10px 0', border: '1.5px dashed #bfdbfe', borderRadius: 10,
        background: '#f8faff', color: '#1a56db', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s'
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
        onMouseLeave={e => e.currentTarget.style.background = '#f8faff'}
      >
        + Thêm nhóm câu hỏi
      </button>
    </div>
  )
}
