export function DropItem({ icon, label, bold, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px', fontSize: 14,
        fontWeight: bold ? 600 : 400,
        color: active ? '#1a56db' : '#374151',
        background: active ? '#eff6ff' : 'transparent',
        cursor: 'pointer', transition: 'background 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? '#eff6ff' : 'transparent' }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span>{label}</span>
    </div>
  )
}

// Generic dropdown wrapper — manages open/hover state and delegates to parent via onOpen/onClose
export default function NavDropdown({ name, isOpen, onOpen, onClose, trigger, children, dropdownStyle }) {
  const base = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
    background: 'white', borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
    border: '1px solid #e2e8f0', zIndex: 1000,
    paddingTop: 4, paddingBottom: 4,
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => onOpen(name)}
      onMouseLeave={onClose}
    >
      {trigger}
      {isOpen && (
        <div
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
