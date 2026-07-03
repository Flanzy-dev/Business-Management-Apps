import { LucideIcon } from 'lucide-react'

type StatusType = 'available' | 'in-progress' | 'on-hold' | 'awaiting-parts' | 'success' | 'warning' | 'danger' | 'info'

interface StatusIndicatorProps {
  status: StatusType
  label: string
  icon?: LucideIcon
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<StatusType, { color: string; bgColor: string; dotColor: string }> = {
  available: { color: 'text-success', bgColor: 'bg-success-muted', dotColor: 'bg-success' },
  success: { color: 'text-success', bgColor: 'bg-success-muted', dotColor: 'bg-success' },
  'in-progress': { color: 'text-accent', bgColor: 'bg-accent-muted', dotColor: 'bg-accent' },
  warning: { color: 'text-warning', bgColor: 'bg-warning-muted', dotColor: 'bg-warning' },
  'on-hold': { color: 'text-info', bgColor: 'bg-info-muted', dotColor: 'bg-info' },
  info: { color: 'text-info', bgColor: 'bg-info-muted', dotColor: 'bg-info' },
  'awaiting-parts': { color: 'text-danger', bgColor: 'bg-danger-muted', dotColor: 'bg-danger' },
  danger: { color: 'text-danger', bgColor: 'bg-danger-muted', dotColor: 'bg-danger' },
}

const sizeConfig = {
  sm: { container: 'gap-1.5 px-2 py-1', dot: 'w-1.5 h-1.5', icon: 14, text: 'text-xs' },
  md: { container: 'gap-2 px-3 py-1.5', dot: 'w-2 h-2', icon: 16, text: 'text-sm' },
  lg: { container: 'gap-2.5 px-4 py-2', dot: 'w-2.5 h-2.5', icon: 18, text: 'text-base' },
}

export function StatusIndicator({ status, label, icon: Icon, size = 'md', className = '' }: StatusIndicatorProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]

  return (
    <div
      className={`inline-flex items-center rounded-radius-full ${sizes.container} ${config.bgColor} ${className}`}
    >
      {Icon ? (
        <Icon size={sizes.icon} className={config.color} />
      ) : (
        <span className={`rounded-full ${sizes.dot} ${config.dotColor}`} />
      )}
      <span className={`font-medium ${sizes.text} ${config.color}`}>{label}</span>
    </div>
  )
}
