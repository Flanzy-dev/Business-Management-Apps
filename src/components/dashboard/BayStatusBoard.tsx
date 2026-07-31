import { CheckCircle, Wrench, Clock, AlertTriangle, Car, User } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'

interface BayData {
  id: string
  name: string
  status: 'available' | 'in-service' | 'inspection' | 'awaiting-parts'
  vehicleInfo?: string
  workerName?: string
}

interface BayStatusBoardProps {
  bays: BayData[]
  compact?: boolean
  className?: string
  /** Tiles are only rendered as clickable (real <button>, cursor, hover
   * state) when this is provided — a bare <div> styled as clickable with no
   * handler is a false affordance, worse for keyboard/screen-reader users
   * than for mouse users since it isn't focusable either way. */
  onSelectBay?: (bayId: string) => void
}

const STATUS_CONFIG = {
  available: { labelKey: 'statusAvailable', color: 'bg-success', textColor: 'text-success', icon: CheckCircle },
  'in-service': { labelKey: 'statusInService', color: 'bg-accent', textColor: 'text-accent', icon: Wrench },
  inspection: { labelKey: 'statusInspection', color: 'bg-info', textColor: 'text-info', icon: Clock },
  'awaiting-parts': { labelKey: 'statusAwaitingParts', color: 'bg-danger', textColor: 'text-danger', icon: AlertTriangle },
}

export function BayStatusBoard({ bays, compact = false, className = '', onSelectBay }: BayStatusBoardProps) {
  const { t } = useTranslation()
  if (compact) {
    return (
      <div className={`grid grid-cols-4 gap-2 ${className}`}>
        {bays.map(bay => {
          const config = STATUS_CONFIG[bay.status]
          const Icon = config.icon
          const label = t(`bays.${config.labelKey}`)
          const Tile = onSelectBay ? 'button' : 'div'
          return (
            <Tile
              key={bay.id}
              type={onSelectBay ? 'button' : undefined}
              onClick={onSelectBay ? () => onSelectBay(bay.id) : undefined}
              className={`flex flex-col items-center p-3 bg-surface-sunken rounded-radius-sm min-h-[44px] min-w-[44px] transition-colors ${
                onSelectBay ? 'cursor-pointer hover:bg-surface-card focus-ring' : ''
              }`}
              title={`${bay.name}: ${label}`}
            >
              <div className={`w-8 h-8 rounded-radius-sm ${config.color}/20 flex items-center justify-center mb-1`}>
                <Icon size={16} className={config.textColor} />
              </div>
              <span className="text-xs text-text-secondary">{bay.name}</span>
            </Tile>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {bays.map(bay => {
        const config = STATUS_CONFIG[bay.status]
        const Icon = config.icon
        const Tile = onSelectBay ? 'button' : 'div'
        return (
          <Tile
            key={bay.id}
            type={onSelectBay ? 'button' : undefined}
            onClick={onSelectBay ? () => onSelectBay(bay.id) : undefined}
            className={`p-4 rounded-radius-sm border min-h-[44px] text-left transition-colors ${
              onSelectBay ? 'cursor-pointer hover:border-accent/30 focus-ring' : ''
            } ${
              bay.status === 'awaiting-parts' ? 'border-danger/30 bg-danger-muted' : 'border-transparent bg-surface-sunken'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-text-primary">{bay.name}</span>
              <div className={`w-6 h-6 rounded ${config.color}/20 flex items-center justify-center`}>
                <Icon size={14} className={config.textColor} />
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-radius-full ${config.color}/20`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
              <span className={`text-xs font-medium ${config.textColor}`}>{t(`bays.${config.labelKey}`)}</span>
            </div>
            {bay.vehicleInfo && (
              <div className="flex items-center gap-1.5 mt-2 text-caption">
                <Car size={12} />
                <span className="truncate">{bay.vehicleInfo}</span>
              </div>
            )}
            {bay.workerName && (
              <div className="flex items-center gap-1.5 mt-1 text-caption">
                <User size={12} />
                <span>{bay.workerName}</span>
              </div>
            )}
          </Tile>
        )
      })}
    </div>
  )
}
