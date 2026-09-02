import {
  READING_GROUP_TYPES, LISTENING_GROUP_TYPES,
  GROUP_TYPE_COLORS, getQuestionTypeTheme,
  inputCls, labelCls,
} from '../../utils/practiceConfig'
import TrueFalseEditor from '../practice/TrueFalseEditor'
import NoteCompletionEditor from '../practice/NoteCompletionEditor'
import TableCompletionEditor from '../practice/TableCompletionEditor'
import MCQGroupEditor from '../practice/MCQGroupEditor'
import MatchingEditor from '../practice/MatchingEditor'
import MatchingHeadingsEditor from '../practice/MatchingHeadingsEditor'
import DiagramLabelEditor from '../practice/DiagramLabelEditor'
import SummaryCompletionEditor from '../practice/SummaryCompletionEditor'
import SummaryCompletionEditorSimple from '../practice/SummaryCompletionEditorSimple'

/**
 * Wrapper 1 "nhóm câu hỏi" cho form soạn Reading/Listening Practice — gộp từ 2 bản
 * page-local trước đây (ReadingGroupEditor trong ReadingPractice.jsx +
 * ListeningGroupEditor trong ListeningPractice.jsx).
 *
 * KHÁC với components/admin/editors/ReadingGroupEditor.jsx — file đó dùng bởi
 * ReadingTab (soạn đề Cambridge/Full Test thật), fork riêng, KHÔNG liên quan.
 *
 * `skill` chỉ quyết định phần vỏ (màu/bo góc/nút): "reading" → style slate phẳng +
 * GROUP_TYPE_COLORS; "listening" → thẻ có màu theo loại + getQuestionTypeTheme.
 * Phần switch(group.type) → leaf-editor giữ NGUYÊN VĂN từng nhánh của cả 2 skill
 * (mỗi skill chỉ sinh ra loại của nó nên các nhánh của skill kia không khớp).
 */
function chrome(skill, groupType) {
  if (skill === 'listening') {
    const t = getQuestionTypeTheme(groupType)
    return {
      card: `border ${t.cardBorder} ${t.cardBg} rounded-2xl overflow-hidden transition-all duration-200 mb-3 shadow-xs`,
      header: `flex items-center gap-3 px-4 py-3 border-b ${t.headerBg}`,
      badge: `text-xs font-bold px-2.5 py-1 rounded-full border ${t.badge}`,
      range: 'text-xs text-slate-500 font-semibold',
      moveWrap: 'flex items-center gap-1',
      moveBtn: 'w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 text-xs transition',
      removeBtn: 'text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50/80 transition',
    }
  }
  return {
    card: 'border border-slate-200 rounded-lg overflow-hidden mb-3',
    header: 'flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200',
    badge: `text-xs font-bold px-2 py-0.5 rounded-full border ${GROUP_TYPE_COLORS[groupType] || 'bg-slate-100 text-slate-700 border-slate-300'}`,
    range: 'text-xs text-slate-500 font-medium',
    moveWrap: 'flex flex-col gap-0.5',
    moveBtn: 'w-5 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-25 text-xs transition',
    removeBtn: 'text-blue-500 hover:text-blue-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-blue-50',
  }
}

export default function PracticeGroupCard({
  skill, group, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
  expanded = true, onToggle,
}) {
  const groupTypes = skill === 'listening' ? LISTENING_GROUP_TYPES : READING_GROUP_TYPES
  const typeLabel = groupTypes.find(t => t.value === group.type)?.label || group.type
  const s = chrome(skill, group.type)
  const bodyId = `grp-body-${group._id ?? group.id ?? group.qNumberStart}`

  // Header là vùng click tiện lợi để thu gọn/bung; chevron mới là control a11y thật
  // (aria-expanded/controls + bàn phím). Nút ▲▼/Xóa chặn nổi bọt để không toggle nhầm.
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(e) }

  return (
    <div className={s.card}>
      <div className={`${s.header} cursor-pointer select-none`} onClick={() => onToggle?.()}>
        <button type="button"
          onClick={stop(onToggle)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `Thu gọn nhóm ${typeLabel}` : `Bung nhóm ${typeLabel}`}
          className={`text-slate-400 text-[10px] leading-none transition-transform hover:text-slate-600 ${expanded ? 'rotate-90' : ''}`}>▶</button>
        <span className={s.badge}>
          {typeLabel}
        </span>
        <span className={s.range}>Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className={s.moveWrap}>
            <button type="button" onClick={stop(onMoveUp)} disabled={isFirst} className={s.moveBtn}>▲</button>
            <button type="button" onClick={stop(onMoveDown)} disabled={isLast} className={s.moveBtn}>▼</button>
          </div>
          <button type="button" onClick={stop(onRemove)} className={s.removeBtn}>
            Xóa nhóm
          </button>
        </div>
      </div>

      {expanded && (
      <div id={bodyId} role="region" aria-label={`Nội dung nhóm ${typeLabel}`} className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2} className={`${inputCls} resize-none`}
            placeholder="Hướng dẫn làm bài..."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {(group.type === 'true_false_ng' || group.type === 'yes_no_ng') && (
          <TrueFalseEditor group={group} onChange={onChange} />
        )}
        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_information' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1D4ED8]" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại chữ cái (mỗi đoạn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {(group.type === 'matching' || group.type === 'map_diagram') && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
        {group.type === 'drag_word_bank' && (
          skill === 'listening'
            ? <SummaryCompletionEditorSimple group={group} onChange={onChange} />
            : <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1D4ED8]" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại đáp án (mỗi đáp án có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'diagram_label' && (
          <DiagramLabelEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_headings' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-green-600" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại heading (heading có thể khớp nhiều đoạn)</span>
            </label>
            <MatchingHeadingsEditor group={group} onChange={onChange} />
          </div>
        )}
      </div>
      )}
    </div>
  )
}
