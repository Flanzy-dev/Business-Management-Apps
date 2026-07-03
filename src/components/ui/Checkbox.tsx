import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Checkbox({ checked, onChange, label, disabled = false, className = '' }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked, e)}
        className="sr-only peer"
      />
      <span
        className={`
          w-4 h-4 rounded-radius-xs border flex items-center justify-center flex-shrink-0
          transition-colors duration-fast ease-out
          ${checked ? 'bg-accent border-accent' : 'bg-surface-input border-border-3'}
        `}
      >
        {checked && <Check size={12} strokeWidth={3.2} className="text-fg-inverse" />}
      </span>
      {label && <span className="text-sm text-fg-1">{label}</span>}
    </label>
  )
}
