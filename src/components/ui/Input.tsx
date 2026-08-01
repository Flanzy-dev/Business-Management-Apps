import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
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
  ({ label, error, mono = false, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            ${fieldBase}
            ${mono ? 'font-mono' : ''}
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
