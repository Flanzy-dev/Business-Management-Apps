import { InputHTMLAttributes, ReactNode, forwardRef, useId, useState } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Guidance shown below the field — the length rule on a new password, say.
   *  Occupies the same line as `error`, and `error` wins when both are set,
   *  per DESIGN_SYSTEM.md §2: "hint/error line below: --text-xs, --danger if error
   *  else --fg-3". Specced there from the start; simply never implemented
   *  until a form needed to state a rule before it was broken. */
  hint?: string
  /** Adds an eye button that flips this field between password and plain
   *  text. The component owns the revealed state — a caller passing
   *  `type="password"` gets the toggle handled for it (see the render). */
  revealToggle?: boolean
  mono?: boolean
  /** An icon inside the field's left edge — a search box's magnifier. */
  leadingIcon?: LucideIcon
  /** A control inside the field's right edge — a search box's clear button. */
  trailing?: ReactNode
}

// focus-ring (not focus:border-accent+shadow) to match Button/IconButton's
// convention exactly: keyboard focus shows the ring, mouse-click focus
// doesn't (see .focus-ring in index.css) — was inconsistent per-field before.
// `coarse:` (config/tailwind.config.mjs) lifts the field to the 44px touch minimum on
// touch screens only; a mouse keeps DESIGN_SYSTEM.md's 34px.
const fieldBase = `
  w-full h-[34px] coarse:h-[44px] px-[10px]
  bg-surface-input border rounded-radius-sm
  text-fg-1 text-sm placeholder-fg-3
  focus-ring
  disabled:opacity-45 disabled:cursor-not-allowed
`

const labelClass = 'block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5'

/** Wiring that makes a label, its field and the hint/error line one unit for
 *  assistive tech: the label's `for`, the field's `id`, `aria-invalid`, and an
 *  `aria-describedby` pointing at the message line below. */
function useFieldWiring(idProp: string | undefined, error?: string, hint?: string) {
  const autoId = useId()
  const id = idProp ?? autoId
  const messageId = `${id}-message`
  return {
    id,
    messageId,
    fieldAria: {
      'aria-invalid': error ? (true as const) : undefined,
      'aria-describedby': error || hint ? messageId : undefined,
    },
  }
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, revealToggle = false, mono = false, leadingIcon: LeadingIcon, trailing, className = '', type, id: idProp, ...props }, ref) => {
    const { t } = useTranslation()
    const [revealed, setRevealed] = useState(false)
    const { id, messageId, fieldAria } = useFieldWiring(idProp, error, hint)
    // `type` is destructured out of props above on purpose: left in the
    // spread it would be re-applied after this line and pin the field to
    // password, making the toggle look broken while changing nothing.
    const resolvedType = revealToggle ? (revealed ? 'text' : 'password') : type

    const field = (
      <input
        ref={ref}
        id={id}
        type={resolvedType}
        aria-required={props.required ? true : undefined}
        {...fieldAria}
        className={`
          ${fieldBase}
          ${mono ? 'font-mono' : ''}
          ${revealToggle || trailing ? 'pr-9' : ''}
          ${LeadingIcon ? 'pl-9' : ''}
          ${error ? 'border-danger' : 'border-border-2'}
          ${className}
        `}
        {...props}
      />
    )

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        )}
        {revealToggle || LeadingIcon || trailing ? (
          // Same composition Select below already uses for its chevron: only
          // the control is wrapped, so the label above and the hint/error
          // below keep their existing position in the column.
          <div className="relative">
            {LeadingIcon && (
              <LeadingIcon size={16} aria-hidden="true" className="absolute left-[10px] top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
            )}
            {field}
            {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2 flex">{trailing}</div>}
            {revealToggle && <button
              type="button"
              onClick={() => setRevealed((shown) => !shown)}
              // Left in the tab order deliberately — reaching the reveal by
              // keyboard is exactly what someone who mistyped a password
              // wants, and it is what ordinary applications do.
              aria-label={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
              title={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg-2 transition-colors duration-fast ease-out focus-ring rounded-radius-xs"
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>}
          </div>
        ) : (
          field
        )}
        {error ? (
          <p id={messageId} role="alert" className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p id={messageId} className="mt-1 text-xs text-fg-3">{hint}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id: idProp, ...props }, ref) => {
    const { id, messageId, fieldAria } = useFieldWiring(idProp, error)
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          aria-required={props.required ? true : undefined}
          {...fieldAria}
          className={`
            w-full px-[10px] py-2
            bg-surface-input border rounded-radius-sm
            text-fg-1 text-sm placeholder-fg-3
            focus-ring
            disabled:opacity-45 disabled:cursor-not-allowed
            ${error ? 'border-danger' : 'border-border-2'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={messageId} role="alert" className="mt-1 text-xs text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  /** A line of help under the field, same as Input's. Replaced by `error` when there is one. */
  hint?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, children, className = '', id: idProp, ...props }, ref) => {
    const { id, messageId, fieldAria } = useFieldWiring(idProp, error, hint)
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-required={props.required ? true : undefined}
            {...fieldAria}
            className={`
              ${fieldBase}
              appearance-none pr-8
              ${error ? 'border-danger' : 'border-border-2'}
              ${className}
            `}
            {...props}
          >
            {children}
          </select>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {error ? (
          <p id={messageId} role="alert" className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p id={messageId} className="mt-1 text-xs text-fg-3">{hint}</p>
        ) : null}
      </div>
    )
  }
)

Select.displayName = 'Select'
