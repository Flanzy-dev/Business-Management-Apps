import { User, Clock, Wrench, CheckCircle } from 'lucide-react'

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
  const availableCount = technicians.filter(t => t.status === 'available').length
  const busyCount = technicians.filter(t => t.status === 'busy').length

  return (
    <div className={className}>
      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-mint" />
          <span className="text-caption">{availableCount} available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-amber" />
          <span className="text-caption">{busyCount} busy</span>
        </div>
      </div>

      {/* Technician List */}
      <div className="space-y-2">
        {technicians.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
            <User size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No technicians on shift</p>
          </div>
        ) : (
          technicians.map(tech => (
            <div
              key={tech.id}
              className={`flex items-center gap-3 p-3 rounded-tile ${
                tech.status === 'available' ? 'bg-surface-sunken' : 'bg-accent-amber/10'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                tech.status === 'available'
                  ? 'bg-accent-mint/20'
                  : 'bg-accent-amber/20'
              }`}>
                <User size={18} className={
                  tech.status === 'available' ? 'text-accent-mint' : 'text-accent-amber'
                } />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {tech.name}
                  </span>
                  {tech.status === 'available' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-accent-mint/20 text-accent-mint text-xs">
                      <CheckCircle size={10} />
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-accent-amber/20 text-accent-amber text-xs">
                      <Wrench size={10} />
                      Busy
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
                    {tech.progress !== undefined && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-amber rounded-full transition-all duration-500"
                            style={{ width: `${tech.progress}%` }}
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
                  <span className="tabular-nums">{tech.timeRemaining}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
