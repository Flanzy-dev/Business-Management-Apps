import { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  dot?: boolean
  className?: string
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-bg-4 text-fg-2',
  accent: 'bg-accent-muted text-accent',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  info: 'bg-info-muted text-info',
}

export function Badge({ children, tone = 'neutral', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-radius-full text-2xs font-semibold uppercase tracking-wide ${toneStyles[tone]} ${className}`}
    >
      {dot && <span className="w-[5px] h-[5px] rounded-full bg-current" />}
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: string
  /** Overrides the derived (capitalised, raw-status) text — pass a translated
   *  label, e.g. from src/lib/entities.ts's orderStatusLabel. */
  label?: string
  className?: string
}

// Note: warning and accent are the same amber (#ffb224) by palette design, so
// statuses that can appear side by side must never use one of each — treat
// warning/accent as a single color when assigning tones here.
const statusToneMap: Record<string, BadgeTone> = {
  // Work order statuses — open is info (blue), not amber, so an "Open" badge
  // stays distinguishable from amber "In service" bay chips on the Dashboard.
  open: 'info',
  completed: 'success',
  cancelled: 'danger',
  // Completed-but-unpaid display status (see receivables.ts's
  // orderDisplayStatus) — neutral so it never collides with the amber
  // due-soon/overdue receivable badge shown beside it (warning and accent
  // are the same amber by palette design, see the note above).
  pending: 'neutral',
  // Bay statuses
  available: 'success',
  'in-service': 'accent',
  inspection: 'info',
  'awaiting-parts': 'danger',
  // Appointment statuses — arrived is neutral (waiting), so it doesn't
  // collide with the amber in-progress in the same list.
  scheduled: 'info',
  arrived: 'neutral',
  'in-progress': 'accent',
  'no-show': 'danger',
  // Worker status
  active: 'success',
  inactive: 'neutral',
  // Vehicle due status (DESIGN.md §5.3)
  'due soon': 'warning',
  overdue: 'danger',
  'on track': 'neutral',
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const tone = statusToneMap[status.toLowerCase()] || 'neutral'
  const text = label ?? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')

  return (
    <Badge tone={tone} dot className={className}>
      {text}
    </Badge>
  )
}
