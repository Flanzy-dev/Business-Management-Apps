import { ChangeEvent, ReactNode, createContext, useContext, useId } from 'react'
import { Check } from 'lucide-react'

// DESIGN_SYSTEM.md §2 Checkbox: the native input stays in the DOM (keyboard,
// form semantics, screen readers) but is visually hidden; a 16×16 box drawn
// from tokens shows its state. Radio is the same control, round, with a dot.

const rowClass = 'flex gap-2 cursor-pointer has-[:disabled]:opacity-45 has-[:disabled]:cursor-not-allowed'
const sizeClass = { sm: 'text-sm text-fg-1', xs: 'text-xs text-fg-2' }
// The box shows keyboard focus with the same --focus-ring token .focus-ring
// gives every other control (the input itself is invisible).
const boxBase =
  'shrink-0 w-4 h-4 flex items-center justify-center border transition-colors duration-fast ' +
  'peer-focus-visible:shadow-[var(--focus-ring)]'

function boxState(checked: boolean) {
  return checked ? 'bg-accent border-accent' : 'bg-surface-input border-border-3'
}

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
  children: ReactNode
  disabled?: boolean
  /** 'start' pins the box to the first line of a label that wraps. */
  align?: 'center' | 'start'
  /** 'xs' for fine print, like an acknowledgement under a form. */
  size?: 'sm' | 'xs'
  className?: string
}

export function Checkbox({ checked, onChange, children, disabled, align = 'center', size = 'sm', className = '' }: CheckboxProps) {
  return (
    <label className={`${rowClass} ${sizeClass[size]} ${align === 'start' ? 'items-start' : 'items-center'} ${className}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked, e)}
      />
      <span aria-hidden="true" className={`${boxBase} rounded-radius-xs ${boxState(checked)} ${align === 'start' ? 'mt-0.5' : ''}`}>
        {checked && <Check size={12} strokeWidth={3} className="text-fg-inverse" />}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  )
}

// A RadioGroup hands its radios one shared `name`, which is what makes the
// browser treat them as a group: Tab lands on the checked one and the arrow
// keys move between them.
const RadioNameContext = createContext<string | undefined>(undefined)

interface RadioProps {
  checked: boolean
  onChange: () => void
  children: ReactNode
  /** Only needed outside a RadioGroup. */
  name?: string
  disabled?: boolean
  className?: string
}

export function Radio({ checked, onChange, children, name, disabled, className = '' }: RadioProps) {
  const groupName = useContext(RadioNameContext)
  return (
    <label className={`${rowClass} ${sizeClass.sm} items-center ${className}`}>
      <input
        type="radio"
        className="peer sr-only"
        name={name ?? groupName}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span aria-hidden="true" className={`${boxBase} rounded-full ${boxState(checked)}`}>
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-fg-inverse" />}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  )
}

const legendClass = 'block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5'

interface RadioGroupProps<T extends string> {
  legend: string
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: ReactNode }[]
  className?: string
  /** Classes for the row of radios (default: a wrapping row, 16px apart). */
  optionsClassName?: string
}

/** A labelled set of radios: <fieldset> + <legend>, so the question is read
 *  out with each choice, and one shared `name` for arrow-key movement. */
export function RadioGroup<T extends string>({
  legend,
  value,
  onChange,
  options,
  className = '',
  optionsClassName = 'flex flex-wrap gap-4',
}: RadioGroupProps<T>) {
  const name = useId()
  return (
    <fieldset className={className}>
      <legend className={legendClass}>{legend}</legend>
      <RadioNameContext.Provider value={name}>
        <div className={optionsClassName}>
          {options.map((o) => (
            <Radio key={o.value} checked={value === o.value} onChange={() => onChange(o.value)}>
              {o.label}
            </Radio>
          ))}
        </div>
      </RadioNameContext.Provider>
    </fieldset>
  )
}
