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
  primary: 'bg-accent-mint text-surface-canvas hover:opacity-90',
  secondary: 'bg-surface-sunken text-text-primary border border-border-subtle hover:border-accent-mint/50',
  danger: 'bg-accent-critical text-white hover:opacity-90',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-sunken',
}

const sizeStyles: Record<ButtonSize, { button: string; icon: number }> = {
  sm: { button: 'px-3 py-1.5 text-sm gap-1.5', icon: 14 },
  md: { button: 'px-4 py-2 text-sm gap-2', icon: 16 },
  lg: { button: 'px-6 py-3 text-base gap-2', icon: 18 },
  touch: { button: 'px-6 py-3 text-base gap-2 min-h-[44px] min-w-[44px]', icon: 20 },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon: Icon, iconPosition = 'left', children, className = '', disabled, ...props }, ref) => {
    const iconElement = Icon && <Icon size={sizeStyles[size].icon} />

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center font-medium rounded-tile transition-all
          ${variantStyles[variant]}
          ${sizeStyles[size].button}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
