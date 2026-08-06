export function DropItem({ icon, label, bold, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px', fontSize: 14,
        fontWeight: bold ? 600 : 400,
        fontFamily: 'var(--font-body)',
        color: active ? 'var(--primary)' : 'var(--text)',
        background: active ? 'var(--primary-light)' : 'transparent',
        cursor: 'pointer', transition: 'background 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? 'var(--primary-light)' : 'transparent' }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span>{label}</span>
    </div>
  )
}

import { useEffect } from 'react'

// Generic dropdown wrapper — manages open/hover state and delegates to parent via onOpen/onClose
export default function NavDropdown({ name, isOpen, onOpen, onClose, trigger, children, dropdownStyle }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
  const base = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
    background: 'var(--surface)', borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-soft)', zIndex: 1000,
    paddingTop: 4, paddingBottom: 4,
  }

  return (
    <div className="relative inline-block" onMouseEnter={() => onOpen(name)} onMouseLeave={onClose}>
      {trigger}
      {isOpen && (
        <div
          className="dropdown-menu"
          style={{ ...base, ...dropdownStyle }}
          onMouseEnter={() => onOpen(name)}
          onMouseLeave={onClose}
        >
          {children}
        </div>
      )}
    </div>
  )
}
