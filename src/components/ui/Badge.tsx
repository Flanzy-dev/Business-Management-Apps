import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-sunken text-text-secondary',
  success: 'bg-accent-mint/20 text-accent-mint',
  warning: 'bg-accent-amber/20 text-accent-amber',
  danger: 'bg-accent-critical/20 text-accent-critical',
  info: 'bg-accent-blue/20 text-accent-blue',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-pill ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusVariantMap: Record<string, BadgeVariant> = {
  // Work order statuses
  open: 'warning',
  completed: 'success',
  cancelled: 'danger',
  // Bay statuses
  available: 'success',
  'in-service': 'warning',
  inspection: 'info',
  'awaiting-parts': 'danger',
  // Appointment statuses
  scheduled: 'info',
  arrived: 'warning',
  'in-progress': 'warning',
  'no-show': 'danger',
  // Worker status
  active: 'success',
  inactive: 'default',
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const variant = statusVariantMap[status.toLowerCase()] || 'default'
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')

  return (
    <Badge variant={variant} className={className}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        variant === 'success' ? 'bg-accent-mint' :
        variant === 'warning' ? 'bg-accent-amber' :
        variant === 'danger' ? 'bg-accent-critical' :
        variant === 'info' ? 'bg-accent-blue' :
        'bg-text-secondary'
      }`} />
      {label}
    </Badge>
  )
}
