import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  READING_GROUP_TYPES, LISTENING_GROUP_TYPES,
  GROUP_TYPE_COLORS, getQuestionTypeTheme,
  inputCls, labelCls,
} from '../../utils/practiceConfig'
import QuestionExplanationModal, { ExplanationStatusBadge } from './QuestionExplanationModal'
import TrueFalseEditor from '../practice/TrueFalseEditor'
import NoteCompletionEditor from './editors/NoteCompletionEditor'
import TableCompletionEditor from './editors/TableCompletionEditor'
import MCQGroupEditor from './editors/MCQGroupEditor'
import MatchingEditor from './editors/MatchingEditor'
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
      card: `border ${t.cardBorder} ${t.cardBg} rounded-2xl overflow-hidden transition-all duration-200 mb-3.5 shadow-xs`,
      header: `flex items-center gap-3 px-4 py-3 border-b ${t.headerBg} overflow-x-auto`,
      badge: `text-xs font-bold px-2.5 py-1 rounded-full border ${t.badge}`,
      range: 'text-xs text-zinc-600 font-semibold',
      moveWrap: 'flex items-center gap-1',
      moveBtn: 'w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 text-xs transition cursor-pointer',
      removeBtn: 'text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50/80 transition cursor-pointer',
    }
  }
  return {
    card: 'border border-zinc-200 rounded-lg overflow-hidden mb-3.5 bg-white shadow-2xs',
    header: 'flex items-center gap-3 px-4 py-3 bg-zinc-50/90 border-b border-zinc-200 overflow-x-auto',
    badge: `text-xs font-bold px-2.5 py-1 rounded-full border ${GROUP_TYPE_COLORS[groupType] || 'bg-zinc-100 text-zinc-700 border-zinc-200'}`,
    range: 'text-xs text-zinc-600 font-semibold',
    moveWrap: 'flex items-center gap-1',
    moveBtn: 'w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 disabled:opacity-25 text-xs transition cursor-pointer',
    removeBtn: 'text-red-600 hover:text-red-700 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition cursor-pointer',
  }
}

export default function PracticeGroupCard({
  skill, group, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
  expanded = true, onToggle, examId, passage = '',
}) {
  const [selectedQModal, setSelectedQModal] = useState(null)
  const groupTypes = skill === 'listening' ? LISTENING_GROUP_TYPES : READING_GROUP_TYPES
  const typeLabel = groupTypes.find(t => t.value === group.type)?.label || group.type
  const s = chrome(skill, group.type)
  const bodyId = `grp-body-${group._id ?? group.id ?? group.qNumberStart}`

  const hasExplanations = group.explanations && Object.keys(group.explanations).length > 0
  const questionsList = (Array.isArray(group.questions) && group.questions.length > 0)
    ? group.questions
    : (group.qNumberStart && group.qNumberEnd && group.qNumberEnd >= group.qNumberStart)
      ? Array.from(
          { length: group.qNumberEnd - group.qNumberStart + 1 },
          (_, idx) => ({ number: group.qNumberStart + idx })
        )
      : []

  // Header là vùng click tiện lợi để thu gọn/bung; chevron mới là control a11y thật
  // (aria-expanded/controls + bàn phím). Nút ▲▼/Xóa chặn nổi bọt để không toggle nhầm.
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(e) }

  return (
    <div className={s.card}>
      <div className={`${s.header} cursor-pointer select-none`} onClick={() => onToggle?.()}>
        {/* Cột 1: Nút toggle expand/collapse */}
        <button type="button"
          onClick={stop(onToggle)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `Thu gọn nhóm ${typeLabel}` : `Bung nhóm ${typeLabel}`}
          className={`w-6 h-6 flex items-center justify-center text-zinc-400 text-[11px] leading-none transition-transform hover:text-zinc-600 shrink-0 ${expanded ? 'rotate-90' : ''}`}
        >
          ▶
        </button>

        {/* Cột 2: Badge loại câu hỏi (đặt width cố định để mọi dòng đều thẳng hàng) */}
        <div className="w-48 sm:w-52 shrink-0 flex items-center">
          <span className={`${s.badge} w-full text-center truncate shadow-2xs`}>
            {typeLabel}
          </span>
        </div>

        {/* Cột 3: Phạm vi số câu (đặt width cố định để cột badge giải thích thẳng hàng) */}
        <div className="w-20 sm:w-24 shrink-0 text-left">
          <span className={`${s.range} whitespace-nowrap`}>
            Câu {group.qNumberStart}–{group.qNumberEnd}
          </span>
        </div>

        {/* Cột 4: Badge trạng thái giải thích AI (thẳng hàng tuyệt đối giữa các nhóm) */}
        <div className="min-w-[190px] shrink-0 flex items-center">
          {hasExplanations ? (
            <span
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs whitespace-nowrap"
              title="Nhóm câu hỏi này đã có lời giải thích chi tiết"
            >
              <span>✓</span> Đã có giải thích ({Object.keys(group.explanations).length} câu)
            </span>
          ) : (
            <span
              className="text-[11px] font-normal text-zinc-400 px-2.5 py-0.5 rounded-full border border-dashed border-zinc-200 flex items-center gap-1.5 whitespace-nowrap"
              title="Nhóm câu hỏi này chưa tạo giải thích"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 inline-block" /> Chưa có giải thích
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-2" />

        {/* Cột 5: Nút Di chuyển và Xóa nhóm */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={s.moveWrap}>
            <button type="button" onClick={stop(onMoveUp)} disabled={isFirst} className={s.moveBtn} title="Di chuyển lên">▲</button>
            <button type="button" onClick={stop(onMoveDown)} disabled={isLast} className={s.moveBtn} title="Di chuyển xuống">▼</button>
          </div>
          <button type="button" onClick={stop(onRemove)} className={s.removeBtn}>
            Xóa nhóm
          </button>
        </div>
      </div>

      {/* Cột danh sách câu hỏi & huy hiệu giải thích */}
      {questionsList.length > 0 && (
        <div className="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-600 flex items-center gap-1 shrink-0 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Giải thích 4 bước:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            {questionsList.map(q => {
              const qNum = q.number
              const exp = group.explanations?.[qNum] || group.explanations?.[String(qNum)]
              return (
                <button
                  key={qNum}
                  type="button"
                  onClick={stop(() => setSelectedQModal({ question: q, qNum, explanation: exp }))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800 transition shadow-2xs cursor-pointer"
                  title={`Xem, duyệt, góp ý hoặc sửa tay giải thích câu ${qNum}`}
                >
                  <span className="font-semibold">Câu {qNum}</span>
                  <ExplanationStatusBadge explanation={exp} />
                </button>
              )
            })}
          </div>
        </div>
      )}

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
          <NoteCompletionEditor group={group} onChange={onChange} themeSource="practice" />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} themeSource="practice" />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} themeSource="practice" />
        )}
        {group.type === 'matching_information' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-zinc-900" />
              <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại chữ cái (mỗi đoạn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} themeSource="practice" />
          </div>
        )}
        {(group.type === 'matching' || group.type === 'map_diagram') && (
          <MatchingEditor group={group} onChange={onChange} themeSource="practice" />
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
                className="accent-zinc-900" />
              <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại đáp án (mỗi đáp án có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} themeSource="practice" />
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
                className="accent-zinc-900" />
              <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại heading (heading có thể khớp nhiều đoạn)</span>
            </label>
            <MatchingHeadingsEditor group={group} onChange={onChange} />
          </div>
        )}
      </div>
      )}

      {selectedQModal && (
        <QuestionExplanationModal
          isOpen={Boolean(selectedQModal)}
          onClose={() => setSelectedQModal(null)}
          examId={examId}
          questionNumber={selectedQModal.qNum}
          isPractice={true}
          skill={skill}
          question={selectedQModal.question}
          initialExplanation={selectedQModal.explanation}
          passage={passage}
          onExplanationUpdated={(newExp, qNum) => {
            const targetNum = qNum || selectedQModal?.qNum
            const nextExplanations = { ...(group.explanations || {}), [targetNum]: newExp }
            onChange({ ...group, explanations: nextExplanations })
            setSelectedQModal(prev => prev ? { ...prev, explanation: newExp } : null)
          }}
        />
      )}
    </div>
  )
}

