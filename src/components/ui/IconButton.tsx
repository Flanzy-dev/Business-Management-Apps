import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'

type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  size?: IconButtonSize
  active?: boolean
  label: string
  children: ReactNode
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-[28px] h-[28px]',
  md: 'w-[34px] h-[34px]',
  lg: 'w-[40px] h-[40px]',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', active = false, label, children, className = '', disabled, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center rounded-radius-md focus-ring
          transition-colors duration-fast ease-out
          ${sizeStyles[size]}
          ${active ? 'bg-accent-muted text-accent' : 'bg-transparent text-fg-2 hover:bg-bg-3 hover:text-fg-1'}
          ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
