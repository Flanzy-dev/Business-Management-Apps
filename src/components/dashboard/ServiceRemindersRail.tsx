import type { ReactNode } from 'react'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { VehicleReminder } from '../../lib/reminders'
import { formatDueDescription, partitionByTone } from '../../lib/reminders'
import { vehicleLabelWithPlate } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'

interface ServiceRemindersRailProps {
  reminders: VehicleReminder[]
  getOwnerName: (vehicle: Vehicle) => string
  /** Translated label for a service item type id — same lookup Reminders.tsx
   *  builds via itemTypeNameLookup, so "what's due" reads the same everywhere. */
  itemTypeName: (id: string) => string
  /** Opens that vehicle's service history in place — see Dashboard.tsx, which
   *  renders VehicleServiceHistoryDialog the same way Vehicles.tsx does. */
  onSelectVehicle?: (vehicle: Vehicle) => void
  onViewAll?: () => void
  className?: string
}

export function ServiceRemindersRail({ reminders, getOwnerName, itemTypeName, onSelectVehicle, onViewAll, className = '' }: ServiceRemindersRailProps) {
  const { t } = useTranslation()
  const { overdue, dueSoon } = partitionByTone(reminders)

  const dueDescription = (r: VehicleReminder) => formatDueDescription(r.status.lines, itemTypeName)

  const row = (r: VehicleReminder, icon: ReactNode, tone: string) => (
    <div
      key={r.vehicle.id}
      role={onSelectVehicle ? 'button' : undefined}
      tabIndex={onSelectVehicle ? 0 : undefined}
      onClick={onSelectVehicle ? () => onSelectVehicle(r.vehicle) : undefined}
      onKeyDown={onSelectVehicle ? (e) => { if (e.key === 'Enter') onSelectVehicle(r.vehicle) } : undefined}
      className={`flex items-center gap-3 p-3 rounded-radius-sm ${tone} ${onSelectVehicle ? 'cursor-pointer hover:brightness-110 transition-[filter] focus-ring' : ''}`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{vehicleLabelWithPlate(r.vehicle)}</p>
        <p className="text-caption truncate">{getOwnerName(r.vehicle)}</p>
        <p className="text-caption truncate">{dueDescription(r)}</p>
      </div>
    </div>
  )

  return (
    <div className={className}>
      {reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
          <CalendarClock size={32} className="mb-2 opacity-50" />
          <p className="text-sm">{t('dashboardWidgets.allVehiclesOnTrack')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overdue.map((r) => row(r, <AlertTriangle size={16} className="text-danger shrink-0" />, 'bg-danger-muted border border-danger/30'))}
          {dueSoon.map((r) => row(r, <CalendarClock size={16} className="text-warning shrink-0" />, 'bg-surface-sunken'))}
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
