import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react'
import { Check, ChevronDown, History } from 'lucide-react'

const fmt = iso => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })

function scoreOf(a) {
  if (typeof a.bandScore === 'number') return a.bandScore.toFixed(1)
  if (a.correct != null && a.total != null) return `${a.correct}/${a.total}`
  return null
}

export default function AttemptPicker({ attempts, value, onChange }) {
  if (!attempts?.length) return null
  const index = Math.max(0, attempts.findIndex(a => String(a.attemptId) === String(value)))
  const current = attempts[index]

  return (
    <Listbox value={String(current.attemptId)} onChange={onChange}>
      {({ open }) => (
        <div className="relative min-w-0">
          <ListboxButton
            aria-label="Chọn lượt làm bài"
            className="h-9 pointer-coarse:h-11 max-w-full inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white pl-3 pr-2.5 text-[13px] text-zinc-800 cursor-pointer hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="font-semibold whitespace-nowrap">Lần {attempts.length - index}</span>
            <span className="hidden sm:inline text-zinc-500 truncate">{fmt(current.finishedAt)}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </ListboxButton>
          <ListboxOptions
            anchor={{ to: 'bottom end', gap: 6 }}
            transition
            className="z-50 w-72 max-h-[min(320px,var(--anchor-max-height))] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg focus:outline-none transition duration-100 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
          >
            {attempts.map((a, i) => {
              const score = scoreOf(a)
              return (
                <ListboxOption
                  key={a.attemptId}
                  value={String(a.attemptId)}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer select-none text-zinc-700 data-[focus]:bg-zinc-100 data-[selected]:bg-zinc-900 data-[selected]:text-white"
                >
                  <span className="w-12 text-[13px] font-semibold whitespace-nowrap">Lần {attempts.length - i}</span>
                  <span className="flex-1 text-xs text-zinc-500 group-data-[selected]:text-zinc-300 tabular-nums whitespace-nowrap">{fmt(a.finishedAt)}</span>
                  {score && <span className="font-mono text-xs font-semibold tabular-nums">{score}</span>}
                  <Check className="w-3.5 h-3.5 shrink-0 invisible group-data-[selected]:visible" />
                </ListboxOption>
              )
            })}
          </ListboxOptions>
        </div>
      )}
    </Listbox>
  )
}
