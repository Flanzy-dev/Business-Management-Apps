import { User, Clock, Wrench, CheckCircle } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'

interface TechnicianData {
  id: string
  name: string
  status: 'available' | 'busy'
  bayName?: string
  vehicleInfo?: string
  timeRemaining?: string
  progress?: number // 0-100
}

interface TechnicianQueueProps {
  technicians: TechnicianData[]
  className?: string
}

export function TechnicianQueue({ technicians, className = '' }: TechnicianQueueProps) {
  const { t } = useTranslation()
  const availableCount = technicians.filter(tech => tech.status === 'available').length
  const busyCount = technicians.filter(tech => tech.status === 'busy').length

  return (
    <div className={className}>
      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-caption">{t('dashboardWidgets.nAvailable', { count: availableCount })}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-caption">{t('dashboardWidgets.nBusy', { count: busyCount })}</span>
        </div>
      </div>

      {/* Technician List */}
      <div className="space-y-2">
        {technicians.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
            <User size={32} className="mb-2 opacity-50" />
            <p className="text-sm">{t('dashboardWidgets.noTechniciansOnShift')}</p>
          </div>
        ) : (
          technicians.map(tech => {
            // Progress fill: accent if busy else fg-3 (DESIGN.md §5.1 technician queue)
            const clampedProgress = tech.progress === undefined ? undefined : Math.max(0, Math.min(100, tech.progress))
            return (
            <div
              key={tech.id}
              className={`flex items-center gap-3 p-3 rounded-radius-sm ${
                tech.status === 'available' ? 'bg-surface-sunken' : 'bg-accent-muted'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                tech.status === 'available'
                  ? 'bg-success-muted'
                  : 'bg-accent-muted'
              }`}>
                <User size={18} className={
                  tech.status === 'available' ? 'text-success' : 'text-accent'
                } />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {tech.name}
                  </span>
                  {tech.status === 'available' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-radius-full bg-success-muted text-success text-xs">
                      <CheckCircle size={10} />
                      {t('dashboardWidgets.available')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-radius-full bg-accent-muted text-accent text-xs">
                      <Wrench size={10} />
                      {t('dashboardWidgets.busy')}
                    </span>
                  )}
                </div>

                {tech.status === 'busy' && (
                  <div className="mt-1">
                    <div className="flex items-center gap-2 text-caption">
                      {tech.bayName && <span>{tech.bayName}</span>}
                      {tech.bayName && tech.vehicleInfo && <span>•</span>}
                      {tech.vehicleInfo && <span className="truncate">{tech.vehicleInfo}</span>}
                    </div>

                    {/* Progress bar */}
                    {clampedProgress !== undefined && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-bg-4 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${clampedProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Time Remaining */}
              {tech.status === 'busy' && tech.timeRemaining && (
                <div className="flex items-center gap-1.5 text-caption shrink-0">
                  <Clock size={14} />
                  <span className="font-mono tabular-nums">{tech.timeRemaining}</span>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
