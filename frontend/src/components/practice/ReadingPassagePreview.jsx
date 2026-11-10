import { readingParagraphs } from '../../utils/readingParagraphs'
export default function ReadingPassagePreview({ title, subtitle, body, letteredParagraphs, questionGroups = [] }) {
  const showLabels = letteredParagraphs ?? questionGroups.some(g => g.type === 'matching_headings')
  return <div>
    {title && <h2 className="mb-1 text-center text-lg font-semibold leading-snug text-zinc-900">{title}</h2>}
    {subtitle && <p className="mb-2 text-center text-sm italic text-zinc-500">{subtitle}</p>}
    {title && <div className="mx-auto mb-6 h-0.5 w-16 bg-zinc-900" />}
    <div className="text-base font-normal leading-relaxed text-zinc-800">
      {(showLabels ? readingParagraphs(body) : String(body || '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean)).map((paragraph, i) => <p key={i} className={`mb-5 ${showLabels ? '' : 'indent-6'}`}>
        {showLabels && <span className="mr-2 font-bold text-zinc-900">{String.fromCharCode(65 + i)}</span>}
        {paragraph.charAt(0).toUpperCase() + paragraph.slice(1)}
      </p>)}
    </div>
  </div>
}
