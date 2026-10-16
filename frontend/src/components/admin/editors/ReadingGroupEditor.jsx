import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import ReviewExplanation from '../../exam/ReviewExplanation'
import { READING_GROUP_TYPES, labelCls, inputCls, getQuestionTypeTheme } from '../adminConstants'
import TrueFalseEditor from '../../practice/TrueFalseEditor'
import SummaryCompletionEditor from '../../practice/SummaryCompletionEditor'
import NoteCompletionEditor from './NoteCompletionEditor'
import TableCompletionEditor from './TableCompletionEditor'
import MCQGroupEditor from './MCQGroupEditor'
import MatchingEditor from './MatchingEditor'
import DiagramLabelEditor from '../../practice/DiagramLabelEditor'

export default function ReadingGroupEditor({ group = {}, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [showExplanations, setShowExplanations] = useState(false)
  const groupType = group?.type || 'short_answer'
  const typeLabel = READING_GROUP_TYPES.find(t => t.value === groupType)?.label || groupType
  const theme = getQuestionTypeTheme(groupType)

  const groupQuestions = group.questions || []
  const hasExplanations = groupQuestions.some(q => q.explanation) || (group.explanations && Object.keys(group.explanations).length > 0)
  const explanationCount = group.explanations
    ? Object.keys(group.explanations).length
    : groupQuestions.filter(q => q.explanation).length

  return (
    <div className={`border ${theme.cardBorder} ${theme.cardBg} rounded-2xl overflow-hidden transition-all duration-200 mb-4 shadow-xs`}>
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${theme.headerBg}`}>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${theme.badge}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-zinc-500 font-semibold">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        {hasExplanations && (
          <button
            type="button"
            onClick={() => setShowExplanations(v => !v)}
            aria-expanded={showExplanations}
            className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition shadow-2xs"
            title="Bấm để xem/ẩn chi tiết giải thích cho nhóm câu hỏi này"
          >
            <span>✓</span> Đã có giải thích ({explanationCount} câu) — <span className="underline">{showExplanations ? 'Ẩn' : 'Xem chi tiết'}</span>
          </button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50/80 transition">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {showExplanations && hasExplanations && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                Giải thích chi tiết {explanationCount} câu hỏi trong nhóm
              </span>
              <button
                type="button"
                onClick={() => setShowExplanations(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer font-medium"
              >
                ✕ Đóng
              </button>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {group.explanations
                ? Object.entries(group.explanations)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([qNum, expl]) => (
                      <div key={qNum} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
                        <div className="text-xs font-bold text-zinc-900 mb-2 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {qNum}
                          </span>
                          <span>Câu hỏi {qNum}</span>
                        </div>
                        <ReviewExplanation explanation={expl} />
                      </div>
                    ))
                : groupQuestions
                    .filter(q => q.explanation)
                    .map((q, idx) => (
                      <div key={q.id || idx} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
                        <div className="text-xs font-bold text-zinc-900 mb-2 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {q.number || (group.qNumberStart + idx)}
                          </span>
                          <span>Câu hỏi {q.number || (group.qNumberStart + idx)}</span>
                        </div>
                        <ReviewExplanation explanation={q.explanation} />
                      </div>
                    ))}
            </div>
          </div>
        )}

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
                className="accent-zinc-900" />
              <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại chữ cái (mỗi đoạn có thể khớp nhiều câu)</span>
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
                className="accent-zinc-900" />
              <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại chữ cái (mỗi lựa chọn có thể khớp nhiều câu)</span>
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
