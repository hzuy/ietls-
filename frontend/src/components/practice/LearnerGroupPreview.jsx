import { useMemo } from 'react'
import ReadingGroup from '../exam/GroupBlock'
import { GroupBlock as ListeningGroup } from '../exam/listening/OtherGroups'
import ReadingPracticeGroup from './ReadingPracticeGroupBlock'
import ListeningPracticeGroup from './ListeningPracticeGroupBlock'
import { questionMechanic, toLearnerGroup } from '../../utils/questionTypes'

const noop = () => {}
export default function LearnerGroupPreview({ group, skill = 'reading', practice = false, showAnswers }) {
  const normalized = useMemo(() => {
    const result = toLearnerGroup(group)
    return { ...result, questions: result.questions.map(q => ({ ...q,
      type: q.type || (['note_completion', 'table_completion', 'diagram_label'].includes(group.type) ? 'fill_blank' : questionMechanic(group.type)),
    })) }
  }, [group])
  const answers = useMemo(() => Object.fromEntries(normalized.questions.map(q => [
    practice && skill === 'listening' ? q.number : q.id, showAnswers ? q.correctAnswer || '' : '',
  ])), [normalized, practice, skill, showAnswers])
  const Component = practice
    ? skill === 'listening' ? ListeningPracticeGroup : ReadingPracticeGroup
    : skill === 'listening' ? ListeningGroup : ReadingGroup
  return <fieldset disabled className="min-w-0 border-0 p-0 m-0" aria-label="Xem trước câu hỏi như học viên">
    <Component group={normalized} answers={answers} onAnswer={noop} globalOffset={0} previewMode showAnswers={showAnswers} />
  </fieldset>
}
