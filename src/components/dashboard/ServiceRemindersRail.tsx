import { AlertTriangle, CalendarClock } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { VehicleReminder } from '../../lib/reminders'
import { vehicleLabelWithPlate } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'

interface ServiceRemindersRailProps {
  reminders: VehicleReminder[]
  getOwnerName: (vehicle: Vehicle) => string
  onViewAll?: () => void
  className?: string
}

export function ServiceRemindersRail({ reminders, getOwnerName, onViewAll, className = '' }: ServiceRemindersRailProps) {
  const { t } = useTranslation()
  const overdue = reminders.filter((r) => r.status.tone === 'overdue')
  const dueSoon = reminders.filter((r) => r.status.tone === 'due_soon')

  return (
    <div className={className}>
      {reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
          <CalendarClock size={32} className="mb-2 opacity-50" />
          <p className="text-sm">{t('dashboardWidgets.allVehiclesOnTrack')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overdue.map((r) => (
            <div key={r.vehicle.id} className="flex items-center gap-3 p-3 bg-danger-muted rounded-radius-sm border border-danger/30">
              <AlertTriangle size={16} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{vehicleLabelWithPlate(r.vehicle)}</p>
                <p className="text-caption truncate">{getOwnerName(r.vehicle)}</p>
              </div>
            </div>
          ))}
          {dueSoon.map((r) => (
            <div key={r.vehicle.id} className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
              <CalendarClock size={16} className="text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{vehicleLabelWithPlate(r.vehicle)}</p>
                <p className="text-caption truncate">{getOwnerName(r.vehicle)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {onViewAll && reminders.length > 0 && (
        <button onClick={onViewAll} className="w-full mt-3 py-2 text-sm text-accent hover:opacity-80 transition-opacity">
          {t('dashboardWidgets.viewReminders')}
        </button>
      )}
    </div>
  )
}
