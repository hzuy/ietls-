import { toImgSrc } from '../../utils/media'
import AdminGroupPreview from './AdminGroupPreview'

export default function ListeningContentPreview({ section, showAnswers, practice = false }) {
  return <div className="flex-1 overflow-y-auto bg-zinc-50">
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      {section.audioUrl && <audio controls src={toImgSrc(section.audioUrl)} key={section.audioUrl} className="w-full" aria-label="Audio bài nghe" />}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
        <p className="mb-5 text-xs font-semibold text-zinc-700">
          {practice ? 'Listening Practice' : `Section ${section.number}`}
          {section.context && <span className="ml-1 font-normal text-zinc-500">— {section.context}</span>}
        </p>
        {(section.questionGroups || []).length ? [...section.questionGroups].sort((a, b) => a.qNumberStart - b.qNumberStart).map((group, i) => <AdminGroupPreview key={group.id ?? i} group={group} skill="listening" practice={practice} showAnswers={showAnswers} />) : <p className="text-sm text-zinc-600">Chưa có câu hỏi.</p>}
      </div>
    </div>
  </div>
}
