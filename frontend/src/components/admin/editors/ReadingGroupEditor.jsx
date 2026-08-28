import { READING_GROUP_TYPES, labelCls, inputCls, getQuestionTypeTheme } from '../adminConstants'
import TrueFalseEditor from '../../practice/TrueFalseEditor'
import SummaryCompletionEditor from '../../practice/SummaryCompletionEditor'
import NoteCompletionEditor from '../../practice/NoteCompletionEditor'
import TableCompletionEditor from '../../practice/TableCompletionEditor'
import MCQGroupEditor from '../../practice/MCQGroupEditor'
import MatchingEditor from '../../practice/MatchingEditor'
import DiagramLabelEditor from '../../practice/DiagramLabelEditor'

export default function ReadingGroupEditor({ group = {}, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const groupType = group?.type || 'short_answer'
  const typeLabel = READING_GROUP_TYPES.find(t => t.value === groupType)?.label || groupType
  const theme = getQuestionTypeTheme(groupType)

  return (
    <div className={`border ${theme.cardBorder} ${theme.cardBg} rounded-2xl overflow-hidden transition-all duration-200 mb-4 shadow-xs`}>
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${theme.headerBg}`}>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${theme.badge}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-slate-500 font-semibold">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50/80 transition">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2}
            className={`${inputCls} resize-none`}
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
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1D4ED8]" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại chữ cái (mỗi lựa chọn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'diagram_label' && (
          <DiagramLabelEditor group={group} onChange={onChange} />
        )}
      </div>
    </div>
  )
}
