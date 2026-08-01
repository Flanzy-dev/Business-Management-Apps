import { LucideIcon } from 'lucide-react'
import { SunkenTile } from '../ui/SunkenTile'
import { useTranslation } from '../../lib/i18n'

type DeltaTone = 'up' | 'down' | 'neutral'

interface StatCardProps {
  title: string
  value: string
  unit?: string
  icon: LucideIcon
  delta?: number
  deltaTone?: DeltaTone
  deltaLabel?: string
  hint?: string
  className?: string
}

const deltaToneClass: Record<DeltaTone, string> = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-fg-3',
}

export function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  delta,
  deltaTone,
  deltaLabel,
  hint,
  className = '',
}: StatCardProps) {
  const { t } = useTranslation()
  const resolvedDeltaLabel = deltaLabel ?? t('dashboardWidgets.vsYesterday')
  // deltaTone defaults to sign-derived when omitted, but callers can override it
  // for "bad-direction" metrics (e.g. an increase in vehicles-due is a bad sign) —
  // see DESIGN.md §5.1's "Vehicles due 7d" example: preserve the semantic, not
  // the literal sign.
  const resolvedTone: DeltaTone | undefined =
    deltaTone ?? (delta === undefined ? undefined : delta >= 0 ? 'up' : 'down')
  const deltaPrefix = delta !== undefined && delta > 0 ? '+' : ''

  return (
    <SunkenTile className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl text-fg-1 leading-none">{value}</span>
            {unit && <span className="font-mono text-sm text-fg-3">{unit}</span>}
          </div>
          {(resolvedDeltaLabel || hint) && (
            <p className="text-xs text-fg-3 mt-1">{hint ?? resolvedDeltaLabel}</p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-radius-sm bg-accent-muted flex items-center justify-center">
            <Icon size={20} className="text-accent" />
          </div>
          {delta !== undefined && resolvedTone && (
            <span className={`font-mono text-xs ${deltaToneClass[resolvedTone]}`}>
              {deltaPrefix}{delta}%
            </span>
          )}
        </div>
      </div>
    </SunkenTile>
  )
}
