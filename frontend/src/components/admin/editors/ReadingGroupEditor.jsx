import AutoGrowTextarea from '../AutoGrowTextarea'
import AdditionalTaskEditor from './AdditionalTaskEditor'
import { GROUP_TYPE_ALIASES } from '../../../utils/questionTypes'
import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { READING_GROUP_TYPES, labelCls, inputCls, getQuestionTypeTheme } from '../adminConstants'
import QuestionExplanationModal, { ExplanationStatusBadge } from '../QuestionExplanationModal'
import ExplanationChipGrid from '../ExplanationChipGrid'
import TrueFalseEditor from '../../practice/TrueFalseEditor'
import SummaryCompletionEditor from '../../practice/SummaryCompletionEditor'
import NoteCompletionEditor from './NoteCompletionEditor'
import TableCompletionEditor from './TableCompletionEditor'
import MCQGroupEditor from './MCQGroupEditor'
import MatchingEditor from './MatchingEditor'
import DiagramLabelEditor from '../../practice/DiagramLabelEditor'
import { isExplanationUnsupportedGroup } from '../../../utils/examExplanationUtils'

export default function ReadingGroupEditor({
  group = {}, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
  examId, passage = '', letteredParagraphs = false,
  onGenerateGroupAI, isAIBusy = false, generatingGroupId = null,
  generatingQuestionNumbers: generatingQuestionNumbersProp = null,
  runStatusByNumber = null,
  runErrorMessageByNumber = null,
  unsavedQuestionNumbers,
}) {
  const [selectedQModal, setSelectedQModal] = useState(null)
  const groupType = group?.type || 'short_answer'
  const typeLabel = READING_GROUP_TYPES.find(t => t.value === groupType)?.label || groupType
  const theme = getQuestionTypeTheme(groupType)

  const groupQuestions = group.questions || []
  const hasExplanations = groupQuestions.some(q => q.explanation) || (group.explanations && Object.keys(group.explanations).length > 0)
  const explanationCount = group.explanations
    ? Object.keys(group.explanations).length
    : groupQuestions.filter(q => q.explanation).length

  const questionsList = (Array.isArray(group.questions) && group.questions.length > 0)
    ? group.questions
    : (group.qNumberStart && group.qNumberEnd && group.qNumberEnd >= group.qNumberStart)
      ? Array.from(
          { length: group.qNumberEnd - group.qNumberStart + 1 },
          (_, idx) => ({ number: group.qNumberStart + idx })
        )
      : []

  const fallbackGeneratingQuestionNumbers = generatingGroupId === group.id
    ? new Set(questionsList.map(q => q.number))
    : undefined

  const generatingQuestionNumbers = generatingQuestionNumbersProp || fallbackGeneratingQuestionNumbers

  return (
    <div
      data-explanation-group-id={group.id ?? group._id ?? undefined}
      className={`border ${theme.cardBorder} ${theme.cardBg} rounded-2xl overflow-hidden transition-all duration-200 mb-4 shadow-xs`}
    >
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${theme.headerBg} flex-wrap`}>
        {/* Cột 1: Badge loại câu hỏi */}
        <div className="w-48 sm:w-52 shrink-0 flex items-center">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${theme.badge} w-full text-center truncate shadow-2xs`}>
            {typeLabel}
          </span>
        </div>

        {/* Cột 2: Phạm vi câu hỏi */}
        <div className="w-20 sm:w-24 shrink-0 text-left">
          <span className="text-xs text-zinc-600 font-semibold whitespace-nowrap">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        </div>

        {/* Cột 3: Trạng thái giải thích */}
        <div className="min-w-[190px] shrink-0 flex items-center">
          {hasExplanations ? (
            <span
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs whitespace-nowrap"
              title="Nhóm câu hỏi này đã có lời giải thích chi tiết"
            >
              <span>✓</span> Đã có giải thích ({explanationCount} câu)
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

        {/* Nút sinh AI theo nhóm (Requirement 3.5) */}
        {onGenerateGroupAI && !isExplanationUnsupportedGroup(group) && (
          <button
            type="button"
            onClick={() => onGenerateGroupAI(group)}
            disabled={isAIBusy}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            title={isAIBusy ? 'Đang sinh giải thích AI, vui lòng chờ' : 'Sinh giải thích AI cho riêng nhóm câu hỏi này'}
            data-testid={`generate-group-ai-${group.id || group.qNumberStart}`}
          >
            {generatingGroupId === group.id ? (
              <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
            ) : (
              <Sparkles className="w-3 h-3 text-zinc-600" />
            )}
            <span>Sinh AI nhóm này</span>
          </button>
        )}

        <div className="flex-1 min-w-2" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onMoveUp} disabled={isFirst || isAIBusy}
              title={isAIBusy ? 'Đang sinh giải thích AI, vui lòng chờ' : undefined}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast || isAIBusy}
              title={isAIBusy ? 'Đang sinh giải thích AI, vui lòng chờ' : undefined}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove} disabled={isAIBusy}
            title={isAIBusy ? 'Đang sinh giải thích AI, vui lòng chờ' : undefined}
            className="text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50/80 transition disabled:opacity-40 disabled:cursor-not-allowed">
            Xóa nhóm
          </button>
        </div>
      </div>

      {/* Cột danh sách câu hỏi & huy hiệu giải thích */}
      <ExplanationChipGrid
        questions={questionsList}
        group={group}
        onSelectQuestion={(data) => setSelectedQModal(data)}
        generatingQuestionNumbers={generatingQuestionNumbers}
        unsavedQuestionNumbers={unsavedQuestionNumbers}
        runStatusByNumber={runStatusByNumber}
        runErrorMessageByNumber={runErrorMessageByNumber}
      />

      <div className="p-4 space-y-3">

        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <AutoGrowTextarea rows={2}
            className={`${inputCls} resize-none`}
            placeholder="Hướng dẫn làm bài..."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {(group.type === 'true_false_ng' || group.type === 'yes_no_ng') && (
          <TrueFalseEditor group={group} onChange={onChange} />
        )}
        {(Object.hasOwn(GROUP_TYPE_ALIASES, group.type) || group.type === 'short_answer' || group.type === 'matching_headings') && <AdditionalTaskEditor letteredParagraphs={letteredParagraphs} passage={passage} group={group} onChange={onChange}  />}
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
            <MatchingEditor group={group} onChange={onChange} passage={passage} letteredParagraphs={letteredParagraphs} />
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

      {selectedQModal && (
        <QuestionExplanationModal
          isOpen={Boolean(selectedQModal)}
          onClose={() => setSelectedQModal(null)}
          examId={examId}
          questionId={selectedQModal.question?.id || selectedQModal.qNum}
          questionNumber={selectedQModal.qNum}
          isPractice={false}
          skill="reading"
          question={selectedQModal.question}
          initialExplanation={selectedQModal.explanation}
          passage={passage}
          isAIBusy={isAIBusy}
          runStatus={runStatusByNumber?.[selectedQModal.qNum] ?? null}
          runErrorMessage={runErrorMessageByNumber?.[selectedQModal.qNum] ?? null}
          onExplanationUpdated={(newExp, qNum) => {
            const targetNum = qNum || selectedQModal?.qNum
            const updatedQuestions = (group.questions || []).map(q =>
              (q.number === targetNum || q.id === selectedQModal.question?.id)
                ? { ...q, explanation: newExp }
                : q
            )
            const nextExplanations = { ...(group.explanations || {}), [targetNum]: newExp }
            onChange({ ...group, questions: updatedQuestions, explanations: nextExplanations })
            setSelectedQModal(prev => prev ? { ...prev, explanation: newExp } : null)
          }}
        />
      )}
    </div>
  )
}
