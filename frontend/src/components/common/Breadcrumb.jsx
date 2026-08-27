import React from 'react'
import { Link } from 'react-router-dom'

export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null

  return (
    <div className="flex items-center gap-2 text-[13px] text-slate-500 font-medium mb-2" style={{ fontFamily: 'var(--font-body)' }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-300">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-blue-600 transition-colors duration-300" style={{ textDecoration: 'none', color: 'inherit' }}>
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
