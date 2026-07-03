import { LucideIcon } from 'lucide-react'
import { SunkenTile } from '../ui/SunkenTile'

interface KPITileProps {
  title: string
  value: string
  icon: LucideIcon
  delta?: number
  deltaLabel?: string
  className?: string
}

export function KPITile({ title, value, icon: Icon, delta, deltaLabel = 'vs yesterday', className = '' }: KPITileProps) {
  const isPositive = delta !== undefined && delta >= 0
  const deltaColor = delta === undefined ? '' : isPositive ? 'text-accent-mint' : 'text-accent-critical'
  const deltaPrefix = delta !== undefined && delta > 0 ? '+' : ''

  return (
    <SunkenTile className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-caption mb-1">{title}</p>
          <p className="text-kpi text-text-primary">{value}</p>
          {delta !== undefined && (
            <p className={`text-sm mt-1 ${deltaColor}`}>
              {deltaPrefix}{delta}% <span className="text-text-secondary">{deltaLabel}</span>
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-tile bg-accent-mint/20 flex items-center justify-center">
          <Icon size={20} className="text-accent-mint" />
        </div>
      </div>
    </SunkenTile>
  )
}
