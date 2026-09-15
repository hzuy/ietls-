import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'

// Dropdown dùng chung cho Admin Panel — thay <select> native (phần danh sách xổ
// xuống do trình duyệt/OS vẽ, CSS không bo góc được) bằng Headless UI Listbox.
// API cố tình giống <select>: value là giá trị hiện tại, onChange nhận thẳng
// giá trị mới được chọn (không phải event — khác với onChange={e => ...} của
// <select> native, cần bỏ `.target.value` khi thay thế từng chỗ gọi).
// options: [{ value, label, disabled? }]
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled = false,
  icon: Icon,
  id,
  ariaLabel,
  className = '',
  buttonClassName = '',
  panelClassName = '',
}) {
  const selected = options.find(o => o.value === value)

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {({ open }) => (
          <>
            <ListboxButton
              id={id}
              aria-label={ariaLabel}
              className={`relative w-full h-9 text-xs border border-zinc-200 rounded-md text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition font-normal bg-white shadow-2xs flex items-center ${Icon ? 'pl-8' : 'pl-3'} pr-8 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${buttonClassName}`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
              <span className="truncate text-left flex-1">{selected ? selected.label : placeholder}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
            </ListboxButton>

            <ListboxOptions
              anchor="bottom start"
              transition
              className={`z-20 w-[var(--button-width)] mt-1.5 rounded-xl border border-zinc-200 bg-white shadow-lg p-1 focus:outline-none transition duration-100 ease-out data-[closed]:opacity-0 data-[closed]:scale-95 ${panelClassName}`}
            >
              {options.map(opt => (
                <ListboxOption key={opt.value} value={opt.value} disabled={opt.disabled}
                  className={({ focus }) => `flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer select-none transition-colors ${focus ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'}`}>
                  {({ selected: isSelected }) => (
                    <>
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />}
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </>
        )}
      </Listbox>
    </div>
  )
}
