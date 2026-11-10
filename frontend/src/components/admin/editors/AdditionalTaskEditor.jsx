import { questionMechanic, TEXT_COMPLETION_TYPES } from '../../../utils/questionTypes'
import NoteCompletionEditor from './NoteCompletionEditor'
import MCQGroupEditor from './MCQGroupEditor'
import MatchingEditor from './MatchingEditor'
import MatchingHeadingsEditor from '../../practice/MatchingHeadingsEditor'
import ShortAnswerEditor from './ShortAnswerEditor'

export default function AdditionalTaskEditor({ group, onChange, themeSource = 'admin', passage = '', letteredParagraphs = false }) {
  const mechanic = questionMechanic(group.type)
  const update = changed => onChange({ ...changed, type: group.type })
  const props = { group: { ...group, type: mechanic }, onChange: update, themeSource, passage, letteredParagraphs }
  if (TEXT_COMPLETION_TYPES.includes(group.type)) return <NoteCompletionEditor {...props} group={group} />
  if (mechanic === 'short_answer') return <ShortAnswerEditor {...props} />
  if (mechanic === 'mcq' || mechanic === 'mcq_multi') return <MCQGroupEditor {...props} />
  if (mechanic === 'matching_drag') return <div className="space-y-3">
    <label className="flex items-center gap-2 text-xs text-zinc-700">
      <input type="checkbox" checked={Boolean(group.canReuse)} onChange={e => onChange({ ...group, canReuse: e.target.checked })} className="accent-zinc-900" />
      Cho phép dùng lại đáp án
    </label>
    <MatchingEditor {...props} />
  </div>
  if (mechanic === 'matching_headings') return <MatchingHeadingsEditor {...props} />
  return null
}
