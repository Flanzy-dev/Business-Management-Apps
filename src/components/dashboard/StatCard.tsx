import { LucideIcon } from 'lucide-react'
import { SunkenTile } from '../ui/SunkenTile'
import { useTranslation } from '../../lib/i18n'
import type { DeltaTone } from '../../lib/statCard'
import { StatCardDelta } from './StatCardDelta'

interface StatCardProps {
  title: string
  value: string
  unit?: string
  icon: LucideIcon
  /** null = no prior-period baseline to compare against (see finance.ts's
   *  pctDelta) — renders as no delta at all, distinct from an actual 0%. */
  delta?: number | null
  deltaTone?: DeltaTone
  deltaLabel?: string
  hint?: string
  className?: string
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
          <StatCardDelta delta={delta} tone={deltaTone} />
        </div>
      </div>
    </SunkenTile>
  )
}
