import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import PillInput from './PillInput'

export default function PasswordInput({ visibilityLabel = 'mật khẩu', className = '', ...props }) {
  const [visible, setVisible] = useState(false)
  const inputRef = useRef(null)
  const Icon = visible ? EyeOff : Eye
  const action = `${visible ? 'Ẩn' : 'Hiện'} ${visibilityLabel}`

  return (
    <div className="relative">
      <PillInput
        {...props}
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        className={`pr-12 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden ${className}`}
      />
      <button
        type="button"
        aria-label={action}
        title={action}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={props.disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={event => {
          const input = inputRef.current
          // Preserve browser/password-manager autofill before a type change
          // causes React to reapply a stale controlled value.
          if (input && props.value !== undefined && input.value !== props.value) {
            props.onChange?.({ ...event, target: input, currentTarget: input })
          }
          setVisible(value => !value)
        }}
        className="absolute inset-y-0 right-0 w-11 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
