import { ButtonHTMLAttributes, forwardRef } from 'react'
import { LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'touch'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-fg-inverse hover:bg-accent-hover active:bg-accent-active',
  secondary: 'bg-bg-3 text-fg-1 border border-border-2 hover:bg-bg-4 hover:border-border-3 active:bg-bg-4',
  ghost: 'bg-transparent text-fg-2 hover:bg-bg-3 hover:text-fg-1 active:bg-bg-4',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
}

// `touch` is not part of DESIGN.md's size scale — kept as an addition for
// shop-floor tablet use (44px min touch target), not a spec deviation.
const sizeStyles: Record<ButtonSize, { button: string; icon: number }> = {
  sm: { button: 'h-[28px] px-[10px] text-xs gap-1.5', icon: 14 },
  md: { button: 'h-[34px] px-[14px] text-sm gap-1.5', icon: 16 },
  lg: { button: 'h-[40px] px-[18px] text-md gap-2', icon: 18 },
  touch: { button: 'px-6 py-3 text-base gap-2 min-h-[44px] min-w-[44px]', icon: 20 },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon: Icon, iconPosition = 'left', children, className = '', disabled, ...props }, ref) => {
    const iconElement = Icon && <Icon size={sizeStyles[size].icon} />

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center font-[540] rounded-radius-md focus-ring
          transition-colors duration-fast ease-out
          ${variantStyles[variant]}
          ${sizeStyles[size].button}
          ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        disabled={disabled}
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
