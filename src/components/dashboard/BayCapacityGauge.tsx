import { chartTheme } from '../../lib/chartTheme'
import { useTranslation } from '../../lib/i18n'

interface BayCapacityGaugeProps {
  percentage: number
  className?: string
  // Opt-in traffic-light recoloring (mint<70% / amber 70-90% / red >=90%) from
  // the pre-rebrand gauge. DESIGN.md's spec wants a flat accent ring always;
  // this is kept as an explicit, disabled-by-default escape hatch rather than
  // deleted, since shop-floor capacity going critical is useful signal.
  severityRamp?: boolean
}

const RADIUS = 66
const STROKE = 14
const SIZE = 168
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function severityColor(pct: number): string {
  if (pct >= 90) return chartTheme.danger
  if (pct >= 70) return chartTheme.warning
  return chartTheme.accent
}

export function BayCapacityGauge({ percentage, className = '', severityRamp = false }: BayCapacityGaugeProps) {
  const { t } = useTranslation()
  const clamped = Math.max(0, Math.min(100, percentage))
  const dash = CIRCUMFERENCE * (clamped / 100)
  const ringColor = severityRamp ? severityColor(clamped) : chartTheme.accent

  return (
    <div className={`relative flex items-center justify-center mx-auto ${className}`} style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--bg-4)" strokeWidth={STROKE} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[38px] leading-none text-fg-1 tabular-nums">
          {Math.round(clamped)}
          <span className="text-[18px] text-fg-3">%</span>
        </span>
        <span className="text-2xs uppercase tracking-wide text-fg-3 mt-1">{t('dashboardWidgets.booked')}</span>
      </div>
    </div>
  )
}
