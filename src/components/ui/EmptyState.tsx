import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  message?: string
  action?: ReactNode
}

/**
 * Rich empty state (icon + heading + copy + optional action) — the pattern
 * from the Bays page, shared so list pages don't fall back to a bare line.
 */
export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="bg-surface-card rounded-radius-md p-12 text-center">
      <Icon size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
      <h2 className="text-lg font-medium text-text-primary mb-2">{title}</h2>
      {message && <p className="text-text-secondary max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
