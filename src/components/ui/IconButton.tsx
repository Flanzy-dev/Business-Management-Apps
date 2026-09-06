import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'

type IconButtonSize = 'sm' | 'md' | 'lg' | 'touch'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  size?: IconButtonSize
  active?: boolean
  label: string
  children: ReactNode
}

// `touch` is not part of DESIGN.md's size scale — kept as an addition for
// shop-floor tablet use (44px min touch target), same as Button.tsx's own
// `touch` size. Unlike Button, IconButton doesn't own its icon's size (the
// icon is passed in as `children`), so a `touch` call site must bump its own
// icon size too — see Button.tsx's sizeStyles for the 14->20 progression
// this mirrors.
const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-[28px] h-[28px]',
  md: 'w-[34px] h-[34px]',
  lg: 'w-[40px] h-[40px]',
  touch: 'w-[44px] h-[44px]',
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
