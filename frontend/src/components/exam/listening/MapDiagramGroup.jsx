import MatchingTickGrid from '../../MatchingTickGrid'

const SERVER_BASE = 'http://localhost:3001'
const toImgSrc = (url) => (url || '').startsWith('/') ? `${SERVER_BASE}${url}` : (url || '')

function InstructionBanner({ group }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
      <p className="font-bold text-gray-800 mb-1">Questions {group.qNumberStart}–{group.qNumberEnd}</p>
      {group.instruction && <p className="text-gray-700">{group.instruction}</p>}
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
            className="max-w-full rounded-xl border border-gray-200 shadow-sm"
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
        accentColor="blue"
      />
    </div>
  )
}
