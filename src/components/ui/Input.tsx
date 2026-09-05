import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Guidance shown below the field — the length rule on a new password, say.
   *  Occupies the same line as `error`, and `error` wins when both are set,
   *  per DESIGN.md §2: "hint/error line below: --text-xs, --danger if error
   *  else --fg-3". Specced there from the start; simply never implemented
   *  until a form needed to state a rule before it was broken. */
  hint?: string
  /** Adds an eye button that flips this field between password and plain
   *  text. The component owns the revealed state — a caller passing
   *  `type="password"` gets the toggle handled for it (see the render). */
  revealToggle?: boolean
  mono?: boolean
}

// focus-ring (not focus:border-accent+shadow) to match Button/IconButton's
// convention exactly: keyboard focus shows the ring, mouse-click focus
// doesn't (see .focus-ring in index.css) — was inconsistent per-field before.
const fieldBase = `
  w-full h-[34px] px-[10px]
  bg-surface-input border rounded-radius-sm
  text-fg-1 text-sm placeholder-fg-3
  focus-ring
  disabled:opacity-45 disabled:cursor-not-allowed
`

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, revealToggle = false, mono = false, className = '', type, ...props }, ref) => {
    const { t } = useTranslation()
    const [revealed, setRevealed] = useState(false)
    // `type` is destructured out of props above on purpose: left in the
    // spread it would be re-applied after this line and pin the field to
    // password, making the toggle look broken while changing nothing.
    const resolvedType = revealToggle ? (revealed ? 'text' : 'password') : type

    const field = (
      <input
        ref={ref}
        type={resolvedType}
        className={`
          ${fieldBase}
          ${mono ? 'font-mono' : ''}
          ${revealToggle ? 'pr-9' : ''}
          ${error ? 'border-danger' : 'border-border-2'}
          ${className}
        `}
        {...props}
      />
    )

    return (
      <div className="w-full">
        {label && (
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {label}
          </label>
        )}
        {revealToggle ? (
          // Same composition Select below already uses for its chevron: only
          // the control is wrapped, so the label above and the hint/error
          // below keep their existing position in the column.
          <div className="relative">
            {field}
            <button
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
            </button>
          </div>
        ) : (
          field
        )}
        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-fg-3">{hint}</p>
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
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
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
          <p className="mt-1 text-xs text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {error && (
          <p className="mt-1 text-xs text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
