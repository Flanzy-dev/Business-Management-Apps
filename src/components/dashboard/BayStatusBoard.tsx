import { CheckCircle, Wrench, Clock, AlertTriangle, Car, User } from 'lucide-react'

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
}

const STATUS_CONFIG = {
  available: { label: 'Available', color: 'bg-accent-mint', textColor: 'text-accent-mint', icon: CheckCircle },
  'in-service': { label: 'In Service', color: 'bg-accent-amber', textColor: 'text-accent-amber', icon: Wrench },
  inspection: { label: 'Inspection', color: 'bg-accent-blue', textColor: 'text-accent-blue', icon: Clock },
  'awaiting-parts': { label: 'Awaiting Parts', color: 'bg-accent-critical', textColor: 'text-accent-critical', icon: AlertTriangle },
}

export function BayStatusBoard({ bays, compact = false, className = '' }: BayStatusBoardProps) {
  if (compact) {
    return (
      <div className={`grid grid-cols-4 gap-2 ${className}`}>
        {bays.map(bay => {
          const config = STATUS_CONFIG[bay.status]
          const Icon = config.icon
          return (
            <div
              key={bay.id}
              className="flex flex-col items-center p-3 bg-surface-sunken rounded-tile min-h-[44px] min-w-[44px] cursor-pointer hover:bg-surface-card transition-colors"
              title={`${bay.name}: ${config.label}`}
            >
              <div className={`w-8 h-8 rounded-tile ${config.color}/20 flex items-center justify-center mb-1`}>
                <Icon size={16} className={config.textColor} />
              </div>
              <span className="text-xs text-text-secondary">{bay.name}</span>
            </div>
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
        return (
          <div
            key={bay.id}
            className={`p-4 rounded-tile border min-h-[44px] cursor-pointer hover:border-accent-mint/30 transition-colors ${
              bay.status === 'awaiting-parts' ? 'border-accent-critical/30 bg-accent-critical-bg' : 'border-transparent bg-surface-sunken'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-text-primary">{bay.name}</span>
              <div className={`w-6 h-6 rounded ${config.color}/20 flex items-center justify-center`}>
                <Icon size={14} className={config.textColor} />
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill ${config.color}/20`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
              <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
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
          </div>
        )
      })}
    </div>
  )
}
