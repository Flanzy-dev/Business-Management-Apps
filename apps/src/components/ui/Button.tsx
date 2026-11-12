import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg' | 'touch'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  /** Shows a spinning icon in place of `icon` and disables the button while
   *  an action runs. */
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-fg-inverse hover:bg-accent-hover active:bg-accent-active',
  secondary: 'bg-bg-3 text-fg-1 border border-border-2 hover:bg-bg-4 hover:border-border-3 active:bg-bg-4',
  ghost: 'bg-transparent text-fg-2 hover:bg-bg-3 hover:text-fg-1 active:bg-bg-4',
  // fg-inverse, not DESIGN_SYSTEM.md's #fff: white on --danger is 3.37:1 (fails WCAG AA
  // 4.5:1 for 13px text); the dark ink is 5.80:1.
  danger: 'bg-danger text-fg-inverse hover:brightness-110 active:brightness-95',
  // A text action ("View all"): amber text, no box.
  link: 'bg-transparent text-accent hover:underline underline-offset-2',
}

// `touch` is not part of DESIGN_SYSTEM.md's size scale — kept as an addition for
// shop-floor tablet use (44px min touch target), not a spec deviation.
const sizeStyles: Record<ButtonSize, { button: string; icon: number }> = {
  // `coarse:h-[44px]` lifts every size to the touch minimum on touch screens
  // only (see the `coarse` variant in config/tailwind.config.mjs).
  sm: { button: 'h-[28px] coarse:h-[44px] px-[10px] text-xs gap-1.5', icon: 14 },
  md: { button: 'h-[34px] coarse:h-[44px] px-[14px] text-sm gap-1.5', icon: 16 },
  lg: { button: 'h-[40px] coarse:h-[44px] px-[18px] text-md gap-2', icon: 18 },
  touch: { button: 'px-6 py-3 text-lg gap-2 min-h-[44px] min-w-[44px]', icon: 20 },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon: Icon, iconPosition = 'left', loading = false, children, className = '', disabled: disabledProp, type = 'button', ...props }, ref) => {
    const disabled = disabledProp || loading
    const iconElement = loading
      ? <Loader2 size={sizeStyles[size].icon} className="animate-spin" aria-hidden="true" />
      : Icon && <Icon size={sizeStyles[size].icon} />

    return (
      <button
        ref={ref}
        type={type}
        className={`
          inline-flex items-center justify-center font-[540] rounded-radius-sm focus-ring
          transition-colors duration-fast ease-out
          ${variantStyles[variant]}
          ${sizeStyles[size].button}
          ${disabled ? 'opacity-45 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
          ${className}
        `}
        disabled={disabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {iconPosition === 'left' && iconElement}
        {children}
        {iconPosition === 'right' && iconElement}
      </button>
    )
  }
)

Button.displayName = 'Button'
