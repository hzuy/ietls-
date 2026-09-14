import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function Breadcrumb({ items, className = '' }) {
  if (!items || items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center flex-wrap gap-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-3 ${className}`}>
      <ol className="flex items-center flex-wrap gap-1.5 m-0 p-0 list-none">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0 stroke-[2]"
                  aria-hidden="true"
                />
              )}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150 inline-flex items-center truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-zinc-900 dark:text-zinc-100 font-semibold truncate"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
