import MatchingTickGrid from '../../MatchingTickGrid'
import { toImgSrc } from '../../../utils/media'

function InstructionBanner({ group }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 mb-4 text-sm">
      <p className="font-semibold text-zinc-900 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-zinc-600">{group.instruction}</p>}
    </div>
  )
}

// ── Map / Diagram Labelling Group ─────────────────────────────────────────────
export default function MapDiagramGroup({ group, answers, onAnswer, previewMode, showAnswers }) {
  const letters = (group.matchingOptions || []).map(mo => mo.optionLetter)
  const questions = group.questions || []

  return (
    <div id={`question-${group.qNumberStart}`} className="mb-6 scroll-mt-4">
      <InstructionBanner group={group} />
      {group.imageUrl && (
        <div className="flex justify-center mb-5">
          <img src={toImgSrc(group.imageUrl)} alt="Map/Diagram"
            className="max-w-full rounded-xl border border-zinc-200 shadow-xs"
            onError={e => { e.target.style.display = 'none' }} />
        </div>
      )}
      <MatchingTickGrid
        letters={letters}
        questions={questions}
        answers={answers}
        onAnswer={onAnswer}
        previewMode={previewMode}
        showAnswers={showAnswers}
        accentColor="zinc"
      />
    </div>
  )
}
