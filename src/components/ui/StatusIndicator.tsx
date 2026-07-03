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
  available: { color: 'text-accent-mint', bgColor: 'bg-accent-mint/20', dotColor: 'bg-accent-mint' },
  success: { color: 'text-accent-mint', bgColor: 'bg-accent-mint/20', dotColor: 'bg-accent-mint' },
  'in-progress': { color: 'text-accent-amber', bgColor: 'bg-accent-amber/20', dotColor: 'bg-accent-amber' },
  warning: { color: 'text-accent-amber', bgColor: 'bg-accent-amber/20', dotColor: 'bg-accent-amber' },
  'on-hold': { color: 'text-accent-blue', bgColor: 'bg-accent-blue/20', dotColor: 'bg-accent-blue' },
  info: { color: 'text-accent-blue', bgColor: 'bg-accent-blue/20', dotColor: 'bg-accent-blue' },
  'awaiting-parts': { color: 'text-accent-critical', bgColor: 'bg-accent-critical/20', dotColor: 'bg-accent-critical' },
  danger: { color: 'text-accent-critical', bgColor: 'bg-accent-critical/20', dotColor: 'bg-accent-critical' },
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
      className={`inline-flex items-center rounded-pill ${sizes.container} ${config.bgColor} ${className}`}
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
